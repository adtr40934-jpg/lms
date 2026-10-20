import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import { getBackendOrigin } from '../../utils/backendUrl';

function Students() {
  const [searchParams, setSearchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [students, setStudents] = useState([]);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', password: '' });

  const [editingEnrollment, setEditingEnrollment] = useState(null);
  const [modalExpiryInput, setModalExpiryInput] = useState('');
  const [adjustingModal, setAdjustingModal] = useState(false);

  useEffect(() => {
    const exp = editingEnrollment?.expires_at || editingEnrollment?.effective_expires_at;
    if (exp) {
      try {
        setModalExpiryInput(new Date(exp).toISOString().split('T')[0]);
      } catch (e) {
        setModalExpiryInput('');
      }
    } else {
      setModalExpiryInput('');
    }
  }, [editingEnrollment]);

  const handleAdjustEnrollment = async (params) => {
    if (!editingEnrollment) return;
    try {
      setAdjustingModal(true);
      const res = await api.put(`/admin/enrollments/${editingEnrollment._id}/expiry`, params);
      alert(res.message || 'تم تعديل مدة صلاحية الاشتراك بنجاح');

      // تحديث الحالة فورياً في الواجهة
      if (res.enrollment) {
        setStudentData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            enrollments: prev.enrollments.map(e => e._id === res.enrollment._id ? {
              ...e,
              expires_at: res.enrollment.expires_at,
              effective_expires_at: res.enrollment.expires_at,
              is_expired: res.enrollment.expires_at ? new Date() > new Date(res.enrollment.expires_at) : false
            } : e)
          };
        });
      }

      setEditingEnrollment(null);
      fetchStudent(true);
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء تعديل مدة الصلاحية');
    } finally {
      setAdjustingModal(false);
    }
  };

  const handleDeleteEnrollment = async (enrollmentId, courseTitle) => {
    const confirmMsg = `هل أنت متأكد من حذف كورس "${courseTitle || 'المحدد'}" من عند هذا الطالب؟\n\nتنبيه: سيتم إلغاء اشتراكه وحذف تقدمه في هذا الكورس فوراً.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      // تحديث فوري وسريع للواجهة بحذف الكورس من القائمة
      setStudentData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          enrollments: prev.enrollments.filter(e => e._id !== enrollmentId)
        };
      });

      const res = await api.delete(`/admin/enrollments/${enrollmentId}`);
      alert(res.message || 'تم حذف الكورس من الطالب بنجاح');
      fetchStudent(true);
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء حذف الكورس');
      fetchStudent(true);
    }
  };

  useEffect(() => {
    if (id) {
      fetchStudent();
    } else {
      fetchStudents();
    }

    // Connect to backend Socket.IO for instant live updates across all clients
    const socket = io(getBackendOrigin(), {
      withCredentials: true,
      auth: { isAdmin: true }
    });

    socket.on('data_updated', () => {
      if (id) {
        fetchStudent(true);
      } else {
        fetchStudents(true);
      }
    });

    // Auto-refresh polling in the background without reloading the page
    const interval = setInterval(() => {
      if (id) {
        fetchStudent(true);
      } else {
        fetchStudents(true);
      }
    }, 4000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [id, searchParams.get('q')]);

  const fetchStudents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const q = searchParams.get('q') || '';
      const res = await api.get(`/admin/students${q ? `?q=${q}` : ''}`);
      setStudents(res.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchStudent = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/admin/students/${id}`);
      setStudentData(res);
    } catch (err) {
      console.error(err);
      if (!silent) setStudentData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const toggleActive = async () => {
    try {
      const res = await api.patch(`/admin/students/${id}/toggle`);
      alert(res.message);
      // تحديث الحالة فورياً في الواجهة
      setStudentData(prev => prev ? {
        ...prev,
        student: { ...prev.student, is_active: res.is_active }
      } : null);
      fetchStudent(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClearSession = async () => {
    if (!window.confirm('هل أنت متأكد من إنهاء جلسة هذا الطالب وتسجيل خروجه من جميع الأجهزة؟')) return;
    try {
      const res = await api.delete(`/admin/students/${id}/session`);
      alert(res.message);
      // مسح الجلسة فورياً في الواجهة
      setStudentData(prev => prev ? {
        ...prev,
        activeSession: null
      } : null);
      fetchStudent(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    const confirmMsg = `هل أنت متأكد من حذف حساب الطالب "${studentName || 'المحدد'}" نهائياً؟\n\nتنبيه: سيتم مسح حساب الطالب وجلساته واشتراكاته وتقدمه فوراً ولن يمكن التراجع عن هذا الإجراء.`;
    if (!window.confirm(confirmMsg)) return;

    // حذف فوري من الجدول دون الحاجة لإعادة تحميل الصفحة
    setStudents(prev => prev.filter(s => s._id !== studentId));

    try {
      const res = await api.delete(`/admin/students/${studentId}`);
      alert(res.message || 'تم حذف حساب الطالب بنجاح');
      if (id) {
        setSearchParams({});
      } else {
        fetchStudents(true);
      }
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء حذف الحساب');
      fetchStudents(true);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/admin/students/${id}`, editForm);
      alert(res.message);
      setIsEditing(false);
      setStudentData(prev => prev ? {
        ...prev,
        student: { ...prev.student, name: editForm.name, phone: editForm.phone, email: editForm.email }
      } : null);
      fetchStudent(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const renderExpiryModal = () => {
    if (!editingEnrollment) return null;

    const currentExpiry = editingEnrollment.expires_at || editingEnrollment.effective_expires_at;
    const isCurrentlyExpired = currentExpiry ? new Date() > new Date(currentExpiry) : false;

    return (
      <div
        className="modal"
        onClick={(e) => { if (e.target === e.currentTarget) setEditingEnrollment(null); }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
      >
        <div className="panel" style={{ width: '100%', maxWidth: '540px', margin: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: '#c81e1e' }}></i>
              تعديل صلاحية اشتراك: <span style={{ color: '#c81e1e' }}>{editingEnrollment.course?.title || 'الكورس'}</span>
            </h3>
            <button className="btn-icon" onClick={() => setEditingEnrollment(null)} title="إغلاق"><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="panel-body">
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '3px' }}>تاريخ تفعيل الاشتراك:</span>
                  <strong style={{ fontSize: '13px' }}>{new Date(editingEnrollment.created_at).toLocaleDateString('ar-EG')}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '3px' }}>تاريخ الانتهاء الحالي:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '13px' }}>
                      {currentExpiry ? new Date(currentExpiry).toLocaleDateString('ar-EG') : 'دائم (بلا انتهاء)'}
                    </strong>
                    {currentExpiry && (
                      isCurrentlyExpired ? (
                        <span className="pill p-red" style={{ fontSize: '10px', padding: '2px 6px' }}>منتهي</span>
                      ) : (
                        <span className="pill p-green" style={{ fontSize: '10px', padding: '2px 6px' }}>نشط</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#166534' }}>
                <i className="fa-solid fa-plus-circle"></i>
                تمديد المدة (+):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ days_delta: 7 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', cursor: 'pointer' }}>+7 أيام</button>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ months_delta: 1 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#dcfce7', color: '#15803d', fontWeight: 'bold', cursor: 'pointer' }}>+شهر</button>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ months_delta: 3 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', cursor: 'pointer' }}>+3 شهور</button>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ months_delta: 6 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', cursor: 'pointer' }}>+6 شهور</button>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ months_delta: 12 })} className="btn btn-light btn-sm" style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', cursor: 'pointer' }}>+سنة</button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#991b1b' }}>
                <i className="fa-solid fa-minus-circle"></i>
                إنقاص المدة أو ضبط النوع:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ days_delta: -7 })} className="btn btn-light btn-sm" style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b', cursor: 'pointer' }}>-7 أيام</button>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ months_delta: -1 })} className="btn btn-light btn-sm" style={{ border: '1px solid #fca5a5', background: '#fee2e2', color: '#b91c1c', fontWeight: 'bold', cursor: 'pointer' }}>-شهر</button>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ months_delta: -3 })} className="btn btn-light btn-sm" style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b', cursor: 'pointer' }}>-3 شهور</button>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ set_lifetime: true })} className="btn btn-light btn-sm" style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af', fontWeight: 'bold', cursor: 'pointer' }}>جعله دائم (بلا انتهاء)</button>
                <button type="button" disabled={adjustingModal} onClick={() => handleAdjustEnrollment({ reset_to_default: true })} className="btn btn-light btn-sm" style={{ border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer' }}>إعادة ضبط للافتراضي</button>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '14px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                أو تعيين تاريخ انتهاء محدد مباشرةً:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="date"
                  value={modalExpiryInput}
                  onChange={(e) => setModalExpiryInput(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', flex: 1 }}
                />
                <button
                  type="button"
                  disabled={adjustingModal || !modalExpiryInput}
                  onClick={() => handleAdjustEnrollment({ expires_at: modalExpiryInput })}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  {adjustingModal ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  حفظ التاريخ
                </button>
              </div>
            </div>

            {adjustingModal && (
              <div style={{ marginTop: '12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ marginLeft: '6px', color: '#c81e1e' }}></i> جاري التعديل والحفظ...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <AdminLayout title="الطلاب المسجلين"><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  if (id) {
    if (!studentData) return <AdminLayout title="الطالب غير موجود">الطالب غير موجود</AdminLayout>;

    const { student: u, enrollments, orders, progress, activeSession, is_online } = studentData;

    return (
      <AdminLayout title={`الطالب: ${u.name}`}>
        <div className="grid-3">
          <div>
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-graduation-cap"></i> الكورسات المفعّلة ({enrollments.length})</h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>الكورس</th><th>التقدم</th><th>تاريخ التفعيل</th><th>انتهاء الصلاحية</th><th>آخر دخول</th><th>إدارة الاشتراك</th></tr></thead>
                  <tbody>
                    {enrollments.map(en => {
                      const p = progress.find(x => x.courseId === en.course?._id) || { percent: 0, done: 0, total: 0 };
                      const expiryDate = en.expires_at || en.effective_expires_at;
                      const isExpired = en.is_expired !== undefined
                        ? en.is_expired
                        : (expiryDate ? new Date() > new Date(expiryDate) : false);

                      return (
                        <tr key={en._id}>
                          <td><strong>{en.course?.title}</strong></td>
                          <td style={{ minWidth: '140px' }}>
                            <div style={{ height: '8px', background: '#f0f1f3', borderRadius: '9px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${p.percent}%`, background: '#c81e1e' }}></div>
                            </div>
                            <span className="sub">{p.done}/{p.total} ({p.percent}%)</span>
                          </td>
                          <td className="ltr" style={{ fontSize: '13px' }}>{new Date(en.created_at).toLocaleDateString()}</td>
                          <td>
                            {expiryDate ? (
                              isExpired ? (
                                <span className="pill p-red" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <i className="fa-solid fa-clock-rotate-left"></i> منتهي ({new Date(expiryDate).toLocaleDateString()})
                                </span>
                              ) : (
                                <span className="ltr" style={{ fontSize: '13px', color: '#166534', fontWeight: '500' }}>
                                  {new Date(expiryDate).toLocaleDateString()}
                                </span>
                              )
                            ) : (
                              <span className="pill p-green" style={{ fontSize: '11px' }}>دائم (بلا انتهاء)</span>
                            )}
                          </td>
                          <td className="ltr" style={{ fontSize: '13px' }}>{en.last_access ? new Date(en.last_access).toLocaleDateString() : '-'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-light btn-sm"
                                style={{ fontSize: '11.5px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: '600' }}
                                onClick={() => setEditingEnrollment(en)}
                                title="تعديل وزيادة/إنقاص مدة الصلاحية"
                              >
                                <i className="fa-solid fa-clock-rotate-left" style={{ color: '#c81e1e' }}></i>
                                تعديل المدة
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  fontSize: '11.5px',
                                  padding: '5px 10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px'
                                }}
                                onClick={() => handleDeleteEnrollment(en._id, en.course?.title)}
                                title="حذف الكورس وإلغاء اشتراك الطالب نهائياً"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                                حذف الكورس
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {enrollments.length === 0 && <tr><td colSpan="6" className="empty">لا يوجد كورسات مفعّلة</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2><i className="fa-solid fa-receipt"></i> طلبات الاشتراك</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>الكورس</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o._id}>
                        <td><span className="ltr" style={{ fontSize: '11px' }}>{o._id.slice(-6)}</span></td>
                        <td>{o.course?.title}</td>
                        <td>{o.amount} $</td>
                        <td className="ltr" style={{ fontSize: '13px' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td>
                          {o.status === 'approved' && o.is_expired ? (
                            <span className="pill p-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-clock-rotate-left"></i> انتهت الصلاحية
                            </span>
                          ) : (
                            <span className={`pill st-${o.status}`}>{o.status === 'pending' ? 'قيد المراجعة' : o.status === 'approved' ? 'مقبول' : 'مرفوض'}</span>
                          )}
                        </td>
                        <td><Link to={`/admin/orders?id=${o._id}`} className="btn btn-light btn-sm">عرض</Link></td>
                      </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan="6" className="empty">لا توجد طلبات</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div>
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-id-card"></i> بيانات الطالب</h2>
                <span className={`pill ${u.is_active ? 'p-green' : 'p-red'}`}>{u.is_active ? 'نشط' : 'موقوف'}</span>
              </div>
              <div className="panel-body">
                {isEditing ? (
                  <form onSubmit={handleUpdateStudent}>
                    <div className="field">
                      <label>الاسم</label>
                      <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                    </div>
                    <div className="field">
                      <label>الموبايل</label>
                      <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="ltr" required />
                    </div>
                    <div className="field">
                      <label>الإيميل</label>
                      <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="ltr" required />
                    </div>
                    <div className="field">
                      <label>كلمة المرور (اختياري)</label>
                      <input
                        type="password"
                        placeholder="حروف وأرقام (6 خانات على الأقل)"
                        value={editForm.password}
                        onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                        className="ltr"
                        pattern="(?=.*[A-Za-z])(?=.*\d).{6,}"
                        title="كلمة المرور يجب أن تكون 6 خانات على الأقل وتجمع بين الحروف والأرقام"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>حفظ التعديلات</button>
                      <button type="button" className="btn btn-light" onClick={() => setIsEditing(false)}>إلغاء</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <dl className="dl" style={{ gridTemplateColumns: '110px 1fr' }}>
                      <dt>الاسم</dt><dd>{u.name}</dd>
                      <dt>الموبايل</dt><dd className="ltr">{u.phone}</dd>
                      <dt>الإيميل</dt><dd className="ltr" style={{ wordBreak: 'break-all' }}>{u.email}</dd>
                      <dt>تاريخ التسجيل</dt><dd className="ltr">{new Date(u.created_at).toLocaleString()}</dd>
                    </dl>
                    <div style={{ display: 'grid', gap: '8px', marginTop: '16px' }}>
                      <Link
                        to={`/admin/user-activity?userId=${u._id}`}
                        className="btn btn-light"
                        style={{ width: '100%', justifyContent: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                      >
                        <i className="fa-solid fa-clock-rotate-left" style={{ color: '#c81e1e' }}></i> سجل نشاط وتدقيق الطالب (Timeline)
                      </Link>
                      <button className="btn btn-primary" onClick={() => { setIsEditing(true); setEditForm({ name: u.name, phone: u.phone, email: u.email, password: '' }); }} style={{ justifyContent: 'center' }}><i className="fa-solid fa-pen"></i> تعديل البيانات</button>
                      <a className="btn btn-success" style={{ justifyContent: 'center' }} target="_blank" rel="noreferrer" href={`https://wa.me/2${u.phone}`}><i className="fa-brands fa-whatsapp"></i> مراسلة على واتساب</a>
                      <button className="btn btn-light" onClick={toggleActive} style={{ width: '100%', justifyContent: 'center' }}><i className="fa-solid fa-user-lock"></i> {u.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}</button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteStudent(u._id, u.name)}
                        style={{ width: '100%', justifyContent: 'center', background: '#dc2626', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        <i className="fa-solid fa-trash-can" style={{ marginLeft: '6px' }}></i> حذف حساب الطالب نهائياً
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="panel" style={{ marginTop: '16px' }}>
              <div className="panel-head">
                <h2><i className="fa-solid fa-laptop"></i> الجلسة الحالية</h2>
                <span className={`pill ${is_online ? 'p-green' : 'p-gray'}`}>
                  {is_online ? 'متصل حالياً' : 'غير متصل'}
                </span>
              </div>
              <div className="panel-body">
                {activeSession ? (
                  <>
                    <dl className="dl" style={{ gridTemplateColumns: '95px 1fr' }}>
                      <dt>الجهاز</dt><dd>{activeSession.device || 'متصفح ويب'}</dd>
                      <dt>عنوان IP</dt><dd className="ltr">{activeSession.ip || 'غير متوفر'}</dd>
                      <dt>وقت الدخول</dt><dd className="ltr">{new Date(activeSession.created_at).toLocaleString()}</dd>
                      <dt>آخر نشاط</dt><dd className="ltr">{new Date(activeSession.last_active || activeSession.created_at).toLocaleString()}</dd>
                    </dl>
                    <button
                      className="btn btn-danger"
                      onClick={handleClearSession}
                      style={{ width: '100%', marginTop: '16px', justifyContent: 'center', background: '#dc2626', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      <i className="fa-solid fa-right-from-bracket" style={{ marginLeft: '6px' }}></i> إنهاء الجلسة وتسجيل الخروج
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '10px 0', color: '#888', fontSize: '13.5px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginLeft: '6px' }}></i>
                    لا توجد جلسة نشطة. يمكن للطالب الدخول من أي جهاز بحرية.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {renderExpiryModal()}
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="الطلاب المسجلين">
      <div className="panel">
        <div className="panel-head">
          <h2><i className="fa-solid fa-user-graduate"></i> الطلاب ({students.length})</h2>
          <form className="search" onSubmit={e => { e.preventDefault(); setSearchParams({ q: e.target.q.value }); }}>
            <input name="q" placeholder="بحث بالاسم / الموبايل / الإيميل" defaultValue={searchParams.get('q') || ''} />
            <button className="btn btn-dark btn-sm"><i className="fa-solid fa-magnifying-glass"></i></button>
          </form>
        </div>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafb', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'right', padding: '14px 16px', minWidth: '150px' }}>الاسم</th>
                <th style={{ textAlign: 'right', padding: '14px 16px', minWidth: '130px' }}>الموبايل</th>
                <th style={{ textAlign: 'right', padding: '14px 16px', minWidth: '200px' }}>البريد الإلكتروني</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', minWidth: '90px' }}>الكورسات</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', minWidth: '110px' }}>الجلسة</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', minWidth: '90px' }}>الحالة</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', minWidth: '130px' }}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {students.map(u => (
                <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ textAlign: 'right', padding: '14px 16px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '14px' }}>{u.name}</strong>
                  </td>
                  <td style={{ textAlign: 'right', padding: '14px 16px' }}>
                    <span dir="ltr" style={{ fontFamily: 'monospace', fontSize: '13.5px', color: '#334155', display: 'inline-block' }}>
                      {u.phone || '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '14px 16px' }}>
                    <span dir="ltr" style={{ color: '#64748b', fontSize: '13px', wordBreak: 'break-all', display: 'inline-block' }}>
                      {u.email}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                    <span className="pill p-blue" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                      {u.courses_count || 0}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                    {u.has_active_session ? (
                      <span className="pill p-green" title={u.active_session?.device || 'متصل'} style={{ fontSize: '12px' }}>
                        <i className="fa-solid fa-circle" style={{ fontSize: '7px', marginLeft: '5px' }}></i>متصل
                      </span>
                    ) : (
                      <span className="pill p-gray" style={{ fontSize: '12px' }}>
                        غير متصل
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                    <span className={`pill ${u.is_active ? 'p-green' : 'p-red'}`} style={{ fontSize: '12px' }}>
                      {u.is_active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                      <Link 
                        to={`/admin/students?id=${u._id}`} 
                        className="btn btn-light btn-sm" 
                        style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} 
                        title="إدارة وتعديل بيانات الطالب"
                      >
                        <i className="fa-solid fa-pen-to-square"></i> إدارة
                      </Link>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleDeleteStudent(u._id, u.name)}
                        title="حذف حساب الطالب"
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '5px 9px', borderRadius: '7px', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty" style={{ textAlign: 'center', padding: '40px' }}>
                    <i className="fa-solid fa-users" style={{ fontSize: '32px', color: '#cbd5e1', marginBottom: '10px', display: 'block' }}></i>
                    لا يوجد طلاب مسجلين
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {renderExpiryModal()}
    </AdminLayout>
  );
}

export default Students;
