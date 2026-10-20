import { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getAssetUrl } from '../utils/assetUrl';

function Header() {
  const { user } = useContext(AuthContext);
  const { settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;

  const siteName = settings.site_name || '';
  const siteSubtitle = settings.site_subtitle || '';
  const logoUrl = settings.site_logo ? getAssetUrl(settings.site_logo) : null;

  return (
    <header className="site-header">
      <div className="container nav">
        <Link to="/" className="logo" aria-label={siteName || 'الرئيسية'}>
          {logoUrl ? (
            <img src={logoUrl} alt={siteName || 'اللوجو'} style={{ maxHeight: '42px', width: 'auto', objectFit: 'contain' }} />
          ) : (
            <>
              <span className="logo-mark">{siteName ? siteName.charAt(0) : 'م'}</span>
              <span className="logo-text"><strong>{siteName}</strong>{siteSubtitle && <span>{siteSubtitle}</span>}</span>
            </>
          )}
        </Link>
        <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <li><Link to="/" className={currentPath === '/' ? 'active' : ''} onClick={() => setMenuOpen(false)}>الرئيسية</Link></li>
          <li><Link to="/tracks" className={currentPath === '/tracks' || currentPath.startsWith('/track') || currentPath === '/courses' || currentPath.startsWith('/course') ? 'active' : ''} onClick={() => setMenuOpen(false)}>الكورسات</Link></li>
          <li><Link to="/about" className={currentPath === '/about' ? 'active' : ''} onClick={() => setMenuOpen(false)}>عن المدرب</Link></li>
          <li><Link to="/verify-certificate" className={currentPath.startsWith('/verify-certificate') ? 'active' : ''} onClick={() => setMenuOpen(false)}>التحقق من الشهادة</Link></li>
          <li><Link to="/subscribe" className={currentPath === '/subscribe' ? 'active' : ''} onClick={() => setMenuOpen(false)}>طريقة الاشتراك</Link></li>
          <li><Link to="/contact" className={currentPath === '/contact' ? 'active' : ''} onClick={() => setMenuOpen(false)}>تواصل معنا</Link></li>
          {!user && (
            <>
              <li className="only-m"><Link to="/login" onClick={() => setMenuOpen(false)}>تسجيل الدخول</Link></li>
              <li className="only-m"><Link to="/register" onClick={() => setMenuOpen(false)}>تسجيل (إنشاء حساب)</Link></li>
            </>
          )}
        </ul>
        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/account" className="btn btn-primary btn-sm"><i className="fa-solid fa-graduation-cap"></i><span>كورساتي</span></Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm hide-m">تسجيل دخول</Link>
              <Link to="/register" className="btn btn-primary btn-sm hide-m">تسجيل</Link>
            </>
          )}
          <button className="menu-toggle" aria-label="القائمة" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <i className="fa-solid fa-xmark"></i> : <i className="fa-solid fa-bars"></i>}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
