import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import { getBackendOrigin } from '../../utils/backendUrl';

function DetailedStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveStats, setLiveStats] = useState({ activeConnections: 0, totalVisitorsToday: 0, countries: {}, loggedStudents: 0 });

  useEffect(() => {
    fetchData();

    // Connect to backend for real-time live stats
    const socket = io(getBackendOrigin(), {
      withCredentials: true,
      auth: { isAdmin: true }
    });

    socket.on('live_stats', (stats) => {
      setLiveStats(stats);
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
      if (res?.liveStats) {
        setLiveStats(prev => ({ ...prev, ...res.liveStats }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AdminLayout title="التحليلات المتقدمة"><div style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></div></AdminLayout>;

  return (
    <AdminLayout title="التحليلات المتقدمة">
      {/* Live Statistics Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', animation: 'pulse 1.5s infinite' }}></span>
        <h3 style={{ margin: 0 }}>الإحصائيات المباشرة (الآن)</h3>
      </div>
      <div className="cards" style={{ marginBottom: '25px' }}>
        <div className="kpi" style={{ border: '1px solid #10b981' }}>
          <span className="ic" style={{ background: '#10b981' }}><i className="fa-solid fa-wifi"></i></span>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><strong>{liveStats.activeConnections}</strong><small>إجمالي المتصلين الآن</small></div>
            <div style={{ textAlign: 'left' }}><strong>{liveStats.loggedStudents || 0}</strong><small>طلاب مسجلين الدخول</small></div>
          </div>
        </div>
        <div className="kpi">
          <span className="ic" style={{ background: '#3b82f6' }}><i className="fa-solid fa-eye"></i></span>
          <div><strong>{liveStats.totalVisitorsToday}</strong><small>إجمالي الزيارات اليوم</small></div>
        </div>
        <div className="kpi" style={{ gridColumn: 'span 2' }}>
          <span className="ic" style={{ background: '#8b5cf6' }}><i className="fa-solid fa-earth-americas"></i></span>
          <div style={{ flex: 1 }}>
            <strong>البلدان الحالية</strong>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
              {Object.keys(liveStats.countries || {}).length === 0 ? <small style={{ color: '#888' }}>لا يوجد متصلين حالياً</small> : 
                Object.entries(liveStats.countries).map(([country, count]) => (
                  <span key={country} className="pill p-blue" style={{ fontSize: '12px' }}>{country}: {count}</span>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: '15px' }}>تحليل الأداء (آخر 7 أيام)</h3>
      <div className="grid-2" style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="panel">
          <div className="panel-head"><h2><i className="fa-solid fa-chart-line"></i> الإيرادات والمبيعات</h2></div>
          <div className="panel-body" style={{ height: '400px', direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="الإيرادات ($)" stroke="#16a34a" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2><i className="fa-solid fa-users"></i> التسجيلات والطلبات الجديدة</h2></div>
          <div className="panel-body" style={{ height: '400px', direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="students" name="التسجيلات" fill="#3b82f6" />
                <Bar dataKey="orders" name="الطلبات" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default DetailedStats;
