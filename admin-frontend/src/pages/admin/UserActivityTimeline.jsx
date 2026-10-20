import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';

function UserActivityTimeline() {
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = searchParams.get('userId');

  const [students, setStudents] = useState([]);
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  // Fetch list of students for quick selector
  useEffect(() => {
    fetchStudentsList();
  }, []);

  // Fetch timeline whenever userId changes
  useEffect(() => {
    if (userId) {
      fetchUserTimeline(userId);
    } else {
      setTimelineData(null);
    }
  }, [userId]);

  const fetchStudentsList = async (q = '') => {
    try {
      setSearching(true);
      const res = await api.get(`/admin/students${q ? `?q=${q}` : ''}`);
      setStudents(res.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const fetchUserTimeline = async (uid) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/logs/users/${uid}`);
      setTimelineData(res);
    } catch (err) {
      alert(err.message || 'فشل جلب سجل نشاط المستخدم');
      setTimelineData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (idx) => {
    setExpandedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getActionIcon = (action, category) => {
    if (action.includes('login_success')) {
      return { icon: 'fa-solid fa-right-to-bracket', bg: '#10b981', color: '#fff' };
    }
    if (action.includes('login_failed')) {
      return { icon: 'fa-solid fa-lock', bg: '#ef4444', color: '#fff' };
    }
    if (action.includes('logout')) {
      return { icon: 'fa-solid fa-arrow-right-from-bracket', bg: '#64748b', color: '#fff' };
    }
    if (action.includes('password')) {
      return { icon: 'fa-solid fa-key', bg: '#f59e0b', color: '#fff' };
    }
    if (action.includes('order')) {
      return { icon: 'fa-solid fa-receipt', bg: '#8b5cf6', color: '#fff' };
    }
    if (action.includes('certificate')) {
      return { icon: 'fa-solid fa-award', bg: '#ec4899', color: '#fff' };
    }
    if (action.includes('enrollment')) {
      return { icon: 'fa-solid fa-graduation-cap', bg: '#06b6d4', color: '#fff' };
    }
    if (category === 'SECURITY' || category === 'CRITICAL') {
      return { icon: 'fa-solid fa-shield-halved', bg: '#b91c1c', color: '#fff' };
    }
    return { icon: 'fa-solid fa-circle-dot', bg: '#3b82f6', color: '#fff' };
  };

  return (
    <AdminLayout title="سجل نشاط المستخدمين (User Activity Timeline)">
      {/* User Search & Selector Panel */}
      <div className="panel" style={{ marginBottom: '22px' }}>
        <div className="panel-head">
          <h2><i className="fa-solid fa-user-clock"></i> اختيار الطالب أو المستخدم للتدقيق</h2>
        </div>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 300px' }}>
              <input
                type="text"
                placeholder="ابحث بالاسم أو البريد الإلكتروني أو الهاتف..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  fetchStudentsList(e.target.value);
                }}
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '13.5px' }}
              />
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <select
                value={userId || ''}
                onChange={e => {
                  if (e.target.value) {
                    setSearchParams({ userId: e.target.value });
                  } else {
                    setSearchParams({});
                  }
                }}
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '13.5px', background: '#fff' }}
              >
                <option value="">-- اختر طالباً من القائمة --</option>
                {students.map(s => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.email}) {s.phone ? ` - ${s.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i>
          <p style={{ marginTop: '12px', color: '#64748b' }}>جاري استخراج السجل الزمني الكامل لنشاط المستخدم...</p>
        </div>
      ) : !timelineData ? (
        <div className="empty" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '60px 20px' }}>
          <i className="fa-solid fa-user-astronaut" style={{ fontSize: '48px', color: '#cbd5e1' }}></i>
          <h3>لم يتم اختيار مستخدم بعد</h3>
          <p>اختر طالباً من القائمة بالأعلى لعرض سجله الزمني، نشاط تسجيل الدخول، والعمليات المنفذة.</p>
        </div>
      ) : (
        <>
          {/* User Profile Summary Header */}
          <div className="panel" style={{ marginBottom: '22px', borderLeft: '4px solid #c81e1e' }}>
            <div className="panel-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#0f172a' }}>
                  <i className="fa-solid fa-user-graduate" style={{ marginLeft: '8px', color: '#c81e1e' }}></i>
                  {timelineData.user?.name}
                </h2>
                <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                  <span><i className="fa-solid fa-envelope"></i> {timelineData.user?.email}</span>
                  {timelineData.user?.phone && <span><i className="fa-solid fa-phone"></i> {timelineData.user?.phone}</span>}
                  <span className={`pill ${timelineData.user?.is_active ? 'p-green' : 'p-red'}`}>
                    {timelineData.user?.is_active ? 'حساب نشط' : 'حساب موقوف'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link to={`/admin/students?id=${timelineData.user?._id}`} className="btn btn-light btn-sm">
                  <i className="fa-solid fa-user-gear"></i> إدارة بيانات الطالب
                </Link>
                <Link to={`/admin/logs?q=${encodeURIComponent(timelineData.user?.email || '')}`} className="btn btn-light btn-sm">
                  <i className="fa-solid fa-magnifying-glass"></i> جميع السجلات الخام
                </Link>
              </div>
            </div>
          </div>

          {/* User Activity KPI Cards */}
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '22px' }}>
            <div className="kpi">
              <span className="ic" style={{ background: '#3b82f6' }}><i className="fa-solid fa-bolt"></i></span>
              <div><strong>{timelineData.stats?.totalActions || 0}</strong><small>إجمالي الأنشطة المسجلة</small></div>
            </div>
            <div className="kpi">
              <span className="ic" style={{ background: '#10b981' }}><i className="fa-solid fa-right-to-bracket"></i></span>
              <div><strong>{timelineData.stats?.successfulLogins || 0}</strong><small>تسجيلات الدخول الناجحة</small></div>
            </div>
            <div className="kpi">
              <span className="ic" style={{ background: '#f59e0b' }}><i className="fa-solid fa-lock"></i></span>
              <div><strong>{timelineData.stats?.failedLogins || 0}</strong><small>محاولات الدخول الفاشلة</small></div>
            </div>
            <div className="kpi">
              <span className="ic" style={{ background: '#ef4444' }}><i className="fa-solid fa-circle-exclamation"></i></span>
              <div><strong>{timelineData.stats?.errors || 0}</strong><small>أخطاء حدثت أثناء التصفح</small></div>
            </div>
            <div className="kpi">
              <span className="ic" style={{ background: '#8b5cf6' }}><i className="fa-solid fa-shield-halved"></i></span>
              <div><strong>{timelineData.stats?.securityAlerts || 0}</strong><small>تنبيهات أمنية مرتبطة</small></div>
            </div>
          </div>

          {/* Security Incidents section if any */}
          {timelineData.incidents && timelineData.incidents.length > 0 && (
            <div className="panel" style={{ marginBottom: '22px', border: '1px solid #fecaca', background: '#fff5f5' }}>
              <div className="panel-head" style={{ borderBottom: '1px solid #fee2e2' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  تنبيهات وحوادث أمنية ارتبطت بهذا الحساب ({timelineData.incidents.length})
                </h3>
              </div>
              <div className="panel-body">
                <div style={{ display: 'grid', gap: '10px' }}>
                  {timelineData.incidents.map((inc, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <strong style={{ color: '#991b1b', fontSize: '14px' }}>{inc.title}</strong>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12.5px' }}>{inc.reason}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="pill p-red">{inc.severity}</span>
                        <span className="pill p-gray">{inc.status}</span>
                        <Link to="/admin/security" className="btn btn-light btn-sm" style={{ fontSize: '11.5px' }}>
                          معاينة في مركز الأمان
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chronological Timeline */}
          <div className="panel">
            <div className="panel-head">
              <h2><i className="fa-solid fa-timeline"></i> الخط الزمني لنشاطات الطالب ({timelineData.timeline?.length || 0})</h2>
            </div>
            <div className="panel-body" style={{ padding: '24px 28px' }}>
              {timelineData.timeline?.length === 0 ? (
                <div className="empty">لا توجد أنشطة مسجلة لهذا المستخدم حتى الآن.</div>
              ) : (
                <div style={{ position: 'relative', borderRight: '2px solid #e2e8f0', marginRight: '16px', paddingRight: '28px', display: 'grid', gap: '22px' }}>
                  {timelineData.timeline.map((item, idx) => {
                    const badge = getActionIcon(item.action, item.category);
                    const isExpanded = !!expandedItems[idx];

                    return (
                      <div key={item._id || idx} style={{ position: 'relative' }}>
                        {/* Timeline Node Dot */}
                        <div
                          style={{
                            position: 'absolute',
                            right: '-41px',
                            top: '4px',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: badge.bg,
                            color: badge.color,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '11px',
                            boxShadow: '0 0 0 4px #fff, 0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          <i className={badge.icon}></i>
                        </div>

                        {/* Content Card */}
                        <div style={{ background: '#fafbfc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', transition: 'box-shadow .2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                            <div>
                              <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.summary}</strong>
                              <span style={{ display: 'inline-block', marginRight: '8px', fontFamily: 'monospace', fontSize: '11.5px', color: '#64748b' }}>
                                [{item.action}]
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              <i className="fa-solid fa-clock" style={{ marginLeft: '4px' }}></i>
                              {new Date(item.timestamp).toLocaleString('ar-EG')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span><i className="fa-solid fa-network-wired"></i> IP: <code>{item.ip}</code></span>
                            {item.method && <span><i className="fa-solid fa-code"></i> {item.method} {item.endpoint}</span>}
                            {item.status_code && <span><i className="fa-solid fa-signal"></i> كود: {item.status_code}</span>}
                            {item.duration_ms > 0 && <span><i className="fa-solid fa-stopwatch"></i> {item.duration_ms}ms</span>}
                          </div>

                          {/* Expandable Details Accordion */}
                          {item.details && Object.keys(item.details).length > 0 && (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleExpand(idx)}
                                style={{ background: 'none', border: 'none', color: '#c81e1e', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                {isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل والبيانات الإضافية'}
                              </button>

                              {isExpanded && (
                                <pre style={{ marginTop: '8px', background: '#0f172a', color: '#e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '11.5px', overflowX: 'auto', maxHeight: '180px' }}>
                                  {JSON.stringify(item.details, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default UserActivityTimeline;
