import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import { io } from 'socket.io-client';
import { getAssetUrl } from '../../utils/assetUrl';
import { getBackendOrigin } from '../../utils/backendUrl';

function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    fetchCourses();

    const socket = io(getBackendOrigin(), {
      withCredentials: true
    });

    socket.on('data_updated', () => {
      fetchCourses(true);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const openStats = async (course) => {
    setSelectedCourse(course);
    setShowStatsModal(true);
    setStatsLoading(true);
    try {
      const res = await api.get(`/courses/admin/${course._id}/content`);
      setStatsData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchCourses = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/courses/admin/all');
      setCourses(res.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await api.patch(`/courses/admin/${id}/toggle`);
      setCourses(courses.map(c => c._id === id ? { ...c, is_published: res.is_published } : c));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = (id) => {
    window.SwalConfirm('هل أنت متأكد من حذف الكورس نهائياً؟ سيتم إلغاء اشتراكات جميع الطلاب وحذفه من حساباتهم ومسح كافة المحاضرات والأقسام التابعة له.', async () => {
      try {
        const res = await api.delete(`/courses/admin/${id}`);
        alert(res.message);
        fetchCourses();
      } catch (err) {
        alert(err.message);
      }
    });
  };

  if (loading) return <AdminLayout title="الكورسات"><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  return (
    <AdminLayout title="الكورسات">
      <div className="panel">
        <div className="panel-head">
          <h2><i className="fa-solid fa-book-open"></i> كل الكورسات ({courses.length})</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>الكورس</th><th>السعر</th><th>المحتوى</th><th>الطلاب</th><th>الحالة</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c._id}>
                  <td>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <img 
                        className="thumb" 
                        src={getAssetUrl(c.image, '/assets/img/courses/default.svg')} 
                        alt="" 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/assets/img/courses/default.svg';
                        }}
                      />
                      <div>
                        <strong>{c.title}</strong>
                        <span className="sub ltr">/course/{c.slug}</span>
                        {c.track && (
                          <span className="pill p-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                            <i className="fa-solid fa-route"></i> تراك: {c.track.title || c.track}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: '600', color: c.price > 0 ? '#16a34a' : '#2563eb' }}>
                    {c.price > 0 ? `${c.price} $` : 'مجاني'}
                  </td>
                  <td>
                    {c.secs || 0} أقسام
                    <span className="sub">{c.lessons || 0} محاضرة {c.duration ? `• ${c.duration}` : ''}</span>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '3px' }}>
                      <i className="fa-regular fa-clock" style={{ marginLeft: '3px', color: '#c81e1e' }}></i>
                      صلاحية: {c.access_duration_unit === 'lifetime' ? 'دائم' : `${c.access_duration_value || 1} ${c.access_duration_unit === 'hours' ? 'ساعة' : c.access_duration_unit === 'days' ? 'يوم' : c.access_duration_unit === 'months' ? 'شهر' : 'سنة'}`}
                    </span>
                  </td>
                  <td>{c.students || 0}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                      <button onClick={() => handleToggle(c._id)} className={`pill ${c.is_published ? 'p-green' : 'p-gray'}`} style={{ border: 0, cursor: 'pointer' }}>
                        {c.is_published ? 'منشور' : 'مخفي'}
                      </button>
                      {c.is_soon && (
                        <span className="pill" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '11px', fontWeight: 'bold' }}>
                          <i className="fa-solid fa-hourglass-start" style={{ marginLeft: '4px' }}></i> قريباً
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" onClick={() => openStats(c)} className="btn btn-primary btn-sm"><i className="fa-solid fa-chart-pie"></i> تفاصيل الكورس</button>
                      <Link to={`/admin/course-form?id=${c._id}`} className="btn btn-light btn-sm"><i className="fa-solid fa-pen"></i> تعديل</Link>
                      <Link to={`/admin/course-content?id=${c._id}`} className="btn btn-dark btn-sm"><i className="fa-solid fa-list-ul"></i> الأقسام والمحاضرات</Link>
                      <Link to={`/course/${c.slug}`} target="_blank" className="btn btn-light btn-sm btn-icon" title="عرض"><i className="fa-solid fa-eye"></i></Link>
                      <button type="button" onClick={() => handleDelete(c._id)} className="btn btn-danger btn-sm btn-icon" title="حذف"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr><td colSpan="6" className="empty"><i className="fa-solid fa-book"></i>لا توجد كورسات. <Link to="/admin/course-form" style={{ color: '#c81e1e', fontWeight: 800 }}>أضف أول كورس</Link></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showStatsModal && selectedCourse && (
        <div className="modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="panel" style={{ width: '100%', maxWidth: '850px', background: '#fff', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '20px', color: '#0f172a' }}><i className="fa-solid fa-chart-line text-primary"></i> إحصائيات وتقييمات الكورس</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{selectedCourse.title}</p>
              </div>
              <button className="btn-icon" onClick={() => setShowStatsModal(false)} style={{ background: '#e2e8f0', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="panel-body" style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-primary"></i></div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        <i className="fa-solid fa-users"></i>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>إجمالي الطلاب</span>
                        <strong style={{ fontSize: '24px', color: '#0f172a' }}>{selectedCourse.students}</strong>
                      </div>
                    </div>
                    
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: '#fefce8', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        <i className="fa-solid fa-star"></i>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>التقييم العام للكورس</span>
                        <strong style={{ fontSize: '24px', color: '#0f172a' }}>
                          {statsData?.globalRating || 0}
                          <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'normal', marginRight: '6px' }}>من 5</span>
                        </strong>
                      </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        <i className="fa-solid fa-comments"></i>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>عدد التقييمات للدروس</span>
                        <strong style={{ fontSize: '24px', color: '#0f172a' }}>{statsData?.totalRatingCount || 0}</strong>
                      </div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '16px', marginBottom: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-list-check text-primary"></i> تفاصيل تقييمات الدروس
                  </h4>
                  
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', margin: 0 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '14px' }}>اسم الدرس</th>
                          <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '14px', width: '150px', textAlign: 'center' }}>متوسط التقييم</th>
                          <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '14px', width: '150px', textAlign: 'center' }}>عدد المصوتين</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsData?.sections?.flatMap(s => s.lessons).map((l, idx) => (
                          <tr key={l._id} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                            <td style={{ padding: '14px 16px', color: '#0f172a', fontWeight: '500' }}>
                              <span style={{ display: 'inline-block', width: '24px', color: '#94a3b8', fontSize: '13px' }}>{idx + 1}.</span> {l.title}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              {l.ratingStats && l.ratingStats.count > 0 ? (
                                <span style={{ color: '#eab308', fontWeight: 'bold', fontSize: '15px', background: '#fefce8', padding: '4px 10px', borderRadius: '20px' }}>
                                  {l.ratingStats.avgRating} <i className="fa-solid fa-star" style={{ fontSize: '12px' }}></i>
                                </span>
                              ) : <span style={{ color: '#cbd5e1', fontSize: '13px' }}>غير مقيم</span>}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b' }}>
                              {l.ratingStats?.count || 0}
                            </td>
                          </tr>
                        ))}
                        {(!statsData?.sections || statsData.sections.length === 0) && (
                          <tr><td colSpan="3" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>لا توجد دروس أو تقييمات في هذا الكورس بعد.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Courses;
