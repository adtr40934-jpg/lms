import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import { getBackendOrigin } from '../../utils/backendUrl';

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Connect to backend for real-time updates
    const socket = io(getBackendOrigin(), {
      withCredentials: true,
      auth: { isAdmin: true }
    });
    
    socket.on('data_updated', () => {
      fetchData();
    });

    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AdminLayout title="لوحة المعلومات"><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  const { stats, recentOrders, recentStudents, topCourses } = data || {};
  const maxN = Math.max(...(topCourses || []).map(c => c.count), 1);

  const kpis = [
    { icon: 'fa-solid fa-user-graduate', color: '#111', value: stats?.students || 0, label: 'طالب مسجل' },
    { icon: 'fa-solid fa-book-open', color: '#c81e1e', value: stats?.courses || 0, label: 'كورس' },
    { icon: 'fa-solid fa-hourglass-half', color: '#f59e0b', value: stats?.pendingOrders || 0, label: 'طلب قيد المراجعة' },
    { icon: 'fa-solid fa-sack-dollar', color: '#16a34a', value: stats?.revenue || 0, label: 'إجمالي المقبول (بالدولار $)' },
  ];

  return (
    <AdminLayout title="لوحة المعلومات">
      <h3 style={{ marginBottom: '15px' }}>إحصائيات المنصة</h3>
      <div className="cards">
        {kpis.map((s, i) => (
          <div key={i} className="kpi">
            <span className="ic" style={{ background: s.color }}><i className={s.icon}></i></span>
            <div><strong>{s.value}</strong><small>{s.label}</small></div>
          </div>
        ))}
      </div>
      <div className="grid-3">
        <div className="panel">
          <div className="panel-head">
            <h2><i className="fa-solid fa-receipt"></i> أحدث طلبات الاشتراك</h2>
            <Link to="/admin/orders" className="btn btn-light btn-sm">عرض الكل</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>الطالب</th><th>الكورس</th><th>المبلغ</th><th>الحالة</th><th></th></tr>
              </thead>
              <tbody>
                {recentOrders && recentOrders.map(o => (
                  <tr key={o._id}>
                    <td><span className="ltr" style={{fontSize: '11px'}}>{o._id.slice(-6)}</span></td>
                    <td>{o.full_name}<span className="sub ltr">{o.phone}</span></td>
                    <td>{o.course?.title}</td>
                    <td>{o.amount} $<span className="sub">{o.payment_method === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}</span></td>
                    <td><span className={`pill st-${o.status}`}>{o.status === 'pending' ? 'قيد المراجعة' : o.status === 'approved' ? 'مقبول' : 'مرفوض'}</span></td>
                    <td><Link to={`/admin/orders?id=${o._id}`} className="btn btn-light btn-sm">مراجعة</Link></td>
                  </tr>
                ))}
                {(!recentOrders || recentOrders.length === 0) && (
                  <tr><td colSpan="6" className="empty">لا توجد طلبات بعد</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="panel">
            <div className="panel-head"><h2><i className="fa-solid fa-chart-simple"></i> الكورسات حسب المشتركين</h2></div>
            <div className="panel-body">
              {topCourses && topCourses.map((t, i) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px' }}>
                    <span>{t.title}</span><span>{t.count}</span>
                  </div>
                  <div style={{ height: '8px', background: '#f0f1f3', borderRadius: '9px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((t.count / maxN) * 100)}%`, background: 'linear-gradient(90deg,#c81e1e,#8b0000)', borderRadius: '9px' }}></div>
                  </div>
                </div>
              ))}
              {(!topCourses || topCourses.length === 0) && <p className="muted">لا توجد اشتراكات بعد</p>}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2><i className="fa-solid fa-user-plus"></i> أحدث الطلاب</h2>
              <Link to="/admin/students" className="btn btn-light btn-sm">الكل</Link>
            </div>
            <div className="panel-body" style={{ padding: '8px 20px' }}>
              {recentStudents && recentStudents.map(s => (
                <Link key={s._id} to={`/admin/students?id=${s._id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f3f3f5' }}>
                  <strong>{s.name}</strong><small className="muted">{new Date(s.created_at).toLocaleDateString()}</small>
                </Link>
              ))}
              {(!recentStudents || recentStudents.length === 0) && <p className="muted" style={{ padding: '12px 0' }}>لا يوجد طلاب بعد</p>}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminDashboard;
