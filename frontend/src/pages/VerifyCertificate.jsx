import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePageReady } from '../hooks/usePageReady';
import { api } from '../api';
import SEO from '../components/common/SEO';

function VerifyCertificate() {
  const { id } = useParams();
  const [certIdInput, setCertIdInput] = useState(id || '');
  const [loading, setLoading] = useState(!!id);
  const [result, setResult] = useState(null);
  const [searchedId, setSearchedId] = useState(id || '');

  usePageReady(true);

  useEffect(() => {
    if (id) {
      verify(id);
    }
  }, [id]);

  const verify = async (targetId) => {
    const cleanId = (targetId || '').trim();
    if (!cleanId) return;

    setLoading(true);
    setResult(null);
    setSearchedId(cleanId);

    try {
      const res = await api.get(`/certificates/verify/${cleanId}`);
      setResult(res);
    } catch (err) {
      setResult({
        valid: false,
        status: 'not_found',
        message: err.message || 'الشهادة غير موجودة في سجلات المنصة الرسمية'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (certIdInput.trim()) {
      verify(certIdInput.trim());
    }
  };

  return (
    <div className="verify-page-wrap" style={{ minHeight: '85vh', background: '#0b0f19', color: '#fff', padding: '40px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
      <SEO
        title="التحقق من صحة الشهادة"
        description="أداة فحص والتحقق من صحة الشهادات التدريبية الصادرة من منصة محمد بهاء التعليمية."
        canonical="/verify-certificate"
        robots="noindex, follow"
      />

      <style>{`
        .verify-search-box {
          display: flex;
          background: #12141a;
          border: 1.5px solid #23232b;
          borderRadius: 12px;
          padding: 6px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          width: 100%;
          box-sizing: border-box;
        }
        .verify-card-header {
          padding: 18px 22px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .verify-card-body {
          padding: 22px;
        }
        @media (max-width: 640px) {
          .verify-card-header {
            padding: 14px 16px;
            gap: 10px;
          }
          .verify-card-body {
            padding: 16px 14px;
          }
          .verify-title {
            font-size: 22px !important;
          }
          .verify-header-text {
            font-size: 16px !important;
          }
          .verify-search-btn span {
            display: inline;
          }
        }
        @media (max-width: 440px) {
          .verify-search-box {
            flex-direction: column;
            gap: 6px;
            padding: 8px;
          }
          .verify-search-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: '650px', marginBottom: '32px', width: '100%' }}>
        <h1 className="verify-title" style={{ fontSize: '28px', fontWeight: '900', color: '#fff', margin: '0 0 10px' }}>
          التحقق من صحة الشهادات
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14.5px', margin: 0, lineHeight: 1.5 }}>
          أدخل رقم الشهادة أو قم بمسح الـ QR Code للتحقق الفوري من مصداقيتها واعتمادها في السجلات الرسمية
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} style={{ width: '100%', maxWidth: '580px', marginBottom: '36px' }}>
        <div className="verify-search-box" style={{ borderRadius: '12px' }}>
          <input
            type="text"
            placeholder="مثال: CERT-XXXX-XXXX"
            value={certIdInput}
            onChange={(e) => setCertIdInput(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '700',
              padding: '10px 14px',
              fontFamily: 'monospace',
              letterSpacing: '1px',
              minWidth: 0
            }}
          />
          <button
            type="submit"
            className="btn btn-primary verify-search-btn"
            disabled={loading}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '800',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #c81e1e 0%, #991515 100%)',
              cursor: loading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
            <span>فحص الشهادة</span>
          </button>
        </div>
      </form>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x" style={{ color: '#d4af37' }}></i>
          <p style={{ marginTop: '16px', fontSize: '15px', fontWeight: 'bold' }}>جاري مطابقة بيانات الشهادة مع سجلات قاعدة البيانات...</p>
        </div>
      )}

      {/* Result Display Card */}
      {!loading && result && (
        <div style={{ width: '100%', maxWidth: '640px' }}>
          {result.status === 'active' && result.valid && (
            <div style={{
              background: '#12141a',
              border: '1.5px solid #10b981',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(16,185,129,0.15)',
              boxSizing: 'border-box'
            }}>
              {/* Status Header */}
              <div className="verify-card-header" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontSize: '22px', flexShrink: 0 }}>
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div>
                  <h3 className="verify-header-text" style={{ margin: 0, color: '#10b981', fontSize: '18px', fontWeight: '900', lineHeight: 1.3 }}>
                    شهادة رسمية معتمدة وسارية المفعول
                  </h3>
                  <small style={{ color: '#94a3b8', fontSize: '12.5px' }}>
                    تم التحقق من صحة ومطابقة الشهادة بنجاح
                  </small>
                </div>
              </div>

              {/* Data Table */}
              <div className="verify-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '14px' }}>

                  <div style={{ background: '#181b24', padding: '14px 16px', borderRadius: '10px', border: '1px solid #282c38', wordBreak: 'break-word' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>اسم المتدرب:</span>
                    <strong style={{ fontSize: '17px', color: '#fff', fontWeight: '900' }}>{result.certificate?.student_name}</strong>
                  </div>

                  <div style={{ background: '#181b24', padding: '14px 16px', borderRadius: '10px', border: '1px solid #282c38', wordBreak: 'break-word' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>اسم الدورة التدريبية:</span>
                    <strong style={{ fontSize: '15px', color: '#d4af37', fontWeight: '800' }}>{result.certificate?.course_title}</strong>
                  </div>

                  <div style={{ background: '#181b24', padding: '14px 16px', borderRadius: '10px', border: '1px solid #282c38', wordBreak: 'break-all' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>رقم الشهادة المعتمد:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#fff', fontWeight: '900', letterSpacing: '0.5px' }}>
                      {result.certificate?.certificate_id}
                    </span>
                  </div>

                  <div style={{ background: '#181b24', padding: '14px 16px', borderRadius: '10px', border: '1px solid #282c38' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>تاريخ الإصدار:</span>
                    <strong style={{ fontSize: '13.5px', color: '#fff' }}>
                      {new Date(result.certificate?.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </strong>
                  </div>

                  <div style={{ background: '#181b24', padding: '14px 16px', borderRadius: '10px', border: '1px solid #282c38' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>المدرب والمحاضر:</span>
                    <strong style={{ fontSize: '13.5px', color: '#fff' }}>{result.certificate?.instructor_name}</strong>
                  </div>

                  <div style={{ background: '#181b24', padding: '14px 16px', borderRadius: '10px', border: '1px solid #282c38' }}>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>الجهة المانحة:</span>
                    <strong style={{ fontSize: '13.5px', color: '#fff' }}>{result.certificate?.issuer_name}</strong>
                  </div>

                </div>

                {result.certificate?.image_url && (
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <a
                      href={result.certificate.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{ padding: '10px 22px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px', maxWidth: '100%', boxSizing: 'border-box' }}
                    >
                      <i className="fa-solid fa-image"></i>
                      <span>معاينة صورة الشهادة المعتمدة</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {result.status === 'revoked' && (
            <div style={{
              background: '#12141a',
              border: '1.5px solid #ef4444',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(239,68,68,0.15)'
            }}>
              <div className="verify-card-header" style={{ background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', flexShrink: 0 }}>
                  <i className="fa-solid fa-ban"></i>
                </div>
                <div>
                  <h3 className="verify-header-text" style={{ margin: 0, color: '#ef4444', fontSize: '18px', fontWeight: '900', lineHeight: 1.3 }}>
                    شهادة ملغاة وغير صالحة
                  </h3>
                  <small style={{ color: '#fca5a5', fontSize: '12.5px' }}>
                    تم إلغاء هذه الشهادة رسمياً من قِبل إدارة المنصة ولا يعتد بها
                  </small>
                </div>
              </div>

              <div className="verify-card-body">
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px dashed #ef4444', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '11.5px', color: '#f87171', display: 'block', marginBottom: '2px' }}>سبب الإلغاء:</span>
                  <strong style={{ color: '#fff', fontSize: '13.5px' }}>{result.certificate?.revocation_reason || 'تم الإلغاء بقرار إداري'}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '10px', fontSize: '13px' }}>
                  <div><span style={{ color: '#94a3b8' }}>المتدرب:</span> <strong>{result.certificate?.student_name}</strong></div>
                  <div><span style={{ color: '#94a3b8' }}>الدورة:</span> <strong>{result.certificate?.course_title}</strong></div>
                  <div style={{ wordBreak: 'break-all' }}><span style={{ color: '#94a3b8' }}>رقم الشهادة:</span> <strong style={{ fontFamily: 'monospace' }}>{result.certificate?.certificate_id}</strong></div>
                  <div><span style={{ color: '#94a3b8' }}>تاريخ الإصدار:</span> <strong>{new Date(result.certificate?.issue_date).toLocaleDateString('ar-EG')}</strong></div>
                </div>
              </div>
            </div>
          )}

          {result.status === 'not_found' && (
            <div style={{
              background: '#12141a',
              border: '1.5px solid #334155',
              borderRadius: '16px',
              padding: '30px 18px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
            }}>
              <i className="fa-solid fa-triangle-exclamation fa-3x" style={{ color: '#f59e0b', marginBottom: '14px' }}></i>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#fff' }}>لم يتم العثور على أي شهادة بهذا الرقم</h3>
              <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: '0 0 18px' }}>
                تأكد من إدخال كود الشهادة بشكل صحيح (مثال: {searchedId || 'CERT-XXXXXXXXX'}) أو تواصل مع إدارة المنصة
              </p>
              <Link to="/tracks" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '13.5px', borderRadius: '8px' }}>
                تصفح الدورات والمسارات المعتمدة
              </Link>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default VerifyCertificate;
