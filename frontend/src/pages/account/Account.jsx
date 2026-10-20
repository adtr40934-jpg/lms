import StudentCertificateModal from '../../components/StudentCertificateModal';
import { useState, useEffect, useContext } from 'react';
import { usePageReady } from '../../hooks/usePageReady';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { getAssetUrl, formatExternalUrl } from '../../utils/assetUrl';
import DiscountBanner from '../../components/DiscountBanner';
import SEO from '../../components/common/SEO';
import { useSocketRefetch } from '../../hooks/useSocketRefetch';
import './Account.css';

function Account() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'courses';
  const { user, logout, login } = useContext(AuthContext);
  const { settings, loadingSettings } = useSettings();
  const navigate = useNavigate();

  const [myCourses, setMyCourses] = useState([]);
  const [accountCourseFilter, setAccountCourseFilter] = useState('all'); // 'all' | 'tracks' | 'courses'
  const [orders, setOrders] = useState([]);
  const urlFilter = searchParams.get('filter');
  const [orderFilter, setOrderFilter] = useState(urlFilter || 'all');
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const [activeCertCourseId, setActiveCertCourseId] = useState(null);
  const [activeCertIsTrack, setActiveCertIsTrack] = useState(false);
  const [myCertificates, setMyCertificates] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(false);

  useEffect(() => {
    if (urlFilter) {
      setOrderFilter(urlFilter);
    }
  }, [urlFilter]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);

  // Close mobile sidebar on tab change
  useEffect(() => {
    setSidebarOpen(false);
  }, [tab]);

  // Lock body scroll and handle ESC key when sidebar is open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };

    if (sidebarOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!user || user.role === 'admin') {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const isReady = !loading && !loadingSettings;
  usePageReady(isReady);

  useSocketRefetch(() => {
    fetchData();
    fetchMyCertificates();
  });

  
  const fetchMyCertificates = async () => {
    try {
      setLoadingCerts(true);
      const res = await api.get('/certificates/my-certificates');
      setMyCertificates(res.certificates || []);
    } catch (err) {
      console.error('Failed to fetch certificates:', err);
    } finally {
      setLoadingCerts(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'admin') {
      fetchMyCertificates();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesRes, ordersRes] = await Promise.all([
        api.get('/account/courses'),
        api.get('/orders/my')
      ]);
      setMyCourses(coursesRes.courses || []);
      setOrders(ordersRes.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const approvedActiveCount = orders.filter(o => o.status === 'approved' && !o.is_expired).length;
  const expiredCount = orders.filter(o => o.status === 'approved' && o.is_expired).length;
  const rejectedCount = orders.filter(o => o.status === 'rejected').length;

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return true;
    if (orderFilter === 'pending') return o.status === 'pending';
    if (orderFilter === 'approved') return o.status === 'approved' && !o.is_expired;
    if (orderFilter === 'expired') return o.status === 'approved' && o.is_expired;
    if (orderFilter === 'rejected') return o.status === 'rejected';
    return true;
  });

  const activeCourses = myCourses.filter(c => !c.is_expired);
  const doneLessons = activeCourses.reduce((acc, c) => acc + (c.progress?.done || 0), 0);
  
  // Get latest active course accessed
  let continueCourse = activeCourses.length > 0 ? activeCourses[0] : null;
  if (activeCourses.length > 1) {
    const sorted = [...activeCourses].sort((a, b) => new Date(b.last_access || 0) - new Date(a.last_access || 0));
    continueCourse = sorted[0];
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await api.put('/auth/profile', Object.fromEntries(fd));
      alert(res.message);
      // update context user
      if (res.user) {
        login(res.user);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    if (!data.newPassword || data.newPassword.length < 6) {
      alert('كلمة المرور الجديدة يجب ألا تقل عن 6 خانات');
      return;
    }
    if (!/[A-Za-z]/.test(data.newPassword) || !/\d/.test(data.newPassword)) {
      alert('كلمة المرور الجديدة يجب أن تحتوي على حروف وأرقام معاً');
      return;
    }
    if (data.newPassword !== data.confirm) {
      alert('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }
    try {
      const res = await api.put('/auth/password', data);
      alert(res.message);
      e.target.reset();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user || !isReady) return null;

  return (
    <main>
      <SEO
        title="حسابي - لوحة تحكم الطالب"
        description="لوحة تحكم الطالب الخاصة بكورسات منصة محمد بهاء التعليمية."
        canonical="/account"
        robots="noindex, nofollow"
      />
      <section className="dash">
        <div className="container">
          {/* Mobile Top Navigation Bar */}
          <div className="mobile-dash-bar">
            <button 
              type="button" 
              className="dash-drawer-trigger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="فتح القائمة الجانبية"
            >
              <i className="fa-solid fa-bars-staggered"></i>
              <span>القائمة</span>
              {pendingCount > 0 && tab !== 'orders' && (
                <span className="drawer-trigger-badge">{pendingCount}</span>
              )}
            </button>

            <div className="mobile-dash-active-indicator">
              {tab === 'courses' && (
                <span className="active-tab-badge">
                  <i className="fa-solid fa-graduation-cap text-red"></i> كورساتي
                </span>
              )}
              {tab === 'orders' && (
                <span className="active-tab-badge">
                  <i className="fa-solid fa-receipt text-red"></i> طلبات الاشتراك
                </span>
              )}
              {tab === 'certificates' && (
                <span className="active-tab-badge">
                  <i className="fa-solid fa-award" style={{ color: '#d4af37' }}></i> شهاداتي
                </span>
              )}
              {tab === 'profile' && (
                <span className="active-tab-badge">
                  <i className="fa-solid fa-user-gear text-red"></i> بيانات الحساب
                </span>
              )}
            </div>

            <button 
              type="button" 
              className="mobile-dash-user-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="الملف الشخصي"
            >
              <span className="av-mini">{user.name?.charAt(0)}</span>
            </button>
          </div>

          {/* Backdrop overlay for mobile drawer */}
          <div 
            className={`dash-drawer-backdrop ${sidebarOpen ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            aria-hidden={!sidebarOpen}
          />

          <div className="dash-layout">
            <aside className={`dash-side ${sidebarOpen ? 'drawer-open' : ''}`}>
              <div className="dash-drawer-head">
                <div className="dash-drawer-title">
                  <i className="fa-solid fa-bars-staggered text-red"></i>
                  <span>لوحة التحكم</span>
                </div>
                <button 
                  type="button" 
                  className="dash-drawer-close"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="إغلاق القائمة"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="dash-user">
                <span className="av">{user.name?.charAt(0)}</span>
                <div className="dash-user-info"><strong>{user.name}</strong><small>{user.email}</small></div>
              </div>

              <ul className="dash-nav">
                <li>
                  <Link 
                    to="?tab=courses" 
                    className={tab === 'courses' ? 'active' : ''}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <i className="fa-solid fa-graduation-cap"></i>
                    <span>كورساتي</span>
                  </Link>
                </li>
                <li>
                  <Link 
                    to="?tab=orders" 
                    className={tab === 'orders' ? 'active' : ''}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <i className="fa-solid fa-receipt"></i>
                    <span>طلبات الاشتراك</span>
                    {pendingCount > 0 && <span className="status-pill st-pending" style={{ marginInlineStart: 'auto' }}>{pendingCount}</span>}
                  </Link>
                </li>
                <li>
                  <Link 
                    to="?tab=certificates" 
                    className={tab === 'certificates' ? 'active' : ''}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <i className="fa-solid fa-award" style={{ color: tab === 'certificates' ? '#d4af37' : undefined }}></i>
                    <span>شهاداتي</span>
                    {myCertificates.length > 0 && (
                      <span className="status-pill" style={{ marginInlineStart: 'auto', background: '#d4af37', color: '#0f172a', fontWeight: '800', fontSize: '11px', padding: '2px 7px' }}>
                        {myCertificates.length}
                      </span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link 
                    to="?tab=profile" 
                    className={tab === 'profile' ? 'active' : ''}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <i className="fa-solid fa-user-gear"></i>
                    <span>بيانات الحساب</span>
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/tracks"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <span>تصفح المسارات والكورسات</span>
                  </Link>
                </li>
                <li>
                  <a 
                    href="#" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      setSidebarOpen(false); 
                      logout(); 
                    }}
                  >
                    <i className="fa-solid fa-right-from-bracket"></i>
                    <span>تسجيل الخروج</span>
                  </a>
                </li>
              </ul>

              {/* أيقونات جروبات الدعم للطلاب (تليجرام وفيسبوك) تحت زر تسجيل الخروج */}
              {(settings.telegram_group_url || settings.facebook_group_url) && (
                <div className="dash-side-community">
                  <span className="dash-side-community-label">
                    <i className="fa-solid fa-comments"></i>
                    <span>جروبات الدعم للمشتركين</span>
                  </span>
                  <div className="dash-side-community-icons">
                    {settings.telegram_group_url && (
                      <a
                        href={formatExternalUrl(settings.telegram_group_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="side-comm-btn tg"
                        title="جروب التليجرام للطلاب (دعم فني وتطبيقات)"
                        aria-label="جروب التليجرام"
                      >
                        <i className="fa-brands fa-telegram"></i>
                        <span>تليجرام</span>
                      </a>
                    )}
                    {settings.facebook_group_url && (
                      <a
                        href={formatExternalUrl(settings.facebook_group_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="side-comm-btn fb"
                        title="جروب الفيسبوك للطلاب (أسئلة شهرية)"
                        aria-label="جروب الفيسبوك"
                      >
                        <i className="fa-brands fa-facebook"></i>
                        <span>فيسبوك</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </aside>
        
        <div className="dash-main">
          {tab === 'courses' && (
            <>
              <div className="welcome">
                <div className="welcome-text"><h1>مرحباً، {user.name}</h1><p>جاهز تكمّل رحلتك في التسويق النهارده؟</p></div>
                {continueCourse && (
                  <Link to={continueCourse.is_track ? `/account/learn/track/${continueCourse.slug}` : `/account/learn/${continueCourse.slug}`} className="btn btn-primary welcome-btn"><i className="fa-solid fa-play"></i> كمّل التعلم</Link>
                )}
              </div>
              <div className="mini-stats">
                <div className="mini-stat"><span className="ic"><i className="fa-solid fa-book-open"></i></span><div><strong>{activeCourses.length}</strong><small>كورسات ومسارات مفعّلة</small></div></div>
                <div className="mini-stat"><span className="ic"><i className="fa-solid fa-circle-check"></i></span><div><strong>{doneLessons}</strong><small>دروس مكتملة</small></div></div>
                <div className="mini-stat"><span className="ic"><i className="fa-solid fa-hourglass-half"></i></span><div><strong>{pendingCount}</strong><small>طلبات قيد المراجعة</small></div></div>
              </div>

              <DiscountBanner variant="student" />

              {continueCourse && (
                <>
                  <h2 className="title" id="continue"><i className="fa-solid fa-circle-play text-red"></i> استكمال المشاهدة</h2>
                  <div className="my-course continue-watching-card">
                    <div className="thumb continue-thumb">
                      <img 
                        src={getAssetUrl(continueCourse.image, '/assets/img/courses/default.svg')} 
                        alt="" 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/assets/img/courses/default.svg';
                        }}
                      />
                    </div>
                    <div className="body continue-body">
                      {continueCourse.is_track && (
                        <div style={{ marginBottom: '6px' }}>
                          <span style={{ background: '#ede9fe', color: '#6d28d9', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa-solid fa-route"></i> مسار تعليمي متكامل
                          </span>
                        </div>
                      )}
                      <h3>{continueCourse.title}</h3>
                      <p className="muted">{continueCourse.last_title ? `آخر درس: ${continueCourse.last_title}` : (continueCourse.is_track ? 'لسه ما بدأتش المسار' : 'لسه ما بدأتش الكورس')}</p>
                      <div className="progress-row"><span>نسبة التقدم</span><span>{continueCourse.progress?.percent || 0}%</span></div>
                      <div className="progress"><span style={{ width: `${continueCourse.progress?.percent || 0}%` }}></span></div>
                      <Link to={continueCourse.is_track ? `/account/learn/track/${continueCourse.slug}` : `/account/learn/${continueCourse.slug}`} className="btn btn-primary continue-action-btn">
                        <i className="fa-solid fa-play"></i> استكمال المشاهدة
                      </Link>
                    </div>
                  </div>
                </>
              )}

              {/* Filter Tabs for Tracks vs Courses */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 className="title" style={{ margin: 0 }}><i className="fa-solid fa-graduation-cap text-red"></i> دوراتي ومساراتي التدريبية</h2>

                {activeCourses.length > 0 && activeCourses.some(c => c.is_track) && (
                  <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setAccountCourseFilter('all')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '700',
                        background: accountCourseFilter === 'all' ? '#0f172a' : 'transparent',
                        color: accountCourseFilter === 'all' ? '#fff' : '#64748b'
                      }}
                    >
                      الكل ({activeCourses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountCourseFilter('tracks')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '700',
                        background: accountCourseFilter === 'tracks' ? '#0f172a' : 'transparent',
                        color: accountCourseFilter === 'tracks' ? '#fff' : '#64748b'
                      }}
                    >
                      <i className="fa-solid fa-route" style={{ marginInlineEnd: '4px' }}></i> التراكات ({activeCourses.filter(c => c.is_track).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountCourseFilter('courses')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '700',
                        background: accountCourseFilter === 'courses' ? '#0f172a' : 'transparent',
                        color: accountCourseFilter === 'courses' ? '#fff' : '#64748b'
                      }}
                    >
                      <i className="fa-solid fa-graduation-cap" style={{ marginInlineEnd: '4px' }}></i> الكورسات ({activeCourses.filter(c => !c.is_track).length})
                    </button>
                  </div>
                )}
              </div>

              {(() => {
                const displayedCourses = accountCourseFilter === 'tracks'
                  ? activeCourses.filter(c => c.is_track)
                  : accountCourseFilter === 'courses'
                  ? activeCourses.filter(c => !c.is_track)
                  : activeCourses;

                if (displayedCourses.length === 0) {
                  return (
                    <div className="form-card empty" style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <i className="fa-solid fa-folder-open fa-2x" style={{ color: '#cbd5e1', marginBottom: '12px' }}></i>
                      <p style={{ color: '#64748b', margin: 0 }}>لا توجد عناصر لعرضها في هذا القسم.</p>
                    </div>
                  );
                }

                return (
                  <div className="my-courses">
                    {displayedCourses.map((c, idx) => {
                    const hasDiscount = Boolean(c.old_price && c.old_price > c.price);
                    const discountPercent = hasDiscount ? Math.round(100 - (c.price / c.old_price) * 100) : 0;
                    const isTrack = Boolean(c.is_track);

                    return (
                      <div key={c._id ? `course-${c._id}` : (c.slug || `course-${idx}`)} className="my-course" style={isTrack ? { border: '1.5px solid #ddd6fe', boxShadow: '0 4px 16px rgba(109,40,217,0.06)' } : {}}>
                        <div className="thumb">
                          <img 
                            src={getAssetUrl(c.image, '/assets/img/courses/default.svg')} 
                            alt="" 
                            loading="lazy" 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/assets/img/courses/default.svg';
                            }}
                          />
                          {isTrack && (
                            <span style={{ position: 'absolute', top: '10px', right: '10px', background: '#6d28d9', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                              <i className="fa-solid fa-route"></i> مسار متكامل
                            </span>
                          )}
                          {hasDiscount && (
                            <span className="course-discount">
                              خصم {discountPercent}%
                            </span>
                          )}
                        </div>
                        <div className="body">
                          {isTrack && (
                            <span style={{ background: '#ede9fe', color: '#6d28d9', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start', marginBottom: '4px' }}>
                              <i className="fa-solid fa-layer-group"></i> يشمل {c.courses_count || c.courses?.length || 0} كورسات
                            </span>
                          )}
                          <h3>{c.title}</h3>
                          {isTrack && c.courses && c.courses.length > 0 && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f1f5f9', lineHeight: 1.4 }}>
                              <strong style={{ color: '#334155' }}>الكورسات المشمولة:</strong> {c.courses.map(sc => sc.title).join(' • ')}
                            </div>
                          )}
                          <div className="progress-row"><span>{c.progress?.done || 0} من {c.progress?.total || 0} درس</span><span>{c.progress?.percent || 0}%</span></div>
                          <div className="progress"><span style={{ width: `${c.progress?.percent || 0}%` }}></span></div>
                          <Link to={isTrack ? `/account/learn/track/${c.slug}` : `/account/learn/${c.slug}`} className={`btn ${c.progress?.percent >= 100 ? 'btn-dark' : 'btn-primary'} btn-sm`} style={{ marginTop: 'auto' }}>
                            <i className={`fa-solid ${c.progress?.percent >= 100 ? 'fa-rotate-right' : 'fa-play'}`}></i>
                            {c.progress?.percent >= 100 ? (isTrack ? 'مراجعة المسار' : 'مراجعة الكورس') : (c.progress?.done ? 'استكمال المشاهدة' : (isTrack ? 'ابدأ المسار' : 'ابدأ الكورس'))}
                          </Link>
                          {c.has_certificate && c.progress?.percent >= 100 && (() => {
                            const isCertIssued = myCertificates.some(cert => (
                              (cert.track?._id && cert.track._id.toString() === c._id.toString()) ||
                              (cert.track && cert.track.toString() === c._id.toString()) ||
                              (!isTrack && (
                                (cert.course?._id && cert.course._id.toString() === c._id.toString()) ||
                                (cert.course && cert.course.toString() === c._id.toString())
                              ))
                            ));

                            return (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ marginTop: '6px', background: isTrack ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' : 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: isTrack ? '#fff' : '#0f172a', fontWeight: '800', border: 'none', gap: '6px' }}
                                onClick={() => {
                                  setActiveCertIsTrack(isTrack);
                                  setActiveCertCourseId(c._id);
                                }}
                              >
                                <i className="fa-solid fa-award"></i> {isCertIssued ? (isTrack ? 'عرض شهادة المسار المعتمدة' : 'عرض الشهادة المعتمدة') : (isTrack ? 'الحصول على شهادة المسار' : 'الحصول على الشهادة')}
                              </button>
                            );
                          })()}
                          {c.expires_at && (
                            <small style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>
                              <i className="fa-regular fa-clock" style={{ marginLeft: '4px' }}></i>
                              صالح حتى: {new Date(c.expires_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </small>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {activeCourses.length === 0 && (
              <div className="form-card empty">
                <i className="fa-solid fa-book-open"></i><h3>مفيش كورسات مفعّلة لسه</h3>
                <p>اشترك في كورس أو تراك، وبعد مراجعة الدفع هيظهر هنا.</p>
                <Link to="/tracks" className="btn btn-primary mt-2">تصفح المسارات والكورسات</Link>
              </div>
            )}

              {expiredCount > 0 && (
                <div className="expired-notice-card" style={{ marginTop: '24px', background: '#fff', border: '1px solid #fecaca', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', boxShadow: '0 2px 10px rgba(220,38,38,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fef2f2', color: '#dc2626', display: 'grid', placeItems: 'center', fontSize: '18px', flexShrink: 0 }}>
                      <i className="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div>
                      <strong style={{ fontSize: '14.5px', color: '#991b1b', display: 'block', marginBottom: '2px' }}>
                        لديك {expiredCount} {expiredCount === 1 ? 'اشتراك كورس انتهت صلاحيته' : 'اشتراكات كورسات انتهت صلاحيتها'}
                      </strong>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        تم نقل الكورس المنتهي تلقائياً إلى صفحة طلبات الاشتراك لتقدر تراجعه أو تجدد اشتراكك فيه.
                      </span>
                    </div>
                  </div>
                  <Link 
                    to="?tab=orders&filter=expired" 
                    className="btn btn-sm" 
                    style={{ background: '#dc2626', color: '#fff', fontSize: '13px', padding: '8px 18px', borderRadius: '8px', fontWeight: 'bold' }}
                  >
                    <i className="fa-solid fa-receipt"></i> عرض في طلبات الاشتراك
                  </Link>
                </div>
              )}
            </>
          )}

          {tab === 'orders' && (
            <>
              <div className="orders-header-row">
                <div>
                  <h2 className="title" style={{ margin: 0 }}>
                    <i className="fa-solid fa-receipt text-red"></i> طلبات الاشتراك
                  </h2>
                  <p className="orders-subtitle">
                    تابع حالة طلبات الانضمام ومراجعة إيصالات الدفع للكورسات
                  </p>
                </div>
                {orders.length > 0 && (
                  <div className="orders-filter-chips">
                    <button
                      type="button"
                      className={`filter-chip ${orderFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setOrderFilter('all')}
                    >
                      الكل ({orders.length})
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orderFilter === 'pending' ? 'active' : ''}`}
                      onClick={() => setOrderFilter('pending')}
                    >
                      <span className="chip-dot chip-dot-pending"></span>
                      قيد المراجعة ({pendingCount})
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orderFilter === 'approved' ? 'active' : ''}`}
                      onClick={() => setOrderFilter('approved')}
                    >
                      <span className="chip-dot chip-dot-approved"></span>
                      المقبولة والمفعّلة ({approvedActiveCount})
                    </button>
                    {expiredCount > 0 && (
                      <button
                        type="button"
                        className={`filter-chip ${orderFilter === 'expired' ? 'active' : ''}`}
                        onClick={() => setOrderFilter('expired')}
                      >
                        <span className="chip-dot chip-dot-expired"></span>
                        انتهت الصلاحية ({expiredCount})
                      </button>
                    )}
                    <button
                      type="button"
                      className={`filter-chip ${orderFilter === 'rejected' ? 'active' : ''}`}
                      onClick={() => setOrderFilter('rejected')}
                    >
                      <span className="chip-dot chip-dot-rejected"></span>
                      المرفوضة ({rejectedCount})
                    </button>
                  </div>
                )}
              </div>

              {orders.length === 0 ? (
                <div className="form-card empty">
                  <i className="fa-solid fa-receipt"></i>
                  <h3>مفيش طلبات اشتراك لسه</h3>
                  <p>اشترك في أي مسار أو كورس متاح، وهيظهر طلبك هنا فور إرساله.</p>
                  <Link to="/tracks" className="btn btn-primary mt-2">
                    <i className="fa-solid fa-graduation-cap"></i> تصفح المسارات والكورسات
                  </Link>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="form-card empty" style={{ padding: '36px 20px' }}>
                  <i className="fa-solid fa-filter-circle-xmark"></i>
                  <h3>لا توجد طلبات في هذا التصنيف</h3>
                  <button
                    type="button"
                    className="btn btn-dark btn-sm mt-2"
                    onClick={() => setOrderFilter('all')}
                  >
                    عرض جميع الطلبات
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View (min-width: 768px) */}
                  <div className="orders-desktop-table">
                    <div className="orders-table-view">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>رقم الطلب</th>
                            <th>الكورس</th>
                            <th>المبلغ</th>
                            <th>طريقة الدفع</th>
                            <th>التاريخ</th>
                            <th>الحالة</th>
                            <th>الإجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map((o, idx) => (
                            <tr key={`order-row-${o._id || idx}`}>
                              <td>
                                <span className="order-id-badge">#{o._id.slice(-6).toUpperCase()}</span>
                              </td>
                              <td>
                                {o.order_type === 'track' || (!o.course && o.track) ? (
                                  <div className="order-course-cell">
                                    <img 
                                      src={getAssetUrl(o.track?.image, '/assets/img/courses/default.svg')} 
                                      alt="" 
                                      className="order-thumb-mini"
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = '/assets/img/courses/default.svg';
                                      }}
                                    />
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '11px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px' }}>
                                          <i className="fa-solid fa-layer-group"></i> تراك كامل
                                        </span>
                                        <div className="order-course-title">
                                          {o.track?.title || o.track_name || 'تراك تعليمي'}
                                        </div>
                                      </div>
                                      {o.track?.courses?.length > 0 && (
                                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                                          يشمل {o.track.courses.length} كورسات
                                        </div>
                                      )}
                                      {o.admin_note && (
                                        <div className="order-note-text">
                                          <i className="fa-solid fa-circle-info" style={{ marginLeft: '4px' }}></i>
                                          {o.admin_note}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="order-course-cell">
                                    <img 
                                      src={getAssetUrl(o.course?.image, '/assets/img/courses/default.svg')} 
                                      alt="" 
                                      className="order-thumb-mini"
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = '/assets/img/courses/default.svg';
                                      }}
                                    />
                                    <div>
                                      <div className="order-course-title">
                                        {o.course?.title || 'كورس غير محدد'}
                                      </div>
                                      {(o.track_name || o.track?.title || o.course?.track?.title) && (
                                        <div style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          marginTop: '3px',
                                          fontSize: '11.5px',
                                          color: '#92400e',
                                          background: '#fef3c7',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          fontWeight: '700'
                                        }}>
                                          <i className="fa-solid fa-route"></i>
                                          <span>ضمن تراك: {o.track_name || o.track?.title || o.course?.track?.title}</span>
                                        </div>
                                      )}
                                      {o.admin_note && (
                                        <div className="order-note-text">
                                          <i className="fa-solid fa-circle-info" style={{ marginLeft: '4px' }}></i>
                                          {o.admin_note}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: '800', color: '#111827' }}>
                                ${o.amount}
                              </td>
                              <td>
                                <span className={`pay-pill ${o.payment_method === 'instapay' ? 'pay-pill-instapay' : 'pay-pill-vodafone'}`}>
                                  <i className={o.payment_method === 'instapay' ? 'fa-solid fa-bolt' : 'fa-solid fa-mobile-screen'}></i>
                                  {o.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}
                                </span>
                                {o.sender_phone && (
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', direction: 'ltr', textAlign: 'right' }}>
                                    {o.sender_phone}
                                  </div>
                                )}
                              </td>
                              <td dir="ltr" style={{ textAlign: 'right', fontSize: '13px', color: '#4b5563' }}>
                                {new Date(o.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </td>
                              <td>
                                {o.status === 'approved' && o.is_expired ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <span className="status-pill st-expired">
                                      <i className="fa-solid fa-clock-rotate-left"></i> انتهت الصلاحية
                                    </span>
                                    {o.expires_at && (
                                      <small style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        انتهى: {new Date(o.expires_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      </small>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <span className={`status-pill st-${o.status}`}>
                                      <i className={`fa-solid ${o.status === 'pending' ? 'fa-hourglass-half' : o.status === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                                      {o.status === 'pending' ? 'قيد المراجعة' : o.status === 'approved' ? 'مقبول ومفعّل' : 'تم الرفض'}
                                    </span>
                                    {o.status === 'approved' && o.expires_at && (
                                      <small style={{ fontSize: '11px', color: '#16a34a' }}>
                                        صالح حتى: {new Date(o.expires_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      </small>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {o.proof_image && (
                                    <button
                                      type="button"
                                      className="btn btn-dark btn-sm"
                                      style={{ padding: '6px 10px', fontSize: '12px' }}
                                      title="عرض صورة الإيصال"
                                      onClick={() => setPreviewReceipt(o)}
                                    >
                                      <i className="fa-solid fa-image"></i> الإيصال
                                    </button>
                                  )}
                                  {/* Track Order Actions */}
                                  {(o.order_type === 'track' || (!o.course && o.track)) && (
                                    <>
                                      {o.status === 'approved' && o.track?.slug && (
                                        <Link
                                          to={`/track/${o.track.slug}`}
                                          className="btn btn-primary btn-sm"
                                          style={{ padding: '6px 10px', fontSize: '12px', background: '#4338ca', borderColor: '#4338ca' }}
                                          title="عرض صفحة التراك والكورسات"
                                        >
                                          <i className="fa-solid fa-layer-group"></i> التراك
                                        </Link>
                                      )}
                                      {o.status === 'rejected' && o.track?.slug && (
                                        <Link
                                          to={`/checkout?track=${o.track.slug}`}
                                          className="btn btn-primary btn-sm"
                                          style={{ padding: '6px 10px', fontSize: '12px', background: '#dc2626' }}
                                          title="إعادة المحاولة لشراء التراك"
                                        >
                                          <i className="fa-solid fa-rotate-right"></i> إعادة المحاولة
                                        </Link>
                                      )}
                                    </>
                                  )}
                                  {/* Course Order Actions */}
                                  {o.order_type !== 'track' && o.course && (
                                    <>
                                      {o.status === 'approved' && !o.is_expired && o.course?.slug && (
                                        <Link
                                          to={`/account/learn/${o.course.slug}`}
                                          className="btn btn-primary btn-sm"
                                          style={{ padding: '6px 10px', fontSize: '12px' }}
                                        >
                                          <i className="fa-solid fa-play"></i> الكورس
                                        </Link>
                                      )}
                                      {o.status === 'approved' && o.is_expired && o.course?.slug && (
                                        <Link
                                          to={`/checkout?course=${o.course.slug}`}
                                          className="btn btn-primary btn-sm"
                                          style={{ padding: '6px 10px', fontSize: '12px', background: '#dc2626', borderColor: '#dc2626' }}
                                          title="تجديد الاشتراك بالكورس"
                                        >
                                          <i className="fa-solid fa-rotate-right"></i> تجديد الاشتراك
                                        </Link>
                                      )}
                                      {o.status === 'rejected' && o.course?.slug && (
                                        <Link
                                          to={`/checkout?course=${o.course.slug}`}
                                          className="btn btn-primary btn-sm"
                                          style={{ padding: '6px 10px', fontSize: '12px', background: '#dc2626' }}
                                        >
                                          <i className="fa-solid fa-rotate-right"></i> إعادة المحاولة
                                        </Link>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Cards View (max-width: 767px) */}
                  <div className="orders-mobile-cards">
                    {filteredOrders.map((o, idx) => (
                      <div key={`order-card-${o._id || idx}`} className="order-mobile-card">
                        <div className="omc-header">
                          <div className="omc-header-meta">
                            <span className="order-id-badge">#{o._id.slice(-6).toUpperCase()}</span>
                            <span className="omc-date">
                              <i className="fa-regular fa-calendar"></i>
                              {new Date(o.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          {o.status === 'approved' && o.is_expired ? (
                            <span className="status-pill st-expired">
                              <i className="fa-solid fa-clock-rotate-left"></i> انتهت الصلاحية
                            </span>
                          ) : (
                            <span className={`status-pill st-${o.status}`}>
                              <i className={`fa-solid ${o.status === 'pending' ? 'fa-hourglass-half' : o.status === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                              {o.status === 'pending' ? 'قيد المراجعة' : o.status === 'approved' ? 'مقبول ومفعّل' : 'تم الرفض'}
                            </span>
                          )}
                        </div>

                        <div className="omc-course">
                          {o.order_type === 'track' || (!o.course && o.track) ? (
                            <>
                              <img 
                                src={getAssetUrl(o.track?.image, '/assets/img/courses/default.svg')} 
                                alt="" 
                                className="omc-course-thumb"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = '/assets/img/courses/default.svg';
                                }}
                              />
                              <div className="omc-course-info">
                                <span style={{ display: 'inline-block', background: '#e0e7ff', color: '#4338ca', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', marginBottom: '4px' }}>
                                  <i className="fa-solid fa-layer-group"></i> تراك كامل
                                </span>
                                <h3>{o.track?.title || o.track_name || 'تراك تعليمي'}</h3>
                                {o.track?.courses?.length > 0 && (
                                  <small style={{ color: '#64748b', display: 'block', marginTop: '2px' }}>
                                    يشمل {o.track.courses.length} كورسات
                                  </small>
                                )}
                                <span className="omc-price-tag">${o.amount}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <img 
                                src={getAssetUrl(o.course?.image, '/assets/img/courses/default.svg')} 
                                alt="" 
                                className="omc-course-thumb"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = '/assets/img/courses/default.svg';
                                }}
                              />
                              <div className="omc-course-info">
                                <h3>{o.course?.title || 'كورس غير محدد'}</h3>
                                {(o.track_name || o.track?.title || o.course?.track?.title) && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    marginTop: '3px',
                                    fontSize: '11px',
                                    color: '#92400e',
                                    background: '#fef3c7',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: '700'
                                  }}>
                                    <i className="fa-solid fa-route"></i>
                                    <span>ضمن تراك: {o.track_name || o.track?.title || o.course?.track?.title}</span>
                                  </span>
                                )}
                                <span className="omc-price-tag">${o.amount}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="omc-grid">
                          <div className="omc-item">
                            <span className="omc-label">المبلغ المطلوب</span>
                            <span className="omc-val omc-val-price">${o.amount}</span>
                          </div>
                          <div className="omc-item">
                            <span className="omc-label">طريقة التحويل</span>
                            <span className="omc-val">
                              <span className={`pay-pill ${o.payment_method === 'instapay' ? 'pay-pill-instapay' : 'pay-pill-vodafone'}`}>
                                <i className={o.payment_method === 'instapay' ? 'fa-solid fa-bolt' : 'fa-solid fa-mobile-screen'}></i>
                                {o.payment_method === 'instapay' ? 'InstaPay' : 'فودافون كاش'}
                              </span>
                            </span>
                          </div>
                          <div className="omc-item">
                            <span className="omc-label">رقم المحوّل منه</span>
                            <span className="omc-val" dir="ltr" style={{ textAlign: 'right' }}>
                              {o.sender_phone || '—'}
                            </span>
                          </div>
                          <div className="omc-item">
                            <span className="omc-label">حالة الطلب</span>
                            <span className="omc-val" style={{ color: o.status === 'approved' && o.is_expired ? '#dc2626' : undefined }}>
                              {o.status === 'pending'
                                ? 'جاري الفحص'
                                : o.status === 'approved'
                                ? o.is_expired
                                  ? 'انتهت فترة الصلاحية'
                                  : 'تم التفعيل بنجاح'
                                : 'مرفوض من الإدارة'}
                            </span>
                          </div>
                          {o.status === 'approved' && o.expires_at && (
                            <div className="omc-item">
                              <span className="omc-label">{o.is_expired ? 'تاريخ الانتهاء' : 'صالح حتى'}</span>
                              <span className="omc-val" style={{ color: o.is_expired ? '#dc2626' : '#16a34a', fontWeight: '600', fontSize: '13px' }}>
                                {new Date(o.expires_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>

                        {o.admin_note && (
                          <div className="omc-admin-note">
                            <i className="fa-solid fa-circle-exclamation"></i>
                            <div>
                              <strong>ملاحظة الإدارة: </strong>
                              {o.admin_note}
                            </div>
                          </div>
                        )}

                        <div className="omc-actions">
                          {o.proof_image && (
                            <button
                              type="button"
                              className="btn btn-dark omc-btn"
                              onClick={() => setPreviewReceipt(o)}
                            >
                              <i className="fa-solid fa-image"></i> عرض الإيصال
                            </button>
                          )}
                          {/* Track Actions */}
                          {(o.order_type === 'track' || (!o.course && o.track)) && (
                            <>
                              {o.status === 'approved' && o.track?.slug && (
                                <Link
                                  to={`/track/${o.track.slug}`}
                                  className="btn btn-primary omc-btn"
                                  style={{ background: '#4338ca', borderColor: '#4338ca' }}
                                >
                                  <i className="fa-solid fa-layer-group"></i> عرض التراك
                                </Link>
                              )}
                              {o.status === 'rejected' && o.track?.slug && (
                                <Link
                                  to={`/checkout?track=${o.track.slug}`}
                                  className="btn btn-primary omc-btn"
                                  style={{ background: '#dc2626' }}
                                >
                                  <i className="fa-solid fa-rotate-right"></i> إعادة المحاولة
                                </Link>
                              )}
                            </>
                          )}
                          {/* Course Actions */}
                          {o.order_type !== 'track' && o.course && (
                            <>
                              {o.status === 'approved' && !o.is_expired && o.course?.slug && (
                                <Link
                                  to={`/account/learn/${o.course.slug}`}
                                  className="btn btn-primary omc-btn"
                                >
                                  <i className="fa-solid fa-play"></i> بدء الكورس
                                </Link>
                              )}
                              {o.status === 'approved' && o.is_expired && o.course?.slug && (
                                <Link
                                  to={`/checkout?course=${o.course.slug}`}
                                  className="btn btn-primary omc-btn"
                                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                >
                                  <i className="fa-solid fa-rotate-right"></i> تجديد الاشتراك
                                </Link>
                              )}
                              {o.status === 'rejected' && o.course?.slug && (
                                <Link
                                  to={`/checkout?course=${o.course.slug}`}
                                  className="btn btn-primary omc-btn"
                                  style={{ background: '#dc2626' }}
                                >
                                  <i className="fa-solid fa-rotate-right"></i> إعادة المحاولة
                                </Link>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'certificates' && (
            <>
              <div className="certificates-header-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 className="title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-award" style={{ color: '#d4af37' }}></i>
                    <span>شهاداتي المعتمدة</span>
                  </h2>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13.5px', lineHeight: 1.5 }}>
                    جميع شهادات إتمام وتفوق الكورسات الصادرة باسمك والموثقة رقمياً برمز QR كود
                  </p>
                </div>
              </div>

              {loadingCerts ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                  <i className="fa-solid fa-circle-notch fa-spin fa-2x" style={{ color: '#d4af37', marginBottom: '12px' }}></i>
                  <div>جاري تحميل شهاداتك...</div>
                </div>
              ) : myCertificates.length === 0 ? (
                <div className="form-card empty" style={{ textAlign: 'center', padding: '50px 20px' }}>
                  <i className="fa-solid fa-award fa-3x" style={{ color: '#cbd5e1', marginBottom: '16px' }}></i>
                  <h3 style={{ margin: '0 0 8px' }}>لم تحصل على أي شهادة بعد</h3>
                  <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto 16px' }}>
                    أكمل 100% من دروس أي كورس يدعم الشهادات لتحصل على شهادتك المعتمدة فوراً وتوثيقها برابط فحص رقمي.
                  </p>
                  <Link to="?tab=courses" className="btn btn-primary">
                    <i className="fa-solid fa-graduation-cap"></i> الذهاب إلى كورساتي
                  </Link>
                </div>
              ) : (
                <div className="my-certificates-grid">
                  {myCertificates.map((cert, idx) => {
                    const isRevoked = cert.status === 'revoked';
                    const isTrack = Boolean(cert.track || cert.certificate_type === 'track');
                    const targetId = cert.track?._id || cert.track || cert.course?._id || cert.course;
                    const certTitle = cert.track?.title || cert.course?.title || (isTrack ? 'مسار تعليمي متكامل' : 'شهادة معتمدة');
                    return (
                      <div
                        key={cert._id || cert.id || cert.certificate_id || `cert-${idx}`}
                        className={`my-certificate-card ${isRevoked ? 'revoked' : ''}`}
                      >
                        {/* Decorative Top Accent */}
                        <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: '4px', background: isRevoked ? '#dc2626' : (isTrack ? 'linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)' : 'linear-gradient(90deg, #d4af37 0%, #f6e05e 100%)') }}></div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '11.5px', background: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#0f172a', wordBreak: 'break-all', letterSpacing: '0.5px' }}>
                              {cert.certificate_id}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {isTrack && (
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', background: '#ede9fe', padding: '2px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <i className="fa-solid fa-route"></i> مسار
                                </span>
                              )}
                              {isRevoked ? (
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>
                                  ملغية
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                  <i className="fa-solid fa-shield-check"></i> موثقة ومعتمدة
                                </span>
                              )}
                            </div>
                          </div>

                          <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '800', color: '#0f172a', lineHeight: 1.4, wordBreak: 'break-word' }}>
                            {certTitle}
                          </h3>

                          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                            <i className="fa-regular fa-calendar"></i>
                            <span>تاريخ الإصدار: {new Date(cert.issue_date || cert.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '14px', width: '100%' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ flex: 1, minWidth: 0, background: isTrack ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' : 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)', color: isTrack ? '#fff' : '#0f172a', fontWeight: '800', border: 'none', justifyContent: 'center', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              setActiveCertIsTrack(isTrack);
                              setActiveCertCourseId(targetId);
                            }}
                          >
                            <i className="fa-solid fa-eye"></i> <span>عرض الشهادة</span>
                          </button>

                          <Link
                            to={`/verify-certificate/${cert.certificate_id}`}
                            target="_blank"
                            className="btn btn-light btn-sm"
                            style={{ border: '1px solid #cbd5e1', padding: '8px 12px', flexShrink: 0 }}
                            title="رابط التحقق الرقمي"
                          >
                            <i className="fa-solid fa-qrcode" style={{ color: '#2563eb' }}></i>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'profile' && (
            <>
              <h2 className="title"><i className="fa-solid fa-user-gear text-red"></i> بيانات الحساب</h2>
              <div className="form-card">
                <h2 style={{ fontSize: '19px', marginBottom: '16px' }}>البيانات الشخصية</h2>
                <form onSubmit={handleProfileSubmit}>
                  <div className="form-grid">
                    <div className="field"><label>الاسم بالكامل</label><input name="name" defaultValue={user.name} required placeholder="اكتب اسمك الثنائي على الأقل" /></div>
                    <div className="field"><label>رقم الموبايل</label><input name="phone" dir="ltr" defaultValue={user.phone} required placeholder="01xxxxxxxxx" /></div>
                    <div className="field full">
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <span>البريد الإلكتروني</span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>
                          <i className="fa-solid fa-lock" style={{ marginLeft: '4px', color: '#c81e1e' }}></i>
                          موثق برمز OTP (غير قابل للتعديل)
                        </span>
                      </label>
                      <input
                        name="email"
                        type="email"
                        dir="ltr"
                        value={user.email}
                        readOnly
                        disabled
                        style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', borderColor: '#e2e8f0' }}
                      />
                    </div>
                    <div className="full"><button className="btn btn-primary" type="submit"><i className="fa-solid fa-floppy-disk"></i> حفظ التعديلات</button></div>
                  </div>
                </form>
              </div>
              <div className="form-card mt-3">
                <h2 style={{ fontSize: '19px', marginBottom: '16px' }}>تغيير كلمة المرور</h2>
                <form onSubmit={handlePasswordSubmit}>
                  <div className="form-grid">
                    <div className="field full"><label>كلمة المرور الحالية</label><input name="current" type="password" dir="ltr" required placeholder="••••••••" /></div>
                    <div className="field">
                      <label>كلمة المرور الجديدة</label>
                      <input
                        name="newPassword"
                        type="password"
                        dir="ltr"
                        required
                        minLength="6"
                        pattern="(?=.*[A-Za-z])(?=.*\d).{6,}"
                        title="كلمة المرور يجب أن تتكون من 6 خانات على الأقل وتحتوي على حروف وأرقام معاً"
                        placeholder="حروف وأرقام (مثال: Pass123)"
                      />
                      <small style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                        يجب أن تتكون من 6 خانات على الأقل وتجمع بين الحروف والأرقام
                      </small>
                    </div>
                    <div className="field"><label>تأكيد كلمة المرور الجديدة</label><input name="confirm" type="password" dir="ltr" required placeholder="••••••••" /></div>
                    <div className="full"><button className="btn btn-dark" type="submit"><i className="fa-solid fa-key"></i> تغيير كلمة المرور</button></div>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
      {activeCertCourseId && (
        <StudentCertificateModal 
          courseId={!activeCertIsTrack ? activeCertCourseId : null}
          trackId={activeCertIsTrack ? activeCertCourseId : null}
          is_track={activeCertIsTrack}
          onClose={() => {
            setActiveCertCourseId(null);
            setActiveCertIsTrack(false);
            fetchMyCertificates();
          }} 
        />
      )}
      {previewReceipt && (
        <div className="receipt-modal-backdrop" onClick={() => setPreviewReceipt(null)}>
          <div className="receipt-modal-card" onClick={e => e.stopPropagation()}>
            <div className="receipt-modal-head">
              <div className="receipt-modal-title">
                <i className="fa-solid fa-receipt text-red"></i>
                <span>إيصال تحويل الطلب #{previewReceipt._id.slice(-6).toUpperCase()}</span>
              </div>
              <button
                type="button"
                className="receipt-modal-close"
                onClick={() => setPreviewReceipt(null)}
                aria-label="إغلاق"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="receipt-modal-body">
              <img
                src={getAssetUrl(previewReceipt.proof_image)}
                alt="إيصال الدفع"
                className="receipt-modal-img"
              />
              <div className="receipt-modal-info">
                {previewReceipt.order_type === 'track' || (!previewReceipt.course && previewReceipt.track) ? (
                  <>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '12px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-layer-group"></i> طلب اشتراك في تراك كامل
                      </span>
                    </div>
                    <div><strong>التراك:</strong> {previewReceipt.track?.title || previewReceipt.track_name || 'مسار تعليمي'}</div>
                    {previewReceipt.track?.courses?.length > 0 && (
                      <div style={{ marginTop: '8px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <strong style={{ fontSize: '12.5px', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                          الكورسات المشمولة في هذا التراك ({previewReceipt.track.courses.length} كورسات):
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {previewReceipt.track.courses.map((c, idx) => (
                            <div key={c._id || idx} style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-circle-check text-green" style={{ fontSize: '11px', color: '#16a34a' }}></i>
                              <span>{c.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div><strong>الكورس:</strong> {previewReceipt.course?.title || '—'}</div>
                    {(previewReceipt.track_name || previewReceipt.track?.title || previewReceipt.course?.track?.title) && (
                      <div style={{
                        margin: '8px 0',
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
                        border: '1.5px solid #fde68a',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#92400e',
                        fontSize: '13px',
                        fontWeight: '700'
                      }}>
                        <i className="fa-solid fa-route" style={{ color: '#d97706', fontSize: '16px' }}></i>
                        <span>تم شراء هذا الكورس من داخل تراك: <strong>{previewReceipt.track_name || previewReceipt.track?.title || previewReceipt.course?.track?.title}</strong></span>
                      </div>
                    )}
                  </>
                )}
                <div><strong>المبلغ:</strong> ${previewReceipt.amount}</div>
                <div><strong>طريقة التحويل:</strong> {previewReceipt.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}</div>
                <div><strong>رقم المحوّل:</strong> {previewReceipt.sender_phone || '—'}</div>
              </div>
            </div>
            <div className="receipt-modal-foot">
              <a
                href={getAssetUrl(previewReceipt.proof_image)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-dark btn-sm"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i> فتح بالحجم الكامل
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewReceipt(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      </section>
    </main>
  );
}

export default Account;
