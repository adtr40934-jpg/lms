import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { getApiBaseUrl } from '../utils/backendUrl';

function StudentCertificateModal({ courseId, trackId, is_track, onClose }) {
  const isTrack = Boolean(is_track || trackId);
  const targetId = trackId || courseId;

  const [certData, setCertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingJpg, setDownloadingJpg] = useState(false);
  const [scale, setScale] = useState(1);

  const containerRef = useRef(null);

  useEffect(() => {
    // 1. Ensure Cairo, Playfair, Outfit & FontAwesome fonts are loaded
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Outfit:wght@400;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&display=swap';
    document.head.appendChild(link);

    // 2. Fetch certificate data (backend automatically generates high-res JPG and uploads to ImgBB)
    const certEndpoint = isTrack ? `/tracks/${targetId}/certificate` : `/courses/${targetId}/certificate`;
    api.get(certEndpoint)
      .then(res => {
        setCertData(res.certificate);
        setLoading(false);
      })
      .catch(err => {
        // Fallback: If requested endpoint failed and it wasn't marked as track, try track endpoint
        if (!isTrack && targetId) {
          api.get(`/tracks/${targetId}/certificate`)
            .then(res => {
              setCertData(res.certificate);
              setLoading(false);
            })
            .catch(() => {
              setError(err.message || 'حدث خطأ أثناء تحميل بيانات الشهادة');
              setLoading(false);
            });
          return;
        }
        setError(err.message || 'حدث خطأ أثناء تحميل بيانات الشهادة');
        setLoading(false);
      });

    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, [courseId, trackId, is_track]);

  // Responsive scale observer so the 1000x708 certificate fits any screen perfectly
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const cW = containerRef.current.clientWidth || 300;
        const cH = containerRef.current.clientHeight || 250;
        const padX = cW <= 640 ? 12 : 24;
        const padY = cH <= 480 ? 12 : 24;
        const availW = Math.max(160, cW - padX);
        const availH = Math.max(120, cH - padY);
        const scaleW = availW / 1000;
        const scaleH = availH / 708;
        const newScale = Math.min(scaleW, scaleH);
        setScale(Math.min(1, Math.max(0.12, newScale)));
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(updateScale);
      ro.observe(containerRef.current);
    }
    const timer1 = setTimeout(updateScale, 50);
    const timer2 = setTimeout(updateScale, 200);
    const timer3 = setTimeout(updateScale, 600);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
      if (ro) ro.disconnect();
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [loading, certData]);

  const downloadJpg = async () => {
    if (!certData) return;
    try {
      setDownloadingJpg(true);
      const studentName = certData.user?.name || 'student';
      const courseTitle = certData.course?.title || 'course';
      const safeName = `شهادة_إتمام_${studentName}_${courseTitle}`.replace(/[\/\\?%*:|"<>]/g, '_');

      // 1. Direct live download from server with the exact current theme color
      try {
        const apiUrl = getApiBaseUrl();
        const isTrackTarget = Boolean(isTrack || certData?.track || certData?.certificate_type === 'track');
        const finalTargetId = (isTrackTarget && (certData?.track?._id || certData?.track)) ? (certData.track._id || certData.track) : targetId;
        const downloadEndpoint = isTrackTarget ? `/tracks/${finalTargetId}/certificate/download-jpg` : `/courses/${finalTargetId}/certificate/download-jpg`;
        const response = await fetch(`${apiUrl}${downloadEndpoint}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${safeName}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
          return;
        }
      } catch (srvErr) {
        console.warn('Server direct download fallback to certData.image_url:', srvErr);
      }

      // 2. Fallback to certData.image_url
      const imgUrl = certData.image_url;
      if (imgUrl) {
        if (imgUrl.startsWith('http')) {
          const response = await fetch(imgUrl);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${safeName}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } else {
          const link = document.createElement('a');
          link.href = imgUrl;
          link.download = `${safeName}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (e) {
      console.error('Download JPG error:', e);
      if (certData?.image_url) {
        window.open(certData.image_url, '_blank');
      }
    } finally {
      setDownloadingJpg(false);
    }
  };

  if (loading) {
    return (
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <div style={{ padding: '70px 20px', textAlign: 'center', color: '#fff' }}>
            <i className="fa-solid fa-circle-notch fa-spin fa-3x" style={{ color: '#d4af37' }}></i>
            <p style={{ marginTop: '18px', fontSize: '17px', fontWeight: 'bold' }}>جاري استخراج وتجهيز شهادتك المعتمدة...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#fff' }}>
            <i className="fa-solid fa-triangle-exclamation fa-3x" style={{ color: 'var(--red)' }}></i>
            <p style={{ marginTop: '16px', fontSize: '18px' }}>{error}</p>
            <button className="btn btn-primary mt-4" onClick={onClose} style={{ padding: '10px 30px' }}>إغلاق</button>
          </div>
        </div>
      </div>
    );
  }

  const { course, user, certificate_id, issue_date } = certData;
  const logoUrl = course.certificate_logo;
  const instName = course.instructor_name || 'م. محمد بهاء';
  const themeColor = certData.theme_color || course.theme_color || '#d4af37';
  const logoScale = (course.logo_scale || 100) / 100;
  const titleEn = course.title_en || certData.title_en || 'CERTIFICATE OF COMPLETION';
  const titleAr = course.title_ar || certData.title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة';
  const preNameText = course.pre_name_text || certData.pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:';
  const completionStatement = course.completion_statement || certData.completion_statement || 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:';

  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify-certificate/${certificate_id}`
    : `https://mohamedbahaa.com/verify-certificate/${certificate_id}`;

  const qrCodeUrl = certData.qr_code_data_url || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verificationUrl)}`;

  return (
    <div className="cert-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        .cert-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(5, 8, 15, 0.94);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
          box-sizing: border-box;
        }
        .cert-modal-content {
          background-color: #12141a;
          border-radius: 18px;
          width: 96%;
          max-width: 1120px;
          height: 92vh;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 60px rgba(0,0,0,0.85), 0 0 30px rgba(200,30,30,0.15);
          border: 1px solid #23232b;
          box-sizing: border-box;
        }
        .cert-modal-header {
          padding: 14px 20px;
          background: #12141a;
          border-bottom: 1px solid #23232b;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .cert-modal-title {
          margin: 0;
          color: #fff;
          font-size: 16px;
          font-weight: 800;
          line-height: 1.35;
          word-break: break-word;
        }
        .cert-modal-body {
          padding: 16px;
          overflow: hidden;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #0b0f19;
          position: relative;
          box-sizing: border-box;
        }
        .cert-modal-footer {
          padding: 14px 20px;
          background: #12141a;
          border-top: 1px solid #23232b;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .cert-modal-btn {
          min-height: 44px;
        }
        .cert-rotate-tip {
          display: none;
        }
        @media (max-width: 640px) {
          .cert-modal-overlay {
            padding: 6px;
          }
          .cert-modal-content {
            width: 100%;
            height: 95vh;
            max-height: 95vh;
            border-radius: 14px;
          }
          .cert-modal-header {
            padding: 10px 14px;
            gap: 8px;
          }
          .cert-modal-title {
            font-size: 13.5px;
          }
          .cert-modal-body {
            padding: 8px 6px;
          }
          .cert-modal-footer {
            padding: 10px 12px;
            gap: 8px;
            flex-direction: column;
            width: 100%;
          }
          .cert-modal-btn {
            width: 100% !important;
            max-width: 100% !important;
            padding: 11px 16px !important;
            font-size: 14px !important;
            justify-content: center !important;
          }
          .cert-rotate-tip {
            display: flex;
          }
        }
        @media (max-width: 420px) {
          .cert-modal-content {
            height: 97vh;
            max-height: 97vh;
            border-radius: 12px;
          }
          .cert-modal-header {
            padding: 8px 10px;
          }
          .cert-modal-title {
            font-size: 12.5px;
          }
          .cert-modal-footer {
            padding: 8px 10px;
          }
        }
      `}</style>
      <div className="cert-modal-content">

        {/* Modal Top Header */}
        <div className="cert-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <i className="fa-solid fa-award" style={{ color: themeColor, fontSize: '22px', flexShrink: 0 }}></i>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 className="cert-modal-title">
                شهادة معتمدة: {course.title}
              </h3>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                  <i className="fa-solid fa-circle-check"></i> موثقة ومعتمدة
                </span>
                <span>•</span>
                <span style={{ wordBreak: 'break-all' }}>رقم الاعتماد: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{certificate_id}</strong></span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#9ea0a8',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              flexShrink: 0
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Certificate Display Area: Directly renders the 100% "مظبوطة" live certificate inside the frame */}
        <div ref={containerRef} className="cert-modal-body">
          
          <div style={{
            width: `${Math.round(1000 * scale)}px`,
            height: `${Math.round(708 * scale)}px`,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 30px rgba(212,175,55,0.25)',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div
              className="cert-print-node"
              style={{
                width: '1000px',
                height: '708px',
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                background: '#ffffff',
                margin: '0',
                overflow: 'hidden',
                direction: 'rtl',
                boxSizing: 'border-box',
                fontFamily: '"Cairo", "Outfit", sans-serif',
                color: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '28px 38px',
                border: '10px solid #0f172a'
              }}
            >
              {/* Inner Gold Inset Frame */}
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                right: '10px',
                bottom: '10px',
                border: `1.5px solid ${themeColor}`,
                pointerEvents: 'none',
                boxSizing: 'border-box',
                zIndex: 2
              }}></div>

              {/* Second Subtle Hairline Inset Border */}
              <div style={{
                position: 'absolute',
                top: '13px',
                left: '13px',
                right: '13px',
                bottom: '13px',
                border: `1px solid ${themeColor}33`,
                pointerEvents: 'none',
                boxSizing: 'border-box',
                zIndex: 2
              }}></div>

              {/* Corner Luxury Ornaments */}
              <svg style={{ position: 'absolute', top: '13px', left: '13px', width: '40px', height: '40px', zIndex: 3, pointerEvents: 'none' }} viewBox="0 0 48 48">
                <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill={themeColor} />
                <rect x="8" y="8" width="6" height="6" fill={themeColor} transform="rotate(45 11 11)" />
              </svg>
              <svg style={{ position: 'absolute', top: '13px', right: '13px', width: '40px', height: '40px', zIndex: 3, pointerEvents: 'none', transform: 'scaleX(-1)' }} viewBox="0 0 48 48">
                <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill={themeColor} />
                <rect x="8" y="8" width="6" height="6" fill={themeColor} transform="rotate(45 11 11)" />
              </svg>
              <svg style={{ position: 'absolute', bottom: '13px', left: '13px', width: '40px', height: '40px', zIndex: 3, pointerEvents: 'none', transform: 'scaleY(-1)' }} viewBox="0 0 48 48">
                <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill={themeColor} />
                <rect x="8" y="8" width="6" height="6" fill={themeColor} transform="rotate(45 11 11)" />
              </svg>
              <svg style={{ position: 'absolute', bottom: '13px', right: '13px', width: '40px', height: '40px', zIndex: 3, pointerEvents: 'none', transform: 'scale(-1, -1)' }} viewBox="0 0 48 48">
                <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill={themeColor} />
                <rect x="8" y="8" width="6" height="6" fill={themeColor} transform="rotate(45 11 11)" />
              </svg>

              {/* Guilloche Security Micro-pattern */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.025, zIndex: 1, pointerEvents: 'none' }}>
                <pattern id="cert-g-modal" width="50" height="50" patternUnits="userSpaceOnUse">
                  <circle cx="25" cy="25" r="23" fill="none" stroke="#0f172a" strokeWidth="0.8" />
                  <circle cx="25" cy="25" r="16" fill="none" stroke={themeColor} strokeWidth="0.6" />
                  <circle cx="25" cy="25" r="10" fill="none" stroke="#0f172a" strokeWidth="0.6" />
                  <path d="M 0,25 Q 25,0 50,25 Q 25,50 0,25" fill="none" stroke={themeColor} strokeWidth="0.5" />
                  <path d="M 25,0 Q 50,25 25,50 Q 0,25 25,0" fill="none" stroke="#0f172a" strokeWidth="0.5" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#cert-g-modal)" />
              </svg>

              {/* Subtle Watermark Logo */}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.035,
                    maxHeight: '320px',
                    maxWidth: '360px',
                    objectFit: 'contain',
                    zIndex: 1,
                    filter: 'grayscale(100%)',
                    pointerEvents: 'none'
                  }}
                />
              )}

              {/* 1. TOP BAR: Academy Logo & Official Verification Metadata */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', zIndex: 10, position: 'relative' }}>
                {/* Right: Academy Brand Logo */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      crossOrigin="anonymous"
                      style={{
                        maxHeight: `${Math.round(48 * logoScale)}px`,
                        maxWidth: `${Math.round(170 * logoScale)}px`,
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      border: `1.5px solid ${themeColor}`,
                      color: themeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      boxShadow: `0 4px 12px ${themeColor}33`
                    }}>
                      <i className="fa-solid fa-graduation-cap"></i>
                    </div>
                  )}
                </div>

                {/* Left: Certificate Verification Info (Udemy Style) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', direction: 'ltr' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Certificate No:</span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#0f172a',
                      background: '#f1f5f9',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0',
                      letterSpacing: '1px'
                    }}>{certificate_id}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#64748b', fontWeight: '600' }}>
                    <span style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '9px', fontWeight: '700', letterSpacing: '1px' }}>Issue Date:</span>
                    <span style={{ color: '#0f172a', fontWeight: '700' }}>{new Date(issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              {/* 2. CENTER CORE: Pure Flexbox Centering (Zero Math Scrambling) */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                width: '100%',
                maxWidth: '820px',
                margin: '0 auto',
                zIndex: 10,
                position: 'relative'
              }}>
                {/* Grand Certificate Title EN */}
                <div style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  letterSpacing: '4px',
                  textTransform: 'uppercase',
                  color: '#0f172a',
                  fontFamily: '"Outfit", "Playfair Display", sans-serif',
                  direction: 'ltr',
                  marginBottom: '2px'
                }}>
                  {titleEn}
                </div>

                {/* Arabic Title */}
                <div style={{
                  fontSize: '22px',
                  fontWeight: '900',
                  color: themeColor,
                  fontFamily: '"Cairo", sans-serif',
                  marginBottom: '4px'
                }}>
                  {titleAr}
                </div>

                {/* Symmetrical Luxury Gold Divider */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', width: '300px' }}>
                  <div style={{ flex: 1, height: '1.5px', background: `linear-gradient(to right, transparent, ${themeColor})` }}></div>
                  <div style={{ fontSize: '9px', color: themeColor }}>★</div>
                  <div style={{ width: '7px', height: '7px', background: themeColor, transform: 'rotate(45deg)' }}></div>
                  <div style={{ fontSize: '9px', color: themeColor }}>★</div>
                  <div style={{ flex: 1, height: '1.5px', background: `linear-gradient(to left, transparent, ${themeColor})` }}></div>
                </div>

                {/* Pre-Name Text */}
                <div style={{
                  fontSize: '12.5px',
                  color: '#475569',
                  fontWeight: '700',
                  marginBottom: '4px',
                  fontFamily: '"Cairo", sans-serif'
                }}>
                  {preNameText}
                </div>

                {/* Student Name */}
                <div style={{
                  fontSize: '44px',
                  fontWeight: 900,
                  color: '#090e17',
                  fontFamily: '"Cairo", sans-serif',
                  lineHeight: 1.15,
                  marginBottom: '4px',
                  textAlign: 'center',
                  textShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  {user.name}
                </div>

                {/* Elegant Gold Calligraphy Divider Under Student Name */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px', width: '240px' }}>
                  <div style={{ flex: 1, height: '1.5px', background: `linear-gradient(to right, transparent, ${themeColor})` }}></div>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: themeColor }}></div>
                  <div style={{ flex: 1, height: '1.5px', background: `linear-gradient(to left, transparent, ${themeColor})` }}></div>
                </div>

                {/* Completion Statement */}
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginBottom: '6px', fontFamily: '"Cairo", sans-serif' }}>
                  {completionStatement}
                </div>

                {/* Course Title Badge Container */}
                <div style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: '#090e17',
                  fontFamily: '"Cairo", sans-serif',
                  lineHeight: 1.35,
                  textAlign: 'center',
                  padding: '6px 26px',
                  background: 'linear-gradient(135deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)',
                  border: `1.5px solid ${themeColor}66`,
                  borderRadius: '10px',
                  maxWidth: '85%',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                }}>
                  {course.title}
                </div>
              </div>

              {/* 3. BOTTOM ROW: Trust & Accreditation Triptych (Instructor Name, 3D Gold Medal, QR Code) */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                width: '100%',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '8px',
                zIndex: 10,
                position: 'relative'
              }}>
                {/* Right: Instructor Endorsement */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '220px' }}>
                  <div style={{ width: '150px', height: '1.5px', background: 'linear-gradient(to right, transparent, #94a3b8, transparent)', marginBottom: '5px' }}></div>
                  <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#090e17', fontFamily: '"Cairo", sans-serif' }}>
                    {instName}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', fontFamily: '"Cairo", sans-serif' }}>
                    المدرب والمحاضر المعتمد
                  </div>
                </div>

                {/* Center: The Official 3D Embossed Gold Seal of Excellence */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <div style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    background: `radial-gradient(ellipse at 35% 25%, #fff9e6 0%, ${themeColor} 45%, #946e09 85%, #5c4302 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 6px 20px ${themeColor}55, inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 6px rgba(0,0,0,0.4)`,
                    position: 'relative',
                    border: '1.5px solid #fff6d6'
                  }}>
                    <div style={{
                      width: '62px',
                      height: '62px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #090e17 0%, #172437 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px dashed #e6c86e',
                      color: '#fff',
                      textAlign: 'center',
                      padding: '3px',
                      boxSizing: 'border-box'
                    }}>
                      <i className="fa-solid fa-medal" style={{ fontSize: '15px', color: themeColor, marginBottom: '2px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}></i>
                      <div style={{ fontSize: '7px', fontWeight: '900', color: themeColor, fontFamily: '"Cairo", sans-serif', lineHeight: 1.1 }}>
                        معتمدة ورسمية
                      </div>
                      <div style={{ fontSize: '5.5px', fontWeight: '900', letterSpacing: '0.8px', color: '#ffffff', textTransform: 'uppercase', marginTop: '2px', direction: 'ltr' }}>
                        VERIFIED
                      </div>
                    </div>
                  </div>
                </div>

                {/* Left: Security QR Code */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', direction: 'ltr', width: '220px', justifyContent: 'flex-end' }}>
                  <div style={{
                    padding: '4px',
                    background: '#fff',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      crossOrigin="anonymous"
                      style={{ width: '48px', height: '48px', display: 'block' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: '#090e17', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SCAN TO VERIFY
                    </div>
                    <div style={{ fontSize: '8px', color: '#64748b', fontWeight: '600' }}>
                      التحقق من صحة الشهادة
                    </div>
                    <div style={{
                      background: '#090e17',
                      color: themeColor,
                      fontSize: '7px',
                      fontWeight: 'bold',
                      padding: '1.5px 5px',
                      borderRadius: '3px',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}>
                      <i className="fa-solid fa-shield-halved"></i> OFFICIAL
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Orientation helper tip for mobile */}
          <div className="cert-rotate-tip" style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '10px', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <i className="fa-solid fa-mobile-screen-button" style={{ transform: 'rotate(90deg)', color: '#d4af37' }}></i>
            <span>نصيحة: يمكنك تدوير شاشة التليفون بالعرض لرؤية الشهادة بأفضل حجم</span>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="cert-modal-footer">
          <button
            className="btn btn-primary cert-modal-btn"
            onClick={downloadJpg}
            disabled={downloadingJpg}
            style={{
              padding: '12px 28px',
              fontSize: '14.5px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #c81e1e 0%, #991515 100%)',
              boxShadow: '0 6px 20px rgba(200,30,30,0.45)',
              cursor: downloadingJpg ? 'wait' : 'pointer',
              border: 'none',
              color: '#fff'
            }}
          >
            {downloadingJpg ? (
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '17px' }}></i>
            ) : (
              <i className="fa-solid fa-download" style={{ fontSize: '17px' }}></i>
            )}
            <span>{downloadingJpg ? 'جاري تجهيز الصورة وتحميلها...' : 'تحميل الشهادة كصورة (JPG)'}</span>
          </button>

          <a
            href={verificationUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-light cert-modal-btn"
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '12px',
              border: '1px solid #334155',
              background: '#1a1f2c',
              color: '#e2e8f0',
              textDecoration: 'none'
            }}
          >
            <i className="fa-solid fa-qrcode" style={{ color: '#60a5fa', fontSize: '16px' }}></i>
            <span>فحص الاعتماد الرقمي</span>
          </a>
        </div>

      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(5, 8, 15, 0.94)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '12px'
};

const modalContentStyle = {
  backgroundColor: '#12141a',
  borderRadius: '18px',
  width: '96%',
  maxWidth: '600px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 30px rgba(200,30,30,0.15)',
  border: '1px solid #23232b'
};

export default StudentCertificateModal;
