import { useState, useEffect, useMemo } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import SEO from '../components/common/SEO';
import { getAssetUrl } from '../utils/assetUrl';
import CourseCard from '../components/CourseCard';

function Courses({ defaultTab }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryTab = searchParams.get('tab');
  // Determine active tab: query param > route pathname > defaultTab > 'tracks'
  const determineTab = () => {
    if (queryTab === 'courses' || queryTab === 'tracks') return queryTab;
    if (location.pathname === '/courses') return 'courses';
    if (location.pathname === '/tracks') return 'tracks';
    return defaultTab || 'tracks';
  };

  const [activeTab, setActiveTab] = useState(determineTab());
  const [tracks, setTracks] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);

  useEffect(() => {
    const nextTab = determineTab();
    setActiveTab(nextTab);
  }, [location.pathname, queryTab, defaultTab]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tracksRes, coursesRes, catsRes] = await Promise.all([
        api.get('/tracks').catch(() => ({ tracks: [] })),
        api.get('/courses').catch(() => ({ courses: [] })),
        api.get('/categories').catch(() => ({ categories: [] }))
      ]);

      setTracks(tracksRes.tracks || []);
      setAllCourses(coursesRes.courses || []);
      setCategories(catsRes.categories || []);
    } catch (err) {
      console.error('Error fetching tracks and courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'courses') {
      setSearchParams({ tab: 'courses' });
    } else {
      setSearchParams({});
    }
  };

  // Filter individual courses by search term and selected category
  const filteredCourses = useMemo(() => {
    return allCourses.filter(c => {
      const matchesSearch = !searchTerm.trim() || 
        c.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.short_desc?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || 
        (c.categories && c.categories.some(cat => (typeof cat === 'object' ? cat._id : cat) === selectedCategory));

      return matchesSearch && matchesCategory;
    });
  }, [allCourses, searchTerm, selectedCategory]);

  if (loading) return null;

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const isTracksTab = activeTab === 'tracks';

  const pageTitle = isTracksTab 
    ? 'المسارات التعليمية الاحترافية (التراكات)' 
    : 'الكورسات التدريبية المنفردة الشاملة';

  const pageDesc = isTracksTab
    ? 'مسارات تدريبية شاملة تجمع لك أهم الكورسات خطوة بخطوة — اشترك في المسار كاملاً بسعر مخفض ووفر أكثر، أو تصفح الكورسات المشمولة داخل كل مسار.'
    : 'تصفح جميع الكورسات التدريبية المتخصصة واشترك في أي كورس ترغب به منفرداً وبشكل مستقل مع وصول فوري للدروس والتطبيقات.';

  const breadcrumbsSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'الرئيسية',
        'item': originUrl
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': pageTitle,
        'item': `${originUrl}/tracks${isTracksTab ? '' : '?tab=courses'}`
      }
    ]
  };

  return (
    <main>
      <SEO
        title={pageTitle}
        description={pageDesc}
        canonical="/tracks"
        keywords={['تراكات تعليمية', 'كورسات تسويق', 'مسارات تدريبية', 'إعلانات ميتا', 'صناعة المحتوى', 'محمد بهاء']}
        schema={breadcrumbsSchema}
      />

      {/* Page Hero */}
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">الرئيسية</Link>
            <i className="fa-solid fa-chevron-left"></i>
            <span>{isTracksTab ? 'المسارات التعليمية (التراكات)' : 'الكورسات المنفردة'}</span>
          </div>

          <h1>{isTracksTab ? 'المسارات التعليمية الاحترافية' : 'الكورسات التدريبية المنفردة'}</h1>
          <p>
            {isTracksTab ? (
              'مسارات متكاملة تجمع لك أقوى الكورسات خطوة بخطوة لنقلك للاحتراف الفعلي مع توفير كبير في التكلفة وشهادة تراك معتمدة.'
            ) : (
              'تصفح باقة الكورسات التدريبية المتخصصة واشترك في أي كورس تريده منفرداً ومستقلاً مع متابعة وتطبيق عملي.'
            )}
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: '35px', paddingBottom: '80px' }}>
        <div className="container">
          {/* Main Navigation Tab Switcher */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '35px' }}>
            <div style={{
              display: 'inline-flex',
              background: '#0f172a',
              padding: '6px',
              borderRadius: '16px',
              border: '1px solid #1e293b',
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              gap: '6px',
              maxWidth: '100%',
              overflowX: 'auto'
            }}>
              <button
                type="button"
                onClick={() => handleTabChange('tracks')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14.5px',
                  fontWeight: '800',
                  background: activeTab === 'tracks' ? 'linear-gradient(135deg, #c81e1e 0%, #991b1b 100%)' : 'transparent',
                  color: activeTab === 'tracks' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.25s ease',
                  boxShadow: activeTab === 'tracks' ? '0 4px 14px rgba(200,30,30,0.35)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <i className="fa-solid fa-layer-group"></i>
                <span>المسارات التعليمية (التراكات)</span>
                <span style={{
                  background: activeTab === 'tracks' ? 'rgba(255,255,255,0.25)' : '#1e293b',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 'bold'
                }}>
                  {tracks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('courses')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14.5px',
                  fontWeight: '800',
                  background: activeTab === 'courses' ? 'linear-gradient(135deg, #c81e1e 0%, #991b1b 100%)' : 'transparent',
                  color: activeTab === 'courses' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.25s ease',
                  boxShadow: activeTab === 'courses' ? '0 4px 14px rgba(200,30,30,0.35)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <i className="fa-solid fa-graduation-cap"></i>
                <span>الكورسات التدريبية المنفردة</span>
                <span style={{
                  background: activeTab === 'courses' ? 'rgba(255,255,255,0.25)' : '#1e293b',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 'bold'
                }}>
                  {allCourses.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: TRACKS TAB */}
          {activeTab === 'tracks' && (
            <div>
              {tracks.length > 0 ? (
                <div className="courses-grid">
                  {tracks.map((track) => {
                    const trackCourses = track.courses || [];
                    const coverUrl = getAssetUrl(track.image, '/assets/img/courses/default.svg');

                    return (
                      <article key={track._id} className="course-card reveal" style={{ display: 'flex', flexDirection: 'column' }}>
                        <Link to={`/track/${track.slug}`} className="course-thumb">
                          <img
                            src={coverUrl}
                            alt={`تراك ${track.title}`}
                            loading="lazy"
                            width="800"
                            height="500"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/assets/img/courses/default.svg';
                            }}
                          />
                          <span className="course-badge" style={{ background: '#0f172a', color: '#38bdf8' }}>
                            <i className="fa-solid fa-layer-group"></i> مسار تعليمي متكامل
                          </span>
                          {track.savings_percent > 0 && (
                            <span className="course-discount">وفر {track.savings_percent}%</span>
                          )}
                        </Link>

                        <div className="course-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div className="course-cats">
                            <span style={{ background: '#fef2f2', color: '#c81e1e', fontWeight: 'bold' }}>
                              <i className="fa-solid fa-route"></i> تراك شامل
                            </span>
                          </div>

                          <h3>
                            <Link to={`/track/${track.slug}`}>{track.title}</Link>
                          </h3>

                          <p style={{ minHeight: '44px' }}>
                            {track.short_desc || 'مسار متكامل يضم مجموعة منتقاة من الكورسات لنقلك لمستوى الاحتراف والتطبيق الفعلي.'}
                          </p>

                          <div className="course-meta" style={{ marginBottom: '14px' }}>
                            <span>
                              <i className="fa-solid fa-book-bookmark text-red"></i> {track.courses_count || trackCourses.length} كورسات
                            </span>
                            <span>
                              <i className="fa-solid fa-circle-play"></i> {track.total_lessons || 0} درس
                            </span>
                          </div>

                          {/* Included courses preview with individual prices */}
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            marginBottom: '16px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' }}>
                              الكورسات المشمولة (متاح شراء أي كورس منفرداً):
                            </div>
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {trackCourses.slice(0, 3).map((c) => (
                                <li key={c._id} style={{ fontSize: '12px', color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '190px' }}>
                                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', marginInlineEnd: '5px', fontSize: '10px' }}></i>
                                    {c.title}
                                  </span>
                                  <strong style={{ fontSize: '11px', color: '#64748b' }}>${c.price}</strong>
                                </li>
                              ))}
                              {trackCourses.length > 3 && (
                                <li style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 'bold', marginTop: '2px' }}>
                                  + {trackCourses.length - 3} كورسات أخرى داخل هذا المسار
                                </li>
                              )}
                            </ul>
                          </div>

                          <div className="course-foot" style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                            <div>
                              <div className="price">
                                {track.total_individual_price > track.price && (
                                  <del>${track.total_individual_price}</del>
                                )}
                                ${track.price}
                              </div>
                              {track.savings_amount > 0 && (
                                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold', display: 'block' }}>
                                  توفير ${track.savings_amount}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '6px' }}>
                              <Link to={`/track/${track.slug}`} className="btn btn-dark btn-sm" style={{ padding: '8px 12px', fontSize: '12.5px' }}>
                                استعراض الكورسات <i className="fa-solid fa-arrow-left"></i>
                              </Link>
                              {track.is_fully_enrolled ? (
                                <span className="pill p-green" style={{ display: 'flex', alignItems: 'center', fontSize: '11.5px', fontWeight: 'bold' }}>
                                  <i className="fa-solid fa-circle-check" style={{ marginInlineEnd: '3px' }}></i> مشترك
                                </span>
                              ) : (
                                <Link to={`/checkout?track=${track.slug}`} className="btn btn-primary btn-sm" style={{ padding: '8px 14px', fontSize: '12.5px', fontWeight: 'bold' }}>
                                  شراء المسار
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty" style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <i className="fa-solid fa-route fa-3x" style={{ color: '#cbd5e1', marginBottom: '16px' }}></i>
                  <h3>لا توجد مسارات تعليمية منشورة حالياً</h3>
                  <p>يتم تجهيز مسارات وتراكات تعليمية شاملة وسيتم نشرها قريباً.</p>
                </div>
              )}

              {/* Bottom Switcher Callout */}
              <div style={{ marginTop: '50px', background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>
                    <i className="fa-solid fa-graduation-cap text-red" style={{ marginInlineEnd: '6px' }}></i>
                    تبحث عن كورس تدريبي محدد؟
                  </h4>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13.5px' }}>
                    يمكنك تصفح جميع الكورسات التدريبية منفرداً والاشتراك في أي كورس مستقل تريده.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange('courses')}
                  className="btn btn-outline btn-sm"
                  style={{ fontWeight: 'bold', padding: '10px 20px' }}
                >
                  استعراض الكورسات المنفردة <i className="fa-solid fa-arrow-left"></i>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: INDIVIDUAL COURSES TAB */}
          {activeTab === 'courses' && (
            <div>
              {/* Filter & Search Bar */}
              <div style={{
                background: '#fff',
                padding: '16px 20px',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                marginBottom: '28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                {/* Search */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '2px 14px', flex: '1 1 240px', maxWidth: '360px' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ color: '#94a3b8', marginInlineEnd: '10px' }}></i>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث عن اسم الكورس أو موضوعه..."
                    style={{ border: 'none', background: 'transparent', padding: '10px 0', fontSize: '13.5px', width: '100%', outline: 'none' }}
                  />
                  {searchTerm && (
                    <button type="button" onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                {categories.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        background: selectedCategory === 'all' ? '#0f172a' : '#f1f5f9',
                        color: selectedCategory === 'all' ? '#fff' : '#64748b'
                      }}
                    >
                      الكل ({allCourses.length})
                    </button>
                    {categories.map(cat => {
                      const count = allCourses.filter(c => c.categories && c.categories.some(cc => (typeof cc === 'object' ? cc._id : cc) === cat._id)).length;
                      return (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => setSelectedCategory(cat._id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            background: selectedCategory === cat._id ? '#0f172a' : '#f1f5f9',
                            color: selectedCategory === cat._id ? '#fff' : '#64748b',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {cat.name} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {filteredCourses.length > 0 ? (
                <div className="courses-grid">
                  {filteredCourses.map((c, i) => (
                    <CourseCard key={c._id} course={c} index={i} />
                  ))}
                </div>
              ) : (
                <div className="empty" style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <i className="fa-solid fa-graduation-cap fa-3x" style={{ color: '#cbd5e1', marginBottom: '16px' }}></i>
                  <h3>لم يتم العثور على أي كورسات تطابق بحثك</h3>
                  <p style={{ color: '#64748b', margin: '4px 0 16px' }}>جرب البحث بكلمة مختلفة أو اختر تصنيفاً آخر.</p>
                  {(searchTerm || selectedCategory !== 'all') && (
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
                      className="btn btn-outline btn-sm"
                    >
                      عرض جميع الكورسات
                    </button>
                  )}
                </div>
              )}

              {/* Bottom Switcher Callout to Tracks */}
              <div style={{ marginTop: '50px', background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>
                    <i className="fa-solid fa-layer-group text-red" style={{ marginInlineEnd: '6px' }}></i>
                    تريد باقة مسار متكامل بسعر مخفض؟
                  </h4>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13.5px' }}>
                    استعرض التراكات الشاملة التي تجمع لك عدة كورسات مترابطة بخصم حزمة مميز وشهادة معتمدة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange('tracks')}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 'bold', padding: '10px 20px' }}
                >
                  استعراض المسارات التعليمية (التراكات) <i className="fa-solid fa-arrow-left"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default Courses;
