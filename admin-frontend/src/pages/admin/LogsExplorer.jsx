import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import { getBackendOrigin } from '../../utils/backendUrl';

function LogsExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [traceLogs, setTraceLogs] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 25 });

  // Filters state
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [severity, setSeverity] = useState(searchParams.get('severity') || '');
  const [method, setMethod] = useState(searchParams.get('method') || '');
  const [statusCode, setStatusCode] = useState(searchParams.get('status_code') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || '');
  const [requestIdFilter, setRequestIdFilter] = useState(searchParams.get('request_id') || '');

  const socketRef = useRef(null);

  // Fetch overview metrics
  const fetchOverview = async () => {
    try {
      const res = await api.get('/admin/logs/overview');
      setOverview(res);
    } catch (err) {
      console.error('Failed to load overview:', err);
    }
  };

  // Fetch paginated logs
  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const page = searchParams.get('page') || '1';
      const queryParams = new URLSearchParams({
        page,
        limit: '25',
        ...(q ? { q } : {}),
        ...(category ? { category } : {}),
        ...(severity ? { severity } : {}),
        ...(method ? { method } : {}),
        ...(statusCode ? { status_code: statusCode } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        ...(requestIdFilter ? { request_id: requestIdFilter } : {})
      });

      const res = await api.get(`/admin/logs?${queryParams.toString()}`);
      setLogs(res.logs || []);
      setPagination({
        page: res.page || 1,
        totalPages: res.totalPages || 1,
        total: res.total || 0,
        limit: res.limit || 25
      });
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchLogs();
  }, [searchParams]);

  // Live streaming via Socket.IO
  useEffect(() => {
    const socket = io(getBackendOrigin(), {
      withCredentials: true,
      auth: { isAdmin: true }
    });
    socketRef.current = socket;

    socket.on('new_log', (newLog) => {
      if (isLive) {
        setLogs(prev => [newLog, ...prev.slice(0, 49)]);
        setPagination(prev => ({ ...prev, total: prev.total + 1 }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isLive]);

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (severity) params.severity = severity;
    if (method) params.method = method;
    if (statusCode) params.status_code = statusCode;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (requestIdFilter) params.request_id = requestIdFilter;
    params.page = '1';
    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setQ('');
    setCategory('');
    setSeverity('');
    setMethod('');
    setStatusCode('');
    setDateFrom('');
    setDateTo('');
    setRequestIdFilter('');
    setSearchParams({});
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    const current = Object.fromEntries(searchParams.entries());
    current.page = newPage.toString();
    setSearchParams(current);
  };

  // Trace request correlation
  const handleTraceRequest = async (reqId) => {
    if (!reqId) return;
    setTraceLoading(true);
    try {
      const res = await api.get(`/admin/logs/requests/${reqId}`);
      setTraceLogs(res.logs || []);
    } catch (err) {
      alert('فشل تتبع مسار الطلب: ' + err.message);
    } finally {
      setTraceLoading(false);
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'critical':
        return <span className="pill p-red" style={{ background: '#7f1d1d', color: '#fff', fontWeight: 'bold' }}><i className="fa-solid fa-triangle-exclamation"></i> حرج</span>;
      case 'high':
        return <span className="pill p-red" style={{ fontWeight: 'bold' }}><i className="fa-solid fa-circle-exclamation"></i> عالي</span>;
      case 'medium':
        return <span className="pill" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 'bold' }}><i className="fa-solid fa-circle-dot"></i> متوسط</span>;
      default:
        return <span className="pill p-gray" style={{ color: '#64748b' }}>عادي</span>;
    }
  };

  const getCategoryPill = (cat) => {
    switch (cat) {
      case 'CRITICAL':
        return <span className="pill" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' }}>CRITICAL</span>;
      case 'SECURITY':
        return <span className="pill" style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe' }}>SECURITY</span>;
      case 'ERROR':
        return <span className="pill p-red">ERROR</span>;
      case 'WARNING':
        return <span className="pill" style={{ background: '#fef3c7', color: '#92400e' }}>WARNING</span>;
      case 'SUCCESS':
        return <span className="pill p-green">SUCCESS</span>;
      default:
        return <span className="pill p-blue">INFO</span>;
    }
  };

  const getStatusPill = (status) => {
    if (status >= 500) return <span className="pill p-red">{status}</span>;
    if (status >= 400) return <span className="pill" style={{ background: '#fef3c7', color: '#92400e' }}>{status}</span>;
    if (status >= 300) return <span className="pill p-blue">{status}</span>;
    return <span className="pill p-green">{status}</span>;
  };

  return (
    <AdminLayout title="سجل التدقيق والأنشطة (Logs Explorer)">
      {/* Overview KPI Cards */}
      {overview && (
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '22px' }}>
          <div className="kpi">
            <span className="ic" style={{ background: '#3b82f6' }}><i className="fa-solid fa-list-check"></i></span>
            <div><strong>{overview.totalLogs.toLocaleString()}</strong><small>إجمالي السجلات (24س)</small></div>
          </div>
          <div className="kpi">
            <span className="ic" style={{ background: '#ef4444' }}><i className="fa-solid fa-bug"></i></span>
            <div><strong>{(overview.categories?.ERROR || 0).toLocaleString()}</strong><small>أخطاء التطبيق (Errors)</small></div>
          </div>
          <div className="kpi">
            <span className="ic" style={{ background: '#f59e0b' }}><i className="fa-solid fa-triangle-exclamation"></i></span>
            <div><strong>{(overview.categories?.WARNING || 0).toLocaleString()}</strong><small>تحذيرات النظام (Warnings)</small></div>
          </div>
          <div className="kpi">
            <span className="ic" style={{ background: '#8b5cf6' }}><i className="fa-solid fa-shield-halved"></i></span>
            <div><strong>{((overview.categories?.SECURITY || 0) + (overview.categories?.CRITICAL || 0)).toLocaleString()}</strong><small>أحداث أمنية (Security)</small></div>
          </div>
          <div className="kpi">
            <span className="ic" style={{ background: '#10b981' }}><i className="fa-solid fa-gauge"></i></span>
            <div><strong>{overview.avgLatencyMs} ms</strong><small>متوسط سرعة الاستجابة</small></div>
          </div>
        </div>
      )}

      {/* Main Panel with Filter Bar */}
      <div className="panel">
        <div className="panel-head" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2><i className="fa-solid fa-clock-rotate-left"></i> سجلات النظام والطلبات ({pagination.total.toLocaleString()})</h2>
            <button
              type="button"
              onClick={() => setIsLive(!isLive)}
              className={`btn btn-sm ${isLive ? 'btn-danger' : 'btn-light'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="تفعيل التحديث اللحظي المباشر للسجلات"
            >
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isLive ? '#22c55e' : '#94a3b8', animation: isLive ? 'pulse 1.2s infinite' : 'none' }}></span>
              {isLive ? 'بث مباشر نشط' : 'تشغيل البث المباشر'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fetchLogs()} className="btn btn-light btn-sm" title="تحديث السجلات">
              <i className="fa-solid fa-rotate-right"></i> تحديث
            </button>
            <button type="button" onClick={handleResetFilters} className="btn btn-light btn-sm" title="إعادة ضبط الفلاتر">
              <i className="fa-solid fa-filter-circle-xmark"></i> مسح الفلاتر
            </button>
          </div>
        </div>

        {/* Filters Form */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
          <form onSubmit={handleApplyFilters} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>بحث بالاسم / المسار / IP</label>
              <input
                type="text"
                placeholder="بحث..."
                value={q}
                onChange={e => setQ(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>التصنيف (Category)</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              >
                <option value="">جميع التصنيفات</option>
                <option value="INFO">INFO (نشاط طبيعي)</option>
                <option value="SUCCESS">SUCCESS (عمليات ناجحة)</option>
                <option value="WARNING">WARNING (تحذيرات)</option>
                <option value="ERROR">ERROR (أخطاء الخادم)</option>
                <option value="SECURITY">SECURITY (أحداث أمنية)</option>
                <option value="CRITICAL">CRITICAL (حوادث حرجة)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>الخطورة (Severity)</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              >
                <option value="">جميع المستويات</option>
                <option value="low">منخفض (Low)</option>
                <option value="medium">متوسط (Medium)</option>
                <option value="high">عالي (High)</option>
                <option value="critical">حرج (Critical)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>طريقة الطلب (Method)</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              >
                <option value="">الكل</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>كود الاستجابة (Status)</label>
              <input
                type="number"
                placeholder="200, 401, 500..."
                value={statusCode}
                onChange={e => setStatusCode(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>معرف الطلب (Request ID)</label>
              <input
                type="text"
                placeholder="req_..."
                value={requestIdFilter}
                onChange={e => setRequestIdFilter(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              />
            </div>
            <div>
              <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', height: '36px', justifyContent: 'center' }}>
                <i className="fa-solid fa-magnifying-glass"></i> تطبيق الفلتر
              </button>
            </div>
          </form>
        </div>

        {/* Logs Table */}
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <i className="fa-solid fa-circle-notch fa-spin fa-2x text-red"></i>
              <p style={{ marginTop: '10px', color: '#64748b', fontSize: '13px' }}>جاري تحميل السجلات وتدقيق الأنشطة...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="empty" style={{ padding: '60px 20px' }}>
              <i className="fa-solid fa-folder-open"></i>
              <h3>لا توجد سجلات مطابقة</h3>
              <p>جرّب تعديل الفلاتر أو إزالة كلمات البحث لعرض السجلات.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafb', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>الوقت</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>الخطورة</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>التصنيف</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>العملية / الملخص</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px' }}>المستخدم</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>المسار والطلب</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>الحالة</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>المدة</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>عنوان IP</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background .15s' }}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px', color: '#475569' }}>
                      <span title={new Date(log.timestamp).toLocaleString()}>
                        {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {getSeverityBadge(log.severity)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {getCategoryPill(log.category)}
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.summary}>
                        {log.summary}
                      </strong>
                      <small style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>{log.action}</small>
                    </td>
                    <td>
                      {log.actor ? (
                        <div>
                          <strong style={{ fontSize: '12.5px', color: '#1e293b' }}>{log.actor.name || log.actor_email}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{log.actor_role}</span>
                        </div>
                      ) : log.actor_email ? (
                        <span style={{ fontSize: '12px', color: '#475569' }}>{log.actor_email}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>زائر مجهول</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'left', direction: 'ltr', maxWidth: '240px' }}>
                      <span className="pill p-gray" style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '6px' }}>{log.method}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#334155' }} title={log.url || log.endpoint}>
                        {log.endpoint || log.url}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {getStatusPill(log.status_code)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px', fontFamily: 'monospace', color: log.duration_ms > 800 ? '#dc2626' : '#475569' }}>
                      {log.duration_ms}ms
                    </td>
                    <td style={{ textAlign: 'left', direction: 'ltr', fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>
                      {log.ip}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-light btn-sm"
                        onClick={() => setSelectedLog(log)}
                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px' }}
                        title="عرض كامل التفاصيل والمعلومات"
                      >
                        <i className="fa-solid fa-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              صفحة {pagination.page} من {pagination.totalPages} (إجمالي {pagination.total.toLocaleString()} سجل)
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-light btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <i className="fa-solid fa-angle-right"></i> السابق
              </button>
              <button
                type="button"
                className="btn btn-light btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                التالي <i className="fa-solid fa-angle-left"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Log Details Modal */}
      {selectedLog && (
        <div
          className="modal"
          onClick={e => { if (e.target === e.currentTarget) setSelectedLog(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '16px' }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-file-lines text-red"></i> تفاصيل سجل النشاط: <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#64748b' }}>{selectedLog.request_id}</span>
              </h3>
              <button className="btn-icon" onClick={() => setSelectedLog(null)} title="إغلاق"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="panel-body">
              {/* Status and Category Summary */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                {getCategoryPill(selectedLog.category)}
                {getSeverityBadge(selectedLog.severity)}
                {getStatusPill(selectedLog.status_code)}
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  <i className="fa-solid fa-stopwatch" style={{ marginLeft: '4px' }}></i> {selectedLog.duration_ms} مللي ثانية
                </span>
                <span style={{ fontSize: '12.5px', color: '#64748b', marginRight: 'auto' }}>
                  <i className="fa-solid fa-calendar-days" style={{ marginLeft: '4px' }}></i> {new Date(selectedLog.timestamp).toLocaleString('ar-EG')}
                </span>
              </div>

              {/* Action Description */}
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>{selectedLog.summary}</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>نوع العملية (Action): <code style={{ fontFamily: 'monospace', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{selectedLog.action}</code></span>
              </div>

              {/* Request Info Grid */}
              <dl className="dl" style={{ gridTemplateColumns: '130px 1fr', fontSize: '13.5px', marginBottom: '16px' }}>
                <dt>معرف الطلب (ID):</dt>
                <dd style={{ fontFamily: 'monospace', fontSize: '12.5px' }}>{selectedLog.request_id}</dd>

                <dt>طريقة الطلب والمسار:</dt>
                <dd dir="ltr" style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  <strong>{selectedLog.method}</strong> {selectedLog.url || selectedLog.endpoint}
                </dd>

                <dt>عنوان IP:</dt>
                <dd style={{ fontFamily: 'monospace' }}>{selectedLog.ip}</dd>

                <dt>المستخدم:</dt>
                <dd>
                  {selectedLog.actor ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>{selectedLog.actor.name || selectedLog.actor.email}</strong>
                      <span className="pill p-gray" style={{ fontSize: '11px' }}>{selectedLog.actor_role}</span>
                      <Link
                        to={`/admin/user-activity?userId=${selectedLog.actor._id || selectedLog.actor}`}
                        className="btn btn-light btn-sm"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        سجل نشاط المستخدم <i className="fa-solid fa-arrow-left"></i>
                      </Link>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>زائر غير مسجل (مجهول)</span>
                  )}
                </dd>

                <dt>متصفح العميل:</dt>
                <dd style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-all' }}>{selectedLog.user_agent || 'غير معروف'}</dd>
              </dl>

              {/* Sanitized Details / Metadata */}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                    <i className="fa-solid fa-code" style={{ marginLeft: '6px', color: '#c81e1e' }}></i>
                    البيانات المفحوصة والمطهرة (Sanitized Metadata):
                  </label>
                  <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '14px', borderRadius: '10px', fontSize: '12px', overflowX: 'auto', maxHeight: '200px' }}>
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={() => handleTraceRequest(selectedLog.request_id)}
                  disabled={traceLoading}
                >
                  <i className="fa-solid fa-diagram-project"></i> تتبع مسار هذا الطلب (Request Trace)
                </button>
                <button type="button" className="btn btn-dark btn-sm" onClick={() => setSelectedLog(null)}>
                  إغلاق
                </button>
              </div>

              {/* Trace Logs Display */}
              {traceLogs && (
                <div style={{ marginTop: '20px', borderTop: '2px dashed #cbd5e1', paddingTop: '14px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '10px', color: '#0f172a' }}>
                    مسار الأحداث المرتبطة بنفس الطلب ({traceLogs.length}):
                  </h4>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {traceLogs.map((tl, i) => (
                      <div key={i} style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: '#1e293b' }}>{tl.action}</strong> - <span style={{ color: '#64748b' }}>{tl.summary}</span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(tl.timestamp).toLocaleTimeString('ar-EG')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default LogsExplorer;
