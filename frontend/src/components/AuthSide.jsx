import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { getAssetUrl } from '../utils/assetUrl';

function AuthSide({ title, text }) {
  const { settings } = useSettings();
  const siteName = settings.site_name || '';
  const siteSubtitle = settings.site_subtitle || '';
  const logoUrl = settings.site_logo ? getAssetUrl(settings.site_logo) : null;

  return (
    <div className="auth-side">
      <Link to="/" className="logo" style={{ marginBottom: '30px' }}>
        {logoUrl ? (
          <img src={logoUrl} alt={siteName || 'اللوجو'} style={{ maxHeight: '42px', width: 'auto', objectFit: 'contain' }} />
        ) : (
          <>
            <span className="logo-mark">{siteName ? siteName.charAt(0) : 'م'}</span>
            <span className="logo-text"><strong style={{ color: '#fff' }}>{siteName}</strong>{siteSubtitle && <span>{siteSubtitle}</span>}</span>
          </>
        )}
      </Link>
      <h2>{title}</h2>
      <p>{text}</p>
      <ul className="check-list single" style={{ color: '#e5e5e7' }}>
        <li style={{ color: '#e5e5e7' }}><i className="fa-solid fa-check"></i>تابع كل الكورسات اللي اشتركت فيها من مكان واحد</li>
        <li style={{ color: '#e5e5e7' }}><i className="fa-solid fa-check"></i>شوف نسبة التقدم وكمّل من آخر درس وقفت عنده</li>
        <li style={{ color: '#e5e5e7' }}><i className="fa-solid fa-check"></i>تابع حالة طلبات الاشتراك والدفع</li>
      </ul>
    </div>
  );
}

export default AuthSide;
