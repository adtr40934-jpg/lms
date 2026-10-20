import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import { io } from 'socket.io-client';
import { getAssetUrl } from '../../utils/assetUrl';
import { getBackendOrigin } from '../../utils/backendUrl';

function Tracks() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTracks();

    const socket = io(getBackendOrigin(), {
      withCredentials: true
    });

    socket.on('data_updated', () => {
      fetchTracks(true);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchTracks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get('/tracks/admin/all');
      setTracks(res.tracks || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await api.patch(`/tracks/admin/${id}/toggle`);
      setTracks(tracks.map(t => t._id === id ? { ...t, is_published: res.is_published } : t));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = (id) => {
    window.SwalConfirm('هل أنت متأكد من حذف هذا التراك؟ لن يتم حذف الكورسات، بل سيتم إلغاء ربطها بالتراك.', async () => {
      try {
        const res = await api.delete(`/tracks/admin/${id}`);
        alert(res.message);
        fetchTracks();
      } catch (err) {
        alert(err.message);
      }
    });
  };

  if (loading) {
    return (
      <AdminLayout title="التراكات التعليمية">
        <div style={{ padding: '100px 0', textAlign: 'center' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="التراكات التعليمية (المسارات)">
      <div className="panel">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2><i className="fa-solid fa-route"></i> جميع التراكات التعليمية ({tracks.length})</h2>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
              نظام التراكات يتيح تجميع عدة كورسات معاً في مسار متكامل بسعر موحد مخفض، مع إمكانية شراء كل كورس منفرداً بسعره الخاص.
            </p>
          </div>
          <Link to="/admin/track-form" className="btn btn-primary" style={{ padding: '9px 18px', gap: '8px' }}>
            <i className="fa-solid fa-circle-plus"></i> إضافة تراك جديد
          </Link>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>التراك</th>
                <th>سعر باقة التراك</th>
                <th>الكورسات المشمولة</th>
                <th>التوفير للطالب</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map(t => {
                const courses = t.courses || [];
                const totalCoursePrice = courses.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
                const trackPrice = Number(t.price) || 0;
                const savings = Math.max(0, totalCoursePrice - trackPrice);
                const savingsPercent = totalCoursePrice > 0 && savings > 0 
                  ? Math.round((savings / totalCoursePrice) * 100) 
                  : 0;

                return (
                  <tr key={t._id}>
                    <td>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '10px',
                          background: t.image ? '#000' : 'linear-gradient(135deg, #c81e1e 0%, #8b0000 100%)',
                          overflow: 'hidden',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0
                        }}>
                          {t.image ? (
                            <img
                              src={getAssetUrl(t.image)}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <i className={t.icon || 'fa-solid fa-route'} style={{ color: '#fff', fontSize: '22px' }}></i>
                          )}
                        </div>
                        <div>
                          <strong>{t.title}</strong>
                          <span className="sub ltr">/track/{t.slug}</span>
                          {t.short_desc && (
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.short_desc}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontWeight: '800', fontSize: '16px', color: trackPrice > 0 ? '#16a34a' : '#2563eb' }}>
                          ${trackPrice}
                        </span>
                        {t.old_price && t.old_price > trackPrice && (
                          <del style={{ fontSize: '12px', color: '#94a3b8' }}>
                            ${t.old_price}
                          </del>
                        )}
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          صلاحية: {t.access_duration_unit === 'lifetime' ? 'دائم' : `${t.access_duration_value || 1} ${t.access_duration_unit === 'hours' ? 'ساعة' : t.access_duration_unit === 'days' ? 'يوم' : t.access_duration_unit === 'months' ? 'شهر' : 'سنة'}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                          <i className="fa-solid fa-book-bookmark text-red" style={{ marginLeft: '4px' }}></i>
                          {courses.length} {courses.length === 1 ? 'كورس' : 'كورسات'}
                        </strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px', maxWidth: '280px' }}>
                          {courses.slice(0, 3).map(c => (
                            <span key={c._id} className="pill p-gray" style={{ fontSize: '11px', padding: '2px 7px' }}>
                              {c.title} (${c.price})
                            </span>
                          ))}
                          {courses.length > 3 && (
                            <span className="pill p-blue" style={{ fontSize: '10.5px' }}>
                              +{courses.length - 3} كورسات أخرى
                            </span>
                          )}
                          {courses.length === 0 && (
                            <span style={{ fontSize: '11.5px', color: '#eab308' }}>
                              <i className="fa-solid fa-triangle-exclamation"></i> لا توجد كورسات مضافة بعد
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {totalCoursePrice > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            مجموع الكورسات: <strong>${totalCoursePrice}</strong>
                          </span>
                          {savings > 0 ? (
                            <span className="pill p-green" style={{ fontSize: '11px', fontWeight: '800' }}>
                              وفر ${savings} ({savingsPercent}%)
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>بدون فارق سعر</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggle(t._id)}
                        className={`pill ${t.is_published ? 'p-green' : 'p-gray'}`}
                        style={{ border: 0, cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        {t.is_published ? 'منشور' : 'مخفي'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Link to={`/admin/track-form?id=${t._id}`} className="btn btn-dark btn-sm" title="تعديل التراك والكورسات">
                          <i className="fa-solid fa-pen-to-square"></i> تعديل
                        </Link>
                        <a
                          href={`/track/${t.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-light btn-sm"
                          title="معاينة في الموقع"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(t._id)}
                          className="btn btn-danger btn-sm"
                          title="حذف التراك"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tracks.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <i className="fa-solid fa-route" style={{ fontSize: '42px', color: '#94a3b8', marginBottom: '12px', display: 'block' }}></i>
                    <h3 style={{ margin: '0 0 6px 0' }}>لا توجد تراكات تعليمية مضافة</h3>
                    <p style={{ margin: '0 0 16px 0', color: '#64748b' }}>
                      ابدأ بإنشاء تراك تعليمي واجمع داخله مجموعة من الكورسات بسعر حزمة مخفض.
                    </p>
                    <Link to="/admin/track-form" className="btn btn-primary btn-sm">
                      <i className="fa-solid fa-plus"></i> إضافة أول تراك
                    </Link>
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

export default Tracks;
