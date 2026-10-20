import { useState, useEffect } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import CourseCard from '../components/CourseCard';
import DiscountBanner from '../components/DiscountBanner';
import { api } from '../api';
import { formatExternalUrl, getAssetUrl } from '../utils/assetUrl';
import { useSettings } from '../context/SettingsContext';
import SEO from '../components/common/SEO';

function Home() {
  const { settings, loadingSettings } = useSettings();
  const [tracks, setTracks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const isReady = !loading && !loadingSettings;
  usePageReady(isReady);

  useEffect(() => {
    fetchData();
  }, []);

  useSocketRefetch(() => {
    fetchData();
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tracksRes, reviewsRes] = await Promise.all([
        api.get('/tracks').catch(() => ({ tracks: [] })),
        api.get('/reviews/public').catch(() => ({ reviews: [] }))
      ]);
      setTracks(tracksRes.tracks || []);
      setReviews(reviewsRes?.reviews || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [showAboutVideo, setShowAboutVideo] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowAboutVideo(false);
    };

    // الاستماع لانتهاء الفيديو من iframes (مثل Bunny Stream / YouTube / Vimeo)
    const handleMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // Bunny Stream video ended
        if (data?.type === 'ended' || data?.event === 'ended' || data?.status === 'ended') {
          setShowAboutVideo(false);
        }
        // Vimeo ended
        if (data?.event === 'ended') {
          setShowAboutVideo(false);
        }
        // YouTube ended (infoDelivery state === 0)
        if (data?.event === 'infoDelivery' && data?.info?.playerState === 0) {
          setShowAboutVideo(false);
        }
      } catch {
        // Not a JSON message or unrelated event
      }
    };

    if (showAboutVideo) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('message', handleMessage);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('message', handleMessage);
    };
  }, [showAboutVideo]);

  const renderAboutVideoPlayer = (url) => {
    const targetUrl = settings.about_video_signed_url || url;
    if (!targetUrl) return null;
    const str = String(targetUrl).trim();

    // 1. روابط Bunny Stream (mediadelivery.net / bunnycdn / play)
    if (str.includes('mediadelivery.net') || str.includes('bunnycdn.com') || str.includes('/play/')) {
      let embedSrc = str;
      if (str.includes('/play/')) {
        embedSrc = str.replace('/play/', '/embed/');
      }
      const sep = embedSrc.includes('?') ? '&' : '?';
      if (!embedSrc.includes('autoplay=')) {
        embedSrc += `${sep}autoplay=true&preload=true`;
      }
      return (
        <iframe
          src={embedSrc}
          allowFullScreen
          allow="autoplay; fullscreen"
          style={{ width: '100%', height: '100%', border: 0 }}
          title="فيديو عن المنصة"
        />
      );
    }

    if (str.includes('youtube.com') || str.includes('youtu.be')) {
      let vid = '';
      if (str.includes('v=')) {
        vid = str.split('v=')[1]?.split('&')[0];
      } else if (str.includes('youtu.be/')) {
        vid = str.split('youtu.be/')[1]?.split('?')[0];
      } else if (str.includes('embed/')) {
        vid = str.split('embed/')[1]?.split('?')[0];
      }
      return (
        <iframe
          src={`https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1&rel=0`}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          style={{ width: '100%', height: '100%', border: 0 }}
          title="فيديو عن المنصة"
        />
      );
    }

    if (str.includes('vimeo.com')) {
      const match = str.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/);
      const vid = match ? match[1] : str.split('/').pop().split('?')[0];
      return (
        <iframe
          src={`https://player.vimeo.com/video/${vid}?autoplay=1`}
          allowFullScreen
          allow="autoplay; fullscreen"
          style={{ width: '100%', height: '100%', border: 0 }}
          title="فيديو عن المنصة"
        />
      );
    }

    if (str.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
      return (
        <video
          controls
          autoPlay
          onEnded={() => setShowAboutVideo(false)}
          controlsList="nodownload"
          src={str.startsWith('http') ? str : getAssetUrl(str)}
          style={{ width: '100%', height: '100%', background: '#000' }}
        />
      );
    }

    let defaultSrc = str;
    if (!defaultSrc.includes('autoplay=')) {
      defaultSrc += (defaultSrc.includes('?') ? '&' : '?') + 'autoplay=true';
    }

    return (
      <iframe
        src={defaultSrc}
        allowFullScreen
        allow="autoplay; fullscreen"
        style={{ width: '100%', height: '100%', border: 0 }}
        title="فيديو عن المنصة"
      />
    );
  };

  const hasAboutVideo = Boolean(settings.about_video_url && settings.about_video_url.trim());

  if (!isReady) {
    return null;
  }

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const homeSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': `${siteOrigin}/#organization`,
        'name': settings?.site_name || 'منصة محمد بهاء التعليمية',
        'alternateName': 'بتاع تسويق',
        'url': siteOrigin,
        'logo': settings?.site_logo ? getAssetUrl(settings.site_logo) : `${siteOrigin}/assets/img/og-preview.jpg`,
        'description': settings?.meta_desc || 'منصة تعليمية رائدة متخصصة في تدريب وتطوير مهارات التسويق الرقمي والإعلانات الممولة وصناعة المحتوى.',
        'founder': {
          '@type': 'Person',
          'name': settings?.trainer_name || 'محمد بهاء'
        },
        'sameAs': [
          settings?.facebook,
          settings?.instagram,
          settings?.tiktok,
          settings?.youtube
        ].filter(Boolean)
      },
      {
        '@type': 'Person',
        '@id': `${siteOrigin}/#trainer`,
        'name': settings?.trainer_name || 'محمد بهاء',
        'jobTitle': 'مدرب ومستشار التسويق الرقمي وصناعة المحتوى',
        'url': `${siteOrigin}/about`,
        'worksFor': { '@id': `${siteOrigin}/#organization` }
      },
      {
        '@type': 'WebSite',
        '@id': `${siteOrigin}/#website`,
        'url': siteOrigin,
        'name': settings?.site_name || 'منصة محمد بهاء التعليمية',
        'publisher': { '@id': `${siteOrigin}/#organization` }
      }
    ]
  };

  return (
    <main>
      <SEO
        title={settings?.site_name || 'منصة محمد بهاء التعليمية'}
        rawTitle={true}
        description={settings?.meta_desc || 'منصة تعليمية متخصصة في كورسات التسويق الرقمي، إعلانات ميتا (فيسبوك وإنستجرام)، وصناعة المحتوى بإشراف المدرب محمد بهاء.'}
        canonical="/"
        keywords={[
          'تسويق إلكتروني',
          'محمد بهاء',
          'بتاع تسويق',
          'إعلانات ميتا',
          'Meta Ads',
          'إعلانات فيسبوك',
          'كورسات تسويق',
          'صناعة محتوى',
          'ميديا باينج'
        ]}
        schema={homeSchema}
      />

      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-content">
            <h1 className="reveal reveal-d1">اتعلم <span className="hl">التسويق</span> وصناعة المحتوى بشكل <span className="hl">عملي</span></h1>
            <p className="lead reveal reveal-d2">مع {settings.trainer_name || 'محمد بهاء'}، هتتعلم المهارات اللي تحتاجها علشان تبدأ أو تطور شغلك في التسويق الإلكتروني وصناعة المحتوى والإعلانات والسوشيال ميديا.</p>
            <div className="hero-actions reveal reveal-d3">
              <Link to="/tracks" className="btn btn-primary"><i className="fa-solid fa-play"></i> ابدأ التعلم</Link>
              {/* زر عن المنصة: يشغل الفيديو مباشرة مكان الصورة */}
              <button
                type="button"
                onClick={() => {
                  setShowAboutVideo(true);
                  const photoEl = document.querySelector('.hero-photo');
                  if (photoEl) photoEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className={`btn ${showAboutVideo ? 'btn-primary' : 'btn-outline-light'}`}
                style={{ cursor: 'pointer' }}
              >
                <i className="fa-solid fa-circle-play"></i> {settings.about_btn_text || 'عن المنصة'}
              </button>
            </div>
          </div>
          <div className="hero-visual reveal reveal-d2">
            <div className="hero-ring"></div>
            <div className={`hero-photo ${showAboutVideo ? 'has-active-video' : ''}`} style={{ position: 'relative' }}>
              {showAboutVideo ? (
                hasAboutVideo ? (
                  <>
                    {renderAboutVideoPlayer(settings.about_video_url)}
                    <button
                      type="button"
                      onClick={() => setShowAboutVideo(false)}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        zIndex: 10,
                        backdropFilter: 'blur(4px)'
                      }}
                      title="إغلاق الفيديو"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    textAlign: 'center',
                    background: '#121218',
                    color: '#fff',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(220, 38, 38, 0.15)',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '26px'
                    }}>
                      <i className="fa-solid fa-video-slash"></i>
                    </div>
                    <strong style={{ fontSize: '17px' }}>لم يتم إضافة فيديو المنصة بعد</strong>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                      يمكنك إضافة رابط الفيديو من لوحة التحكم في صفحة الإعدادات &gt; "فيديو عن المنصة".
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAboutVideo(false)}
                      className="btn btn-light btn-sm mt-2"
                      style={{ padding: '6px 16px', fontSize: '13px' }}
                    >
                      إغلاق
                    </button>
                  </div>
                )
              ) : (
                <div
                  style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}
                  onClick={() => setShowAboutVideo(true)}
                  title="اضغط لتشغيل فيديو عن المنصة"
                >
                  <img
                    src={settings.trainer_image ? getAssetUrl(settings.trainer_image) : '/assets/img/hero.webp'}
                    alt={settings.trainer_name || "المدرب محمد بهاء"}
                    width="600"
                    height="720"
                    fetchpriority="high"
                    style={{ objectFit: 'cover' }}
                  />
                  {/* زر تشغيل دائم جذاب فوق الصورة يدعو للمشاهدة */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="play-btn" style={{ width: '68px', height: '68px', fontSize: '24px', margin: 0 }}>
                      <i className="fa-solid fa-play" style={{ marginInlineStart: '3px' }}></i>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="float-card fc-1"><span className="ic" style={{ background: '#c81e1e' }}><i className="fa-solid fa-heart"></i></span><div>+12.5K<small>تفاعل على البوست</small></div></div>
            <div className="float-card fc-2"><span className="ic" style={{ background: '#111' }}><i className="fa-solid fa-users"></i></span><div>+3,200<small>متابع جديد</small></div></div>
            <div className="float-card fc-3"><div className="bar-chart"><span></span><span></span><span></span><span></span></div><div>ROAS 4.8x<small>نتائج الحملة</small></div></div>
            {settings.facebook && (
              <a href={formatExternalUrl(settings.facebook)} target="_blank" rel="noopener noreferrer" className="social-bubble sb-fb" aria-label="Facebook"><i className="fa-brands fa-facebook-f"></i></a>
            )}
            {settings.instagram && (
              <a href={formatExternalUrl(settings.instagram)} target="_blank" rel="noopener noreferrer" className="social-bubble sb-ig" aria-label="Instagram"><i className="fa-brands fa-instagram"></i></a>
            )}
            {settings.tiktok && (
              <a href={formatExternalUrl(settings.tiktok)} target="_blank" rel="noopener noreferrer" className="social-bubble sb-tt" aria-label="TikTok"><i className="fa-brands fa-tiktok"></i></a>
            )}
          </div>
        </div>

        {/* الشريط الممتد بعرض القسم: المتدربين على اليمين وبطاقة الخصم تمتد بجوارها مباشرة لنهاية الصورة */}
        <div className="container hero-banner-row reveal reveal-d4">
          <div className="hero-trust">
            <div className="avatars"><span style={{ background: '#c81e1e' }}>م</span><span style={{ background: '#374151' }}>أ</span><span style={{ background: '#8b0000' }}>س</span><span style={{ background: '#1f2937' }}>+</span></div>
            <div><strong className="ltr">+{settings.stat_students || '1000'}</strong> متدرب اتعلموا معانا<small><span className="stars"><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i></span> تقييمات ممتازة</small></div>
          </div>
          <div className="hero-banner-row-offer">
            <DiscountBanner variant="hero-bar" />
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {Array(2).fill(['صناعة المحتوى', 'Facebook', 'Instagram', 'Meta Ads', 'Reels', 'CapCut', 'التسويق الإلكتروني', 'Microsoft Office']).map((words, i) => (
            <span key={i}>
              {words.map((w, j) => <span key={j}>{w} <i className="fa-solid fa-star-of-life"></i> </span>)}
            </span>
          ))}
        </div>
      </div>

      <section className="section" id="courses">
        <div className="container">
          <div className="section-head reveal">
            <span className="section-tag"><i className="fa-solid fa-layer-group"></i> المسارات التعليمية المعتمدة</span>
            <h2>المسارات التعليمية الاحترافية (التراكات)</h2>
            <p>مسارات شاملة تجمع لك أهم الكورسات خطوة بخطوة — اشترك في المسار كاملاً بسعر مخفض ووفر أكثر، أو تصفح الكورسات المشمولة داخل كل مسار.</p>
          </div>

          {loading ? (
            <div style={{ padding: '50px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div>
          ) : tracks.length > 0 ? (
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
                      <div className="course-cats" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ background: '#fef2f2', color: '#c81e1e', fontWeight: 'bold' }}>
                          <i className="fa-solid fa-route"></i> تراك شامل
                        </span>
                        <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-star"></i> {track.rating || '5.0'}
                          {track.reviews_count > 0 && <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'normal' }}>({track.reviews_count})</span>}
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
              <i className="fa-solid fa-route fa-3x text-red" style={{ marginBottom: '14px' }}></i>
              <h3>يتم تجهيز مسارات وتراكات تعليمية شاملة وسيتم نشرها قريباً</h3>
            </div>
          )}

          <div className="center mt-4 reveal" style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Link to="/tracks" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 'bold' }}>
              <i className="fa-solid fa-layer-group"></i> استعراض جميع المسارات التعليمية <i className="fa-solid fa-arrow-left"></i>
            </Link>
            <Link to="/tracks?tab=courses" className="btn btn-outline" style={{ padding: '12px 24px', fontSize: '15px' }}>
              <i className="fa-solid fa-graduation-cap"></i> تصفح الكورسات التدريبية المنفردة
            </Link>
          </div>
        </div>
      </section>

      {/* ── قسم المميزات الحصرية للاشتراك ── */}
      <section className="section section-dark vip-perks-section" id="perks">
        <div className="container">
          <div className="section-head reveal" style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 10px' }}>
            <span className="section-tag" style={{ margin: '0 auto 12px' }}>
              <i className="fa-solid fa-crown text-yellow"></i>
              <span>مميزات الاشتراك معنا</span>
            </span>
            <h2>مش مجرد فيديوهات مسجلة</h2>
            <p>اشتراكك في الكورس يضمنلك متابعة حقيقية، دعم فني بعد التطبيق، وشهادات معتمدة تساعدك تبدأ وتنجح.</p>
          </div>

          <div className="vip-perks-grid">
            {/* 1. تليجرام - أسئلة وتصحيح أخطاء بعد التطبيق */}
            <div className="vip-perk-card perk-tg reveal reveal-d1">
              <div className="vip-perk-glow"></div>
              <div className="vip-perk-top">
                <div className="vip-perk-icon ic-tg">
                  <i className="fa-brands fa-telegram"></i>
                </div>
                <span className="vip-perk-badge badge-tg">
                  <span className="pulse-dot tg-dot"></span>
                  <span>جروب التليجرام</span>
                </span>
              </div>
              <div className="vip-perk-body">
                <h3>متاح الأسئلة بعد التطبيق</h3>
                <p>
                  تقدر تسأل وتستفسر بعد التطبيق العملي للدروس نظراً لوجود أي خطأ، لمراجعة خطواتك وحل أي مشكلة تقابلك أولاً بأول مع فريق الدعم.
                </p>
              </div>
              <div className="vip-perk-footer">
                <span className="vip-perk-feature">
                  <i className="fa-solid fa-circle-check text-tg"></i>
                  <span>متابعة وتصحيح الأخطاء خطوة بخطوة</span>
                </span>
              </div>
            </div>

            {/* 2. فيسبوك - لايف شهري تفاعلي */}
            <div className="vip-perk-card perk-fb reveal reveal-d2">
              <div className="vip-perk-glow"></div>
              <div className="vip-perk-top">
                <div className="vip-perk-icon ic-fb">
                  <i className="fa-brands fa-facebook-f"></i>
                </div>
                <span className="vip-perk-badge badge-fb">
                  <span className="pulse-dot fb-dot"></span>
                  <span>لايف شهري تفاعلي</span>
                </span>
              </div>
              <div className="vip-perk-body">
                <h3>لايف شهري للأسئلة والمناقشة</h3>
                <p>
                  بث مباشر مخصص للطلاب شهرياً على جروب الفيس بوك لمناقشة أحدث تحديثات السوشيال ميديا، تحليل المشروعات، والإجابة عن كل استفساراتكم.
                </p>
              </div>
              <div className="vip-perk-footer">
                <span className="vip-perk-feature">
                  <i className="fa-solid fa-circle-check text-fb"></i>
                  <span>جلسة أسئلة وأجوبة لايف كل شهر</span>
                </span>
              </div>
            </div>

            {/* 3. شهادة لكل كورس */}
            <div className="vip-perk-card perk-cert reveal reveal-d3">
              <div className="vip-perk-glow"></div>
              <div className="vip-perk-top">
                <div className="vip-perk-icon ic-cert">
                  <i className="fa-solid fa-award"></i>
                </div>
                <span className="vip-perk-badge badge-cert">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>توثيق معتمد</span>
                </span>
              </div>
              <div className="vip-perk-body">
                <h3>شهادة إتمام لكل كورس</h3>
                <p>
                  بمجرد إكمال دروس وتطبيق أي كورس، تصدر لك شهادة إلكترونية رسمية باسمك ورقم تحقق كودي موثق، لتعزيز سيرتك الذاتية في سوق العمل.
                </p>
              </div>
              <div className="vip-perk-footer">
                <span className="vip-perk-feature">
                  <i className="fa-solid fa-circle-check text-cert"></i>
                  <span>شهادة رسمية موثقة برقم كودي</span>
                </span>
              </div>
            </div>

            {/* 4. اشتراك سنوي شامل التحديثات */}
            <div className="vip-perk-card perk-updates reveal reveal-d4">
              <div className="vip-perk-glow"></div>
              <div className="vip-perk-top">
                <div className="vip-perk-icon ic-updates">
                  <i className="fa-solid fa-arrows-rotate"></i>
                </div>
                <span className="vip-perk-badge badge-updates">
                  <i className="fa-solid fa-calendar-check"></i>
                  <span>365 يوماً وصول كامل</span>
                </span>
              </div>
              <div className="vip-perk-body">
                <h3>اشتراك سنوي شامل كل التحديثات</h3>
                <p>
                  الاشتراك سنوي بالكامل، ويشمل تلقائياً الوصول لكافة التحديثات والدروس والإضافات الجديدة التي يتم طرحها خلال السنة دون دفع أي مبالغ إضافية.
                </p>
              </div>
              <div className="vip-perk-footer">
                <span className="vip-perk-feature">
                  <i className="fa-solid fa-circle-check text-updates"></i>
                  <span>تحديثات مستمرة طوال فترة اشتراكك</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-gray">
        <div className="container">
          <div className="section-head reveal">
            <span className="section-tag"><i className="fa-solid fa-medal"></i> لماذا تتعلم معنا؟</span>
            <h2>الهدف إنك تعرف تطبق</h2>
          </div>
          <div className="features-grid">
            <div className="feature reveal reveal-d1"><div className="ic"><i className="fa-solid fa-screwdriver-wrench"></i></div><h3>محتوى عملي</h3><p>كل درس مربوط بتطبيق حقيقي تقدر تنفذه على شغلك أو صفحتك مباشرة.</p></div>
            <div className="feature reveal reveal-d2"><div className="ic"><i className="fa-solid fa-language"></i></div><h3>شرح باللغة العربية بطريقة بسيطة</h3><p>شرح بالمصري وبأسلوب سهل من غير تعقيد ولا مصطلحات ملهاش لازمة.</p></div>
            <div className="feature reveal reveal-d3"><div className="ic"><i className="fa-solid fa-lightbulb"></i></div><h3>تطبيقات وأمثلة عملية</h3><p>أمثلة من السوق المصري والعربي وحالات حقيقية لبراندات ومشروعات.</p></div>
            <div className="feature reveal reveal-d4"><div className="ic"><i className="fa-solid fa-clock-rotate-left"></i></div><h3>تقدر تتعلم في الوقت المناسب ليك</h3><p>الكورس متاح على حسابك، اتفرج في أي وقت ومن أي جهاز وبالسرعة اللي تريحك.</p></div>
          </div>
        </div>
      </section>

      <section className="section section-dark" id="path">
        <div className="container path-wrap">
          <div className="path-intro reveal">
            <span className="section-tag"><i className="fa-solid fa-route"></i> المسار التعليمي</span>
            <h2>مش عارف تبدأ منين؟</h2>
            <p>لو لسه في بداية طريقك في التسويق الإلكتروني، تقدر تبدأ بالمسار التعليمي الكامل وتتعلم المهارات خطوة بخطوة.</p>
            <Link to="/tracks" className="btn btn-primary"><i className="fa-solid fa-flag-checkered"></i> ابدأ رحلتك التعليمية</Link>
          </div>
          <div className="path-list">
            {!loading && courses.map((c, i) => (
              <Link to={`/course/${c.slug}`} className={`path-step reveal reveal-d${Math.min(i + 1, 5)}`} key={c._id}>
                <span className="path-num">{i + 1}</span>
                <div className="path-info"><h4>{c.title}</h4><small>{c.lessons_count || 0} درس • {c.duration || '-'} • {c.level || '-'}</small></div>
                <i className="fa-solid fa-arrow-left arrow"></i>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="section section-gray" style={{ overflow: 'hidden' }}>
          <div className="container">
            <div className="section-head reveal">
              <h2>آراء المتدربين</h2>
              <p>شهادات نعتز بها من طلابنا بعد دراستهم وتطبيقهم العملي.</p>
            </div>

            <div className="reveal reveal-d2">
              <Swiper
                modules={[Pagination, Autoplay]}
                spaceBetween={24}
                slidesPerView={1}
                breakpoints={{
                  768: { slidesPerView: 2 },
                  1024: { slidesPerView: 3 },
                }}
                pagination={{ clickable: true }}
                autoplay={{ delay: 4000, disableOnInteraction: false }}
                className="testimonials-swiper"
                style={{ paddingBottom: '50px' }}
              >
                {reviews.map((r, idx) => {
                  const initial = (r.user?.name || 'م')[0];
                  const colors = ['#c81e1e', '#111827', '#b45309', '#1e3a8a', '#15803d', '#7c3aed'];
                  const bg = colors[idx % colors.length];
                  const stars = r.rating || 5;

                  return (
                    <SwiperSlide key={r._id}>
                      <div className="feature" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                            <span className="ic" style={{ background: bg, width: '48px', height: '48px', fontSize: '18px', flexShrink: 0, color: '#fff', fontWeight: 'bold' }}>
                              {initial}
                            </span>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '16px', marginBottom: '4px' }}>{r.user?.name || 'متدرب متميز'}</h3>
                              <p className="sub" style={{ margin: 0, color: '#c81e1e', fontSize: '12.5px', fontWeight: '600' }}>
                                {r.track ? `مسار: ${r.track.title}` : (r.course?.title || 'أحد الكورسات')}
                              </p>
                            </div>
                          </div>
                          <p style={{ lineHeight: '1.7', color: '#475569', fontSize: '14.5px' }}>
                            "{r.comment}"
                          </p>
                        </div>
                        <div className="stars mt" style={{ color: '#f59e0b', fontSize: '14px', marginTop: '16px' }}>
                          {[1, 2, 3, 4, 5].map(st => (
                            <i key={st} className={st <= stars ? 'fa-solid fa-star' : 'fa-regular fa-star'} style={{ marginLeft: '2px' }}></i>
                          ))}
                        </div>
                      </div>
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            </div>

          </div>
        </section>
      )}

      <section className="section (mt-4 reveal)">
        <div className="container">
          <div className="stats-grid">
            <div className="stat reveal reveal-d1"><i className="fa-solid fa-award"></i><div className="num">+{settings.stat_years || '12'}</div><div className="lbl">سنوات خبرة تدريبية</div></div>
            <div className="stat reveal reveal-d2"><i className="fa-solid fa-user-graduate"></i><div className="num">+{settings.stat_students || '1200'}</div><div className="lbl">متدرب</div></div>
            <div className="stat reveal reveal-d3"><i className="fa-solid fa-book-open"></i><div className="num">+{settings.stat_courses || '11'}</div><div className="lbl">كورسات</div></div>
            <div className="stat reveal reveal-d4"><i className="fa-solid fa-circle-play"></i><div className="num">+{settings.stat_hours || '50'}</div><div className="lbl">ساعة محتوى تدريبي</div></div>
            <div className="stat reveal reveal-d5"><i className="fa-solid fa-handshake"></i><div className="num">+{settings.stat_clients || '1050'}</div><div className="lbl">عميل ساعدناهم</div></div>
          </div>
          <div className="cta mt-4 reveal">
            <div><h2>جاهز تبدأ رحلتك في التسويق؟</h2><p>اختار الكورس، حوّل بـ InstaPay أو Vodafone Cash، وابدأ تتعلم فوراً بعد التفعيل.</p></div>
            <div className="btns">
              <Link to="/register" className="btn btn-light"><i className="fa-solid fa-user-plus"></i> انشاء حساب</Link>
              <Link to="/subscribe" className="btn btn-ghost-light btn-outline">طريقة الاشتراك</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
