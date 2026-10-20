import { useState, useEffect } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { getAssetUrl } from '../utils/assetUrl';
import { useSettings } from '../context/SettingsContext';
import SEO from '../components/common/SEO';
import { sanitizeHtml } from '../utils/sanitizeHtml';

function CourseDetails() {
  const { slug } = useParams();
  const { settings, loadingSettings } = useSettings();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isReady = !loading && !loadingSettings;
  usePageReady(isReady);

  const [openSection, setOpenSection] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [previewLesson, setPreviewLesson] = useState(null);
  const [isPlayingIntro, setIsPlayingIntro] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewLesson(null);
    };
    if (previewLesson) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [previewLesson]);

  const handleOpenPreviewLesson = async (l) => {
    if (!l || !l.is_preview) return;
    setPreviewLesson(l);

    // If video fields are missing, fetch fresh preview from endpoint
    if (!l.embed_url && !l.bunny_video_id && !l.video_url && !l.video_file) {
      try {
        const res = await api.get(`/courses/lessons/${l._id}/preview`);
        if (res && res.lesson) {
          setPreviewLesson(prev => (prev && prev._id === l._id ? { ...prev, ...res.lesson } : prev));
        }
      } catch (e) {
        console.error('Failed to fetch preview lesson details:', e);
      }
    }
  };

  const renderVideoPlayer = (target, autoPlay = false) => {
    if (!target) return null;

    // If it's a lesson object
    if (typeof target === 'object') {
      const lesson = target;
      if (lesson.embed_url) {
        let embedSrc = lesson.embed_url;
        if (autoPlay && !embedSrc.includes('autoplay=')) {
          embedSrc += (embedSrc.includes('?') ? '&' : '?') + 'autoplay=true&preload=true';
        }
        return (
          <iframe
            src={embedSrc}
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{ width: '100%', height: '100%', border: 0 }}
            title={lesson.title}
          />
        );
      }

      if (lesson.bunny_video_id) {
        const libraryId = '773479';
        const src = `https://iframe.mediadelivery.net/embed/${libraryId}/${lesson.bunny_video_id}?autoplay=${autoPlay ? 'true' : 'false'}&preload=true`;
        return (
          <iframe
            src={src}
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{ width: '100%', height: '100%', border: 0 }}
            title={lesson.title}
          />
        );
      }

      const url = lesson.video_url || '';
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let vid = '';
        if (url.includes('v=')) {
          vid = url.split('v=')[1]?.split('&')[0];
        } else if (url.includes('youtu.be/')) {
          vid = url.split('youtu.be/')[1]?.split('?')[0];
        } else if (url.includes('embed/')) {
          vid = url.split('embed/')[1]?.split('?')[0];
        }
        return (
          <iframe
            src={`https://www.youtube.com/embed/${vid}${autoPlay ? '?autoplay=1&rel=0' : '?rel=0'}`}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            style={{ width: '100%', height: '100%', border: 0 }}
            title={lesson.title}
          />
        );
      }

      if (url.includes('vimeo.com')) {
        const match = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/);
        const vid = match ? match[1] : url.split('/').pop().split('?')[0];
        return (
          <iframe
            src={`https://player.vimeo.com/video/${vid}${autoPlay ? '?autoplay=1' : ''}`}
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{ width: '100%', height: '100%', border: 0 }}
            title={lesson.title}
          />
        );
      }

      if (url.includes('mediadelivery.net') || url.includes('bunnycdn.com') || url.includes('/embed/') || url.includes('/play/')) {
        let embedSrc = url.replace('/play/', '/embed/');
        if (embedSrc.includes('player.mediadelivery.net')) {
          embedSrc = embedSrc.replace('player.mediadelivery.net', 'iframe.mediadelivery.net');
        }
        if (autoPlay && !embedSrc.includes('autoplay=')) {
          embedSrc += (embedSrc.includes('?') ? '&' : '?') + 'autoplay=true&preload=true';
        }
        return (
          <iframe
            src={embedSrc}
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{ width: '100%', height: '100%', border: 0 }}
            title={lesson.title}
          />
        );
      }

      if (lesson.video_file) {
        const videoSrc = lesson.video_file.startsWith('http')
          ? lesson.video_file
          : getAssetUrl(lesson.video_file);
        return (
          <video
            controls
            autoPlay={autoPlay}
            controlsList="nodownload"
            src={videoSrc}
            style={{ width: '100%', height: '100%', background: '#000' }}
          />
        );
      }

      if (url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('.mp4?') || url.includes('.webm?'))) {
        return (
          <video
            controls
            autoPlay={autoPlay}
            controlsList="nodownload"
            src={url}
            style={{ width: '100%', height: '100%', background: '#000' }}
          />
        );
      }

      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', flexDirection: 'column', gap: '10px' }}>
          <i className="fa-solid fa-circle-exclamation fa-2x"></i>
          <span>لا يتوفر فيديو لهذه المحاضرة حالياً</span>
        </div>
      );
    }

    // If target is a string URL (e.g. course.intro_video)
    const strUrl = String(target).trim();

    // 1. Bunny Stream for course intro video
    if (strUrl.includes('mediadelivery.net') || strUrl.includes('bunnycdn.com') || strUrl.includes('/embed/') || strUrl.includes('/play/')) {
      let embedSrc = strUrl.replace('/play/', '/embed/');
      if (autoPlay && !embedSrc.includes('autoplay=')) {
        embedSrc += (embedSrc.includes('?') ? '&' : '?') + 'autoplay=true&preload=true';
      }
      return (
        <iframe
          src={embedSrc}
          allowFullScreen
          allow="autoplay; fullscreen"
          style={{ width: '100%', height: '100%', border: 0 }}
          title="الفيديو التعريفي للكورس"
        />
      );
    }

    if (strUrl.includes('youtube.com') || strUrl.includes('youtu.be')) {
      let vid = '';
      if (strUrl.includes('v=')) {
        vid = strUrl.split('v=')[1]?.split('&')[0];
      } else if (strUrl.includes('youtu.be/')) {
        vid = strUrl.split('youtu.be/')[1]?.split('?')[0];
      } else if (strUrl.includes('embed/')) {
        vid = strUrl.split('embed/')[1]?.split('?')[0];
      }
      return (
        <iframe
          src={`https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1&rel=0`}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          style={{ width: '100%', height: '100%', border: 0 }}
          title="الفيديو التعريفي للكورس"
        />
      );
    }

    if (strUrl.includes('vimeo.com')) {
      const match = strUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/);
      const vid = match ? match[1] : strUrl.split('/').pop().split('?')[0];
      return (
        <iframe
          src={`https://player.vimeo.com/video/${vid}?autoplay=1`}
          allowFullScreen
          allow="autoplay; fullscreen"
          style={{ width: '100%', height: '100%', border: 0 }}
          title="الفيديو التعريفي للكورس"
        />
      );
    }

    if (strUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
      const videoSrc = strUrl.startsWith('http') ? strUrl : getAssetUrl(strUrl);
      return (
        <video
          controls
          autoPlay={autoPlay}
          controlsList="nodownload"
          src={videoSrc}
          style={{ width: '100%', height: '100%', background: '#000' }}
        />
      );
    }

    let defaultSrc = strUrl;
    if (autoPlay && !defaultSrc.includes('autoplay=')) {
      defaultSrc += (defaultSrc.includes('?') ? '&' : '?') + 'autoplay=true';
    }

    return (
      <iframe
        src={defaultSrc}
        allowFullScreen
        allow="autoplay; fullscreen"
        style={{ width: '100%', height: '100%', border: 0 }}
        title="الفيديو التعريفي للكورس"
      />
    );
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/courses/${slug}`);
      setData(res);
      if (res.course?.sections?.length > 0) {
        setOpenSection(res.course.sections[0]._id);
      }
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) return null;
  if (!data || !data.course) return <main style={{ padding: '100px 0', textAlign: 'center' }}><h2>الكورس غير موجود</h2><Link to="/tracks?tab=courses" className="btn btn-primary mt-2">تصفح الكورسات</Link></main>;

  const { course } = data;
  const sections = course.sections || [];

  // NOTE: faqs were mocked in original, let's keep it mocked or omit it as the model didn't define faqs natively (only in UI). 
  // We can add them later if needed. For now, empty or static.
  const faqs = [];

  const off = course.old_price > course.price
    ? Math.round(100 - (course.price / course.old_price) * 100)
    : 0;

  const getFirstLesson = (sectionsList) => {
    if (!sectionsList || !sectionsList.length) return null;
    for (const s of sectionsList) {
      if (s.lessons && s.lessons.length > 0) {
        return s.lessons[0];
      }
      if (s.subsections && s.subsections.length > 0) {
        for (const sub of s.subsections) {
          if (sub.lessons && sub.lessons.length > 0) {
            return sub.lessons[0];
          }
        }
      }
    }
    return null;
  };

  const hasIntroVideo = Boolean(course.intro_video && course.intro_video.trim());
  const firstLesson = getFirstLesson(sections);
  const firstFreeLesson = (!hasIntroVideo && (course.first_free_lesson || (firstLesson?.is_preview ? firstLesson : null))) || null;

  const totalLessons = sections.reduce((acc, s) => {
    const subCount = (s.subsections || []).reduce((subAcc, sub) => subAcc + (sub.lessons?.length || 0), 0);
    return acc + (s.lessons?.length || 0) + subCount;
  }, 0);

  const toggleSection = (id) => setOpenSection(openSection === id ? null : id);
  const toggleFaq = (id) => setOpenFaq(openFaq === id ? null : id);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const courseTitle = course.meta_title || `كورس ${course.title}`;
  const courseDesc = course.meta_desc || course.short_desc || course.description || `سجل الآن في كورس ${course.title} مع المدرب محمد بهاء وتعلم مهارات التسويق الرقمي وإعلانات ميتا باحترافية.`;
  const courseCanonical = `/course/${encodeURIComponent(slug)}`;
  const courseOgImage = course.thumbnail ? getAssetUrl(course.thumbnail) : `${originUrl}/assets/img/og-preview.jpg`;

  const courseSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        '@id': `${originUrl}/course/${encodeURIComponent(slug)}#course`,
        'name': course.title,
        'description': courseDesc,
        'provider': {
          '@type': 'EducationalOrganization',
          'name': settings?.site_name || 'منصة محمد بهاء التعليمية',
          'url': originUrl
        },
        'instructor': {
          '@type': 'Person',
          'name': settings?.trainer_name || 'محمد بهاء',
          'url': `${originUrl}/about`
        },
        'image': courseOgImage,
        'inLanguage': 'ar',
        'hasCourseInstance': {
          '@type': 'CourseInstance',
          'courseMode': 'online',
          'courseWorkload': course.duration || undefined
        },
        'offers': {
          '@type': 'Offer',
          'price': course.price || 0,
          'priceCurrency': 'EGP',
          'availability': 'https://schema.org/InStock',
          'url': `${originUrl}/course/${encodeURIComponent(slug)}`
        }
      },
      {
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
            'name': 'الكورسات',
            'item': `${originUrl}/courses`
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': course.title,
            'item': `${originUrl}/course/${encodeURIComponent(slug)}`
          }
        ]
      }
    ]
  };

  return (
    <main>
      <SEO
        title={courseTitle}
        description={courseDesc}
        canonical={courseCanonical}
        ogType="article"
        ogImage={courseOgImage}
        keywords={[course.title, 'كورس تسويق', 'محمد بهاء', 'إعلانات ممولة', 'بتاع تسويق', ...(course.categories?.map(c => c.name) || [])]}
        schema={courseSchema}
      />
      <section className="course-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">الرئيسية</Link><i className="fa-solid fa-chevron-left"></i>
            <Link to="/tracks?tab=courses">الكورسات</Link><i className="fa-solid fa-chevron-left"></i>
            <span>{course.title}</span>
          </div>
          <div className="course-cats">
            {course.categories.map((c, i) => <span key={i}>{c.name}</span>)}
          </div>
          <h1>كورس {course.title}</h1>
          <p className="lead">{course.short_desc}</p>
          <div className="chips">
            <span className="chip"><i className="fa-solid fa-chalkboard-user"></i> المدرب: {settings.trainer_name || 'محمد بهاء'}</span>
            <span className="chip"><i className="fa-solid fa-circle-play"></i> {totalLessons} محاضرة</span>
            <span className="chip"><i className="fa-regular fa-clock"></i> {course.duration || 'غير محدد'}</span>
            <span className="chip"><i className="fa-solid fa-signal"></i> مستوى {course.level || 'غير محدد'}</span>
            <span className="chip"><i className="fa-solid fa-language"></i> باللغة العربية</span>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: '90px' }}>
        <div className="container course-layout">
          <div className="course-main">
            <div className="card reveal" style={{ marginTop: 0 }}>
              <h2><i className="fa-solid fa-circle-info"></i> وصف الكورس</h2>
              <div className="prose">
                {(course.description || '').split('\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>

            <div className="card reveal">
              <h2><i className="fa-solid fa-bullseye"></i> ماذا ستتعلم؟</h2>
              <ul className="check-list">
                {(course.what_learn || '').split('\n').filter(Boolean).map((item, i) => (
                  <li key={i}><i className="fa-solid fa-check"></i>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card reveal">
              <h2><i className="fa-solid fa-users"></i> لمن هذا الكورس؟</h2>
              <ul className="check-list single dark">
                {(course.audience || '').split('\n').filter(Boolean).map((item, i) => (
                  <li key={i}><i className="fa-solid fa-user"></i>{item}</li>
                ))}
              </ul>
            </div>

            {!course.is_soon && sections.length > 0 && (
              <div className="card reveal">
                <h2>
                  <i className="fa-solid fa-list-ul"></i> محتويات الكورس
                  <small className="muted" style={{ fontSize: '14px', fontWeight: 600, marginInlineStart: 'auto' }}>
                    {sections.length} أقسام • {totalLessons} محاضرة
                  </small>
                </h2>
                <div className="curriculum">
                  {sections.map((s) => {
                  const sLessons = s.lessons || [];
                  const sSubsections = s.subsections || [];
                  const sCount = sLessons.length + sSubsections.reduce((acc, sub) => acc + (sub.lessons?.length || 0), 0);
                  
                  const renderLessonItem = (l, idx) => (
                    <div
                      key={l._id}
                      className={`lesson-row ${l.is_preview ? 'is-preview-active' : ''}`}
                      onClick={() => {
                        if (l.is_preview) {
                          handleOpenPreviewLesson(l);
                        }
                      }}
                    >
                      <span className={`li ${l.is_preview ? 'preview' : ''}`}>
                        <i className={`fa-solid ${l.is_preview ? 'fa-play' : 'fa-lock'}`}></i>
                      </span>
                      <div className="l-body">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <span className="t">{idx + 1}. {l.title}</span>
                          {l.is_preview && (
                            <button
                              type="button"
                              className="btn-preview-watch"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPreviewLesson(l);
                              }}
                            >
                              <i className="fa-solid fa-circle-play"></i> مشاهدة مجاناً
                            </button>
                          )}
                        </div>
                        <div className="l-meta">
                          <span className="d"><i className="fa-regular fa-clock"></i> {l.duration || '00:00'}</span>
                          {l.is_preview && (
                            <span className="tag-preview">
                              <i className="fa-solid fa-unlock"></i> متاح للمشاهدة مجاناً
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div key={s._id} className={`acc ${openSection === s._id ? 'open' : ''}`}>
                      <button className="acc-head" type="button" onClick={() => toggleSection(s._id)}>
                        <span>{s.title}</span>
                        <span className="meta">{sCount} محاضرات</span>
                        <i className="fa-solid fa-chevron-down chev"></i>
                      </button>
                      <div className="acc-body">
                        {sLessons.map((l, idx) => renderLessonItem(l, idx))}

                        {sSubsections.map((sub, subIdx) => (
                          <div key={sub._id} style={{ margin: '8px 0 4px' }}>
                            <div style={{
                              padding: '7px 12px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              borderRight: '3px solid var(--red)',
                              borderRadius: '6px',
                              marginBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              color: 'var(--text)'
                            }}>
                              <i className="fa-solid fa-folder-tree" style={{ color: 'var(--red)', fontSize: '11px' }}></i>
                              <span>{sub.title}</span>
                              <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: 'auto' }}>
                                {(sub.lessons || []).length} محاضرات
                              </span>
                            </div>
                            {(sub.lessons || []).map((l, lIdx) => renderLessonItem(l, lIdx))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

            <div className="card reveal">
              <h2><i className="fa-solid fa-chalkboard-user"></i> المدرب</h2>
              <div className="instructor">
                <img src={settings.trainer_image ? getAssetUrl(settings.trainer_image) : '/assets/img/hero.webp'} alt="المدرب" width="84" height="84" loading="lazy" style={{ objectFit: 'cover' }} />
                <div>
                  <h4>{settings.trainer_name || 'محمد بهاء'}</h4>
                  <small>{settings.trainer_subtitle || 'بتاع تسويق — مدرب تسويق إلكتروني وصانع محتوى'}</small>
                  <div
                    className="muted"
                    style={{ fontSize: '14.5px', lineHeight: '1.7', marginTop: '6px' }}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(settings.trainer_desc || 'مدرب متخصص في التسويق الإلكتروني وصناعة المحتوى، بيقدم محتوى تدريبي عملي بيساعدك تفهم وتستخدم أدوات التسويق والسوشيال ميديا بطريقة عملية.')
                    }}
                  />
                </div>
              </div>
            </div>

            {faqs.length > 0 && (
              <div className="card reveal faq">
                <h2><i className="fa-solid fa-circle-question"></i> الأسئلة الشائعة</h2>
                <div className="curriculum">
                  {faqs.map((f, i) => (
                    <div key={i} className={`acc ${openFaq === i ? 'open' : ''}`}>
                      <button className="acc-head" type="button" onClick={() => toggleFaq(i)}>
                        <span>{f.question}</span><i className="fa-solid fa-chevron-down chev"></i>
                      </button>
                      <div className="acc-body"><p>{f.answer}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bottom-cta reveal">
              <div>
                <h3>{course.enrolled ? 'مرحباً بعودتك للتعلم!' : course.is_soon ? `كورس ${course.title} سيتوفر قريباً` : `جاهز تبدأ كورس ${course.title}؟`}</h3>
                <p>{course.enrolled ? 'استمتع بمشاهدة الكورس من حيث توقفت.' : course.is_soon ? 'جاري إعداد محتوى الكورس وسيكون متاحاً للتسجيل قريباً.' : `السعر $${course.price} — ادفع بـ InstaPay أو Vodafone Cash.`}</p>
              </div>
              {course.enrolled ? (
                <Link to={`/account/learn/${course.slug}`} className="btn btn-dark"><i className="fa-solid fa-play"></i> مشاهدة الكورس</Link>
              ) : course.is_soon ? (
                <button type="button" className="btn btn-soon" style={{ padding: '12px 28px', fontSize: '15px' }} disabled>
                  قريباً
                </button>
              ) : course.has_pending_order ? (
                <Link to="/account?tab=orders" className="btn btn-warning" style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '12px 24px' }}>
                  <i className="fa-solid fa-hourglass-half"></i> طلبك قيد المراجعة
                </Link>
              ) : (
                <Link to={`/checkout?course=${course.slug}`} className="btn btn-primary"><i className="fa-solid fa-cart-shopping"></i> اشترك في الكورس</Link>
              )}
            </div>
          </div>

          <aside className="course-side">
            <div className="buy-card reveal">
              <div className="thumb" style={{ position: 'relative' }}>
                {course.is_soon ? (
                  <div
                    className="course-video-cover-overlay"
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      cursor: 'default',
                      overflow: 'hidden'
                    }}
                  >
                    <img 
                      src={getAssetUrl(course.image, '/assets/img/courses/default.svg')} 
                      alt={course.title} 
                      width="800" 
                      height="500" 
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/assets/img/courses/default.svg';
                      }}
                    />
                    {/* طبقة SOON خفيفة مع شارة Soon */}
                    <div className="course-thumb-soon-overlay">
                      <span className="soon-pill-badge" style={{ fontSize: '16px', padding: '10px 24px' }}>
                        <i className="fa-solid fa-hourglass-start"></i> قريباً Soon
                      </span>
                    </div>
                  </div>
                ) : isPlayingIntro ? (
                  hasIntroVideo ? (
                    renderVideoPlayer(course.intro_video, true)
                  ) : firstFreeLesson ? (
                    renderVideoPlayer(firstFreeLesson, true)
                  ) : (
                    <img 
                      src={getAssetUrl(course.image, '/assets/img/courses/default.svg')} 
                      alt={course.title} 
                      width="800" 
                      height="500" 
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/assets/img/courses/default.svg';
                      }}
                    />
                  )
                ) : (
                  <div
                    className="course-video-cover-overlay"
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      cursor: (hasIntroVideo || firstFreeLesson) ? 'pointer' : 'default',
                      overflow: 'hidden'
                    }}
                    onClick={() => {
                      if (hasIntroVideo || firstFreeLesson) {
                        setIsPlayingIntro(true);
                      }
                    }}
                  >
                    <img 
                      src={getAssetUrl(course.image, '/assets/img/courses/default.svg')} 
                      alt={course.title} 
                      width="800" 
                      height="500" 
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.4s ease'
                      }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/assets/img/courses/default.svg';
                      }}
                    />
                    {(hasIntroVideo || firstFreeLesson) && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.4) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div className="play-btn" style={{ width: '60px', height: '60px', fontSize: '20px', margin: 0 }}>
                          <i className="fa-solid fa-play" style={{ marginInlineStart: '3px' }}></i>
                        </div>
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '700', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                          مشاهدة مقدمة الكورس
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="buy-inner">
                {course.enrolled ? (
                  <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--accent, #ff0000ff)', marginBottom: '8px' }}>أنت مشترك في هذا الكورس</h3>
                    {course.expires_at && (
                      <small style={{ color: '#64748b', fontSize: '12px' }}>
                        صالح حتى: {new Date(course.expires_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </small>
                    )}
                  </div>
                ) : course.is_soon ? (
                  <div style={{ marginBottom: '16px', textAlign: 'center', background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.25)', padding: '12px', borderRadius: '12px' }}>
                    <strong style={{ color: '#d97706', fontSize: '17px', display: 'block' }}>
                      <i className="fa-solid fa-hourglass-half"></i> قريباً
                    </strong>
                    <small style={{ color: '#94a3b8', fontSize: '12.5px', marginTop: '4px', display: 'block' }}>
                      الكورس قيد الإعداد وسيتاح للتسجيل قريباً
                    </small>
                  </div>
                ) : (
                  <>
                    {course.is_expired && (
                      <div style={{ marginBottom: '14px', textAlign: 'center', background: '#fee2e2', padding: '10px 12px', borderRadius: '10px', color: '#991b1b' }}>
                        <strong style={{ display: 'block', fontSize: '13.5px' }}><i className="fa-solid fa-lock"></i> انتهت صلاحية اشتراكك السابق</strong>
                        <small style={{ fontSize: '11.5px' }}>يمكنك إعادة الشراء للتجديد ومتابعة الدروس</small>
                      </div>
                    )}
                    <div className="buy-price">
                      <span className="now">${Number(course.price).toLocaleString()}</span>
                      {off > 0 && <><del>${Number(course.old_price).toLocaleString()}</del><span className="off">-{off}%</span></>}
                    </div>
                    <small className="muted">دفع يدوي آمن عبر InstaPay أو Vodafone Cash</small>
                  </>
                )}
                <ul className="buy-list">
                  {!course.is_soon && (
                    <li><span><i className="fa-solid fa-circle-play"></i>عدد المحاضرات</span><strong>{totalLessons} محاضرة</strong></li>
                  )}
                  {course.duration && (
                    <li><span><i className="fa-regular fa-clock"></i>مدة الكورس</span><strong>{course.duration}</strong></li>
                  )}
                  <li><span><i className="fa-solid fa-signal"></i>المستوى</span><strong>{course.level || '-'}</strong></li>
                  <li><span><i className="fa-solid fa-chalkboard-user"></i>المدرب</span><strong>{settings.trainer_name || 'محمد بهاء'}</strong></li>
                  {!course.is_soon && (
                    <li>
                      <span><i className="fa-solid fa-hourglass-half"></i>مدة إتاحة الكورس</span>
                      <strong>
                        {course.access_duration_unit === 'lifetime' 
                          ? 'مدى الحياة' 
                          : `${course.access_duration_value || 1} ${course.access_duration_unit === 'hours' ? 'ساعة' : course.access_duration_unit === 'days' ? 'يوم' : course.access_duration_unit === 'months' ? 'شهر' : 'سنة'}`}
                      </strong>
                    </li>
                  )}
                </ul>

                {course.has_pending_order && (
                  <div style={{ marginBottom: '14px', textAlign: 'center', background: '#fffbeb', border: '1px solid #fde68a', padding: '10px 12px', borderRadius: '10px', color: '#92400e' }}>
                    <strong style={{ display: 'block', fontSize: '13px', marginBottom: '2px' }}>
                      <i className="fa-solid fa-hourglass-half" style={{ color: '#d97706' }}></i> طلب اشتراكك قيد المراجعة
                    </strong>
                    <small style={{ fontSize: '11.5px', color: '#b45309' }}>
                      لا يمكنك إرسال طلب جديد إلا بعد مراجعة الطلب الحالي أو رفضه.
                    </small>
                  </div>
                )}

                {course.enrolled ? (
                  <Link to={`/account/learn/${course.slug}`} className="btn btn-dark btn-block"><i className="fa-solid fa-play"></i> مشاهدة الكورس</Link>
                ) : course.is_soon ? (
                  <button type="button" className="btn btn-soon btn-block" style={{ padding: '14px', fontSize: '16px', justifyContent: 'center' }} disabled>
                    قريباً
                  </button>
                ) : course.has_pending_order ? (
                  <Link to="/account?tab=orders" className="btn btn-warning btn-block" style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '14px', fontSize: '15px' }}>
                    <i className="fa-solid fa-hourglass-half"></i> طلب الاشتراك قيد المراجعة
                  </Link>
                ) : (
                  <Link to={`/checkout?course=${course.slug}`} className="btn btn-primary btn-block">
                    <i className="fa-solid fa-cart-shopping"></i> {course.is_expired ? 'تجديد الاشتراك في الكورس' : 'اشترك في الكورس'}
                  </Link>
                )}

                {course.track && (
                  <div style={{
                    marginTop: '16px',
                    padding: '14px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    textAlign: 'right'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#c81e1e', fontWeight: 'bold', marginBottom: '4px' }}>
                      <i className="fa-solid fa-route"></i> متاح أيضاً كجزء من تراك:
                    </div>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                      {course.track.title}
                    </strong>
                    <Link
                      to={`/track/${course.track.slug}`}
                      className="btn btn-outline btn-block btn-sm"
                      style={{ fontSize: '12px', justifyContent: 'center', borderColor: '#c81e1e', color: '#c81e1e' }}
                    >
                      <i className="fa-solid fa-layer-group"></i> عرض التراك الشامل (${course.track.price})
                    </Link>
                  </div>
                )}

                {settings.whatsapp && (
                  <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-block mt-2" style={{ color: '#16a34a' }}><i className="fa-brands fa-whatsapp"></i> استفسر على واتساب</a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Video Preview Modal */}
      {previewLesson && (
        <div
          className="preview-modal-overlay"
          onClick={() => setPreviewLesson(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            className="preview-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              maxWidth: '920px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(22, 163, 74, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              color: '#fff',
              maxHeight: '92vh'
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                background: 'rgba(30, 41, 59, 0.98)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-unlock"></i> معاينة مجانية
                </span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                  {previewLesson.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLesson(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background 0.2s'
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Video Player Box */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
              {renderVideoPlayer(previewLesson, true)}
            </div>

            {/* Modal Footer / CTA */}
            <div
              style={{
                padding: '20px 24px',
                background: 'rgba(30, 41, 59, 0.98)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '15px', color: '#f8fafc', marginBottom: '4px' }}>
                  {course.enrolled ? 'أنت مشترك في هذا الكورس' : 'أعجبتك المحاضرة؟ اشترك في الكورس بالكامل الآن'}
                </strong>
                <small style={{ color: '#94a3b8', fontSize: '13px' }}>
                  {course.enrolled ? 'يمكنك متابعة الكورس بالكامل من منصة التعلم' : `احصل على وصول كامل لكافة المحاضرات (${totalLessons} محاضرة) والشهادة المعتمدة`}
                </small>
              </div>

              {course.enrolled ? (
                <Link
                  to={`/account/learn/${course.slug}?lesson=${previewLesson._id}`}
                  className="btn btn-dark"
                  style={{ background: '#2563eb', padding: '10px 20px', borderRadius: '10px' }}
                >
                  <i className="fa-solid fa-play"></i> فتح في صفحة التعلم
                </Link>
              ) : (
                <Link
                  to={`/checkout?course=${course.slug}`}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '15px' }}
                >
                  <i className="fa-solid fa-cart-shopping"></i> اشترك الآن (${Number(course.price).toLocaleString()})
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CourseDetails;
