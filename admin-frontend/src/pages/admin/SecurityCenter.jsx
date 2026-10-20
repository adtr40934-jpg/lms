import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import { getBackendOrigin } from '../../utils/backendUrl';

function SecurityCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'incidents');

  const [overview, setOverview] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Filters
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Active Incident Modal
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [relatedLogs, setRelatedLogs] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState('investigating');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Live alert banner
  const [liveAlert, setLiveAlert] = useState(null);

  useEffect(() => {
    fetchOverview();
    fetchRules();
  }, []);

  useEffect(() => {
    if (activeTab === 'incidents') {
      fetchIncidents();
    }
  }, [activeTab, statusFilter, severityFilter, searchQuery, searchParams.get('page')]);

  // Real-time Socket.IO alert listener
  useEffect(() => {
    const socket = io(getBackendOrigin(), {
      withCredentials: true,
      auth: { isAdmin: true }
    });

    socket.on('security_alert', (incident) => {
      setLiveAlert(incident);
      fetchOverview();
      if (activeTab === 'incidents') {
        fetchIncidents(true);
      }
    });

    return () => socket.disconnect();
  }, [activeTab]);

  const fetchOverview = async () => {
    try {
      const res = await api.get('/admin/security/overview');
      setOverview(res);
    } catch (err) {
      console.error('Failed to fetch security overview:', err);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await api.get('/admin/security/rules');
      setRules(res || []);
    } catch (err) {
      console.error('Failed to fetch security rules:', err);
    }
  };

  const fetchIncidents = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const page = searchParams.get('page') || '1';
      const qParams = new URLSearchParams({
        page,
        limit: '20',
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(severityFilter ? { severity: severityFilter } : {}),
        ...(searchQuery ? { q: searchQuery } : {})
      });

      const res = await api.get(`/admin/security/incidents?${qParams.toString()}`);
      setIncidents(res.incidents || []);
      setPagination({
        page: res.page || 1,
        totalPages: res.totalPages || 1,
        total: res.total || 0
      });
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenIncident = async (incident) => {
    setSelectedIncident(incident);
    setResolutionStatus(incident.status);
    setResolutionNotes(incident.resolution_notes || '');
    setModalLoading(true);
    try {
      const res = await api.get(`/admin/security/incidents/${incident.incident_id || incident._id}`);
      setSelectedIncident(res.incident || incident);
      setRelatedLogs(res.relatedLogs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateIncidentStatus = async (e) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/admin/security/incidents/${selectedIncident.incident_id || selectedIncident._id}/status`, {
        status: resolutionStatus,
        resolution_notes: resolutionNotes
      });
      alert(res.message || 'تم تحديث حالة الحادث بنجاح');
      setSelectedIncident(res.incident);
      fetchOverview();
      fetchIncidents(true);
    } catch (err) {
      alert(err.message || 'فشل تحديث حالة الحادث');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      const res = await api.patch(`/admin/security/rules/${rule.rule_id || rule._id}`, {
        enabled: !rule.enabled
      });
      setRules(prev => prev.map(r => r._id === rule._id ? res.rule : r));
    } catch (err) {
      alert('فشل تعديل حالة القاعدة: ' + err.message);
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'critical':
        return <span className="pill" style={{ background: '#7f1d1d', color: '#fff', fontWeight: 'bold' }}><i className="fa-solid fa-radiation"></i> حرج جداً (Critical)</span>;
      case 'high':
        return <span className="pill p-red" style={{ fontWeight: 'bold' }}><i className="fa-solid fa-triangle-exclamation"></i> عالي (High)</span>;
      case 'medium':
        return <span className="pill" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 'bold' }}><i className="fa-solid fa-circle-dot"></i> متوسط (Medium)</span>;
      default:
        return <span className="pill p-gray">منخفض (Low)</span>;
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'open':
        return <span className="pill p-red"><i className="fa-solid fa-bell"></i> مفتوح جديد</span>;
      case 'investigating':
        return <span className="pill" style={{ background: '#fef3c7', color: '#92400e' }}><i className="fa-solid fa-magnifying-glass"></i> قيد التحقيق</span>;
      case 'resolved':
        return <span className="pill p-green"><i className="fa-solid fa-circle-check"></i> تم الحل</span>;
      case 'false_positive':
        return <span className="pill p-gray"><i className="fa-solid fa-circle-xmark"></i> بلاغ خاطئ</span>;
      default:
        return <span className="pill p-gray">{st}</span>;
    }
  };

  return (
    <AdminLayout title="مركز المراقبة والأمان (Security Operations Center)">
      {/* Real-time Alert Notification Banner */}
      {liveAlert && (
        <div style={{ background: '#7f1d1d', color: '#fff', borderRadius: '12px', padding: '14px 20px', marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 20px rgba(127,29,29,0.3)', animation: 'pulse 2s infinite' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '24px', color: '#fca5a5' }}></i>
            <div>
              <strong style={{ fontSize: '15px' }}>تنبيه أمني جديد: {liveAlert.title}</strong>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#fecaca' }}>
                المصدر: {liveAlert.source_ip} | السبب: {liveAlert.reason}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => { handleOpenIncident(liveAlert); setLiveAlert(null); }}
              style={{ background: '#fff', color: '#7f1d1d', fontWeight: 'bold' }}
            >
              فحص الحادث فوراً
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setLiveAlert(null)}
              style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {overview && (
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: '22px' }}>
          <div className="kpi" style={{ border: overview.openCount > 0 ? '1.5px solid #ef4444' : '1px solid #e2e8f0' }}>
            <span className="ic" style={{ background: '#ef4444' }}><i className="fa-solid fa-fire"></i></span>
            <div><strong>{overview.openCount}</strong><small>حوادث مفتوحة تتطلب تدخلاً</small></div>
          </div>
          <div className="kpi">
            <span className="ic" style={{ background: '#7f1d1d' }}><i className="fa-solid fa-radiation"></i></span>
            <div><strong>{overview.criticalCount}</strong><small>تهديدات حرجة (Critical)</small></div>
          </div>
          <div className="kpi">
            <span className="ic" style={{ background: '#f59e0b' }}><i className="fa-solid fa-user-secret"></i></span>
            <div><strong>{overview.investigatingCount}</strong><small>قيد الفحص والتحقيق</small></div>
          </div>
          <div className="kpi">
            <span className="ic" style={{ background: '#10b981' }}><i className="fa-solid fa-circle-check"></i></span>
            <div><strong>{overview.resolvedCount}</strong><small>حوادث تم حلها وتأمينها</small></div>
          </div>
          <div className="kpi">
            <span className="ic" style={{ background: '#3b82f6' }}><i className="fa-solid fa-shield-halved"></i></span>
            <div><strong>{rules.filter(r => r.enabled).length} / {rules.length}</strong><small>قواعد الحماية المفعلة</small></div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('incidents')}
          className={`btn btn-sm ${activeTab === 'incidents' ? 'btn-primary' : 'btn-light'}`}
          style={{ fontSize: '13.5px', borderRadius: '10px' }}
        >
          <i className="fa-solid fa-list-check"></i> قائمة الحوادث الأمنية ({pagination.total || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-light'}`}
          style={{ fontSize: '13.5px', borderRadius: '10px' }}
        >
          <i className="fa-solid fa-chart-line"></i> التحليلات ومخططات التهديدات
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`btn btn-sm ${activeTab === 'rules' ? 'btn-primary' : 'btn-light'}`}
          style={{ fontSize: '13.5px', borderRadius: '10px' }}
        >
          <i className="fa-solid fa-sliders"></i> قواعد الحماية والمراقبة ({rules.length})
        </button>
      </div>

      {/* TAB 1: INCIDENTS TABLE */}
      {activeTab === 'incidents' && (
        <div className="panel">
          <div className="panel-head" style={{ gap: '14px' }}>
            <h2><i className="fa-solid fa-shield-virus"></i> الحوادث الأمنية المسجلة</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="بحث برقم الحادث أو IP أو الإيميل..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
              >
                <option value="">جميع الحالات</option>
                <option value="open">مفتوح جديد (Open)</option>
                <option value="investigating">قيد التحقيق (Investigating)</option>
                <option value="resolved">تم الحل (Resolved)</option>
                <option value="false_positive">بلاغ خاطئ (False Positive)</option>
              </select>
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
              >
                <option value="">جميع المستويات</option>
                <option value="critical">حرج جداً</option>
                <option value="high">عالي</option>
                <option value="medium">متوسط</option>
                <option value="low">منخفض</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <i className="fa-solid fa-circle-notch fa-spin fa-2x text-red"></i>
                <p style={{ marginTop: '10px', color: '#64748b' }}>جاري استرجاع الحوادث الأمنية...</p>
              </div>
            ) : incidents.length === 0 ? (
              <div className="empty" style={{ padding: '60px 20px' }}>
                <i className="fa-solid fa-shield-check" style={{ color: '#10b981' }}></i>
                <h3>المنظومة آمنة - لا توجد حوادث أمنية مطابقة</h3>
                <p>جميع الطلبات الواردة تتوافق مع القواعد والمعايير الأمنية المعتمدة.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafb', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'right', padding: '12px 14px' }}>رقم الحادث</th>
                    <th style={{ textAlign: 'center', padding: '12px 14px' }}>الخطورة</th>
                    <th style={{ textAlign: 'right', padding: '12px 14px' }}>نوع التهديد / القاعدة</th>
                    <th style={{ textAlign: 'left', padding: '12px 14px' }}>عنوان IP المصدر</th>
                    <th style={{ textAlign: 'center', padding: '12px 14px' }}>التكرار</th>
                    <th style={{ textAlign: 'right', padding: '12px 14px' }}>المستهدف</th>
                    <th style={{ textAlign: 'right', padding: '12px 14px' }}>آخر رصد</th>
                    <th style={{ textAlign: 'center', padding: '12px 14px' }}>الحالة</th>
                    <th style={{ textAlign: 'center', padding: '12px 14px' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr key={inc._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>
                        {inc.incident_id}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {getSeverityBadge(inc.severity)}
                      </td>
                      <td>
                        <strong style={{ fontSize: '13.5px', color: '#1e293b', display: 'block' }}>{inc.title}</strong>
                        <small style={{ color: '#64748b', fontSize: '11.5px' }}>{inc.reason}</small>
                      </td>
                      <td style={{ textAlign: 'left', direction: 'ltr', fontFamily: 'monospace', color: '#334155' }}>
                        {inc.source_ip}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge" style={{ background: inc.occurrence_count > 5 ? '#ef4444' : '#64748b' }}>
                          {inc.occurrence_count}x
                        </span>
                      </td>
                      <td>
                        {inc.target_user ? (
                          <span style={{ fontSize: '13px' }}>{inc.target_user.name || inc.user_email}</span>
                        ) : inc.user_email ? (
                          <span style={{ fontSize: '12.5px', color: '#64748b' }}>{inc.user_email}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>غير محدد</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#64748b' }}>
                        {new Date(inc.last_seen).toLocaleString('ar-EG')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {getStatusBadge(inc.status)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenIncident(inc)}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          <i className="fa-solid fa-magnifying-glass"></i> تحقيق
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ANALYTICS & CHARTS */}
      {activeTab === 'analytics' && overview && (
        <div style={{ display: 'grid', gap: '22px' }}>
          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-chart-pie"></i> توزيع الحوادث حسب القواعد المكتشفة</h2>
              </div>
              <div className="panel-body">
                {overview.topRules?.length === 0 ? (
                  <div className="empty">لا توجد بيانات كافية للرسم البياني</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={overview.topRules}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="title" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#c81e1e" radius={[6, 6, 0, 0]} name="عدد المرات" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2><i className="fa-solid fa-network-wired"></i> أكثر عناوين IP المشبوهة تكراراً</h2>
              </div>
              <div className="panel-body">
                {overview.topOffenders?.length === 0 ? (
                  <div className="empty">لا توجد سجلات هجوم من عناوين IP</div>
                ) : (
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>عنوان IP</th>
                        <th style={{ textAlign: 'center' }}>عدد الحوادث</th>
                        <th style={{ textAlign: 'center' }}>إجمالي التكرار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.topOffenders.map((o, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'left', direction: 'ltr', fontFamily: 'monospace' }}><strong>{o.ip}</strong></td>
                          <td style={{ textAlign: 'center' }}><span className="pill p-red">{o.incidents}</span></td>
                          <td style={{ textAlign: 'center' }}><strong style={{ color: '#991b1b' }}>{o.count}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DETECTION RULES CONFIGURATION */}
      {activeTab === 'rules' && (
        <div className="panel">
          <div className="panel-head">
            <h2><i className="fa-solid fa-shield"></i> محرك وقواعد الكشف عن التهديدات (Detection Rules Engine)</h2>
          </div>
          <div className="table-wrap">
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#fafafb' }}>
                  <th style={{ textAlign: 'right' }}>معرف القاعدة</th>
                  <th style={{ textAlign: 'right' }}>اسم القاعدة والوصف</th>
                  <th style={{ textAlign: 'center' }}>الخطورة</th>
                  <th style={{ textAlign: 'center' }}>الحد المسموح (Threshold)</th>
                  <th style={{ textAlign: 'center' }}>نافذة الوقت (Time Window)</th>
                  <th style={{ textAlign: 'center' }}>الحالة</th>
                  <th style={{ textAlign: 'center' }}>تفعيل / تعطيل</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12.5px', color: '#0f172a' }}>
                      {rule.rule_id}
                    </td>
                    <td>
                      <strong style={{ fontSize: '13.5px', color: '#1e293b' }}>{rule.name}</strong>
                      <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '12px' }}>{rule.description}</p>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {getSeverityBadge(rule.severity)}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {rule.threshold} مرات
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12.5px', color: '#64748b' }}>
                      {Math.round(rule.time_window_seconds / 60)} دقيقة
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`pill ${rule.enabled ? 'p-green' : 'p-gray'}`}>
                        {rule.enabled ? 'مفعلة ونشطة' : 'معطلة'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule)}
                        className={`btn btn-sm ${rule.enabled ? 'btn-danger' : 'btn-success'}`}
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                      >
                        {rule.enabled ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incident Investigation Modal */}
      {selectedIncident && (
        <div
          className="modal"
          onClick={e => { if (e.target === e.currentTarget) setSelectedIncident(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-shield-halved text-red"></i> التحقيق في الحادث: <span style={{ fontFamily: 'monospace', color: '#c81e1e' }}>{selectedIncident.incident_id}</span>
              </h3>
              <button className="btn-icon" onClick={() => setSelectedIncident(null)} title="إغلاق"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="panel-body">
              {modalLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-2x text-red"></i></div>
              ) : (
                <>
                  {/* Status and Severity Badges */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {getSeverityBadge(selectedIncident.severity)}
                    {getStatusBadge(selectedIncident.status)}
                    <span className="pill p-blue" style={{ fontSize: '12px' }}>
                      تكرر {selectedIncident.occurrence_count} مرات
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#64748b', marginRight: 'auto' }}>
                      أول رصد: {new Date(selectedIncident.first_seen).toLocaleString('ar-EG')}
                    </span>
                  </div>

                  {/* Summary Box */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                    <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>{selectedIncident.title}</strong>
                    <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>{selectedIncident.reason}</p>
                  </div>

                  {/* Source and Evidence Details */}
                  <dl className="dl" style={{ gridTemplateColumns: '130px 1fr', fontSize: '13.5px', marginBottom: '16px' }}>
                    <dt>عنوان IP المصدر:</dt>
                    <dd style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{selectedIncident.source_ip}</dd>

                    <dt>المستخدم المستهدف:</dt>
                    <dd>
                      {selectedIncident.target_user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong>{selectedIncident.target_user.name}</strong> ({selectedIncident.target_user.email})
                          <Link to={`/admin/user-activity?userId=${selectedIncident.target_user._id}`} className="btn btn-light btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }}>
                            سجل نشاط المستخدم <i className="fa-solid fa-arrow-left"></i>
                          </Link>
                        </div>
                      ) : selectedIncident.user_email ? (
                        <span>{selectedIncident.user_email}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>غير محدد (هجوم على مستوى المنظومة)</span>
                      )}
                    </dd>

                    <dt>متصفح العميل:</dt>
                    <dd style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-all' }}>{selectedIncident.user_agent || 'غير متوفر'}</dd>
                  </dl>

                  {/* Evidence Payload */}
                  {selectedIncident.evidence && Object.keys(selectedIncident.evidence).length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                        <i className="fa-solid fa-fingerprint" style={{ marginLeft: '6px', color: '#c81e1e' }}></i>
                        الدليل الجنائي المشفر والمطهر (Sanitized Forensic Evidence):
                      </label>
                      <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '14px', borderRadius: '10px', fontSize: '12px', overflowX: 'auto', maxHeight: '180px' }}>
                        {JSON.stringify(selectedIncident.evidence, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Related Requests */}
                  {selectedIncident.request_ids && selectedIncident.request_ids.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                        معرفات الطلبات المرتبطة ({selectedIncident.request_ids.length}):
                      </label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {selectedIncident.request_ids.map((rid, i) => (
                          <Link
                            key={i}
                            to={`/admin/logs?request_id=${rid}`}
                            className="btn btn-light btn-sm"
                            style={{ fontFamily: 'monospace', fontSize: '11.5px', padding: '3px 8px' }}
                            title="عرض هذا الطلب في Logs Explorer"
                          >
                            {rid} <i className="fa-solid fa-arrow-up-right-from-square"></i>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution Form */}
                  <form onSubmit={handleUpdateIncidentStatus} style={{ background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '16px', marginTop: '20px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>
                      <i className="fa-solid fa-gavel"></i> اتخاذ إجراء وتحديث حالة الحادث
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>تحديث الحالة إلى:</label>
                        <select
                          value={resolutionStatus}
                          onChange={e => setResolutionStatus(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                        >
                          <option value="open">مفتوح (Open)</option>
                          <option value="investigating">قيد التحقيق (Investigating)</option>
                          <option value="resolved">تم الحل والتأمين (Resolved)</option>
                          <option value="false_positive">بلاغ خاطئ (False Positive)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>ملاحظات التحقيق والإجراء المتخذ:</label>
                        <input
                          type="text"
                          placeholder="مثال: تم فحص العنوان وحظر IP / تأكيد الطلب السليم..."
                          value={resolutionNotes}
                          onChange={e => setResolutionNotes(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button type="submit" disabled={updatingStatus} className="btn btn-primary btn-sm">
                        {updatingStatus ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>} حفظ القرار والإجراء
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default SecurityCenter;
