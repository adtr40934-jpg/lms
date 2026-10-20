import { useState, useEffect, useContext, useRef } from 'react';
import { usePageReady } from '../../hooks/usePageReady';
import { useParams, Link, useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import StudentCertificateModal from '../../components/StudentCertificateModal';
import CourseReviewModal from '../../components/CourseReviewModal';
import SEO from '../../components/common/SEO';
import { getAssetUrl } from '../../utils/assetUrl';

// Helper component for tracking progress
function CustomVideoPlayer({ lesson, userId, onEnded }) {
  const [ready, setReady] = useState(false);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const intervalRef = useRef(null);
  const hasEndedRef = useRef(false);
  const storageKey = `yt_prog_${userId}_${lesson._id}`;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const saveTime = (time) => {
    if (time > 0) localStorage.setItem(storageKey, time);
  };

  const getSavedTime = () => {
    const t = localStorage.getItem(storageKey);
    return t ? parseFloat(t) : 0;
  };

  // YouTube Handlers
  const onReadyYt = (e) => {
    playerRef.current = e.target;
    setReady(true);
    const saved = getSavedTime();
    if (saved > 0) {
      e.target.seekTo(saved);
    }
  };

  const onStateChangeYt = (e) => {
    // 1 = playing, 2 = paused, 0 = ended
    if (e.data === 1) {
      intervalRef.current = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          saveTime(playerRef.current.getCurrentTime());
        }
      }, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (e.data === 0 && onEnded && !hasEndedRef.current) {
         hasEndedRef.current = true;
         onEnded();
      }
    }
  };

  // HTML5 Video Handlers
  const onTimeUpdateHtml = (e) => {
    // throttle save to avoid excessive writes
    if (Math.floor(e.target.currentTime) % 5 === 0) {
      saveTime(e.target.currentTime);
    }
  };
  
  const onLoadedMetadataHtml = (e) => {
    const saved = getSavedTime();
    if (saved > 0) e.target.currentTime = saved;
  };

  let embedUrl = lesson.embed_url || lesson.video_url;
  if (embedUrl && (embedUrl.includes('mediadelivery.net') || embedUrl.includes('bunnycdn.com')) && !embedUrl.includes('enablejsapi')) {
    embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'enablejsapi=true';
  }

  // Keep onEnded in a ref to avoid stale closures
  const onEndedRef = useRef(onEnded);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  // Bunny Raw PostMessage Listener
  useEffect(() => {
    if (!lesson.bunny_video_id && (!embedUrl || (!embedUrl.includes('mediadelivery.net') && !embedUrl.includes('bunnycdn.com')))) {
      return;
    }

    hasEndedRef.current = false;

    const handleMessage = (e) => {
      let strData = '';
      let objData = null;
      
      if (typeof e.data === 'string') {
        strData = e.data.toLowerCase();
        try { objData = JSON.parse(e.data); } catch(ex) {}
      } else if (e.data && typeof e.data === 'object') {
        objData = e.data;
        try { strData = JSON.stringify(e.data).toLowerCase(); } catch(ex) {}
      }

      if (!objData && !strData) return;

      // Handle Player.js ready event by subscribing
      if (objData && objData.event === 'ready' && iframeRef.current) {
        try {
          const subscribeMsg = (evt) => JSON.stringify({
            context: 'player.js',
            version: '0.0.11',
            method: 'addEventListener',
            value: evt
          });
          iframeRef.current.contentWindow.postMessage(subscribeMsg('ended'), '*');
          iframeRef.current.contentWindow.postMessage(subscribeMsg('timeupdate'), '*');
        } catch (err) {}
      }

      // Check for exact end event
      let isEnded = false;
      if (
        strData.includes('"event":"ended"') || 
        strData.includes('"event":"videoended"') || 
        strData.includes('"type":"ended"') || 
        strData === 'ended' ||
        strData === 'videoended' ||
        (objData && objData.event === 'ended') ||
        (objData && objData.value === 'ended')
      ) {
        isEnded = true;
      }

      // Handle timeupdate for saving progress
      if (objData && objData.event === 'timeupdate' && objData.value) {
        const secs = objData.value.seconds;
        const dur = objData.value.duration;
        
        if (secs) {
          // Save time every 5 seconds
          if (Math.floor(secs) % 5 === 0) {
             saveTime(secs);
          }
          // Trigger ended if very extremely close to the end (0.5s) in case 'ended' event drops
          if (dur && secs >= dur - 0.5) {
             isEnded = true;
          }
        }
      }

      if (isEnded && !hasEndedRef.current) {
        hasEndedRef.current = true;
        if (onEndedRef.current) onEndedRef.current();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [lesson._id]); // Only re-register when the lesson changes

  // 1. Bunny Stream Video (Highest Priority)
  if (lesson.bunny_video_id || (embedUrl && (embedUrl.includes('mediadelivery.net') || embedUrl.includes('bunnycdn.com')))) {
    return (
      <iframe 
        ref={iframeRef} 
        src={embedUrl} 
        allowFullScreen 
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        style={{ width: '100%', height: '100%', border: 0 }}
        onLoad={() => {
          if (iframeRef.current) {
            try {
              const subscribeMsg = (evt) => JSON.stringify({
                context: 'player.js',
                version: '0.0.11',
                method: 'addEventListener',
                value: evt
              });
              iframeRef.current.contentWindow.postMessage(subscribeMsg('ended'), '*');
              iframeRef.current.contentWindow.postMessage(subscribeMsg('timeupdate'), '*');
            } catch (err) {}
          }
        }}
      ></iframe>
    );
  }

  // 2. YouTube Video
  if (lesson.video_url && (lesson.video_url.includes('youtube.com') || lesson.video_url.includes('youtu.be'))) {
    let vid = lesson.video_url.split('v=')[1]?.split('&')[0];
    if (!vid) vid = lesson.video_url.split('/').pop();

    return (
      <YouTube 
        videoId={vid}
        onReady={onReadyYt}
        onStateChange={onStateChangeYt}
        opts={{
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0, rel: 0, modestbranding: 1 }
        }}
        style={{ width: '100%', height: '100%' }}
        iframeClassName="yt-iframe"
      />
    );
  }

  const handleHtmlEnded = () => {
    if (onEnded && !hasEndedRef.current) {
       hasEndedRef.current = true;
       onEnded();
    }
  };

  // 3. Local Uploaded Video File (Fallback)
  if (lesson.video_file) {
    return (
      <video 
        controls 
        controlsList="nodownload" 
        src={lesson.video_file.startsWith('http') ? lesson.video_file : getAssetUrl(lesson.video_file)}
        style={{ width: '100%', height: '100%', background: '#000' }}
        onTimeUpdate={onTimeUpdateHtml}
        onLoadedMetadata={onLoadedMetadataHtml}
        onEnded={handleHtmlEnded}
      />
    );
  }

  return (
    <iframe 
      ref={iframeRef} 
      src={embedUrl} 
      allowFullScreen 
      allow="autoplay; fullscreen"
      style={{ width: '100%', height: '100%', border: 0 }}
    ></iframe>
  );
}

function Learn() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  usePageReady(!loading);
  const [error, setError] = useState('');
  const [trackAccessInfo, setTrackAccessInfo] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [mobileTab, setMobileTab] = useState('playlist');
  
  const [currentLessonId, setCurrentLessonId] = useState(null);
  const [showRatingFor, setShowRatingFor] = useState(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showCourseReviewModal, setShowCourseReviewModal] = useState(false);
  const [myReview, setMyReview] = useState(null);

  const searchParams = new URLSearchParams(window.location.search);
  const paramLesson = searchParams.get('lesson');

  const getAllLessons = (secs) => (secs || []).flatMap(s => [
    ...(s.lessons || []),
    ...((s.subsections || []).flatMap(sub => sub.lessons || []))
  ]);

  const submitRating = async () => {
    if (!selectedRating) return;
    try {
      await api.post('/account/progress/rate', { lessonId: showRatingFor, rating: selectedRating });
      const ratedId = showRatingFor;
      setData(prev => {
        const updateSec = (s) => ({
          ...s,
          lessons: (s.lessons || []).map(l => 
            l._id === ratedId ? { ...l, rating: selectedRating } : l
          ),
          subsections: (s.subsections || []).map(sub => ({
            ...sub,
            lessons: (sub.lessons || []).map(l => 
              l._id === ratedId ? { ...l, rating: selectedRating } : l
            )
          }))
        });
        const newSections = prev.sections.map(updateSec);
        return { ...prev, sections: newSections };
      });
      setShowRatingFor(null);
      setSelectedRating(0);
      
      const flat = getAllLessons(data?.sections);
      const currIdx = flat.findIndex(l => l._id === ratedId);
      if (currIdx !== -1 && currIdx + 1 < flat.length) {
         handleLessonChange(flat[currIdx + 1]._id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/account/learn/${slug}`);
      setData(res);

      const flat = getAllLessons(res.sections);
      let targetLessonId = null;

      if (paramLesson) {
        const found = flat.find(l => l._id === paramLesson);
        if (found) {
          if (!found.is_locked) {
            targetLessonId = paramLesson;
          } else {
            alert('عفواً، هذا الدرس مغلق! يجب عليك إنهاء الدرس السابق أولاً لتتمكن من فتحه.');
          }
        }
      }

      if (!targetLessonId && res.last_lesson_id) {
        const found = flat.find(l => l._id.toString() === res.last_lesson_id.toString());
        if (found && !found.is_locked) {
          targetLessonId = res.last_lesson_id;
        }
      }

      if (!targetLessonId) {
        const firstUnlockedIncomplete = flat.find(l => !l.is_locked && !l.is_done);
        const firstUnlocked = flat.find(l => !l.is_locked);
        targetLessonId = firstUnlockedIncomplete ? firstUnlockedIncomplete._id : (firstUnlocked ? firstUnlocked._id : flat[0]?._id);
      }

      if (targetLessonId) {
        setCurrentLessonId(targetLessonId);
        if (paramLesson !== targetLessonId) {
          navigate(`?lesson=${targetLessonId}`, { replace: true });
        }
      }

      // Fetch user's existing review for this track or course
      if (res.is_track && res.track?._id) {
        try {
          const revRes = await api.get(`/reviews/track/${res.track._id}/my-review`);
          setMyReview(revRes.review || null);
        } catch {
          // ignore review fetch error
        }
      } else if (res.course?._id) {
        try {
          const revRes = await api.get(`/reviews/course/${res.course._id}/my-review`);
          setMyReview(revRes.review || null);
        } catch {
          // ignore review fetch error
        }
      }
    } catch (err) {
      setError(err.message);
      if (err.has_track_access) {
        setTrackAccessInfo({
          trackSlug: err.track_slug,
          trackTitle: err.track_title
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLessonChange = (lessonId) => {
    const flat = getAllLessons(data?.sections);
    const target = flat.find(l => l._id === lessonId);
    if (target && target.is_locked) {
      alert('عفواً، لا يمكنك مشاهدة هذا الدرس قبل إنهاء الدرس السابق أولاً.');
      return;
    }
    setCurrentLessonId(lessonId);
    navigate(`?lesson=${lessonId}`, { replace: true });
  };

  const markProgress = async (lessonId, action) => {
    try {
      const res = await api.post('/account/progress', { 
        lessonId, 
        action,
        trackId: data?.is_track ? (data?.track?._id || data?.course?._id) : null
      });
      const isComp = action === 'complete';
      setData(prev => {
        const updateSec = (s) => ({
          ...s,
          lessons: (s.lessons || []).map(l => 
            l._id === lessonId ? { ...l, is_done: isComp } : l
          ),
          subsections: (s.subsections || []).map(sub => ({
            ...sub,
            lessons: (sub.lessons || []).map(l => 
              l._id === lessonId ? { ...l, is_done: isComp } : l
            )
          }))
        });
        const newSections = prev.sections.map(updateSec);

        // Recompute is_locked sequentially in real-time
        let prevDone = true;
        newSections.forEach(s => {
          (s.lessons || []).forEach(l => {
            const is_locked = !prevDone;
            l.is_locked = is_locked;
            prevDone = l.is_done;
          });
          (s.subsections || []).forEach(sub => {
            (sub.lessons || []).forEach(l => {
              const is_locked = !prevDone;
              l.is_locked = is_locked;
              prevDone = l.is_done;
            });
          });
        });

        return { ...prev, sections: newSections, progress: res.progress };
      });

      // If whole course is completed (100%), prompt the student for course review
      if (isComp && res.progress && res.progress.percent === 100) {
        if (!myReview) {
          setTimeout(() => {
            setShowCourseReviewModal(true);
          }, 1000);
        }
      }

      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  };

  if (loading) return null;
  if (error) {
    const isExpiredMsg = error.includes('انتهت') || error.includes('صلاحية');
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '580px', margin: '0 auto', background: '#161619', padding: '40px 30px', borderRadius: '20px', border: '1px solid #28282e', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: trackAccessInfo ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.12)', color: trackAccessInfo ? '#3b82f6' : 'var(--red)', display: 'grid', placeItems: 'center', fontSize: '30px', margin: '0 auto 20px' }}>
            <i className={`fa-solid ${trackAccessInfo ? 'fa-route' : isExpiredMsg ? 'fa-clock-rotate-left' : 'fa-triangle-exclamation'}`}></i>
          </div>
          <h2 style={{ fontSize: '22px', color: '#fff', margin: '0 0 12px', fontWeight: '800' }}>
            {trackAccessInfo ? 'متاح لك عبر المسار التعليمي' : isExpiredMsg ? 'انتهت صلاحية اشتراكك في الكورس' : 'تعذر فتح الكورس'}
          </h2>
          <p style={{ color: '#9ea0a8', fontSize: '15px', lineHeight: '1.7', marginBottom: '25px' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {trackAccessInfo && (
              <Link to={`/account/learn/track/${trackAccessInfo.trackSlug}`} className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 'bold' }}>
                <i className="fa-solid fa-play"></i> فتح المسار الآن
              </Link>
            )}
            {isExpiredMsg && (
              <Link to={`/checkout?course=${slug}`} className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 'bold' }}>
                <i className="fa-solid fa-cart-shopping"></i> تجديد الاشتراك الآن
              </Link>
            )}
            <Link to="/account?tab=courses" className="btn btn-light" style={{ padding: '12px 24px', fontSize: '15px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: '8px' }}>
              العودة لكورساتي
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { course, sections, progress } = data;
  
  // Find current, next, prev lessons
  let currentLesson = null;
  let nextLesson = null;
  let prevLesson = null;
  const flatLessons = getAllLessons(sections);
  const currentIndex = flatLessons.findIndex(l => l._id === currentLessonId);
  
  if (currentIndex !== -1) {
    currentLesson = flatLessons[currentIndex];
    prevLesson = flatLessons[currentIndex - 1] || null;
    nextLesson = flatLessons[currentIndex + 1] || null;
  }

  const isDone = currentLesson?.is_done;

  // Calculate global progress
  const doneLessonsCount = flatLessons.filter(l => l.is_done).length;
  const progressPercent = flatLessons.length > 0 ? Math.round((doneLessonsCount / flatLessons.length) * 100) : 0;

  const renderLessonButton = (l, idx, isMobile = false) => {
    const isPlaying = currentLessonId === l._id;
    const hasResources = l.assets && l.assets.length > 0;
    const isLocked = !!l.is_locked;
    return (
      <button 
        key={l._id} 
        className={`p-lesson ${isPlaying ? 'current' : ''} ${l.is_done ? 'done' : ''} ${isLocked ? 'locked' : ''}`}
        onClick={() => {
          if (isLocked) {
            alert('عفواً، هذا الدرس مغلق! يجب عليك إنهاء الدرس السابق أولاً لتتمكن من فتحه.');
            return;
          }
          handleLessonChange(l._id);
        }}
        title={isLocked ? 'الدرس مغلق - أكمل الدرس السابق لفتحه' : l.title}
      >
        <div className="st square">
          {isLocked ? (
            <i className="fa-solid fa-lock" style={{ fontSize: '11px', color: '#71717a' }}></i>
          ) : isPlaying ? (
            <i className="fa-solid fa-play" style={{ fontSize: '10px' }}></i>
          ) : l.is_done ? (
            <i className="fa-solid fa-check"></i>
          ) : null}
        </div>
        <div className="l-body">
          <span className="t" style={{ opacity: isLocked ? 0.6 : 1 }}>
            {idx + 1}. {l.title}
          </span>
          <div className="l-meta">
            <span className="d">
              <i className="fa-regular fa-circle-play"></i> {l.duration || '00:00'}
            </span>
            {isLocked ? (
              <span className="locked-badge">
                <i className="fa-solid fa-lock"></i> مغلق
              </span>
            ) : hasResources && (
              <span className="r-badge" onClick={(e) => {
                e.stopPropagation();
                if (isMobile) {
                  if (currentLessonId !== l._id) {
                    handleLessonChange(l._id);
                  }
                  setMobileTab('details');
                } else {
                  if (currentLessonId !== l._id) {
                    handleLessonChange(l._id);
                    setTimeout(() => {
                      document.getElementById('lesson-assets-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 500);
                  } else {
                    document.getElementById('lesson-assets-section')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              }}>
                <i className="fa-regular fa-folder"></i> ملحقات
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  // Reusable playlist component
  const renderSectionItem = (s, sIdx, isMobile) => {
    const sLessons = s.lessons || [];
    const sSubsections = s.subsections || [];
    const allSecLessons = [...sLessons, ...sSubsections.flatMap(sub => sub.lessons || [])];
    const completedCount = allSecLessons.filter(l => l.is_done).length;
    const totalCount = allSecLessons.length;
    const hasCurrent = allSecLessons.some(l => l._id === currentLessonId);

    return (
      <details key={s._id} className="p-section" open={hasCurrent || sIdx === 0}>
        <summary className="p-section-head">
          <div className="s-info">
            <h4>{s.title}</h4>
            <small>{completedCount} / {totalCount} درس</small>
          </div>
          <i className="fa-solid fa-chevron-down chev"></i>
        </summary>
        <div className="p-section-body">
          {sLessons.map((l, idx) => renderLessonButton(l, idx, isMobile))}

          {sSubsections.map((sub) => (
            <div key={sub._id} className="p-subsection-block" style={{ margin: '8px 0 4px' }}>
              <div style={{
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRight: '3px solid #c81e1e',
                borderRadius: '6px',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#f1f5f9'
              }}>
                <i className="fa-solid fa-folder-tree" style={{ color: '#c81e1e', fontSize: '11px' }}></i>
                <span>{sub.title}</span>
                <span style={{ fontSize: '10.5px', color: '#94a3b8', marginRight: 'auto' }}>
                  {(sub.lessons || []).filter(l => l.is_done).length} / {(sub.lessons || []).length}
                </span>
              </div>
              {(sub.lessons || []).map((l, lIdx) => renderLessonButton(l, lIdx, isMobile))}
            </div>
          ))}
        </div>
      </details>
    );
  };

  const renderPlaylist = (isMobile = false) => (
    <>
      <div className="head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '17px' }}>
            {data?.is_track ? 'محتوى المسار التعليمي المتكامل' : 'محتوى الكورس'}
          </h3>
          {!isMobile && (
            <button className="btn-close-playlist" onClick={() => setShowSidebar(false)} style={{ background: 'transparent', border: 'none', color: '#c3c5cc', fontSize: '18px', cursor: 'pointer' }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
        <div className="progress-row" style={{ color: '#c3c5cc', fontSize: '13px' }}>
          <span>{progress.done} / {progress.total} درس</span>
          <span>{progress.percent}%</span>
        </div>
        <div className="progress" style={{ marginTop: '6px' }}><span style={{ width: `${progress.percent}%` }}></span></div>
      </div>

      {data?.is_track && data?.track_courses && data.track_courses.length > 0 ? (
        data.track_courses.map((tc, cIdx) => {
          const tcTotal = tc.progress?.total || 0;
          const tcDone = tc.progress?.done || 0;
          const tcPercent = tc.progress?.percent || 0;
          const isCurrentCourse = (tc.sections || []).some(s => {
            const sLessons = s.lessons || [];
            const sSubLessons = (s.subsections || []).flatMap(sub => sub.lessons || []);
            return [...sLessons, ...sSubLessons].some(l => l._id === currentLessonId);
          });

          return (
            <div key={tc._id} className="track-course-group" style={{ marginBottom: '14px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: isCurrentCourse ? '1px solid rgba(200, 30, 30, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', background: isCurrentCourse ? 'linear-gradient(90deg, rgba(200, 30, 30, 0.22) 0%, rgba(200, 30, 30, 0.08) 100%)' : 'rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 'bold' }}>الكورس {cIdx + 1} من {data.track_courses.length}</span>
                    {tcPercent === 100 && (
                      <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        <i className="fa-solid fa-check"></i> مكتمل
                      </span>
                    )}
                  </div>
                  <strong style={{ fontSize: '14px', color: '#fff', display: 'block' }}>{tc.title}</strong>
                </div>
                <span style={{ fontSize: '11.5px', color: '#cbd5e1', background: 'rgba(0,0,0,0.35)', padding: '3px 9px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {tcDone} / {tcTotal} درس ({tcPercent}%)
                </span>
              </div>
              <div className="track-course-sections" style={{ padding: '6px 8px 10px' }}>
                {(tc.sections || []).map((s, sIdx) => renderSectionItem(s, sIdx, isMobile))}
              </div>
            </div>
          );
        })
      ) : (
        sections.map((s, sIdx) => renderSectionItem(s, sIdx, isMobile))
      )}
      
      {course.has_certificate && (
        <details className="p-section" open={progressPercent === 100 && course.is_certificate_active}>
          <summary className="p-section-head" style={{ background: progressPercent === 100 && course.is_certificate_active ? 'rgba(212,175,55,0.1)' : '' }}>
            <div className="s-info">
              <h4 style={{ color: progressPercent === 100 && course.is_certificate_active ? '#d4af37' : '#fff' }}>
                <i className="fa-solid fa-award" style={{ marginLeft: '8px' }}></i>
                {data?.is_track ? 'شهادة إتمام المسار التعليمي (التراك)' : 'شهادة الإتمام'}
              </h4>
              <small>{!course.is_certificate_active ? 'غير مفعلة حالياً' : progressPercent === 100 ? 'متاحة الآن' : 'غير متاحة بعد'}</small>
            </div>
            <i className="fa-solid fa-chevron-down chev"></i>
          </summary>
          <div className="p-section-body">
            <button 
              className={`p-lesson ${progressPercent === 100 && course.is_certificate_active ? 'done' : ''}`}
              onClick={() => {
                if (progressPercent === 100 && course.is_certificate_active) {
                  setShowCertModal(true);
                }
              }}
              disabled={progressPercent < 100 || !course.is_certificate_active}
              style={{ cursor: (progressPercent < 100 || !course.is_certificate_active) ? 'not-allowed' : 'pointer', opacity: (progressPercent < 100 || !course.is_certificate_active) ? 0.6 : 1 }}
            >
              <div className="st square" style={{ borderColor: '#d4af37', background: progressPercent === 100 && course.is_certificate_active ? '#d4af37' : 'transparent' }}>
                {progressPercent === 100 && course.is_certificate_active ? <i className="fa-solid fa-check" style={{ color: '#0f172a' }}></i> : <i className="fa-solid fa-lock" style={{ fontSize: '10px', color: '#64748b' }}></i>}
              </div>
              <div className="l-body">
                <span className="t" style={{ color: progressPercent === 100 && course.is_certificate_active ? '#d4af37' : '#9ea0a8' }}>
                  {data?.has_earned_certificate 
                    ? (data?.is_track ? 'عرض شهادة المسار المعتمدة الصادرة' : 'عرض شهادتك المعتمدة الصادرة') 
                    : (progressPercent === 100 
                        ? (data?.is_track ? 'إصدار شهادة المسار المعتمدة' : 'إصدار الشهادة المعتمدة') 
                        : (data?.is_track ? 'الحصول على شهادة المسار' : 'الحصول على الشهادة'))}
                </span>
                <div className="l-meta">
                  {!course.is_certificate_active ? (
                    <span className="d" style={{ color: 'var(--red)' }}><i className="fa-solid fa-clock"></i> ستتوفر قريباً</span>
                  ) : progressPercent < 100 ? (
                    <span className="d"><i className="fa-solid fa-triangle-exclamation"></i> {data?.is_track ? 'أكمل جميع دروس المسار أولاً' : 'أكمل الدورة أولاً'}</span>
                  ) : data?.has_earned_certificate ? (
                    <span className="d" style={{ color: '#10b981' }}><i className="fa-solid fa-shield-check"></i> شهادتك الرسمية الصادرة (رقم: {data.existing_certificate?.certificate_id})</span>
                  ) : (
                    <span className="d" style={{ color: '#10b981' }}><i className="fa-solid fa-award"></i> عرض وتحميل الشهادة</span>
                  )}
                </div>
              </div>
            </button>
          </div>
        </details>
      )}

      {progressPercent === 100 && (
        <details className="p-section" open style={{ border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '10px', margin: '10px 0', overflow: 'hidden' }}>
          <summary className="p-section-head" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <div className="s-info">
              <h4 style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                <i className="fa-solid fa-star" style={{ marginLeft: '8px' }}></i>
                {data?.is_track ? 'تقييم ورأي المتدرب في التراك' : 'تقييم ورأي المتدرب'}
              </h4>
              <small>{myReview ? `تم التقييم (${myReview.rating} نجوم)` : 'شاركنا تجربتك ورأيك'}</small>
            </div>
            <i className="fa-solid fa-chevron-down chev"></i>
          </summary>
          <div className="p-section-body" style={{ padding: '12px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setShowCourseReviewModal(true)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                color: '#fff',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
              }}
            >
              <i className="fa-solid fa-pen-to-square"></i>
              {myReview
                ? (data?.is_track ? 'تعديل تقييمك ورأيك في التراك' : 'تعديل تقييمك ورأيك في الكورس')
                : (data?.is_track ? 'اكتب تقييمك ورأيك في التراك' : 'اكتب تقييمك ورأيك في الكورس')}
            </button>
          </div>
        </details>
      )}
    </>
  );

  return (
    <section className="player-page">
      <SEO
        title={`مشاهدة درس: ${currentLesson?.title || course.title}`}
        description="مشغل الدروس الخاص بطلاب المنصة."
        canonical={`/account/learn/${slug}`}
        robots="noindex, nofollow"
      />
      <div className="player-layout">
        <div className="player-main">
          {/* STICKY AREA ON MOBILE: Header + Video Player + Tab Switcher */}
          <div className="player-sticky-area">
            <div className="player-top">
              <Link to="/account?tab=courses"><i className="fa-solid fa-arrow-right"></i> {data?.is_track ? 'رجوع للمسارات والكورسات' : 'رجوع لكورساتي'}</Link>
              <strong>{data?.is_track ? `مسار: ${data?.track?.title || course.title}` : course.title}</strong>
              {currentLesson && (
                <span className="player-top-lesson-title">
                  {currentLesson.course_title ? `${currentLesson.course_title} • ` : ''}{currentLesson.title}
                </span>
              )}
            </div>
            
            {currentLesson ? (
              <div className={`player-video ${showRatingFor === currentLesson._id ? 'player-video-rating' : ''}`}>
                {currentLesson.is_locked ? (
                  <div className="no-video" style={{ background: 'radial-gradient(circle at center, #261111, #0b0b0c 70%)' }}>
                    <div style={{ padding: '30px', textAlign: 'center' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(200,30,30,0.18)', color: 'var(--red)', display: 'grid', placeItems: 'center', fontSize: '28px', margin: '0 auto 16px', border: '1px solid rgba(200,30,30,0.3)' }}>
                        <i className="fa-solid fa-lock"></i>
                      </div>
                      <h3 style={{ fontSize: '22px', color: '#fff', marginBottom: '8px', fontWeight: '800' }}>هذا الدرس مغلق</h3>
                      <p style={{ color: '#9ea0a8', fontSize: '15px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: '1.7' }}>
                        عفواً، لا يمكنك مشاهدة هذا الدرس قبل إتمام مشاهدة الدرس السابق أولاً.
                      </p>
                      {prevLesson && (
                        <button 
                          type="button" 
                          className="btn btn-primary"
                          onClick={() => handleLessonChange(prevLesson._id)}
                        >
                          <i className="fa-solid fa-arrow-right"></i> الذهاب إلى الدرس السابق
                        </button>
                      )}
                    </div>
                  </div>
                ) : showRatingFor === currentLesson._id ? (
                  <div className="rating-fullscreen" style={{ textAlign: 'center', padding: 'clamp(20px, 4vw, 40px)', color: '#fff', animation: 'fadeIn 0.5s ease', width: '100%' }}>
                    <h3 style={{ fontSize: 'clamp(20px, 4vw, 28px)', margin: '0 0 12px', color: '#fff' }}>كيف تقيم هذا الدرس؟</h3>
                    <p style={{ fontSize: 'clamp(13px, 2.5vw, 16px)', color: '#a1a5b5', marginBottom: 'clamp(16px, 3vw, 30px)' }}>تقييمك يساعدنا على تقديم محتوى أفضل</p>
                    <div className="stars" style={{ display: 'flex', gap: 'clamp(8px, 2vw, 15px)', justifyContent: 'center', fontSize: 'clamp(26px, 6vw, 44px)', direction: 'ltr', marginBottom: 'clamp(18px, 3vw, 30px)' }}>
                      {[1, 2, 3, 4, 5].map(star => {
                        const isActive = (hoverRating || selectedRating) >= star;
                        return (
                          <i 
                            key={star} 
                            className="fa-solid fa-star"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setSelectedRating(star)}
                            style={{ 
                              cursor: 'pointer', 
                              transition: 'all 0.2s',
                              color: isActive ? '#facc15' : '#3d4052',
                              transform: isActive ? 'scale(1.15)' : 'scale(1)'
                            }}
                          ></i>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      {selectedRating > 0 && (
                        <button className="btn btn-primary" style={{ padding: '8px 22px', fontSize: '15px', fontWeight: 'bold', minWidth: '110px' }} onClick={submitRating}>إرسال</button>
                      )}
                      <button className="btn btn-light" style={{ padding: '8px 22px', fontSize: '15px', fontWeight: 'bold', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', minWidth: '110px' }} onClick={() => {
                          setShowRatingFor(null);
                          setSelectedRating(0);
                          if (nextLesson && !nextLesson.is_locked) handleLessonChange(nextLesson._id);
                      }}>تخطي</button>
                    </div>
                  </div>
                ) : (currentLesson.video_url || currentLesson.video_file || currentLesson.bunny_video_id) ? (
                  <CustomVideoPlayer 
                    key={currentLesson._id} 
                    lesson={currentLesson} 
                    userId={user?.id}
                    onEnded={async () => {
                      if (!isDone) {
                         await markProgress(currentLesson._id, 'complete');
                      }
                      if (!currentLesson.rating) {
                         setShowRatingFor(currentLesson._id);
                      } else if (nextLesson) {
                         handleLessonChange(nextLesson._id);
                      }
                    }}
                  />
                ) : (
                  <div className="no-video">
                    <div>
                      <i className="fa-solid fa-film"></i>
                      <h3>فيديو الدرس هيتضاف قريباً</h3>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="player-video">
                <div className="no-video">
                  <div>
                    <i className="fa-solid fa-hourglass-half"></i>
                    <h3>المحاضرات هتتضاف قريباً</h3>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Tab Switcher (Under Video) */}
            <div className="mobile-player-tabs">
              <button 
                type="button"
                className={`m-tab-btn ${mobileTab === 'playlist' ? 'active' : ''}`}
                onClick={() => setMobileTab('playlist')}
              >
                <i className="fa-solid fa-list-ul"></i>
                <span>محتوى الكورس</span>
                <span style={{ fontSize: '11px', opacity: 0.85 }}>({progress.done}/{progress.total})</span>
              </button>
              <button 
                type="button"
                className={`m-tab-btn ${mobileTab === 'details' ? 'active' : ''}`}
                onClick={() => setMobileTab('details')}
              >
                <i className="fa-solid fa-circle-info"></i>
                <span>عن الدرس والملحقات</span>
                {currentLesson?.assets?.length > 0 && (
                  <span className="m-assets-badge">{currentLesson.assets.length}</span>
                )}
              </button>
            </div>
          </div>

          {/* MOBILE CONTENT VIEWPORT (Scrolls internally under the fixed video) */}
          {mobileTab === 'playlist' ? (
            <div className="mobile-playlist-container">
              {renderPlaylist(true)}
            </div>
          ) : (
            <div className="mobile-details-container">
              {currentLesson ? (
                <>
                  <h2 style={{ fontSize: '18px', margin: '0 0 14px', fontWeight: '800', color: '#fff' }}>
                    {currentLesson.title}
                  </h2>
                  <div className="lesson-desc">
                    {currentLesson.description ? (
                      <p style={{ whiteSpace: 'pre-wrap', fontSize: '15px', lineHeight: '1.8', margin: '0 0 16px' }}>{currentLesson.description}</p>
                    ) : (
                      <p style={{ color: '#9ea0a8', fontSize: '14px', margin: 0 }}>لا يوجد وصف مضاف لهذا الدرس.</p>
                    )}

                    {currentLesson.assets && currentLesson.assets.length > 0 && (
                      <div className="lesson-assets" style={{ marginTop: '20px' }}>
                        <h4 style={{ margin: '0 0 14px', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                          <i className="fa-solid fa-paperclip" style={{ color: 'var(--red)' }}></i> الملحقات والروابط
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                          {currentLesson.assets.map((asset, idx) => {
                            const isLink = asset.url.startsWith('http');
                            return (
                              <a key={idx} href={asset.url} target="_blank" rel="noreferrer" className="asset-card">
                                <div className="ac-ic">
                                  <i className={`fa-solid ${isLink ? 'fa-link' : 'fa-file-arrow-down'}`}></i>
                                </div>
                                <div className="ac-body">
                                  <strong>{asset.title}</strong>
                                  <small>{isLink ? 'رابط خارجي' : 'ملف للتحميل'}</small>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}

            </div>
          )}

          {/* DESKTOP CONTENT (Visible only on screens > 980px) */}
          {currentLesson && (
            <div className="desktop-lesson-content lesson-content-wrapper" style={{ marginTop: '30px' }}>
              <div className="lesson-title-row" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h1 style={{ fontSize: '30px', margin: '0 0', fontWeight: '900', color: '#fff' }}>{currentLesson.title}</h1>
                </div>
              </div>

              {(currentLesson.description || (currentLesson.assets && currentLesson.assets.length > 0)) && (
                <div className="lesson-desc" style={{ color: '#c3c5cc', background: '#141416', border: '1px solid #232327', padding: '28px', borderRadius: '20px' }}>
                  {currentLesson.description && <p style={{ whiteSpace: 'pre-wrap', fontSize: '16px', lineHeight: '1.8' }}>{currentLesson.description}</p>}
                  
                  {(currentLesson.assets && currentLesson.assets.length > 0) && (
                    <div id="lesson-assets-section" className="lesson-assets" style={{ marginTop: currentLesson.description ? '34px' : '0' }}>
                      <h4 style={{ margin: '0 0 20px', fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '800' }}>
                        <i className="fa-solid fa-paperclip" style={{ color: 'var(--red)' }}></i> الملحقات والروابط
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                        {currentLesson.assets?.map((asset, idx) => {
                          const isLink = asset.url.startsWith('http');
                          return (
                            <a key={idx} href={asset.url} target="_blank" rel="noreferrer" className="asset-card">
                              <div className="ac-ic">
                                <i className={`fa-solid ${isLink ? 'fa-link' : 'fa-file-arrow-down'}`}></i>
                              </div>
                              <div className="ac-body">
                                <strong>{asset.title}</strong>
                                <small>{isLink ? 'رابط خارجي' : 'ملف للتحميل'}</small>
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* DESKTOP SIDEBAR PLAYLIST */}
        <aside className="player-side desktop-player-side">
          {renderPlaylist(false)}
        </aside>
      </div>
      
      {showCertModal && (
        <StudentCertificateModal 
          courseId={course._id} 
          trackId={data?.is_track ? (data?.track?._id || course._id) : null}
          is_track={data?.is_track}
          onClose={() => {
            setShowCertModal(false);
            api.get(`/account/learn/${slug}`).then(res => {
              if (res) setData(res);
            }).catch(() => {});
          }} 
        />
      )}
      {showCourseReviewModal && (
        <CourseReviewModal
          course={data?.is_track ? null : course}
          track={data?.is_track ? (data?.track || course) : null}
          existingReview={myReview}
          onClose={() => setShowCourseReviewModal(false)}
          onSuccess={(saved) => setMyReview(saved)}
        />
      )}
    </section>
  );
}

export default Learn;
