import { useState } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { formatExternalUrl } from '../utils/assetUrl';
import { useSettings } from '../context/SettingsContext';
import SEO from '../components/common/SEO';

function Contact() {
  const { settings, loadingSettings } = useSettings();
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);

  usePageReady(!loadingSettings);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      return alert('يرجى ملء جميع الحقول المطلوبة.');
    }
    setLoading(true);
    try {
      const res = await api.post('/messages', formData);
      await alert(res.data.message);
      setFormData({ name: '', phone: '', email: '', message: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ أثناء الإرسال');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings) {
    return null;
  }

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const contactSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ContactPage',
        '@id': `${originUrl}/contact#webpage`,
        'name': 'تواصل معنا',
        'url': `${originUrl}/contact`,
        'description': 'صفحة التواصل والدعم الفني لمنصة محمد بهاء التعليمية'
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
            'name': 'تواصل معنا',
            'item': `${originUrl}/contact`
          }
        ]
      }
    ]
  };

  return (
    <main>
      <SEO
        title="تواصل معنا"
        description="تواصل مع منصة محمد بهاء وفريق الدعم الفني للاستفسار عن الكورسات، طرق الدفع، وخدمات الاستشارات التسويقية عبر الواتساب والبريد الإلكتروني."
        canonical="/contact"
        keywords={['تواصل معنا', 'دعم منصة محمد بهاء', 'رقم محمد بهاء', 'واتساب محمد بهاء', 'استفسارات كورسات التسويق']}
        schema={contactSchema}
      />
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">الرئيسية</Link><i className="fa-solid fa-chevron-left"></i><span>تواصل معنا</span>
          </div>
          <h1>تواصل معنا</h1>
          <p>عندك سؤال عن الكورسات أو طريقة الاشتراك؟ ابعتلنا وهنرد عليك في أسرع وقت.</p>
        </div>
      </section>
      
      <section className="section" style={{ paddingTop: '60px' }}>
        <div className="container contact-layout">
          <div className="contact-card reveal">
            <h3>{settings.trainer_name || settings.site_name || 'تواصل معنا'}{settings.trainer_subtitle ? ` - ${settings.trainer_subtitle}` : ''}</h3>
            <p style={{ color: '#9ea0a8', position: 'relative', zIndex: 1 }}>متاحين للرد على استفساراتك يومياً.</p>
            {settings.phone && <a className="contact-item" href={`tel:${settings.phone.replace(/[^0-9+]/g, '')}`}><span className="ic"><i className="fa-solid fa-phone"></i></span><div><small>رقم التواصل</small><strong><span className="ltr">{settings.phone}</span></strong></div></a>}
            {settings.whatsapp && <a className="contact-item" href={`https://wa.me/${String(settings.whatsapp).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(settings.whatsapp_message || 'مرحباً، أود الاستفسار عن الكورسات')}`} target="_blank" rel="noopener noreferrer"><span className="ic" style={{ color: '#25d366' }}><i className="fa-brands fa-whatsapp"></i></span><div><small>WhatsApp</small><strong><span className="ltr">{settings.whatsapp}</span></strong></div></a>}
            <div className="socials">
              {settings.facebook && <a href={formatExternalUrl(settings.facebook)} target="_blank" rel="noopener noreferrer" aria-label="facebook"><i className="fa-brands fa-facebook-f"></i></a>}
              {settings.instagram && <a href={formatExternalUrl(settings.instagram)} target="_blank" rel="noopener noreferrer" aria-label="instagram"><i className="fa-brands fa-instagram"></i></a>}
              {settings.tiktok && <a href={formatExternalUrl(settings.tiktok)} target="_blank" rel="noopener noreferrer" aria-label="tiktok"><i className="fa-brands fa-tiktok"></i></a>}
              {settings.youtube && <a href={formatExternalUrl(settings.youtube)} target="_blank" rel="noopener noreferrer" aria-label="youtube"><i className="fa-brands fa-youtube"></i></a>}
            </div>
            {settings.whatsapp && <a href={`https://wa.me/${String(settings.whatsapp).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(settings.whatsapp_message || 'مرحباً، أود الاستفسار عن الكورسات')}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-block mt-3" style={{ position: 'relative', zIndex: 1 }}><i className="fa-brands fa-whatsapp"></i> ابدأ محادثة واتساب</a>}
          </div>
          
          <div className="form-card reveal reveal-d1">
            <h2>ابعتلنا رسالة</h2>
            <p className="muted" style={{ marginBottom: '20px' }}>املأ البيانات وهنتواصل معاك.</p>
            <form onSubmit={handleSubmit} noValidate>
              <input type="text" name="website" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
              <div className="form-grid">
                <div className="field">
                  <label>الاسم <span className="req">*</span></label>
                  <input name="name" required value={formData.name} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>رقم الموبايل <span className="req">*</span></label>
                  <input name="phone" type="tel" dir="ltr" required placeholder="01xxxxxxxxx" value={formData.phone} onChange={handleChange} />
                </div>
                <div className="field full">
                  <label>البريد الإلكتروني <span className="req">*</span></label>
                  <input name="email" type="email" dir="ltr" placeholder="name@example.com" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="field full">
                  <label>الرسالة <span className="req">*</span></label>
                  <textarea name="message" required value={formData.message} onChange={handleChange}></textarea>
                </div>
                <div className="full">
                  <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                    {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <><i className="fa-solid fa-paper-plane"></i> إرسال الرسالة</>}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Contact;
