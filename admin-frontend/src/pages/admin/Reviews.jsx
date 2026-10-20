import { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { api } from '../../api';

function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterHome, setFilterHome] = useState('all'); // 'all', 'home_only', 'not_home'
  const [filterType, setFilterType] = useState('all'); // 'all', 'courses', 'tracks'
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reviews');
      setReviews(res.reviews || []);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تحميل آراء المتدربين');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHome = async (review) => {
    try {
      setTogglingId(review._id);
      const res = await api.put(`/admin/reviews/${review._id}/toggle-home`);
      setReviews(prev =>
        prev.map(r => r._id === review._id ? { ...r, show_on_home: res.show_on_home } : r)
      );
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء تعديل حالة العرض');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id, studentName) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف رأي الطالب "${studentName || 'المتدرب'}"؟`);
    if (!confirmed) return;

    try {
      const res = await api.delete(`/admin/reviews/${id}`);
      alert(res.message || 'تم حذف التقييم بنجاح');
      setReviews(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء حذف التقييم');
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (filterHome === 'home_only' && !r.show_on_home) return false;
    if (filterHome === 'not_home' && r.show_on_home) return false;
    if (filterType === 'courses' && (!r.course || r.track)) return false;
    if (filterType === 'tracks' && !r.track) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const sName = (r.user?.name || '').toLowerCase();
      const sEmail = (r.user?.email || '').toLowerCase();
      const cTitle = (r.course?.title || '').toLowerCase();
      const tTitle = (r.track?.title || '').toLowerCase();
      const comment = (r.comment || '').toLowerCase();
      return sName.includes(q) || sEmail.includes(q) || cTitle.includes(q) || tTitle.includes(q) || comment.includes(q);
    }
    return true;
  });

  const totalReviews = reviews.length;
  const homeCount = reviews.filter(r => r.show_on_home).length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / totalReviews).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <AdminLayout title="آراء المتدربين">
        <div style={{ padding: '100px 0', textAlign: 'center' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="آراء المتدربين">
      {/* بطاقات الإحصائيات السريعة */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>إجمالي التقييمات</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{totalReviews}</div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              <i className="fa-solid fa-comments"></i>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>معروضة في الرئيسية</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>{homeCount}</div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              <i className="fa-solid fa-house-circle-check"></i>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>متوسط التقييم العام</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>
                {avgRating} <span style={{ fontSize: '18px' }}>★</span>
              </div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              <i className="fa-solid fa-star"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2><i className="fa-solid fa-comments text-red" style={{ marginLeft: '8px' }}></i> آراء وتقييمات المتدربين ({filteredReviews.length})</h2>
            <small style={{ color: '#64748b' }}>
              التقييمات التي يكتبها الطلاب بعد إتمام الكورسات بالكامل، مع إمكانية تحديد ما يظهر منها في سيكشن "آراء المتدربين" في الصفحة الرئيسية
            </small>
          </div>

          {/* فلاتر البحث والفرز */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="بحث بالطالب، الكورس، أو الرأي..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingRight: '32px', paddingLeft: '12px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: '220px' }}
              />
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px' }}></i>
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', background: '#fff' }}
            >
              <option value="all">كل الأنواع ({totalReviews})</option>
              <option value="courses">الكورسات فقط ({reviews.filter(r => r.course && !r.track).length})</option>
              <option value="tracks">التراكات فقط ({reviews.filter(r => r.track).length})</option>
            </select>

            <select
              value={filterHome}
              onChange={(e) => setFilterHome(e.target.value)}
              style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', background: '#fff' }}
            >
              <option value="all">كل التقييمات ({totalReviews})</option>
              <option value="home_only">المعروضة بالرئيسية فقط ({homeCount})</option>
              <option value="not_home">غير المعروضة ({totalReviews - homeCount})</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المتدرب</th>
                <th>الكورس / المسار</th>
                <th>التقييم</th>
                <th style={{ minWidth: '320px' }}>رأي المتدرب</th>
                <th>تاريخ الإرسال</th>
                <th>العرض في الرئيسية</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map(r => {
                const isToggling = togglingId === r._id;

                return (
                  <tr key={r._id} style={{ background: r.show_on_home ? '#f8fafc' : 'inherit' }}>
                    {/* المتدرب */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #c81e1e 0%, #8b0000 100%)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '15px',
                          flexShrink: 0
                        }}>
                          {(r.user?.name || 'م')[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14px' }}>
                            {r.user?.name || 'مستخدم غير معروف'}
                          </div>
                          {r.user?.email && (
                            <small style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>
                              {r.user.email}
                            </small>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* الكورس أو المسار */}
                    <td>
                      {r.track ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#fef2f2',
                            color: '#c81e1e',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            width: 'fit-content'
                          }}>
                            <i className="fa-solid fa-route"></i> تراك تعليمي
                          </span>
                          <span style={{ color: '#0f172a', fontWeight: '700', fontSize: '13.5px' }}>
                            {r.track.title}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            width: 'fit-content'
                          }}>
                            <i className="fa-solid fa-book-open"></i> كورس منفرد
                          </span>
                          <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '13.5px' }}>
                            {r.course?.title || 'كورس محذوف'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* التقييم */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ color: '#f59e0b', fontSize: '13px' }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <i
                              key={star}
                              className={star <= (r.rating || 5) ? 'fa-solid fa-star' : 'fa-regular fa-star'}
                              style={{ marginLeft: '2px' }}
                            ></i>
                          ))}
                        </div>
                        <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '13px', marginRight: '4px' }}>
                          ({r.rating || 5})
                        </span>
                      </div>
                    </td>

                    {/* رأي المتدرب */}
                    <td>
                      <div style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        fontSize: '13.5px',
                        lineHeight: '1.6',
                        color: '#334155'
                      }}>
                        "{r.comment}"
                      </div>
                    </td>

                    {/* التاريخ */}
                    <td>
                      <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                        <i className="fa-regular fa-calendar" style={{ marginLeft: '4px' }}></i>
                        {new Date(r.created_at).toLocaleDateString('ar-EG')}
                      </div>
                    </td>

                    {/* الظهور في الرئيسية */}
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleHome(r)}
                        disabled={isToggling}
                        style={{
                          background: r.show_on_home ? '#dcfce7' : '#f1f5f9',
                          color: r.show_on_home ? '#15803d' : '#64748b',
                          border: r.show_on_home ? '1px solid #86efac' : '1px solid #cbd5e1',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                        title={r.show_on_home ? 'اضغط لإلغاء عرضه في الصفحة الرئيسية' : 'اضغط للسماح بعرضه في الصفحة الرئيسية'}
                      >
                        {isToggling ? (
                          <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : r.show_on_home ? (
                          <>
                            <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }}></i>
                            معروض بالرئيسية
                          </>
                        ) : (
                          <>
                            <i className="fa-regular fa-circle"></i>
                            إظهار في الرئيسية
                          </>
                        )}
                      </button>
                    </td>

                    {/* إجراءات */}
                    <td>
                      <button
                        type="button"
                        onClick={() => handleDelete(r._id, r.user?.name)}
                        className="btn btn-danger btn-sm btn-icon"
                        title="حذف هذا الرأي"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredReviews.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-solid fa-comments fa-3x" style={{ display: 'block', marginBottom: '10px', color: '#cbd5e1' }}></i>
                    لا توجد آراء متدربين مطابقة للبحث حالياً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Reviews;
