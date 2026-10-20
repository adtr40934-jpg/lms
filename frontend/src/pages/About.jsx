import { useState, useEffect } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useSettings } from '../context/SettingsContext';
import SEO from '../components/common/SEO';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { getAssetUrl } from '../utils/assetUrl';

function About() {
  const { settings, loadingSettings } = useSettings();
  const [certificates, setCertificates] = useState([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [activeCertIndex, setActiveCertIndex] = useState(null);

  const isReady = !loadingSettings && !certsLoading;
  usePageReady(isReady);

  useEffect(() => {
    setCertsLoading(true);
    api.get('/trainer-certificates').then(async res => {
      const certList = res.certificates || [];
      if (!certList.length) {
        setCertificates([]);
        setCertsLoading(false);
        return;
      }

      // قياس أبعاد كل صورة لمعرفة العريضة (Landscape) من الطولية (Portrait)
      const enriched = await Promise.all(
        certList.map(cert => {
          return new Promise(resolve => {
            const src = cert.image ? getAssetUrl(cert.image) : '';
            if (!src) return resolve({ ...cert, isWide: true });
            const img = new Image();
            img.onload = () => {
              resolve({ ...cert, isWide: img.naturalWidth >= img.naturalHeight, ratio: img.naturalWidth / img.naturalHeight });
            };
            img.onerror = () => resolve({ ...cert, isWide: true, ratio: 1 });
            img.src = src;
          });
        })
      );

      const wideCerts = enriched.filter(c => c.isWide);
      const tallCerts = enriched.filter(c => !c.isWide);
      setCertificates([...wideCerts, ...tallCerts]);
    }).catch(err => {
      console.error(err);
      setCertificates([]);
    }).finally(() => {
      setCertsLoading(false);
    });
  }, []);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (activeCertIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveCertIndex(null);
      } else if (e.key === 'ArrowRight') {
        setActiveCertIndex((prev) => (prev > 0 ? prev - 1 : certificates.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setActiveCertIndex((prev) => (prev < certificates.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCertIndex, certificates.length]);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const trainerName = settings?.trainer_name || 'محمد بهاء';
  const trainerImage = settings?.trainer_image
    ? getAssetUrl(settings.trainer_image)
    : `${originUrl}/assets/img/og-preview.jpg`;

  const aboutSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${originUrl}/about#trainer`,
        'name': trainerName,
        'jobTitle': 'مدرب ومستشار التسويق الرقمي وصانع محتوى',
        'image': trainerImage,
        'description': `تعرّف على ${trainerName}، إعلامي ومدرب معتمد في التسويق الإلكتروني وإعلانات ميتا واستراتيجيات المحتوى الرقمي.`,
        'sameAs': [
          settings?.facebook,
          settings?.instagram,
          settings?.tiktok,
          settings?.youtube
        ].filter(Boolean)
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
            'name': 'عن المدرب',
            'item': `${originUrl}/about`
          }
        ]
      }
    ]
  };

  return (
    <main>
      <SEO
        title={`عن المدرب ${trainerName}`}
        description={`تعرّف على مسيرة ${trainerName} (بتاع تسويق) في التدريب والتسويق الإلكتروني وصناعة المحتوى، وشاهد شهادات الاعتماد والخبرات العملية.`}
        canonical="/about"
        ogImage={trainerImage}
        keywords={['عن محمد بهاء', 'محمد بهاء', 'بتاع تسويق', 'مدرب تسويق الكتروني', 'شهادات محمد بهاء']}
        schema={aboutSchema}
      />
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">الرئيسية</Link><i className="fa-solid fa-chevron-left"></i><span>عن المدرب</span>
          </div>
          <h1>عن المدرب</h1>
          <p>تعرّف على {settings.trainer_name || 'محمد بهاء'} ورحلته في التدريب والتسويق الإلكتروني وصناعة المحتوى.</p>
        </div>
      </section>
      
      <section className="section">
        <div className="container about-grid">
          <div className="about-photo reveal">
            <div className="frame">
              <img src={settings.trainer_image ? getAssetUrl(settings.trainer_image) : '/assets/img/hero.webp'} alt={settings.trainer_name || "المدرب"} width="600" height="720" style={{objectFit:'cover'}} />
            </div>
            <div className="about-badge">
              <span className="ic"><i className="fa-solid fa-bullhorn"></i></span>
              <div>{settings.trainer_name || 'بتاع تسويق'}<br /><small className="muted">Digital Marketing Trainer</small></div>
            </div>
          </div>
          <div className="about-text reveal reveal-d1">
            <span className="section-tag"><i className="fa-solid fa-user-tie"></i> المدرب</span>
            <h2>{settings.trainer_name || 'محمد بهاء'}</h2>
            <div className="role">{settings.trainer_subtitle || 'بتاع تسويق — مدرب تسويق إلكتروني وصانع محتوى'}</div>
            <div
              className="trainer-desc-content"
              style={{ lineHeight: '1.8', color: 'var(--text-muted, #94a3b8)', marginBottom: '24px' }}
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(settings.trainer_desc || 'محمد بهاء مدرب متخصص في التسويق الإلكتروني وصناعة المحتوى، يقدم محتوى تدريبياً عملياً يساعد أصحاب المشروعات وصناع المحتوى والمسوقين والمبتدئين على فهم واستخدام أدوات التسويق والسوشيال ميديا بطريقة عملية.<br/><br/>تركز الكورسات على التطبيق العملي وتبسيط المعلومات، بداية من صناعة المحتوى وإدارة منصات التواصل الاجتماعي وحتى الإعلانات الممولة والتصوير والمونتاج.')
              }}
            />
            <div className="skills">
              <span><i className="fa-solid fa-pen-nib"></i>صناعة المحتوى</span>
              <span><i className="fa-brands fa-facebook"></i>Facebook</span>
              <span><i className="fa-brands fa-instagram"></i>Instagram</span>
              <span><i className="fa-solid fa-bullseye"></i>Meta Ads</span>
              <span><i className="fa-solid fa-video"></i>التصوير والمونتاج</span>
              <span><i className="fa-brands fa-microsoft"></i>Microsoft Office</span>
            </div>
            <div className="hero-actions">
              <Link to="/courses" className="btn btn-primary"><i className="fa-solid fa-layer-group"></i> شوف الكورسات</Link>
              {settings.whatsapp && (
                <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp"><i className="fa-brands fa-whatsapp"></i> تواصل على واتساب</a>
              )}
            </div>
          </div>
        </div>
      </section>
      
      {/* معرض الشهادات والاعتمادات للمدرب */}
      {certificates.length > 0 && (
        <section className="section" id="trainer-certificates" style={{ background: '#111114', borderTop: '1px solid #222228', borderBottom: '1px solid #222228' }}>
          <div className="container">
            <div className="section-head reveal" style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 36px' }}>
              <span className="section-tag" style={{ margin: '0 auto 10px' }}>
                <i className="fa-solid fa-award"></i> الشهادات
              </span>
              <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#fff', marginBottom: '10px' }}>
                شهادات واعتمادات المدرب
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
                اضغط على أي شهادة لمعاينتها وتكبيرها بدقة عالية
              </p>
            </div>

            {/* الشهادات العريضة بجانب بعضها */}
            {certificates.filter(c => c.isWide).length > 0 && (
              <div style={{ marginBottom: certificates.filter(c => !c.isWide).length > 0 ? '36px' : '0' }}>
                <div className="cert-row-wide">
                  {certificates.map((cert, idx) => {
                    if (!cert.isWide) return null;
                    const imgSrc = cert.image ? getAssetUrl(cert.image) : '';
                    return (
                      <div
                        key={cert._id || idx}
                        className="cert-portfolio-item cert-item-landscape reveal"
                        onClick={() => setActiveCertIndex(idx)}
                        title="اضغط لتكبير الشهادة"
                      >
                        <img
                          src={imgSrc}
                          alt="شهادة معتمدة"
                          loading="lazy"
                          className="cert-portfolio-img"
                        />
                        <div className="cert-portfolio-overlay">
                          <div className="cert-portfolio-badge">
                            <i className="fa-solid fa-magnifying-glass-plus"></i> تكبير الشهادة
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* الشهادات الطولية بجانب بعضها */}
            {certificates.filter(c => !c.isWide).length > 0 && (
              <div>
                <div className="cert-row-tall">
                  {certificates.map((cert, idx) => {
                    if (cert.isWide) return null;
                    const imgSrc = cert.image ? getAssetUrl(cert.image) : '';
                    return (
                      <div
                        key={cert._id || idx}
                        className="cert-portfolio-item cert-item-portrait reveal"
                        onClick={() => setActiveCertIndex(idx)}
                        title="اضغط لتكبير الشهادة"
                      >
                        <img
                          src={imgSrc}
                          alt="شهادة معتمدة"
                          loading="lazy"
                          className="cert-portfolio-img"
                        />
                        <div className="cert-portfolio-overlay">
                          <div className="cert-portfolio-badge">
                            <i className="fa-solid fa-magnifying-glass-plus"></i> تكبير الشهادة
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Lightbox Modal عند الضغط على الشهادة */}
      {activeCertIndex !== null && certificates[activeCertIndex] && (
        <div
          className="cert-lightbox-modal"
          onClick={() => setActiveCertIndex(null)}
        >
          {/* Close Button */}
          <button
            type="button"
            className="cert-lightbox-close"
            onClick={() => setActiveCertIndex(null)}
            title="إغلاق (Esc)"
          >
            ✕
          </button>

          {/* Navigation Arrows */}
          {certificates.length > 1 && (
            <>
              <button
                type="button"
                className="cert-lightbox-arrow prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveCertIndex((prev) => (prev > 0 ? prev - 1 : certificates.length - 1));
                }}
                title="السابق (سهم يمين)"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>

              <button
                type="button"
                className="cert-lightbox-arrow next"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveCertIndex((prev) => (prev < certificates.length - 1 ? prev + 1 : 0));
                }}
                title="التالي (سهم يسار)"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
            </>
          )}

          {/* Large Certificate Image Inside Frame */}
          <div
            style={{
              maxWidth: '92vw',
              maxHeight: '84vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={certificates[activeCertIndex].image ? getAssetUrl(certificates[activeCertIndex].image) : ''}
              alt="معاينة الشهادة"
              style={{
                maxWidth: '100%',
                maxHeight: '84vh',
                objectFit: 'contain',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.85)'
              }}
            />
          </div>

          {/* Bottom Counter */}
          <div
            style={{
              position: 'absolute',
              bottom: '22px',
              color: '#94a3b8',
              fontSize: '14px',
              fontWeight: 'bold',
              background: 'rgba(0,0,0,0.5)',
              padding: '4px 14px',
              borderRadius: '20px',
              backdropFilter: 'blur(4px)',
              zIndex: 3
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeCertIndex + 1} / {certificates.length}
          </div>
        </div>
      )}
      
      <section className="section section-dark">
        <div className="container">
          <div className="section-head reveal">
            <span className="section-tag"><i className="fa-solid fa-chart-line"></i> بالأرقام</span>
            <h2>خبرة بتتقاس بالنتائج</h2>
          </div>
          <div className="stats-grid">
            <div className="stat reveal reveal-d1"><i className="fa-solid fa-award"></i><div className="num">+{settings.stat_years || '12'}</div><div className="lbl">سنوات خبرة تدريبية</div></div>
            <div className="stat reveal reveal-d2"><i className="fa-solid fa-user-graduate"></i><div className="num">+{settings.stat_students || '1200'}</div><div className="lbl">متدرب</div></div>
            <div className="stat reveal reveal-d3"><i className="fa-solid fa-book-open"></i><div className="num">+{settings.stat_courses || '11'}</div><div className="lbl">كورسات</div></div>
            <div className="stat reveal reveal-d4"><i className="fa-solid fa-circle-play"></i><div className="num">+{settings.stat_hours || '50'}</div><div className="lbl">ساعة محتوى تدريبي</div></div>
            <div className="stat reveal reveal-d5"><i className="fa-solid fa-handshake"></i><div className="num">+{settings.stat_clients || '1050'}</div><div className="lbl">عميل ساعدناهم</div></div>
          </div>
        </div>
      </section>
      
      <section className="section section-gray">
        <div className="container">
          <div className="section-head reveal">
            <span className="section-tag"><i className="fa-solid fa-compass"></i> أسلوب التدريب</span>
            <h2>إزاي بنتعلم في بتاع تسويق؟</h2>
          </div>
          <div className="features-grid">
            <div className="feature reveal reveal-d1"><div className="ic"><i className="fa-solid fa-hand-pointer"></i></div><h3>تطبيق قبل التنظير</h3><p>كل معلومة بتتشرح بمثال وتطبيق تقدر تعمله بنفسك.</p></div>
            <div className="feature reveal reveal-d2"><div className="ic"><i className="fa-solid fa-stairs"></i></div><h3>خطوة بخطوة</h3><p>مسار واضح من الأساسيات لحد المستوى الاحترافي.</p></div>
            <div className="feature reveal reveal-d3"><div className="ic"><i className="fa-solid fa-store"></i></div><h3>أمثلة من السوق</h3><p>حالات حقيقية لبراندات ومشروعات من السوق المصري والعربي.</p></div>
            <div className="feature reveal reveal-d4"><div className="ic"><i className="fa-solid fa-headset"></i></div><h3>متابعة ودعم</h3><p>تقدر تتواصل معانا على واتساب لأي استفسار.</p></div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default About;
