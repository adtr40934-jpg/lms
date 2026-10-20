import { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { api } from '../../api';

function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  // Launch Discount Modal State
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [editingLaunchCoupon, setEditingLaunchCoupon] = useState(null);
  const [launchCode, setLaunchCode] = useState('LAUNCH');
  const [launchExpiresAt, setLaunchExpiresAt] = useState('');
  const [launchMaxUses, setLaunchMaxUses] = useState('');
  const [launchDiscounts, setLaunchDiscounts] = useState({});
  const [bulkDiscountType, setBulkDiscountType] = useState('percentage');
  const [bulkDiscountValue, setBulkDiscountValue] = useState('');
  const [launchSubmitting, setLaunchSubmitting] = useState(false);

  // Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [courseId, setCourseId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resCoupons, resCourses] = await Promise.all([
        api.get('/admin/coupons'),
        api.get('/courses/admin/all')
      ]);
      setCoupons(resCoupons.coupons || []);
      setCourses(resCourses.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountType('percentage');
    setDiscountValue('');
    setMaxUses('');
    setExpiresAt('');
    setCourseId('');
    setShowModal(true);
  };

  const openEditModal = (c) => {
    if (c.is_launch) {
      openLaunchModal(c);
      return;
    }
    setEditingCoupon(c);
    setCode(c.code || '');
    setDiscountType(c.discount_type || 'percentage');
    setDiscountValue(c.discount_value || '');
    setMaxUses(c.max_uses ? c.max_uses.toString() : '');
    const dateFormatted = c.expires_at ? new Date(c.expires_at).toISOString().split('T')[0] : '';
    setExpiresAt(dateFormatted);
    setCourseId(c.course ? (c.course._id || c.course) : '');
    setShowModal(true);
  };

  const openLaunchModal = (existing = null) => {
    // If not passed explicitly, see if an active launch coupon already exists
    const launch = existing || coupons.find(c => c.is_launch);
    setEditingLaunchCoupon(launch || null);

    if (launch) {
      setLaunchCode(launch.code || 'LAUNCH');
      setLaunchExpiresAt(launch.expires_at ? new Date(launch.expires_at).toISOString().split('T')[0] : '');
      setLaunchMaxUses(launch.max_uses ? launch.max_uses.toString() : '');
      
      const map = {};
      courses.forEach(crs => {
        const found = launch.course_discounts?.find(cd => {
          const cid = cd.course?._id || cd.course;
          return String(cid) === String(crs._id);
        });

        if (found) {
          map[crs._id] = {
            enabled: true,
            discount_type: found.discount_type || 'percentage',
            discount_value: found.discount_value != null ? found.discount_value : ''
          };
        } else {
          map[crs._id] = {
            enabled: false,
            discount_type: 'percentage',
            discount_value: '20'
          };
        }
      });
      setLaunchDiscounts(map);
    } else {
      setLaunchCode('LAUNCH');
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setLaunchExpiresAt(d.toISOString().split('T')[0]);
      setLaunchMaxUses('');

      const map = {};
      courses.forEach(crs => {
        map[crs._id] = {
          enabled: true,
          discount_type: 'percentage',
          discount_value: '20'
        };
      });
      setLaunchDiscounts(map);
    }

    setBulkDiscountType('percentage');
    setBulkDiscountValue('');
    setShowLaunchModal(true);
  };

  const handleBulkApply = () => {
    if (!bulkDiscountValue || Number(bulkDiscountValue) <= 0) {
      alert('يرجى كتابة قيمة صالحة للخصم الموحد');
      return;
    }
    setLaunchDiscounts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(cid => {
        if (next[cid]?.enabled) {
          next[cid] = {
            ...next[cid],
            discount_type: bulkDiscountType,
            discount_value: bulkDiscountValue
          };
        }
      });
      return next;
    });
  };

  const toggleAllCourses = (enable) => {
    setLaunchDiscounts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(cid => {
        next[cid] = {
          ...next[cid],
          enabled: enable
        };
      });
      return next;
    });
  };

  const handleLaunchSubmit = async (e) => {
    e.preventDefault();

    const selectedDiscounts = Object.keys(launchDiscounts)
      .filter(cid => launchDiscounts[cid]?.enabled && Number(launchDiscounts[cid]?.discount_value) > 0)
      .map(cid => ({
        course: cid,
        discount_type: launchDiscounts[cid].discount_type,
        discount_value: Number(launchDiscounts[cid].discount_value)
      }));

    if (selectedDiscounts.length === 0) {
      alert('يرجى تفعيل الخصم وتحديد قيمته لكورس واحد على الأقل');
      return;
    }

    const payload = {
      code: launchCode.trim().toUpperCase(),
      is_launch: true,
      course_discounts: selectedDiscounts,
      expires_at: launchExpiresAt,
      max_uses: launchMaxUses ? parseInt(launchMaxUses) : null,
      discount_type: 'percentage',
      discount_value: 0
    };

    try {
      setLaunchSubmitting(true);
      if (editingLaunchCoupon) {
        const res = await api.put(`/admin/coupons/${editingLaunchCoupon._id}`, payload);
        alert(res.message || 'تم تحديث خصم الإطلاق بنجاح');
      } else {
        const res = await api.post('/admin/coupons', payload);
        alert(res.message || 'تم تفعيل خصم الإطلاق بنجاح');
      }
      setShowLaunchModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء حفظ خصم الإطلاق');
    } finally {
      setLaunchSubmitting(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountValue,
      expires_at: expiresAt,
      courseId: courseId || null,
      max_uses: maxUses ? parseInt(maxUses) : null
    };

    try {
      setSubmitting(true);
      if (editingCoupon) {
        const res = await api.put(`/admin/coupons/${editingCoupon._id}`, payload);
        alert(res.message);
      } else {
        const res = await api.post('/admin/coupons', payload);
        alert(res.message);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء حفظ الكوبون');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id, couponCode) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف الكوبون "${couponCode}"؟`);
    if (!confirmed) return;

    api.delete(`/admin/coupons/${id}`)
      .then((res) => {
        alert(res.message);
        fetchData();
      })
      .catch((err) => alert(err.message || 'حدث خطأ أثناء الحذف'));
  };

  if (loading) return (
    <AdminLayout title="كوبونات الخصم">
      <div style={{ padding: '100px 0', textAlign: 'center' }}>
        <i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="كوبونات الخصم">
      <div className="panel">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2><i className="fa-solid fa-ticket"></i> الكوبونات الحالية ({coupons.length})</h2>
            <small style={{ color: '#64748b' }}>إدارة أكواد الخصم، نسب التخفيض، وخصم الإطلاق المخصص لكل كورس</small>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={() => openLaunchModal()}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                color: '#fff',
                fontWeight: 'bold',
                border: 'none',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-rocket"></i> خصم الإطلاق 🚀
            </button>
            <button className="btn btn-primary" onClick={openCreateModal}>
              <i className="fa-solid fa-plus"></i> إضافة كوبون جديد
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الكود</th>
                <th>قيمة الخصم</th>
                <th>يطبق على</th>
                <th>حد الاستخدام</th>
                <th>تاريخ الانتهاء</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => {
                const isExpired = new Date(c.expires_at) < new Date();
                const used = c.used_count || 0;
                const max = c.max_uses;
                const isLimitReached = max && max > 0 && used >= max;

                return (
                  <tr key={c._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '15px', letterSpacing: '1px', color: '#0f172a' }}>
                          {c.code}
                        </strong>
                        {c.is_launch && (
                          <span
                            className="badge"
                            style={{
                              background: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 'bold'
                            }}
                          >
                            <i className="fa-solid fa-rocket" style={{ marginLeft: '4px' }}></i>
                            خصم الإطلاق
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {c.is_launch ? (
                        <span style={{ color: '#ea580c', fontWeight: 'bold', fontSize: '13.5px' }}>
                          <i className="fa-solid fa-sliders" style={{ marginLeft: '4px' }}></i>
                          مخصص لكل كورس ({c.course_discounts?.length || 0})
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '14.5px' }}>
                          {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}
                        </span>
                      )}
                    </td>
                    <td>
                      {c.is_launch ? (
                        <span style={{ color: '#475569', fontSize: '13px', fontWeight: '500' }}>
                          <i className="fa-solid fa-layer-group" style={{ marginLeft: '4px', color: '#f59e0b' }}></i>
                          {c.course_discounts?.length || 0} كورسات محددة
                        </span>
                      ) : c.course ? (
                        <span style={{ color: '#2563eb', fontWeight: '600' }}>
                          <i className="fa-solid fa-book-open" style={{ marginLeft: '4px', fontSize: '12px' }}></i>
                          {c.course.title}
                        </span>
                      ) : (
                        <span style={{ color: '#475569' }}>
                          <i className="fa-solid fa-layer-group" style={{ marginLeft: '4px', fontSize: '12px' }}></i>
                          جميع الكورسات
                        </span>
                      )}
                    </td>

                    {/* حدود الاستخدام */}
                    <td>
                      {max && max > 0 ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 'bold', color: isLimitReached ? '#dc2626' : '#0f172a' }}>
                              {used} / {max}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>استخدام</span>
                          </div>
                          {isLimitReached ? (
                            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold', display: 'block', marginTop: '2px' }}>
                              <i className="fa-solid fa-ban"></i> اكتمل الحد
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#16a34a', display: 'block', marginTop: '2px' }}>
                              متبقي {max - used}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{used}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginRight: '4px' }}>(غير محدود ♾️)</span>
                        </div>
                      )}
                    </td>

                    {/* تاريخ الانتهاء */}
                    <td>
                      <div style={{ fontSize: '13px', color: isExpired ? '#dc2626' : '#475569' }}>
                        <i className="fa-regular fa-calendar" style={{ marginLeft: '4px' }}></i>
                        {new Date(c.expires_at).toLocaleDateString('ar-EG')}
                      </div>
                    </td>

                    {/* الحالة العامة */}
                    <td>
                      {isExpired ? (
                        <span className="badge badge-danger">منتهي الصلاحية</span>
                      ) : isLimitReached ? (
                        <span className="badge badge-danger">اكتمل الاستخدام</span>
                      ) : (
                        <span className="badge badge-success">نشط وساري</span>
                      )}
                    </td>

                    {/* إجراءات */}
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(c)}
                          className="btn btn-light btn-sm btn-icon"
                          title={c.is_launch ? 'تعديل خصم الإطلاق' : 'تعديل الكوبون'}
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(c._id, c.code)}
                          className="btn btn-danger btn-sm btn-icon"
                          title="حذف الكوبون"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-solid fa-ticket fa-2x" style={{ display: 'block', marginBottom: '8px' }}></i>
                    لا توجد كوبونات خصم حالياً. اضغط على "إضافة كوبون جديد" للبدء.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Modal Add / Edit */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="panel" style={{ width: '100%', maxWidth: '520px', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                <i className="fa-solid fa-ticket text-red" style={{ marginLeft: '8px' }}></i>
                {editingCoupon ? `تعديل الكوبون: ${editingCoupon.code}` : 'إضافة كوبون خصم جديد'}
              </h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>
            <div className="panel-body" style={{ padding: '20px' }}>
              <form onSubmit={handleFormSubmit}>
                <div className="form-grid">
                  <div className="field full">
                    <label>كود الخصم *</label>
                    <input
                      name="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="مثال: MARKETING50 أو RAMADAN2026"
                      required
                      style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}
                    />
                  </div>

                  <div className="field">
                    <label>نوع الخصم *</label>
                    <select
                      name="discount_type"
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      required
                    >
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت ($)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>قيمة الخصم *</label>
                    <input
                      type="number"
                      name="discount_value"
                      min="1"
                      step="any"
                      required
                      placeholder="مثال: 50 أو 100"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                    />
                  </div>

                  {/* أقصى عدد للاستخدام */}
                  <div className="field full">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><i className="fa-solid fa-users-gear text-red"></i> أقصى عدد لاستخدام الكوبون (الحد الأقصى)</span>
                      <small style={{ color: '#64748b' }}>اختياري</small>
                    </label>
                    <input
                      type="number"
                      name="max_uses"
                      min="1"
                      step="1"
                      placeholder="مثال: 10 أو 50 (اتركه فارغاً إذا كان الاستخدام غير محدود)"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                    />
                    <div className="hint" style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                      إذا حددت مثلاً 10، سيتوقف الكوبون تلقائياً فور استخدامه 10 مرات بواسطة الطلاب.
                    </div>
                  </div>

                  <div className="field full">
                    <label>تاريخ الانتهاء *</label>
                    <input
                      type="date"
                      name="expires_at"
                      required
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>

                  <div className="field full">
                    <label>يطبق على</label>
                    <select
                      name="courseId"
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                    >
                      <option value="">-- جميع الكورسات --</option>
                      {courses.map(c => (
                        <option key={c._id} value={c._id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="full" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setShowModal(false)}
                      disabled={submitting}
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                      style={{ padding: '10px 24px' }}
                    >
                      {submitting ? (
                        <><i className="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...</>
                      ) : (
                        <><i className="fa-solid fa-check"></i> {editingCoupon ? 'حفظ التعديلات' : 'إضافة الكوبون'}</>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Launch Discount */}
      {showLaunchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="panel" style={{
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            <div className="panel-head" style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-rocket" style={{ color: '#f59e0b' }}></i>
                  {editingLaunchCoupon ? `تعديل خصم الإطلاق (${launchCode})` : 'إعداد خصم الإطلاق (Launch Discount)'}
                </h3>
                <small style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px', display: 'block' }}>
                  كوبون موحد يستخدمه الطلاب (كود ثابت)، مع إمكانية تحديد خصم مختلف ومستقل لكل كورس على حدة
                </small>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowLaunchModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div className="panel-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <form id="launchDiscountForm" onSubmit={handleLaunchSubmit}>
                {/* الإعدادات الأساسية */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '12px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-gear" style={{ color: '#64748b' }}></i>
                    الإعدادات العامة للكوبون
                  </div>
                  <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div className="field">
                      <label style={{ fontWeight: '600' }}>كود الكوبون الموحد *</label>
                      <input
                        type="text"
                        value={launchCode}
                        onChange={(e) => setLaunchCode(e.target.value.toUpperCase())}
                        required
                        placeholder="LAUNCH"
                        style={{ textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontWeight: '600' }}>تاريخ انتهاء العرض *</label>
                      <input
                        type="date"
                        value={launchExpiresAt}
                        onChange={(e) => setLaunchExpiresAt(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontWeight: '600' }}>الحد الأقصى للاستخدام <small style={{ color: '#64748b' }}>(اختياري)</small></label>
                      <input
                        type="number"
                        min="1"
                        placeholder="فارغ = غير محدود"
                        value={launchMaxUses}
                        onChange={(e) => setLaunchMaxUses(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{
                    marginTop: '12px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12.5px',
                    color: '#1e40af'
                  }}>
                    <i className="fa-solid fa-circle-info" style={{ fontSize: '15px', color: '#3b82f6', flexShrink: 0 }}></i>
                    <div>
                      <strong>تنبيه العرض للطلاب:</strong> في حال إضافة أكثر من كورس، سيظهر في الموقع كـ <strong>"خصم إطلاق على جميع الكورسات"</strong> (أو على كورسات محددة) بدون كتابة نسبة أو سعر الخصم لاختلافه بين الكورسات، وتُطبق قيمة خصم كل كورس بدقة في صفحة الدفع.
                    </div>
                  </div>
                </div>

                {/* أداة التطبيق السريع */}
                <div style={{
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>⚡</span>
                    <div>
                      <strong style={{ color: '#92400e', fontSize: '13.5px', display: 'block' }}>تطبيق خصم سريع وموحد:</strong>
                      <span style={{ fontSize: '11.5px', color: '#b45309' }}>يطبق على جميع الكورسات المحددة دفعة واحدة، ويمكنك تعديل أي كورس منفرداً بعدها</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <select
                      value={bulkDiscountType}
                      onChange={(e) => setBulkDiscountType(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="fixed">مبلغ ثابت ($)</option>
                    </select>
                    <input
                      type="number"
                      placeholder="القيمة"
                      value={bulkDiscountValue}
                      onChange={(e) => setBulkDiscountValue(e.target.value)}
                      style={{ width: '90px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={handleBulkApply}
                      style={{ background: '#d97706', color: '#fff', padding: '6px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                    >
                      تطبيق على الكل
                    </button>
                  </div>
                </div>

                {/* جدول تحديد الخصومات للكورسات */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14.5px', color: '#0f172a' }}>
                      <i className="fa-solid fa-graduation-cap text-red" style={{ marginLeft: '6px' }}></i>
                      تحديد الخصم لكل كورس ({courses.length} كورس متاح):
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => toggleAllCourses(true)}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12.5px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        تحديد الكل
                      </button>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <button
                        type="button"
                        onClick={() => toggleAllCourses(false)}
                        style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12.5px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        إلغاء تحديد الكل
                      </button>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ margin: 0, width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '10px 14px', textAlign: 'right', width: '40px' }}>تفعيل</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>الكورس</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', width: '110px' }}>السعر الأصلي</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', width: '140px' }}>نوع الخصم</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', width: '120px' }}>قيمة الخصم</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', width: '130px' }}>السعر بعد الخصم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map(crs => {
                          const state = launchDiscounts[crs._id] || { enabled: false, discount_type: 'percentage', discount_value: '0' };
                          const origPrice = Number(crs.price) || 0;
                          const discVal = Number(state.discount_value) || 0;
                          let finalPrice = origPrice;

                          if (state.enabled && discVal > 0) {
                            if (state.discount_type === 'percentage') {
                              finalPrice = Math.max(0, origPrice - (origPrice * discVal / 100));
                            } else {
                              finalPrice = Math.max(0, origPrice - discVal);
                            }
                          }

                          return (
                            <tr
                              key={crs._id}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: state.enabled ? '#fff' : '#f8fafc',
                                opacity: state.enabled ? 1 : 0.6
                              }}
                            >
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={!!state.enabled}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setLaunchDiscounts(prev => ({
                                      ...prev,
                                      [crs._id]: {
                                        ...(prev[crs._id] || { discount_type: 'percentage', discount_value: '20' }),
                                        enabled: checked
                                      }
                                    }));
                                  }}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ fontWeight: '600', color: state.enabled ? '#0f172a' : '#64748b' }}>
                                  {crs.title}
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>
                                ${origPrice}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <select
                                  disabled={!state.enabled}
                                  value={state.discount_type}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLaunchDiscounts(prev => ({
                                      ...prev,
                                      [crs._id]: { ...prev[crs._id], discount_type: val }
                                    }));
                                  }}
                                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '100%' }}
                                >
                                  <option value="percentage">نسبة مئوية (%)</option>
                                  <option value="fixed">مبلغ ثابت ($)</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  disabled={!state.enabled}
                                  min="0"
                                  step="any"
                                  placeholder="0"
                                  value={state.discount_value}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLaunchDiscounts(prev => ({
                                      ...prev,
                                      [crs._id]: { ...prev[crs._id], discount_value: val }
                                    }));
                                  }}
                                  style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}
                                />
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                {state.enabled && discVal > 0 ? (
                                  <span style={{ fontWeight: 'bold', color: '#16a34a' }}>
                                    ${Math.round(finalPrice * 100) / 100}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </form>
            </div>

            <div style={{
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '14px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                تم تفعيل الخصم لـ {Object.values(launchDiscounts).filter(v => v?.enabled).length} من أصل {courses.length} كورس
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowLaunchModal(false)}
                  disabled={launchSubmitting}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  form="launchDiscountForm"
                  className="btn"
                  disabled={launchSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 'bold',
                    padding: '9px 24px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  {launchSubmitting ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...</>
                  ) : (
                    <><i className="fa-solid fa-rocket"></i> {editingLaunchCoupon ? 'حفظ تعديلات خصم الإطلاق' : 'تفعيل خصم الإطلاق الآن'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Coupons;
