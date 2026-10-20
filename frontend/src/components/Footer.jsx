import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { formatExternalUrl, getAssetUrl } from '../utils/assetUrl';

function Footer() {
  const currentYear = new Date().getFullYear();
  const { settings } = useSettings();

  const siteName = settings.site_name || '';
  const siteSubtitle = settings.site_subtitle || '';
  const logoUrl = settings.site_logo ? getAssetUrl(settings.site_logo) : null;

  // Phone & WhatsApp formatting
  const phone = settings.phone || '';
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  const rawWhatsapp = settings.whatsapp || '';
  const cleanWhatsapp = rawWhatsapp ? String(rawWhatsapp).replace(/[^0-9]/g, '') : '';
  const waMsg = settings.whatsapp_message ? encodeURIComponent(settings.whatsapp_message) : '';
  const waUrl = cleanWhatsapp ? `https://wa.me/${cleanWhatsapp}${waMsg ? `?text=${waMsg}` : ''}` : '';

  const hasSocials = !!(settings.facebook || settings.instagram || settings.tiktok || settings.youtube || settings.telegram_group_url);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="logo">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName || 'اللوجو'} style={{ maxHeight: '42px', width: 'auto', objectFit: 'contain' }} />
              ) : (
                <>
                  <span className="logo-mark">{siteName ? siteName.charAt(0) : 'م'}</span>
                  <span className="logo-text"><strong>{siteName}</strong>{siteSubtitle && <span>{siteSubtitle}</span>}</span>
                </>
              )}
            </Link>
            <p>منصة تعليمية لتعلم التسويق الإلكتروني وصناعة المحتوى والسوشيال ميديا.</p>
            {hasSocials && (
              <div className="socials">
                {settings.facebook && (
                  <a href={formatExternalUrl(settings.facebook)} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                    <i className="fa-brands fa-facebook-f"></i>
                  </a>
                )}
                {settings.instagram && (
                  <a href={formatExternalUrl(settings.instagram)} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <i className="fa-brands fa-instagram"></i>
                  </a>
                )}
                {settings.tiktok && (
                  <a href={formatExternalUrl(settings.tiktok)} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                    <i className="fa-brands fa-tiktok"></i>
                  </a>
                )}
                {settings.youtube && (
                  <a href={formatExternalUrl(settings.youtube)} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                    <i className="fa-brands fa-youtube"></i>
                  </a>
                )}
                {settings.telegram_group_url && (
                  <a href={formatExternalUrl(settings.telegram_group_url)} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                    <i className="fa-brands fa-telegram"></i>
                  </a>
                )}
              </div>
            )}
          </div>
          <div>
            <h4>روابط سريعة</h4>
            <ul className="footer-links">
              <li><Link to="/"><i className="fa-solid fa-chevron-left"></i>الرئيسية</Link></li>
              <li><Link to="/courses"><i className="fa-solid fa-chevron-left"></i>الكورسات</Link></li>
              <li><Link to="/about"><i className="fa-solid fa-chevron-left"></i>عن المدرب</Link></li>
              <li><Link to="/verify-certificate"><i className="fa-solid fa-chevron-left"></i>التحقق من الشهادات</Link></li>
              <li><Link to="/subscribe"><i className="fa-solid fa-chevron-left"></i>طريقة الاشتراك</Link></li>
              <li><Link to="/contact"><i className="fa-solid fa-chevron-left"></i>تواصل معنا</Link></li>
            </ul>
          </div>

          <div>
            <h4>تواصل معنا</h4>
            <ul className="footer-links">
              {phone && (
                <li>
                  <a href={`tel:${cleanPhone || phone}`}>
                    <i className="fa-solid fa-phone"></i>
                    <span className="ltr">{phone}</span>
                  </a>
                </li>
              )}
              {waUrl && (
                <li>
                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                    <i className="fa-brands fa-whatsapp" style={{ color: '#25d366' }}></i>
                    <span className="ltr">{rawWhatsapp || phone}</span>
                  </a>
                </li>
              )}
              {settings.email && (
                <li>
                  <a href={`mailto:${settings.email}`}>
                    <i className="fa-solid fa-envelope"></i>
                    <span>{settings.email}</span>
                  </a>
                </li>
              )}
            </ul>
            <div className="methods">
              <span className="method m-insta"><i className="fa-solid fa-bolt"></i>InstaPay</span>
              <span className="method m-voda"><i className="fa-solid fa-wallet"></i>Vodafone Cash</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {currentYear} {siteName} {siteSubtitle ? `| ${siteSubtitle}` : ''} — جميع الحقوق محفوظة</span>
          <span>صُنع بشغف لكل اللي عايز يتعلم التسويق <i className="fa-solid fa-heart text-red"></i></span>
        </div>
      </div>

      {(waUrl || cleanPhone) && (
        <a 
          className="wa-float" 
          href={waUrl || `https://wa.me/${cleanPhone}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          aria-label="تواصل على واتساب"
        >
          <i className="fa-brands fa-whatsapp"></i><span className="wa-tip">كلمنا على واتساب</span>
        </a>
      )}
      <button className="to-top" aria-label="للأعلى" onClick={() => window.scrollTo(0, 0)}><i className="fa-solid fa-arrow-up"></i></button>
    </footer>
  );
}

export default Footer;
