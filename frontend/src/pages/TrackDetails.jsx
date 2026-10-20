import { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePageReady } from '../hooks/usePageReady';
import { api } from '../api';
import { AuthContext } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import SEO from '../components/common/SEO';
import { getAssetUrl } from '../utils/assetUrl';

function TrackDetails() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);
  const { settings } = useSettings();

  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);

  useEffect(() => {
    fetchTrack();
  }, [slug]);

  const fetchTrack = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tracks/${slug}`);
      setTrack(res.track);
    } catch (err) {
      console.error('Failed to fetch track details:', err);
      setTrack(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  if (!track) {
    return (
      <main className="section text-center" style={{ padding: '100px 0' }}>
        <div className="container">
          <i className="fa-solid fa-route" style={{ fontSize: '48px', color: '#94a3b8', marginBottom: '16px' }}></i>
          <h2>التراك غير موجود أو تم إخفاؤه</h2>
          <p className="muted" style={{ margin: '10px 0 20px' }}>تأكد من صحة الرابط أو تصفح باقي التراكات المتاحة.</p>
          <Link to="/courses" className="btn btn-primary">تصفح الكورسات والمسارات</Link>
        </div>
      </main>
    );
  }

  const courses = track.courses || [];
  const coverUrl = getAssetUrl(track.image, '/assets/img/courses/default.svg');
  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const trackSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    'name': track.title,
    'description': track.short_desc || track.description,
    'provider': {
      '@type': 'Organization',
      'name': settings?.site_name || 'منصة بهاء الأكاديمية',
      'sameAs': originUrl
    }
  };

  const learnPoints = (track.what_learn || '')
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean);

  const audiencePoints = (track.audience || '')
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <main>
      <SEO
        title={`تراك ${track.title}`}
        description={track.short_desc || track.description || 'تراك تعليمي متكامل يجمع عدة كورسات في مسار احترافي واحد.'}
        canonical={`/track/${track.slug}`}
        schema={trackSchema}
      />

      {/* Hero Section */}
      <section className="page-hero" style={{ padding: '60px 0 45px' }}>
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">الرئيسية</Link>
            <i className="fa-solid fa-chevron-left"></i>
            <Link to="/tracks">التراكات</Link>
            <i className="fa-solid fa-chevron-left"></i>
            <span>{track.title}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '40px', alignItems: 'center' }} className="hero-track-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(200,30,30,0.12)', color: '#ef4444', padding: '6px 14px', borderRadius: '50px', fontSize: '13px', fontWeight: 'bold' }}>
                  <i className="fa-solid fa-route"></i> مسار تعليمي متكامل
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '5px 12px', borderRadius: '50px', color: '#f59e0b', fontSize: '13px', fontWeight: 'bold' }}>
                  <i className="fa-solid fa-star"></i>
                  <span>{track.rating || '5.0'}</span>
                  <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 'normal' }}>
                    ({track.reviews_count || (track.reviews ? track.reviews.length : 0)} تقييم)
                  </span>
                </div>
              </div>

              <h1 style={{ fontSize: '32px', lineHeight: 1.3, marginBottom: '16px', color: '#fff' }}>
                {track.title}
              </h1>

              <p style={{ fontSize: '16px', color: '#cbd5e1', lineHeight: 1.7, maxWidth: '640px', margin: '0 0 24px' }}>
                {track.short_desc || track.description}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', color: '#94a3b8', fontSize: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-book-bookmark text-red"></i>
                  <strong>{courses.length}</strong> كورسات شاملة
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-circle-play text-red"></i>
                  <strong>{track.total_lessons || 0}</strong> درس تدريبي
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-clock-rotate-left text-red"></i>
                  صلاحية الوصول: <strong>{track.access_duration_unit === 'lifetime' ? 'دائم مدى الحياة' : `${track.access_duration_value || 1} ${track.access_duration_unit === 'hours' ? 'ساعة' : track.access_duration_unit === 'days' ? 'يوم' : track.access_duration_unit === 'months' ? 'شهر' : 'سنة'}`}</strong>
                </span>
              </div>
            </div>

            {/* Bundle Purchase Card in Hero */}
            <div>
              <div style={{
                background: '#1c1c21',
                borderRadius: '20px',
                padding: '28px',
                border: '1px solid #2d2d38',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                color: '#fff'
              }}>
                <div style={{
                  width: '100%',
                  height: '190px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  marginBottom: '20px',
                  background: '#09090b',
                  position: 'relative'
                }}>
                  <img
                    src={coverUrl}
                    alt={track.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/assets/img/courses/default.svg';
                    }}
                  />
                  {track.savings_percent > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '800',
                      padding: '4px 10px',
                      borderRadius: '50px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                    }}>
                      وفر {track.savings_percent}%
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    سعر باقة التراك الكاملة (كل الكورسات):
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontSize: '32px', fontWeight: '900', color: '#4ade80' }}>
                      ${track.price}
                    </span>
                    {track.total_individual_price > track.price && (
                      <del style={{ fontSize: '18px', color: '#64748b' }}>
                        ${track.total_individual_price}
                      </del>
                    )}
                  </div>
                  {track.savings_amount > 0 && (
                    <div style={{ fontSize: '13px', color: '#fbbf24', marginTop: '6px', fontWeight: 'bold' }}>
                      <i className="fa-solid fa-sparkles"></i> توفر ${track.savings_amount} مقارنة بشراء كل كورس منفرداً!
                    </div>
                  )}
                </div>

                {track.is_fully_enrolled ? (
                  <div style={{
                    background: 'rgba(22,163,74,0.15)',
                    border: '1px solid #16a34a',
                    padding: '14px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: '#86efac',
                    fontWeight: 'bold',
                    fontSize: '14.5px'
                  }}>
                    <i className="fa-solid fa-circle-check" style={{ marginInlineEnd: '6px' }}></i>
                    أنت مشترك بالفعل في جميع كورسات هذا التراك!
                  </div>
                ) : (
                  <>
                    <Link
                      to={`/checkout?track=${track.slug}`}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '15px',
                        fontSize: '16.5px',
                        fontWeight: '800',
                        borderRadius: '12px',
                        marginBottom: '12px'
                      }}
                    >
                      <i className="fa-solid fa-bag-shopping"></i> شراء التراك بالكامل (${track.price})
                    </Link>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                      <i className="fa-solid fa-shield-halved" style={{ marginInlineEnd: '4px', color: '#38bdf8' }}></i>
                      دفع آمن بالجنيه المصري عبر فودافون كاش أو انستاباي
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Courses Roadmap Section */}
      <section className="section" style={{ background: '#f8fafc', padding: '60px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px' }}>
            <span style={{ fontSize: '13.5px', color: '#c81e1e', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>
              خريطة المسار التعليمي
            </span>
            <h2 style={{ fontSize: '28px', color: '#0f172a', margin: '8px 0 12px' }}>
              الكورسات المشمولة في هذا التراك
            </h2>
            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6 }}>
              يمكنك الحصول على جميع هذه الكورسات مجتمعة عند شراء التراك، أو يمكنك النقر على أي كورس للاشتراك فيه منفرداً بسعره الخاص.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '980px', margin: '0 auto' }}>
            {courses.map((course, idx) => {
              const courseCover = getAssetUrl(course.image, '/assets/img/courses/default.svg');

              return (
                <div
                  key={course._id}
                  style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    display: 'grid',
                    gridTemplateColumns: '240px minmax(0, 1fr) 200px',
                    gap: '24px',
                    alignItems: 'center',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  className="track-course-row"
                >
                  {/* Course Thumbnail */}
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '145px', background: '#0f172a' }}>
                    <img
                      src={courseCover}
                      alt={course.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/assets/img/courses/default.svg';
                      }}
                    />
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(15,23,42,0.85)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      الكورس #{idx + 1}
                    </span>
                  </div>

                  {/* Course Details */}
                  <div>
                    <h3 style={{ fontSize: '18px', margin: '0 0 8px', color: '#0f172a' }}>
                      <Link to={`/course/${course.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {course.title}
                      </Link>
                    </h3>
                    <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 14px', lineHeight: 1.6 }}>
                      {course.short_desc || 'كورس تطبيقي شامل يقدم مهارات عملية واستراتيجيات احترافية خطوة بخطوة.'}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12.5px', color: '#64748b' }}>
                      <span><i className="fa-solid fa-circle-play text-red"></i> {course.lessons_count || 0} درس</span>
                      {course.duration && <span><i className="fa-regular fa-clock text-red"></i> {course.duration}</span>}
                      <span><i className="fa-solid fa-signal text-red"></i> {course.level || 'جميع المستويات'}</span>
                    </div>
                  </div>

                  {/* Course Pricing & Purchase Action */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: '10px',
                    borderRight: '1px solid #f1f5f9',
                    paddingRight: '20px'
                  }} className="track-course-pricing-cell">
                    <div style={{ textAlign: 'left', width: '100%' }}>
                      <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block' }}>سعر الكورس منفرداً:</span>
                      <strong style={{ fontSize: '22px', color: '#0f172a' }}>${course.price}</strong>
                    </div>

                    {course.enrolled ? (
                      <Link
                        to={`/account/learn/${course.slug}`}
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', justifyContent: 'center', background: '#16a34a', borderColor: '#16a34a', padding: '9px 12px' }}
                      >
                        <i className="fa-solid fa-play"></i> ابدأ المشاهدة
                      </Link>
                    ) : (
                      <>
                        <Link
                          to={`/checkout?course=${course.slug}&track=${track.slug}`}
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%', justifyContent: 'center', padding: '9px 12px', fontSize: '13px', fontWeight: 'bold' }}
                          title={`شراء كورس ${course.title} منفرداً بسعر $${course.price}`}
                        >
                          شراء هذا الكورس فقط
                        </Link>
                        <Link
                          to={`/course/${course.slug}`}
                          className="btn btn-dark btn-sm"
                          style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', fontSize: '12px' }}
                        >
                          تفاصيل الكورس <i className="fa-solid fa-arrow-left"></i>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom CTA to buy track */}
          {!track.is_fully_enrolled && (
            <div style={{
              background: '#1c1c21',
              color: '#fff',
              borderRadius: '20px',
              padding: '35px 30px',
              maxWidth: '980px',
              margin: '50px auto 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px',
              flexWrap: 'wrap'
            }}>
              <div>
                <h3 style={{ fontSize: '22px', margin: '0 0 8px', color: '#fff' }}>
                  جاهز لامتلاك التراك بالكامل وتوفير ${track.savings_amount || 0}؟
                </h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '14.5px' }}>
                  احصل على وصول فوري لجميع الـ ({courses.length}) كورسات ومحتوياتها الكاملة بسعر موحد.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '26px', fontWeight: '900', color: '#4ade80' }}>
                    ${track.price}
                  </div>
                  {track.total_individual_price > track.price && (
                    <del style={{ fontSize: '14px', color: '#64748b' }}>
                      بدلاً من ${track.total_individual_price}
                    </del>
                  )}
                </div>
                <Link
                  to={`/checkout?track=${track.slug}`}
                  className="btn btn-primary"
                  style={{ padding: '14px 28px', fontSize: '16px', fontWeight: 'bold', borderRadius: '12px' }}
                >
                  <i className="fa-solid fa-bag-shopping"></i> اشترك في التراك كاملاً
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Track Details & Outcomes */}
      {(learnPoints.length > 0 || audiencePoints.length > 0) && (
        <section className="section" style={{ padding: '60px 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', maxWidth: '980px', margin: '0 auto' }} className="track-info-grid">
              {learnPoints.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px' }}>
                  <h3 style={{ fontSize: '19px', color: '#0f172a', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-check text-red"></i> ماذا ستتعلم في هذا التراك؟
                  </h3>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {learnPoints.map((pt, i) => (
                      <li key={i} style={{ fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.6 }}>
                        <i className="fa-solid fa-check" style={{ color: '#16a34a', marginTop: '4px' }}></i>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {audiencePoints.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px' }}>
                  <h3 style={{ fontSize: '19px', color: '#0f172a', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-user-graduate text-red"></i> لمن هذا التراك؟
                  </h3>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {audiencePoints.map((pt, i) => (
                      <li key={i} style={{ fontSize: '14px', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.6 }}>
                        <i className="fa-solid fa-arrow-left" style={{ color: '#c81e1e', marginTop: '4px' }}></i>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Track Reviews Section */}
      {track.reviews && track.reviews.length > 0 && (
        <section className="section" style={{ background: '#f8fafc', padding: '60px 0', borderTop: '1px solid #e2e8f0' }}>
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px' }}>
              <span style={{ fontSize: '13.5px', color: '#c81e1e', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>
                آراء وتقييمات المتدربين
              </span>
              <h2 style={{ fontSize: '28px', color: '#0f172a', margin: '8px 0 12px' }}>
                ماذا يقول الطلاب عن هذا المسار؟
              </h2>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '18px', fontWeight: 'bold' }}>
                <span>{track.rating || '5.0'}</span>
                <div>
                  {[1, 2, 3, 4, 5].map(st => (
                    <i
                      key={st}
                      className={st <= Math.round(Number(track.rating) || 5) ? 'fa-solid fa-star' : 'fa-regular fa-star'}
                      style={{ marginLeft: '2px', fontSize: '15px' }}
                    ></i>
                  ))}
                </div>
                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>
                  ({track.reviews.length} تقييم)
                </span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '24px',
              maxWidth: '1000px',
              margin: '0 auto'
            }}>
              {track.reviews.map((rev, idx) => {
                const initial = (rev.user?.name || 'م')[0];
                const colors = ['#c81e1e', '#0f172a', '#b45309', '#1e3a8a', '#15803d', '#7c3aed'];
                const bg = colors[idx % colors.length];

                return (
                  <div
                    key={rev._id || idx}
                    style={{
                      background: '#fff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: bg,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '16px'
                        }}>
                          {initial}
                        </div>
                        <div>
                          <h4 style={{ margin: '0 0 2px', fontSize: '15px', color: '#0f172a' }}>
                            {rev.user?.name || 'متدرب متميز'}
                          </h4>
                          <small style={{ color: '#94a3b8', fontSize: '11.5px' }}>
                            {rev.created_at ? new Date(rev.created_at).toLocaleDateString('ar-EG') : 'متدرب بالمسار'}
                          </small>
                        </div>
                      </div>

                      <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
                        "{rev.comment}"
                      </p>
                    </div>

                    <div style={{ color: '#f59e0b', fontSize: '13px', marginTop: '16px' }}>
                      {[1, 2, 3, 4, 5].map(st => (
                        <i
                          key={st}
                          className={st <= (rev.rating || 5) ? 'fa-solid fa-star' : 'fa-regular fa-star'}
                          style={{ marginLeft: '2px' }}
                        ></i>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <style>{`
        @media (max-width: 900px) {
          .hero-track-grid {
            grid-template-columns: 1fr !important;
          }
          .track-course-row {
            grid-template-columns: 1fr !important;
            text-align: right;
          }
          .track-course-row > div:first-child {
            height: 180px !important;
            width: 100% !important;
          }
          .track-course-pricing-cell {
            border-right: none !important;
            border-top: 1px solid #f1f5f9;
            padding-right: 0 !important;
            padding-top: 16px;
            align-items: stretch !important;
          }
          .track-info-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

export default TrackDetails;
