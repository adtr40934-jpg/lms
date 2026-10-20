import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import { getBackendOrigin } from '../../utils/backendUrl';
import { getAssetUrl } from '../../utils/assetUrl';

function Orders() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const statusFilter = searchParams.get('status') || '';
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [singleOrder, setSingleOrder] = useState(null);

  const [customExpiryInput, setCustomExpiryInput] = useState('');
  const [adjustingDuration, setAdjustingDuration] = useState(false);

  useEffect(() => {
    if (singleOrder?.enrollment?.expires_at) {
      const d = new Date(singleOrder.enrollment.expires_at);
      setCustomExpiryInput(d.toISOString().split('T')[0]);
    } else {
      setCustomExpiryInput('');
    }
  }, [singleOrder]);

  const handleAdjustDuration = async (params) => {
    try {
      setAdjustingDuration(true);
      const res = await api.put(`/orders/admin/${id}/duration`, params);
      alert(res.message);
      fetchSingleOrder(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setAdjustingDuration(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchSingleOrder();
    } else {
      fetchOrders();
    }

    // Connect to backend Socket.IO for real-time live order updates
    const socket = io(getBackendOrigin(), {
      withCredentials: true,
      auth: { isAdmin: true }
    });

    socket.on('data_updated', () => {
      if (id) {
        fetchSingleOrder(true);
      } else {
        fetchOrders(true);
      }
    });

    const interval = setInterval(() => {
      if (id) {
        fetchSingleOrder(true);
      } else {
        fetchOrders(true);
      }
    }, 4000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [id, statusFilter]);

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/orders/admin${statusFilter ? `?status=${statusFilter}` : ''}`);
      setOrders(res.orders || []);
      setCounts(res.counts || { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchSingleOrder = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/orders/admin/${id}`);
      setSingleOrder(res.order);
    } catch (err) {
      console.error(err);
      if (!silent) setSingleOrder(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newStatus = fd.get('status');
    if (newStatus && singleOrder) {
      setSingleOrder(prev => prev ? { ...prev, status: newStatus } : null);
    }
    try {
      const res = await api.put(`/orders/admin/${id}/status`, Object.fromEntries(fd));
      alert(res.message);
      fetchSingleOrder(true);
    } catch (err) {
      alert(err.message);
    }
  };



  const handleDelete = () => {
    window.SwalConfirm('هل أنت متأكد من حذف الطلب نهائياً؟', async () => {
      try {
        const res = await api.delete(`/orders/admin/${id}`);
        await alert(res.message);
        navigate('/admin/orders');
      } catch (err) {
        alert(err.message);
      }
    });
  };

  if (loading) return <AdminLayout title="طلبات الاشتراك"><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  if (id) {
    const o = singleOrder;
    if (!o) return <AdminLayout title="الطلب غير موجود">الطلب غير موجود</AdminLayout>;
    
    return (
      <AdminLayout title={`طلب اشتراك #${id.slice(-6)}`}>
        <div className="grid-3">
          <div>
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-file-invoice"></i> تفاصيل الطلب</h2>
                <span className={`pill st-${o.status}`}>{o.status === 'pending' ? 'قيد المراجعة' : o.status === 'approved' ? 'مقبول' : 'مرفوض'}</span>
              </div>
              <div className="panel-body">
                <dl className="dl">
                  <dt>الاسم بالكامل</dt><dd>{o.full_name} {o.user && <Link to={`/admin/students?id=${o.user._id}`} className="pill p-blue">ملف الطالب</Link>}</dd>
                  <dt>رقم الموبايل</dt><dd><span className="ltr">{o.phone}</span> <a className="pill p-green" target="_blank" href={`https://wa.me/2${o.phone}`} rel="noreferrer"><i className="fa-brands fa-whatsapp"></i> واتساب</a></dd>
                  <dt>البريد الإلكتروني</dt><dd className="ltr">{o.email}</dd>
                  {o.order_type === 'track' || (o.track && !o.course) ? (
                    <>
                      <dt>نوع الطلب</dt>
                      <dd>
                        <span className="pill p-green" style={{ fontWeight: '800' }}>
                          <i className="fa-solid fa-layer-group"></i> شراء تراك كامل
                        </span>
                        <strong style={{ marginInlineStart: '6px' }}>{o.track?.title || o.track_name}</strong>
                      </dd>
                      {o.track?.courses?.length > 0 && (
                        <>
                          <dt>الكورسات المشمولة</dt>
                          <dd>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {o.track.courses.map(c => (
                                <span key={c._id} className="pill p-blue" style={{ fontSize: '11.5px' }}>
                                  <i className="fa-solid fa-book-bookmark"></i> {c.title}
                                </span>
                              ))}
                            </div>
                          </dd>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <dt>الكورس</dt>
                      <dd>
                        <strong>{o.course?.title}</strong> <span className="muted">(سعره {o.course?.price} $)</span>
                        {(o.track_name || o.track?.title || o.course?.track?.title) && (
                          <div style={{ marginTop: '6px' }}>
                            <span className="pill p-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 'bold' }}>
                              <i className="fa-solid fa-route"></i> هذا الكورس تم شراؤه من داخل تراك: <strong>{o.track_name || o.track?.title || o.course?.track?.title}</strong>
                            </span>
                          </div>
                        )}
                      </dd>
                    </>
                  )}
                  <dt>طريقة الدفع</dt><dd>{o.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}</dd>
                  <dt>كود الخصم (الكوبون)</dt>
                  <dd>
                    {(o.coupon_code || o.coupon?.code) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="pill p-green" style={{ fontWeight: '800', letterSpacing: '0.5px' }}>
                          <i className="fa-solid fa-tag"></i> {o.coupon_code || o.coupon?.code}
                        </span>
                        {(() => {
                          const c = o.coupon;
                          if (!c) return null;
                          let desc = '';
                          if (c.course_discounts && c.course_discounts.length > 0 && o.course?._id) {
                            const cd = c.course_discounts.find(item => item.course?.toString() === o.course._id.toString());
                            if (cd) {
                              desc = cd.discount_type === 'percentage' ? `${cd.discount_value}%` : `${cd.discount_value} $`;
                            }
                          }
                          if (!desc && c.discount_value) {
                            desc = c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} $`;
                          }
                          return desc ? (
                            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
                              (خصم {desc})
                            </span>
                          ) : null;
                        })()}
                        {o.course?.price && o.amount < o.course.price && (
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            (وفّر {(o.course.price - o.amount).toFixed(1)} $)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="muted" style={{ fontSize: '13px' }}>بدون كود خصم</span>
                    )}
                  </dd>
                  <dt>المبلغ المحوّل</dt><dd style={{ color: o.amount < o.course?.price ? '#b91c1c' : '#166534', fontWeight: '700' }}>{o.amount} $ {o.amount < o.course?.price && <span className="sub" style={{ color: '#16a34a' }}>(تم تطبيق خصم على السعر الأصلي {o.course?.price} $)</span>}</dd>
                  <dt>الرقم المحوّل منه</dt><dd className="ltr">{o.sender_phone}</dd>
                  <dt>تاريخ الطلب</dt><dd className="ltr">{new Date(o.created_at).toLocaleString()}</dd>
                  <dt>حالة التفعيل</dt><dd>{o.enrolled ? <span className="pill p-green"><i className="fa-solid fa-check"></i> الكورس مفعّل للطالب</span> : <span className="pill p-gray">غير مفعّل</span>}</dd>
                </dl>
              </div>
            </div>

            <div className="panel" style={{ marginTop: '20px' }}>
              <div className="panel-head">
                <h2><i className="fa-solid fa-calendar-check" style={{ color: '#c81e1e' }}></i> فترة وصلاحية الاشتراك {o.order_type === 'track' || (!o.course && o.track) ? 'بالتراك وكورساته' : 'بالكورس'}</h2>
                {o.enrolled ? (
                  <span className="pill p-green"><i className="fa-solid fa-circle-check"></i> {o.order_type === 'track' || (!o.course && o.track) ? 'التراك مفعّل' : 'الكورس مفعّل'}</span>
                ) : (
                  <span className="pill p-gray"><i className="fa-solid fa-clock"></i> غير مفعّل بعد</span>
                )}
              </div>
              <div className="panel-body">
                {o.enrolled && o.enrollment ? (
                  <div>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            <i className="fa-regular fa-calendar-plus" style={{ marginLeft: '5px', color: '#2563eb' }}></i>
                            تاريخ بدء الاشتراك:
                          </span>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                            {new Date(o.enrollment.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </strong>
                          <span className="sub ltr" style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                            {new Date(o.enrollment.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            <i className="fa-regular fa-calendar-xmark" style={{ marginLeft: '5px', color: '#dc2626' }}></i>
                            تاريخ انتهاء الاشتراك:
                          </span>
                          {o.enrollment.expires_at ? (
                            <>
                              <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                                {new Date(o.enrollment.expires_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </strong>
                              <span className="sub ltr" style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                                {new Date(o.enrollment.expires_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          ) : (
                            <strong style={{ fontSize: '14px', color: '#16a34a' }}>اشتراك دائم (بلا انتهاء)</strong>
                          )}
                        </div>

                        <div>
                          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            <i className="fa-solid fa-hourglass-half" style={{ marginLeft: '5px', color: '#f59e0b' }}></i>
                            حالة الصلاحية الحالية:
                          </span>
                          {o.enrollment.expires_at ? (
                            (() => {
                              const diffMs = new Date(o.enrollment.expires_at).getTime() - Date.now();
                              const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                              if (diffMs <= 0) {
                                return (
                                  <span className="pill p-red" style={{ fontWeight: '600', display: 'inline-block' }}>
                                    <i className="fa-solid fa-ban"></i> منتهي (منذ {Math.abs(diffDays)} يوم)
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="pill p-green" style={{ fontWeight: '600', display: 'inline-block' }}>
                                    <i className="fa-solid fa-check"></i> نشط (متبقي {diffDays} يوم)
                                  </span>
                                );
                              }
                            })()
                          ) : (
                            <span className="pill p-blue" style={{ fontWeight: '600', display: 'inline-block' }}>
                              <i className="fa-solid fa-infinity"></i> صالح مدى الحياة
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '15px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                        <i className="fa-solid fa-sliders" style={{ marginLeft: '5px', color: '#c81e1e' }}></i>
                        التحكم في مدة الاشتراك (زيادة أو إنقاص المدة براحتك):
                      </label>

                      {/* Quick Increase Buttons */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold', minWidth: '70px' }}>تمديد (+):</span>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ days_delta: 7 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534' }}>
                          +7 أيام
                        </button>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ months_delta: 1 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#dcfce7', color: '#15803d', fontWeight: 'bold' }}>
                          +شهر (30 يوم)
                        </button>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ months_delta: 3 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534' }}>
                          +3 شهور
                        </button>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ months_delta: 6 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534' }}>
                          +6 شهور
                        </button>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ months_delta: 12 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534' }}>
                          +سنة كاملة
                        </button>
                      </div>

                      {/* Quick Decrease Buttons */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 'bold', minWidth: '70px' }}>إنقاص (-):</span>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ days_delta: -7 })} className="btn btn-light btn-sm" style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b' }}>
                          -7 أيام
                        </button>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ months_delta: -1 })} className="btn btn-light btn-sm" style={{ border: '1px solid #fca5a5', background: '#fee2e2', color: '#b91c1c', fontWeight: 'bold' }}>
                          -شهر (30 يوم)
                        </button>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ months_delta: -3 })} className="btn btn-light btn-sm" style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b' }}>
                          -3 شهور
                        </button>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ set_lifetime: true })} className="btn btn-light btn-sm" style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af' }}>
                          <i className="fa-solid fa-infinity"></i> جعله دائم
                        </button>
                        <button type="button" disabled={adjustingDuration} onClick={() => handleAdjustDuration({ reset_to_default: true })} className="btn btn-light btn-sm" style={{ border: '1px solid #cbd5e1', color: '#475569' }} title="إعادة الضبط لافتراضي الكورس">
                          <i className="fa-solid fa-rotate-left"></i> ضبط للافتراضي
                        </button>
                      </div>

                      {/* Manual Date Input */}
                      <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '6px' }}>
                          أو حدد تاريخ انتهاء مخصص مباشرةً:
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="date"
                            value={customExpiryInput}
                            onChange={(e) => setCustomExpiryInput(e.target.value)}
                            style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                          />
                          <button
                            type="button"
                            disabled={adjustingDuration || !customExpiryInput}
                            onClick={() => handleAdjustDuration({ expires_at: customExpiryInput })}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '7px 15px' }}
                          >
                            <i className="fa-solid fa-floppy-disk"></i> حفظ التاريخ المخصص
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.6' }}>
                    <p style={{ margin: 0, marginBottom: '8px' }}>
                      <i className="fa-solid fa-info-circle" style={{ color: '#0284c7', marginLeft: '5px' }}></i>
                      هذا الطلب لم يتم تفعيل الكورس له بعد.
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                      مدة الصلاحية المقررة لهذا الكورس: <strong>{o.course?.access_duration_unit === 'lifetime' ? 'دائم مدى الحياة' : `${o.course?.access_duration_value || 1} ${o.course?.access_duration_unit === 'hours' ? 'ساعة' : o.course?.access_duration_unit === 'days' ? 'يوم' : o.course?.access_duration_unit === 'months' ? 'شهر' : 'سنة'}`}</strong>.
                      عند قبول الدفع وتفعيل الكورس للطالب، سيبدأ الاشتراك وتظهر أدوات زيادة وإنقاص المدة وتغيير تاريخ الانتهاء بحرية.
                    </p>
                  </div>
                )}
              </div>
            </div>
            {o.proof_image && (
              <div className="panel">
                <div className="panel-head"><h2><i className="fa-solid fa-image"></i> إثبات الدفع</h2></div>
                <div className="panel-body">
                  <a href={getAssetUrl(o.proof_image)} target="_blank" rel="noreferrer"><img className="proof" src={getAssetUrl(o.proof_image)} alt="إثبات الدفع" style={{width:'100%', borderRadius:'8px'}} /></a>
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-clipboard-check"></i> مراجعة الدفع</h2></div>
              <div className="panel-body">
                <form onSubmit={handleStatusChange}>
                  <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="field">
                      <label>حالة الطلب</label>
                      <select name="status" defaultValue={o.status}>
                        <option value="pending">قيد المراجعة</option>
                        <option value="approved">تم قبول الدفع</option>
                        <option value="rejected">تم رفض الدفع</option>
                      </select>
                    </div>
                    <label className="check"><input type="checkbox" name="activate" value="true" defaultChecked /> تفعيل الكورس للطالب عند القبول</label>
                    <div className="field">
                      <label>ملاحظة للطالب (تظهر عند الرفض)</label>
                      <textarea name="admin_note" defaultValue={o.admin_note} style={{ minHeight: '80px' }} placeholder="مثال: المبلغ المحوّل أقل من سعر الكورس"></textarea>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px' }}><i className="fa-solid fa-floppy-disk"></i> حفظ الطلب</button>
                      <button type="button" className="btn btn-danger" onClick={handleDelete} style={{ flex: 1, justifyContent: 'center', padding: '11px' }}><i className="fa-solid fa-trash"></i> حذف الطلب</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const total = counts.pending + counts.approved + counts.rejected;

  return (
    <AdminLayout title="طلبات الاشتراك">
      <div className="panel">
        <div className="panel-head">
          <div className="filters">
            <Link to="/admin/orders" className={!statusFilter ? 'active' : ''}>الكل ({total})</Link>
            <Link to="/admin/orders?status=pending" className={statusFilter === 'pending' ? 'active' : ''}>قيد المراجعة ({counts.pending})</Link>
            <Link to="/admin/orders?status=approved" className={statusFilter === 'approved' ? 'active' : ''}>تم القبول ({counts.approved})</Link>
            <Link to="/admin/orders?status=rejected" className={statusFilter === 'rejected' ? 'active' : ''}>مرفوض ({counts.rejected})</Link>
          </div>
          <form className="search" onSubmit={e => {
            e.preventDefault();
            const q = e.target.q.value;
            // TODO implement search if needed or filter on frontend
          }}>
            <input name="q" placeholder="بحث بالاسم / الرقم / الإيميل" />
            <button className="btn btn-dark btn-sm"><i className="fa-solid fa-magnifying-glass"></i></button>
          </form>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>الطالب</th><th>الكورس / التراك</th><th>المبلغ / الطريقة</th><th>المحوّل منه</th><th>الإثبات</th><th>التاريخ</th><th>الحالة</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o._id}>
                  <td><span className="ltr" style={{fontSize:'11px'}}>{o._id.slice(-6)}</span></td>
                  <td><strong>{o.full_name}</strong><span className="sub ltr">{o.phone}</span></td>
                  <td>
                    {o.order_type === 'track' || (o.track && !o.course) ? (
                      <div>
                        <span className="pill p-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', fontWeight: 'bold' }}>
                          <i className="fa-solid fa-layer-group"></i> تراك كامل
                        </span>
                        <strong style={{ display: 'block', fontSize: '13px', marginTop: '3px' }}>{o.track?.title || o.track_name}</strong>
                        {o.track?.courses?.length > 0 && (
                          <span className="sub">({o.track.courses.length} كورسات مشمولة)</span>
                        )}
                      </div>
                    ) : (
                      <div>
                        <strong style={{ display: 'block', fontSize: '13px' }}>{o.course?.title || 'كورس غير محدد'}</strong>
                        {(o.track_name || o.track?.title || o.course?.track?.title) && (
                          <span className="pill p-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', marginTop: '3px', fontWeight: 'bold' }}>
                            <i className="fa-solid fa-route"></i> من تراك: {o.track_name || o.track?.title || o.course?.track?.title}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {o.amount} $
                    {(o.coupon_code || o.coupon?.code) && (
                      <span className="pill p-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', padding: '2px 6px', marginTop: '3px', fontWeight: 'bold' }} title={`تم استخدام كود خصم: ${o.coupon_code || o.coupon?.code}`}>
                        <i className="fa-solid fa-tag"></i> {o.coupon_code || o.coupon?.code}
                      </span>
                    )}
                    <span className="sub">{o.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}</span>
                  </td>
                  <td className="ltr">{o.sender_phone}</td>
                  <td>
                    {o.proof_image ? (
                      <a href={getAssetUrl(o.proof_image)} target="_blank" rel="noreferrer" className="pill p-blue"><i className="fa-regular fa-image"></i> عرض</a>
                    ) : '-'}
                  </td>
                  <td><span className="ltr" style={{ fontSize: '13px' }}>{new Date(o.created_at).toLocaleDateString()}</span></td>
                  <td>
                    {o.status === 'approved' && o.is_expired ? (
                      <span className="pill p-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={o.expires_at ? `انتهت الصلاحية في ${new Date(o.expires_at).toLocaleDateString()}` : 'انتهت الصلاحية'}>
                        <i className="fa-solid fa-clock-rotate-left"></i> انتهت الصلاحية
                      </span>
                    ) : (
                      <span className={`pill st-${o.status}`}>
                        {o.status === 'pending' ? 'قيد المراجعة' : o.status === 'approved' ? 'مقبول' : 'مرفوض'}
                      </span>
                    )}
                  </td>
                  <td><Link to={`/admin/orders?id=${o._id}`} className={`btn ${o.status === 'pending' ? 'btn-primary' : 'btn-light'} btn-sm`}>مراجعة</Link></td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan="9" className="empty"><i className="fa-solid fa-receipt"></i>لا توجد طلبات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Orders;
