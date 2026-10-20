import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import AdminLayout from './AdminLayout';
import { getAssetUrl } from '../../utils/assetUrl';

function Certificates() {
  const [courses, setCourses] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [itemFilter, setItemFilter] = useState('all'); // 'all' | 'courses' | 'tracks'
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});
  
  // Active course for custom course modal preview
  const [activeCourse, setActiveCourse] = useState(null);
  const [previewName, setPreviewName] = useState('أحمد محمد عبدالله');
  const certificateRef = useRef();

  const [isPrinting, setIsPrinting] = useState(false);

  // Global / General Certificate Settings State
  const [globalThemeColor, setGlobalThemeColor] = useState('#d4af37');
  const [globalLogoScale, setGlobalLogoScale] = useState(100);
  const [globalInstName, setGlobalInstName] = useState('');
  const [globalLogoFile, setGlobalLogoFile] = useState(null);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [globalPreNameText, setGlobalPreNameText] = useState('شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:');
  const [globalTitleEn, setGlobalTitleEn] = useState('CERTIFICATE OF COMPLETION');
  const [globalTitleAr, setGlobalTitleAr] = useState('شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة');
  const [globalCompletionStatement, setGlobalCompletionStatement] = useState('تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:');

  // Tab state
  const [activeTab, setActiveTab] = useState('issued'); // 'issued' | 'general' | 'courses'

  // Issued certificates state
  const [issuedCertificates, setIssuedCertificates] = useState([]);
  const [issuedLoading, setIssuedLoading] = useState(false);
  const [issuedSearch, setIssuedSearch] = useState('');
  const [issuedStatusFilter, setIssuedStatusFilter] = useState('');
  const [issuedPage, setIssuedPage] = useState(1);
  const [issuedTotalPages, setIssuedTotalPages] = useState(1);
  const [issuedTotalCount, setIssuedTotalCount] = useState(0);
  const [revokingCert, setRevokingCert] = useState(null);
  const [revocationReasonInput, setRevocationReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);


  useEffect(() => {
    fetchData();
    
    // Add fonts to document for live preview & print
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Alex+Brush&family=Cairo:wght@400;600;700;800;900&family=Outfit:wght@400;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&display=swap';
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (isPrinting) {
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 500);
    }
  }, [isPrinting]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesRes, tracksRes, settingsRes] = await Promise.all([
        api.get('/courses/admin/all'),
        api.get('/tracks/admin/all').catch(() => ({ tracks: [] })),
        api.get('/settings')
      ]);
      const certCourses = (coursesRes.courses || []).filter(c => c.has_certificate).map(c => ({ ...c, item_type: 'course' }));
      const certTracks = (tracksRes.tracks || []).filter(t => t.has_certificate !== false).map(t => ({ ...t, item_type: 'track' }));
      setCourses(certCourses);
      setTracks(certTracks);

      const st = settingsRes.settings || {};
      setSettings(st);
      setGlobalThemeColor(st.certificate_theme_color || '#d4af37');
      setGlobalLogoScale(parseInt(st.certificate_logo_scale, 10) || 100);
      setGlobalInstName(st.certificate_instructor_name || st.trainer_name || 'م. محمد بهاء');
      setGlobalPreNameText(st.certificate_pre_name_text || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:');
      setGlobalTitleEn(st.certificate_title_en || 'CERTIFICATE OF COMPLETION');
      setGlobalTitleAr(st.certificate_title_ar || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة');
      setGlobalCompletionStatement(st.certificate_completion_statement || 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  
  const fetchIssuedCertificates = async (page = 1, search = issuedSearch, status = issuedStatusFilter) => {
    try {
      setIssuedLoading(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        search: search || '',
        status: status || ''
      }).toString();

      const res = await api.get(`/certificates/admin/all?${query}`);
      setIssuedCertificates(res.certificates || []);
      setIssuedPage(res.page || 1);
      setIssuedTotalPages(res.pages || 1);
      setIssuedTotalCount(res.total || 0);
    } catch (err) {
      console.error('Fetch issued certificates error:', err);
    } finally {
      setIssuedLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'issued') {
      fetchIssuedCertificates(1, issuedSearch, issuedStatusFilter);
    }
  }, [activeTab, issuedStatusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchIssuedCertificates(1, issuedSearch, issuedStatusFilter);
  };

  const handleRevokeSubmit = async () => {
    if (!revokingCert) return;
    if (!revocationReasonInput.trim()) {
      alert('يرجى كتابة سبب إلغاء الشهادة');
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.put(`/certificates/admin/${revokingCert._id}/status`, {
        status: 'revoked',
        revocation_reason: revocationReasonInput.trim()
      });
      alert(res.message || 'تم إلغاء الشهادة بنجاح');
      setRevokingCert(null);
      setRevocationReasonInput('');
      fetchIssuedCertificates(issuedPage);
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء إلغاء الشهادة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateCert = async (cert) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في إعادة تفعيل الشهادة رقم (${cert.certificate_id})؟`)) return;
    try {
      setActionLoading(true);
      const res = await api.put(`/certificates/admin/${cert._id}/status`, {
        status: 'active'
      });
      alert(res.message || 'تم إعادة تفعيل الشهادة بنجاح');
      fetchIssuedCertificates(issuedPage);
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء إعادة التفعيل');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCert = async (cert) => {
    if (!cert || !cert._id) return;
    const studentName = cert.user?.name || 'الطالب';
    const certId = cert.certificate_id || '';
    if (!window.confirm(`هل أنت متأكد تماماً من حذف شهادة الطالب (${studentName}) رقم (${certId}) نهائياً من قاعدة البيانات وخوادم الصور (ImgBB)؟\n\nعند الحذف سيتحول زر الشهادة لدى الطالب تلقائياً إلى "الحصول على الشهادة" ليتمكن من استخراجها مجدداً.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await api.delete(`/certificates/admin/${cert._id}`);
      alert(res.message || 'تم حذف الشهادة نهائياً بنجاح');
      fetchIssuedCertificates(issuedPage);
    } catch (err) {
      console.error('Delete certificate error:', err);
      alert(err.message || 'حدث خطأ أثناء حذف الشهادة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveGlobalSettings = async (e) => {
    if (e) e.preventDefault();
    try {
      setSavingGlobal(true);
      const fd = new FormData();
      fd.append('certificate_theme_color', globalThemeColor);
      fd.append('certificate_logo_scale', globalLogoScale);
      fd.append('certificate_instructor_name', globalInstName);
      fd.append('certificate_pre_name_text', globalPreNameText);
      fd.append('certificate_title_en', globalTitleEn);
      fd.append('certificate_title_ar', globalTitleAr);
      fd.append('certificate_completion_statement', globalCompletionStatement);

      if (globalLogoFile) fd.append('certificate_default_logo', globalLogoFile);

      const res = await api.put('/settings/admin', fd, true);
      alert(res.message || 'تم حفظ إعدادات الشهادات العامة بنجاح وتطبيقها على كافة الشهادات');
      fetchData();
      setGlobalLogoFile(null);
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء حفظ الإعدادات العامة');
    } finally {
      setSavingGlobal(false);
    }
  };

  const openPreview = (course) => {
    setActiveCourse(course);
    setInstName(course.instructor_name || '');
    setLogoFile(null);
  };

  const saveCertificateSettings = async () => {
    if (!activeCourse) return;
    try {
      setSavingSettings(true);
      const fd = new FormData();
      fd.append('instructor_name', instName);
      if (logoFile) fd.append('certificate_logo', logoFile);
      
      const res = await api.put(`/courses/admin/${activeCourse._id}`, fd, true);
      alert('تم حفظ إعدادات الشهادة الخاصة بهذا الكورس بنجاح');
      
      const updatedCourse = res.course;
      setActiveCourse(updatedCourse);
      setCourses(courses.map(c => c._id === updatedCourse._id ? updatedCourse : c));
      setLogoFile(null);
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
  };

  const renderCertificate = (item) => {
    const isTrack = item?.item_type === 'track';
    const issueDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const certId = 'UC-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    let logoUrl = '';
    if (globalLogoFile) {
      logoUrl = URL.createObjectURL(globalLogoFile);
    } else if (item?.certificate_logo) {
      logoUrl = item.certificate_logo;
    } else if (settings?.certificate_default_logo) {
      logoUrl = settings.certificate_default_logo;
    } else if (settings?.site_logo) {
      logoUrl = settings.site_logo;
    }

    const effectiveInstructor = globalInstName || item?.instructor_name || 'م. محمد بهاء';
    const siteName = settings?.site_name || 'منصة محمد بهاء التعليمية';
    const activeColor = globalThemeColor || '#d4af37';
    const logoScaleFactor = (globalLogoScale || 100) / 100;
    const courseTitle = item?.title || (isTrack ? 'المسار التعليمي المتكامل' : 'الدورة التدريبية المتخصصة');
    const preNameLabel = globalPreNameText || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:';
    const completionStatementText = isTrack 
      ? 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات المسار التعليمي المتكامل:'
      : (globalCompletionStatement || 'تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:');

    const verificationUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/verify-certificate/${certId}`
      : `https://mohamedbahaa.com/verify-certificate/${certId}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verificationUrl)}`;

    const resolveUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('http') || url.startsWith('blob')) return url;
      return getAssetUrl(url);
    };

    return (
      <div
        ref={certificateRef}
        className="certificate-container"
        style={{
          width: '1000px',
          height: '708px',
          position: 'relative',
          background: '#ffffff',
          margin: '0 auto',
          overflow: 'hidden',
          direction: 'rtl',
          boxSizing: 'border-box',
          fontFamily: '"Cairo", "Outfit", sans-serif',
          color: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '30px 40px',
          border: '10px solid #0f172a',
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
        }}
      >
        {/* Inner Gold Inset Frame */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          right: '10px',
          bottom: '10px',
          border: `1.5px solid ${activeColor}`,
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
          border: `1px solid ${activeColor}33`,
          pointerEvents: 'none',
          boxSizing: 'border-box',
          zIndex: 2
        }}></div>

        {/* Corner Luxury Ornaments */}
        <svg style={{ position: 'absolute', top: '13px', left: '13px', width: '40px', height: '40px', zIndex: 3, pointerEvents: 'none' }} viewBox="0 0 48 48">
          <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill={activeColor} />
          <rect x="8" y="8" width="6" height="6" fill={activeColor} transform="rotate(45 11 11)" />
        </svg>
        <svg style={{ position: 'absolute', top: '13px', right: '13px', width: '40px', height: '40px', zIndex: 3, pointerEvents: 'none', transform: 'scaleX(-1)' }} viewBox="0 0 48 48">
          <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill={activeColor} />
          <rect x="8" y="8" width="6" height="6" fill={activeColor} transform="rotate(45 11 11)" />
        </svg>
        <svg style={{ position: 'absolute', bottom: '13px', left: '13px', width: '40px', height: '40px', zIndex: 3, pointerEvents: 'none', transform: 'scaleY(-1)' }} viewBox="0 0 48 48">
          <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill={activeColor} />
          <rect x="8" y="8" width="6" height="6" fill={activeColor} transform="rotate(45 11 11)" />
        </svg>
        <svg style={{ position: 'absolute', bottom: '13px', right: '13px', width: '40px', height: '40px', zIndex: 3, pointerEvents: 'none', transform: 'scale(-1, -1)' }} viewBox="0 0 48 48">
          <path d="M 0,0 L 40,0 L 40,4 L 4,4 L 4,40 L 0,40 Z" fill={activeColor} />
          <rect x="8" y="8" width="6" height="6" fill={activeColor} transform="rotate(45 11 11)" />
        </svg>

        {/* Guilloche Security Micro-pattern */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.025, zIndex: 1, pointerEvents: 'none' }}>
          <pattern id="cert-guilloche-admin" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="23" fill="none" stroke="#0f172a" strokeWidth="0.8" />
            <circle cx="25" cy="25" r="16" fill="none" stroke={activeColor} strokeWidth="0.6" />
            <circle cx="25" cy="25" r="10" fill="none" stroke="#0f172a" strokeWidth="0.6" />
            <path d="M 0,25 Q 25,0 50,25 Q 25,50 0,25" fill="none" stroke={activeColor} strokeWidth="0.5" />
            <path d="M 25,0 Q 50,25 25,50 Q 0,25 25,0" fill="none" stroke="#0f172a" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#cert-guilloche-admin)" />
        </svg>

        {/* Subtle Watermark Logo */}
        {logoUrl && (
          <img
            src={resolveUrl(logoUrl)}
            alt=""
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
        <div style={{ position: 'absolute', top: '28px', left: '38px', right: '38px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
          {/* Right: Academy Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {logoUrl ? (
              <img
                src={resolveUrl(logoUrl)}
                alt="Logo"
                style={{
                  maxHeight: `${Math.round(48 * logoScaleFactor)}px`,
                  maxWidth: `${Math.round(180 * logoScaleFactor)}px`,
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                border: `2px solid ${activeColor}`,
                color: activeColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                boxShadow: `0 4px 12px ${activeColor}33`
              }}>
                <i className="fa-solid fa-graduation-cap"></i>
              </div>
            )}
          </div>

          {/* Left: Certificate Verification Info (Udemy Style) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', direction: 'ltr' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
              <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Certificate No:</span>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: '800',
                color: '#0f172a',
                background: '#f1f5f9',
                padding: '2px 7px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                letterSpacing: '1px'
              }}>{certId}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', color: '#64748b', fontWeight: '600' }}>
              <span style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '8.5px', fontWeight: '700', letterSpacing: '1px' }}>Issue Date:</span>
              <span style={{ color: '#0f172a', fontWeight: '700' }}>{issueDate}</span>
            </div>
          </div>
        </div>

        {/* 2. CENTER CORE: Exactly Centered (في نص الشهادة بالظبط) */}
        <div style={{
          position: 'absolute',
          top: '48.5%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '820px',
          zIndex: 10
        }}>
          {/* Grand Certificate Title (Bilingual Udemy Aesthetics) */}
          <div style={{
            fontSize: '21px',
            fontWeight: '900',
            letterSpacing: '5px',
            textTransform: 'uppercase',
            color: '#0f172a',
            fontFamily: '"Outfit", "Playfair Display", sans-serif',
            direction: 'ltr',
            marginBottom: '2px'
          }}>
            {globalTitleEn || 'CERTIFICATE OF COMPLETION'}
          </div>

          <div style={{
            fontSize: '23px',
            fontWeight: '900',
            color: activeColor,
            fontFamily: '"Cairo", sans-serif',
            marginBottom: '6px',
            letterSpacing: '0.5px'
          }}>
            {globalTitleAr || 'شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة'}
          </div>

          {/* Symmetrical Luxury Gold Divider */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px', width: '320px' }}>
            <div style={{ flex: 1, height: '1.5px', background: `linear-gradient(to right, transparent, ${activeColor})` }}></div>
            <div style={{ fontSize: '9px', color: activeColor }}>★</div>
            <div style={{ width: '7px', height: '7px', background: activeColor, transform: 'rotate(45deg)' }}></div>
            <div style={{ fontSize: '9px', color: activeColor }}>★</div>
            <div style={{ flex: 1, height: '1.5px', background: `linear-gradient(to left, transparent, ${activeColor})` }}></div>
          </div>

          {/* Pre-Name Text */}
          <div style={{
            fontSize: '13px',
            color: '#475569',
            fontWeight: '700',
            marginBottom: '6px',
            letterSpacing: '0.3px',
            fontFamily: '"Cairo", sans-serif'
          }}>
            {globalPreNameText || 'شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:'}
          </div>

          {/* Student Name (Centerpiece Display) */}
          <div style={{
            fontSize: '46px',
            fontWeight: 900,
            color: '#090e17',
            fontFamily: '"Cairo", sans-serif',
            lineHeight: 1.15,
            marginBottom: '6px',
            textAlign: 'center',
            textShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            {previewName || 'أحمد محمد عبدالله'}
          </div>

          {/* Elegant Gold Calligraphy Divider Under Student Name */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px', width: '240px' }}>
            <div style={{ flex: 1, height: '1.5px', background: `linear-gradient(to right, transparent, ${activeColor})` }}></div>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: activeColor }}></div>
            <div style={{ flex: 1, height: '1.5px', background: `linear-gradient(to left, transparent, ${activeColor})` }}></div>
          </div>

          {/* Completion Statement */}
          <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '700', marginBottom: '8px', fontFamily: '"Cairo", sans-serif' }}>
            {completionStatementText}
          </div>

          {/* Course Title Badge Container */}
          <div style={{
            fontSize: '23px',
            fontWeight: 900,
            color: '#090e17',
            fontFamily: '"Cairo", sans-serif',
            lineHeight: 1.35,
            textAlign: 'center',
            padding: '8px 28px',
            background: 'linear-gradient(135deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)',
            border: `1.5px solid ${activeColor}66`,
            borderRadius: '10px',
            marginBottom: '4px',
            maxWidth: '85%',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
          }}>
            {courseTitle}
          </div>
        </div>

        {/* 3. BOTTOM ROW: Trust & Accreditation Triptych (Instructor Name, 3D Gold Medal, QR Code) */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '38px',
          right: '38px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '10px',
          zIndex: 10
        }}>
          {/* Right: Instructor Endorsement */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '220px' }}>
            <div style={{ width: '150px', height: '1.5px', background: 'linear-gradient(to right, transparent, #94a3b8, transparent)', marginBottom: '6px' }}></div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#090e17', fontFamily: '"Cairo", sans-serif' }}>
              {effectiveInstructor}
            </div>
            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', fontFamily: '"Cairo", sans-serif' }}>
              المدرب والمحاضر المعتمد
            </div>
          </div>

          {/* Center: The Official 3D Embossed Gold Seal of Excellence */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* 3D Embossed Golden Medal */}
            <div style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: `radial-gradient(ellipse at 35% 25%, #fff9e6 0%, ${activeColor} 45%, #946e09 85%, #5c4302 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 6px 20px ${activeColor}55, inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 6px rgba(0,0,0,0.4)`,
              position: 'relative',
              border: '1.5px solid #fff6d6'
            }}>
              {/* Inner Ring with Dashed Border */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #090e17 0%, #172437 100%)',
                border: `1.5px dashed ${activeColor}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeColor,
                boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.7)'
              }}>
                <i className="fa-solid fa-award" style={{ fontSize: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))', color: activeColor }}></i>
                <div style={{ fontSize: '5.5px', fontWeight: '900', letterSpacing: '1px', color: '#ffffff', textTransform: 'uppercase', marginTop: '2px', direction: 'ltr' }}>
                  VERIFIED
                </div>
                <div style={{ display: 'flex', gap: '2px', color: activeColor, fontSize: '5px', marginTop: '1px' }}>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                </div>
              </div>
            </div>

            {/* Hanging Ribbon Tails */}
            <div style={{ display: 'flex', gap: '5px', marginTop: '-5px', zIndex: -1 }}>
              <div style={{
                width: '12px',
                height: '24px',
                background: `linear-gradient(180deg, ${activeColor} 0%, #8c6809 100%)`,
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)',
                boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
              }}></div>
              <div style={{
                width: '12px',
                height: '24px',
                background: `linear-gradient(180deg, ${activeColor} 0%, #8c6809 100%)`,
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)',
                boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
              }}></div>
            </div>
          </div>

          {/* Left: Instant Verification QR Code & Security Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '220px', justifyContent: 'flex-end', direction: 'ltr' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#ffffff',
              border: `1.5px solid ${activeColor}`,
              borderRadius: '7px',
              padding: '2px',
              boxShadow: `0 4px 12px ${activeColor}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={qrCodeUrl}
                alt="Verification QR"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
              <div style={{ fontSize: '9px', fontWeight: '800', color: '#090e17', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Scan To Verify
              </div>
              <div style={{ fontSize: '8px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
                امسح للتحقق الرقمي
              </div>
              <div style={{
                fontSize: '7.5px',
                fontWeight: '800',
                color: '#059669',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '2px 5px',
                borderRadius: '4px',
                marginTop: '3px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}>
                <i className="fa-solid fa-shield-halved"></i> OFFICIAL CREDENTIAL
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };



  if (isPrinting) {
    return (
      <div style={{ width: '100%', height: '100vh', background: '#fff' }}>
        <style>
          {`
            @page { size: A4 landscape; margin: 0; }
            body, html { 
               margin: 0 !important; 
               padding: 0 !important; 
               -webkit-print-color-adjust: exact; 
               print-color-adjust: exact; 
               background: #fff; 
               overflow: hidden !important; 
            }
            .print-wrapper {
               width: 100vw;
               height: 100vh;
               display: flex;
               align-items: center;
               justify-content: center;
            }
            .certificate-container {
               transform: scale(0.95) !important;
               transform-origin: center center !important;
            }
          `}
        </style>
        <div className="print-wrapper">
          {renderCertificate(activeCourse)}
        </div>
      </div>
    );
  }

  if (loading) return <AdminLayout title="إدارة الشهادات"><div style={{ padding: '100px', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  return (
    <AdminLayout title="إدارة الشهادات">
      {/* Header Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '22px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('issued')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14.5px',
            fontWeight: '800',
            background: activeTab === 'issued' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'issued' ? '#fff' : '#475569',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="fa-solid fa-certificate" style={{ color: activeTab === 'issued' ? '#d4af37' : '#94a3b8' }}></i>
          الشهادات الصادرة للطلاب
          {issuedTotalCount > 0 && (
            <span style={{
              background: activeTab === 'issued' ? '#c81e1e' : '#cbd5e1',
              color: '#fff',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              {issuedTotalCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14.5px',
            fontWeight: '800',
            background: activeTab === 'general' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'general' ? '#fff' : '#475569',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="fa-solid fa-sliders" style={{ color: activeTab === 'general' ? '#d4af37' : '#94a3b8' }}></i>
          الإعدادات العامة والتصميم
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('courses')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14.5px',
            fontWeight: '800',
            background: activeTab === 'courses' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'courses' ? '#fff' : '#475569',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="fa-solid fa-graduation-cap" style={{ color: activeTab === 'courses' ? '#d4af37' : '#94a3b8' }}></i>
          الكورسات والمسارات المفعلة ({courses.length + tracks.length})
        </button>
      </div>

      {/* TAB 1: ISSUED CERTIFICATES */}
      {activeTab === 'issued' && (
        <div className="panel" style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
          <div className="panel-head" style={{ padding: '18px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-award" style={{ color: '#d4af37' }}></i>
                سجل شهادات الطلاب المعتمدة الصادرة
              </h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                إجمالي الشهادات الممنوحة حتى الآن: <strong>{issuedTotalCount}</strong> شهادة
              </p>
            </div>

            {/* Search and Filters */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="ابحث بالطالب، الكورس، أو رقم الشهادة..."
                  value={issuedSearch}
                  onChange={(e) => setIssuedSearch(e.target.value)}
                  style={{ padding: '8px 34px 8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '270px' }}
                />
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '12px' }}></i>
              </div>

              <select
                value={issuedStatusFilter}
                onChange={(e) => setIssuedStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">جميع الحالات</option>
                <option value="active">نشطة ومعتمدة فقط</option>
                <option value="revoked">ملغية / مسحوبة فقط</option>
              </select>

              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>
                بحث
              </button>
            </form>
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            {issuedLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <i className="fa-solid fa-circle-notch fa-spin fa-2x" style={{ color: '#c81e1e', marginBottom: '10px' }}></i>
                <div>جاري تحميل سجل الشهادات...</div>
              </div>
            ) : issuedCertificates.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                <i className="fa-solid fa-certificate fa-3x" style={{ color: '#cbd5e1', marginBottom: '14px' }}></i>
                <h4 style={{ margin: '0 0 6px', color: '#1e293b' }}>لا توجد شهادات مطابقة</h4>
                <p style={{ margin: 0, fontSize: '13px' }}>لم يتم العثور على أي شهادة صادرة بهذه المعايير</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '13px' }}>
                      <th style={{ padding: '12px 16px' }}>رقم الشهادة</th>
                      <th style={{ padding: '12px 16px' }}>الطالب</th>
                      <th style={{ padding: '12px 16px' }}>الكورس</th>
                      <th style={{ padding: '12px 16px' }}>تاريخ الإصدار</th>
                      <th style={{ padding: '12px 16px' }}>الحالة</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuedCertificates.map(cert => {
                      const isRevoked = cert.status === 'revoked';
                      return (
                        <tr key={cert._id} style={{ borderBottom: '1px solid #f1f5f9', background: isRevoked ? '#fff7f7' : '#fff' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '12.5px', color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', direction: 'ltr' }}>
                                {cert.certificate_id}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{cert.user?.name || 'طالب غير معروف'}</div>
                            <small style={{ color: '#64748b', fontSize: '11.5px' }}>{cert.user?.email}</small>
                          </td>
                          <td style={{ padding: '14px 16px', maxWidth: '240px' }}>
                            {cert.certificate_type === 'track' || cert.track ? (
                              <div>
                                <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                  <i className="fa-solid fa-route"></i> مسار تعليمي متكامل
                                </span>
                                <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '13.5px' }}>{cert.track?.title || cert.course?.title || 'مسار تعليمي'}</div>
                              </div>
                            ) : (
                              <div>
                                <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                  <i className="fa-solid fa-book-open"></i> كورس معتمد
                                </span>
                                <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '13.5px' }}>{cert.course?.title || 'كورس'}</div>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                            {new Date(cert.issue_date || cert.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {isRevoked ? (
                              <div>
                                <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 9px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <i className="fa-solid fa-ban"></i> ملغية ومسحوبة
                                </span>
                                {cert.revocation_reason && (
                                  <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px', maxWidth: '200px' }} title={cert.revocation_reason}>
                                    السبب: {cert.revocation_reason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 9px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-circle-check"></i> نشطة ومعتمدة
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>

                              {/* Revoke or Reactivate Button */}
                              {isRevoked ? (
                                <button
                                  type="button"
                                  onClick={() => handleReactivateCert(cert)}
                                  disabled={actionLoading}
                                  className="btn btn-sm"
                                  style={{ padding: '5px 9px', fontSize: '12px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 'bold' }}
                                  title="إعادة تفعيل هذه الشهادة لتصبح صالحة مجدداً"
                                >
                                  <i className="fa-solid fa-rotate-left"></i> إعادة تفعيل
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRevokingCert(cert);
                                    setRevocationReasonInput('');
                                  }}
                                  className="btn btn-sm"
                                  style={{ padding: '5px 9px', fontSize: '12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 'bold' }}
                                  title="إلغاء الشهادة وسحب صلاحيتها"
                                >
                                  <i className="fa-solid fa-ban"></i> إلغاء الشهادة
                                </button>
                              )}

                              {/* Delete Certificate Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteCert(cert)}
                                disabled={actionLoading}
                                className="btn btn-sm"
                                style={{ padding: '5px 9px', fontSize: '12px', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', fontWeight: 'bold' }}
                                title="حذف الشهادة نهائياً من قاعدة البيانات"
                              >
                                <i className="fa-solid fa-trash-can"></i> حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {issuedTotalPages > 1 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  صفحة {issuedPage} من {issuedTotalPages}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={issuedPage <= 1 || issuedLoading}
                    onClick={() => fetchIssuedCertificates(issuedPage - 1)}
                    className="btn btn-light btn-sm"
                  >
                    السابق
                  </button>
                  <button
                    type="button"
                    disabled={issuedPage >= issuedTotalPages || issuedLoading}
                    onClick={() => fetchIssuedCertificates(issuedPage + 1)}
                    className="btn btn-light btn-sm"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revocation Reason Modal */}
      {revokingCert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '18px 22px', background: '#fee2e2', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#dc2626', fontSize: '18px' }}></i>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#991b1b', fontWeight: '800' }}>
                  إلغاء وسحب شهادة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRevokingCert(null)}
                style={{ background: 'none', border: 'none', color: '#991b1b', fontSize: '18px', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ padding: '22px' }}>
              <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: '#334155', lineHeight: '1.6' }}>
                أنت على وشك إلغاء شهادة الطالب: <strong>{revokingCert.user?.name}</strong> للكورس: <strong>{revokingCert.course?.title}</strong> (رقم: {revokingCert.certificate_id}).
                ستظهر الشهادة في صفحة التحقق الرقمي برمز <strong style={{ color: '#dc2626' }}>ملغية</strong>.
              </p>

              <div className="field">
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '6px', color: '#0f172a' }}>
                  سبب الإلغاء (سيظهر عند فحص الشهادة):
                </label>
                <textarea
                  rows="3"
                  value={revocationReasonInput}
                  onChange={(e) => setRevocationReasonInput(e.target.value)}
                  placeholder="مثال: تم إلغاء الشهادة بناء على طلب الطالب أو بسبب انتهاك شروط الاستخدام..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setRevokingCert(null)}
                  className="btn btn-light"
                  style={{ padding: '9px 18px', borderRadius: '8px' }}
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleRevokeSubmit}
                  disabled={actionLoading}
                  className="btn"
                  style={{ padding: '9px 18px', borderRadius: '8px', background: '#dc2626', color: '#fff', fontWeight: 'bold' }}
                >
                  {actionLoading ? 'جاري الإلغاء...' : 'تأكيد إلغاء الشهادة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL SETTINGS */}
      {activeTab === 'general' && (
      <div className="panel" style={{ marginBottom: '24px', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
      <div className="panel" style={{ marginBottom: '24px', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
        <div className="panel-head" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', padding: '18px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <h2 style={{ color: '#fff', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-sliders" style={{ color: '#d4af37' }}></i> الإعدادات العامة لكافة الشهادات
              </h2>
              <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '13px' }}>
                اضبط اللوجو الافتراضي والألوان واسم المدرب ونصوص الشهادة مرة واحدة ليتم تطبيقها تلقائياً على جميع شهادات الطلاب
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveGlobalSettings}
              disabled={savingGlobal}
              style={{ fontWeight: 'bold', gap: '8px', padding: '10px 22px', borderRadius: '10px' }}
            >
              {savingGlobal ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
              {savingGlobal ? 'جاري الحفظ...' : 'حفظ الإعدادات العامة'}
            </button>
          </div>
        </div>

        <div className="panel-body" style={{ padding: '24px', background: '#f8fafc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* Color & Instructor */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-palette text-red"></i> الثيم واسم المدرب الافتراضي
              </h3>

              <div className="field">
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  لون برواز وحليات الشهادة (Theme Color):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="color"
                    value={globalThemeColor}
                    onChange={(e) => setGlobalThemeColor(e.target.value)}
                    style={{ width: '48px', height: '40px', padding: '2px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={globalThemeColor}
                    onChange={(e) => setGlobalThemeColor(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 'bold' }}
                    placeholder="#d4af37"
                  />
                </div>
                {/* Color quick presets */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>ألوان سريعة:</span>
                  {[
                    { label: 'ذهبي كلاسيكي', color: '#d4af37' },
                    { label: 'أحمر المنصة', color: '#c81e1e' },
                    { label: 'أزرق ملكي', color: '#1d4ed8' },
                    { label: 'أخضر زمردي', color: '#059669' },
                    { label: 'أسود كحلي', color: '#0f172a' }
                  ].map(preset => (
                    <button
                      key={preset.color}
                      type="button"
                      title={preset.label}
                      onClick={() => setGlobalThemeColor(preset.color)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: preset.color,
                        border: globalThemeColor.toLowerCase() === preset.color.toLowerCase() ? '2px solid #0f172a' : '1px solid #cbd5e1',
                        cursor: 'pointer',
                        padding: 0,
                        transform: globalThemeColor.toLowerCase() === preset.color.toLowerCase() ? 'scale(1.2)' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="field">
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  اسم المدرب الافتراضي المعتمد للشهادات:
                </label>
                <input
                  type="text"
                  value={globalInstName}
                  onChange={(e) => setGlobalInstName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  placeholder="مثال: م. محمد بهاء"
                />
              </div>

            </div>

            {/* Logo Settings & Scale */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-image text-red"></i> لوجو الشهادة وحجمه
              </h3>

              <div className="field">
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  شعار المنصة / الأكاديمية الافتراضي:
                </label>
                {settings?.certificate_default_logo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '6px 12px', background: '#0f172a', borderRadius: '8px', width: 'fit-content' }}>
                    <img
                      src={getAssetUrl(settings.certificate_default_logo)}
                      alt="Default Cert Logo"
                      style={{ maxHeight: '35px', maxWidth: '120px', objectFit: 'contain' }}
                    />
                    <small style={{ color: '#94a3b8', fontSize: '11px' }}>شعار محفوظ حالياً</small>
                  </div>
                ) : settings?.site_logo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '6px 12px', background: '#0f172a', borderRadius: '8px', width: 'fit-content' }}>
                    <img
                      src={getAssetUrl(settings.site_logo)}
                      alt="Site Logo"
                      style={{ maxHeight: '35px', maxWidth: '120px', objectFit: 'contain' }}
                    />
                    <small style={{ color: '#94a3b8', fontSize: '11px' }}>لوجو الموقع الأساسي</small>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGlobalLogoFile(e.target.files[0])}
                  style={{ width: '100%', padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}
                />
              </div>

              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontWeight: '700', fontSize: '13px' }}>تكبير / تصغير اللوجو:</label>
                  <span style={{ fontWeight: '900', color: '#c81e1e', fontSize: '14px' }}>{globalLogoScale}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="180"
                  step="5"
                  value={globalLogoScale}
                  onChange={(e) => setGlobalLogoScale(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#c81e1e', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                  <span>50% (صغير)</span>
                  <span>100% (طبيعي)</span>
                  <span>180% (كبير)</span>
                </div>
              </div>
            </div>



          </div>

          {/* Dedicated Text Customization Card (تعديل نصوص الشهادة بالكامل) */}
          <div style={{ background: '#fff', padding: '22px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-pen-to-square text-red"></i> تعديل نصوص وعناوين الشهادة (كتيكست)
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>أي تعديل تدخله هنا يظهر فوراً في الشهادة بالأسفل</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="field">
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  عنوان الشهادة بالإنجليزي (Title EN):
                </label>
                <input
                  type="text"
                  value={globalTitleEn}
                  onChange={(e) => setGlobalTitleEn(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', direction: 'ltr', fontWeight: '700' }}
                  placeholder="CERTIFICATE OF COMPLETION"
                />
              </div>

              <div className="field">
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  عنوان الشهادة بالعربي (Title AR):
                </label>
                <input
                  type="text"
                  value={globalTitleAr}
                  onChange={(e) => setGlobalTitleAr(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700' }}
                  placeholder="شـهـادة إتـمـام وتـفـوّق مـعـتـمـدة"
                />
              </div>

              <div className="field">
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  النص التمهيدي قبل اسم الطالب:
                </label>
                <input
                  type="text"
                  value={globalPreNameText}
                  onChange={(e) => setGlobalPreNameText(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  placeholder="شهادة إتمام وتفوّق تُمنح بكل فخر واعتزاز إلى:"
                />
              </div>

              <div className="field">
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                  جملة إتمام واجتياز الدورة التدريبية:
                </label>
                <input
                  type="text"
                  value={globalCompletionStatement}
                  onChange={(e) => setGlobalCompletionStatement(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  placeholder="تقديراً لاجتيازه(ا) بنجاح وتفوق كافّة متطلبات وتطبيقات واختبارات الدورة التدريبية:"
                />
              </div>
            </div>
          </div>

          {/* Quick Live Preview of General Certificate */}
          <div style={{ marginTop: '24px', background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '800' }}>
                <i className="fa-solid fa-eye text-red"></i> معاينة حية سريعة للتصميم العام المعتمد (Live Preview)
              </h4>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                تتغير أبعاد اللوجو والتوقيع والألوان مباشرة مع السلايدر أعلاه
              </span>
            </div>
            <div style={{ overflowX: 'auto', background: '#0b0f19', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', transform: 'scale(0.72)', transformOrigin: 'top center', marginBottom: '-190px' }}>
                {renderCertificate(null)}
              </div>
            </div>
          </div>
        </div>
      </div>

      </div>
      )}

      {/* TAB 3: COURSES & TRACKS SPECIFIC LIST */}
      {activeTab === 'courses' && (() => {
        const allItems = [...courses, ...tracks];
        const displayedItems = itemFilter === 'courses'
          ? allItems.filter(i => i.item_type === 'course')
          : itemFilter === 'tracks'
          ? allItems.filter(i => i.item_type === 'track')
          : allItems;

        return (
          <div className="panel" style={{ marginBottom: '20px' }}>
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h2><i className="fa-solid fa-graduation-cap"></i> الكورسات والمسارات المفعل لها الشهادات ({allItems.length})</h2>
              
              {/* Filter Sub-Tabs */}
              <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setItemFilter('all')}
                  style={{
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: itemFilter === 'all' ? '#0f172a' : 'transparent',
                    color: itemFilter === 'all' ? '#fff' : '#64748b'
                  }}
                >
                  الكل ({allItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemFilter('courses')}
                  style={{
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: itemFilter === 'courses' ? '#0f172a' : 'transparent',
                    color: itemFilter === 'courses' ? '#fff' : '#64748b'
                  }}
                >
                  <i className="fa-solid fa-graduation-cap" style={{ marginLeft: '4px' }}></i> الكورسات ({courses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemFilter('tracks')}
                  style={{
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: itemFilter === 'tracks' ? '#0f172a' : 'transparent',
                    color: itemFilter === 'tracks' ? '#fff' : '#64748b'
                  }}
                >
                  <i className="fa-solid fa-route" style={{ marginLeft: '4px' }}></i> المسارات / التراكات ({tracks.length})
                </button>
              </div>
            </div>

            <div className="panel-body">
              {displayedItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <i className="fa-solid fa-folder-open fa-3x" style={{ marginBottom: '15px' }}></i>
                  <p>لا يوجد عناصر مفعل لها ميزة الشهادات حالياً في هذا القسم.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {displayedItems.map(item => (
                    <div key={`${item.item_type}-${item._id}`} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        {item.image ? (
                           <img src={getAssetUrl(item.image)} alt={item.title} style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover' }} />
                        ) : (
                           <div style={{ width: '64px', height: '64px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <i className={item.item_type === 'track' ? "fa-solid fa-route text-slate-400" : "fa-solid fa-image text-slate-400"}></i>
                           </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            {item.item_type === 'track' ? (
                              <span style={{ background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                                <i className="fa-solid fa-route"></i> مسار تعليمي (تراك)
                              </span>
                            ) : (
                              <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                                <i className="fa-solid fa-graduation-cap"></i> كورس
                              </span>
                            )}

                            {item.is_certificate_active !== false ? (
                              <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <i className="fa-solid fa-circle-check"></i> الاستخراج متاح
                              </span>
                            ) : (
                              <span style={{ color: '#d97706', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <i className="fa-solid fa-clock"></i> الاستخراج معلق
                              </span>
                            )}
                          </div>

                          <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 'bold', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>
                            {item.title}
                          </h3>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {item.item_type === 'track' ? 'شهادة إتمام وتفوق معتمدة للمسار بالكامل' : 'شهادة إتمام وتفوق معتمدة للدورة'}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, padding: '9px', justifyContent: 'center', borderRadius: '8px' }}
                          onClick={() => openPreview(item)}
                        >
                          <i className="fa-solid fa-eye"></i> معاينة الشهادة
                        </button>
                        <a
                          href={item.item_type === 'track' ? `/admin/tracks/form?id=${item._id}` : `/admin/courses/form?id=${item._id}`}
                          className="btn btn-light"
                          style={{ padding: '9px 12px', borderRadius: '8px', color: '#475569' }}
                          title="تعديل إعدادات الشهادة"
                        >
                          <i className="fa-solid fa-gear"></i>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 3. Modal for Course/Track-Specific Preview */}
      {activeCourse && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setActiveCourse(null); }}>
          <div className="modal-content" style={{ background: '#f8fafc', width: '100%', maxWidth: '1440px', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '95vh' }}>
            <div style={{ padding: '20px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '19px', color: '#0f172a' }}>
                  <i className="fa-solid fa-certificate text-red"></i> شهادة {activeCourse.item_type === 'track' ? 'المسار التعليمي (التراك)' : 'الدورة'}: {activeCourse.title}
                </h2>
                {activeCourse.item_type === 'track' ? (
                  <span style={{ background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                    <i className="fa-solid fa-route"></i> تراك
                  </span>
                ) : (
                  <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                    <i className="fa-solid fa-graduation-cap"></i> كورس
                  </span>
                )}
              </div>
              <button onClick={() => setActiveCourse(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            {/* Preview Area */}
            <div style={{ flex: 1, padding: '24px', background: '#0b0f19', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label style={{ fontWeight: 'bold', color: '#fff', fontSize: '13.5px' }}>اسم الطالب للمعاينة:</label>
                    <input 
                      type="text" 
                      value={previewName} 
                      onChange={(e) => setPreviewName(e.target.value)}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff', width: '240px' }}
                    />
                  </div>
                  <button className="btn btn-light" onClick={handlePrint} style={{ fontWeight: 'bold' }}>
                    <i className="fa-solid fa-print"></i> طباعة / تصدير PDF
                  </button>
                </div>
                
                {/* Certificate Wrapper */}
                <div style={{ flex: 1, overflow: 'auto', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.2)' }}>
                    {renderCertificate(activeCourse)}
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Certificates;

