import { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../api';
import { getBackendOrigin } from '../../utils/backendUrl';

function AdminLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openIncidents, setOpenIncidents] = useState(0);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const adminName = user ? user.name : 'مدير النظام';
  
  const pending = 0;
  const unread = 0;

  useEffect(() => {
    // Check security incident count
    api.get('/admin/security/overview')
      .then(res => {
        if (res?.openCount !== undefined) setOpenIncidents(res.openCount);
      })
      .catch(() => {});

    const socket = io(getBackendOrigin(), {
      withCredentials: true,
      auth: { isAdmin: true }
    });

    socket.on('security_alert', () => {
      api.get('/admin/security/overview')
        .then(res => {
          if (res?.openCount !== undefined) setOpenIncidents(res.openCount);
        })
        .catch(() => {});
    });

    return () => socket.disconnect();
  }, []);

  const items = [
    { isLabel: true, lbl: 'الرئيسية' },
    { path: '/', icon: 'fa-solid fa-gauge-high', lbl: 'لوحة المعلومات' },
    { path: '/admin/stats', icon: 'fa-solid fa-chart-pie', lbl: 'التحليلات المتقدمة' },
    { isLabel: true, lbl: 'المحتوى التعليمي' },
    { path: '/admin/tracks', icon: 'fa-solid fa-route', lbl: 'التراكات (المسارات)' },
    { path: '/admin/courses', icon: 'fa-solid fa-book-open', lbl: 'الكورسات' },
    { path: '/admin/course-form', icon: 'fa-solid fa-circle-plus', lbl: 'إضافة كورس جديد' },
    { path: '/admin/trainer-certificates', icon: 'fa-solid fa-award', lbl: 'شهادات المدرب' },
    { path: '/admin/certificates', icon: 'fa-solid fa-graduation-cap', lbl: 'شهادات الطلاب' },
    { path: '/admin/categories', icon: 'fa-solid fa-tags', lbl: 'التصنيفات' },
    { isLabel: true, lbl: 'الطلاب والمبيعات' },
    { path: '/admin/orders', icon: 'fa-solid fa-receipt', lbl: 'طلبات الاشتراك', badge: pending },
    { path: '/admin/coupons', icon: 'fa-solid fa-ticket', lbl: 'كوبونات الخصم' },
    { path: '/admin/students', icon: 'fa-solid fa-user-graduate', lbl: 'الطلاب' },
    { path: '/admin/reviews', icon: 'fa-solid fa-comments', lbl: 'آراء المتدربين' },
    { path: '/admin/messages', icon: 'fa-solid fa-envelope', lbl: 'رسائل التواصل', badge: unread },
    { isLabel: true, lbl: 'الأمان والمراقبة' },
    { path: '/admin/security', icon: 'fa-solid fa-shield-halved', lbl: 'مركز الأمان والمراقبة', badge: openIncidents },
    { path: '/admin/logs', icon: 'fa-solid fa-clock-rotate-left', lbl: 'سجل التدقيق (Logs)' },
    { path: '/admin/user-activity', icon: 'fa-solid fa-user-clock', lbl: 'نشاط المستخدمين' },
    { isLabel: true, lbl: 'النظام' },
    { path: '/admin/settings', icon: 'fa-solid fa-gear', lbl: 'الإعدادات' },
  ];

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/admin.css';
    link.id = 'admin-css';
    document.head.appendChild(link);

    return () => {
      const existing = document.getElementById('admin-css');
      if (existing) existing.remove();
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
        <div className="sb-brand">
          <span className="mark">ب</span>
          <div><strong>{adminName}</strong><small>لوحة تحكم المنصة</small></div>
        </div>
        <ul className="sb-nav">
          {items.map((it, i) => (
            it.isLabel ? (
              <li key={i} className="lbl">{it.lbl}</li>
            ) : (
              <li key={i}>
                <Link to={it.path} className={window.location.pathname === it.path ? 'active' : ''}>
                  <i className={it.icon}></i>{it.lbl}
                  {it.badge > 0 && <span className="badge">{it.badge}</span>}
                </Link>
              </li>
            )
          ))}
        </ul>
        <div className="sb-foot">
          <Link className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', background: '#1c1c21', marginBottom: '8px' }} to="/" target="_blank">
            <i className="fa-solid fa-arrow-up-right-from-square"></i> عرض الموقع
          </Link>
          <button onClick={handleLogout} className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', background: '#2a1214', color: '#ff8a8a' }}>
            <i className="fa-solid fa-right-from-bracket"></i> تسجيل الخروج
          </button>
        </div>
      </aside>
      <div className={`overlay ${sidebarOpen ? 'show' : ''}`} id="overlay" onClick={() => setSidebarOpen(false)}></div>
      <div className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="menu-btn" id="menuBtn" aria-label="القائمة" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <i className="fa-solid fa-bars"></i>
            </button>
            <h1>{title}</h1>
          </div>
          <div className="actions">
            <span className="hide-m muted" style={{ fontWeight: 700 }}><i className="fa-regular fa-user"></i> {adminName}</span>
          </div>
        </header>
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
