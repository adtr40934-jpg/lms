import { useState, useEffect, useRef } from 'react';
import AdminLayout from './AdminLayout';
import { api } from '../../api';
import UploadProgressModal from '../../components/UploadProgressModal';
import { getAssetUrl } from '../../utils/assetUrl';

function TrainerCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const fileInputRef = useRef(null);

  // Upload Progress
  const [uploadState, setUploadState] = useState({ isUploading: false, progress: 0, loaded: 0, total: 0 });

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/trainer-certificates/admin');
      setCertificates(res.certificates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilesSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fd = new FormData();
    for (let i = 0; i < files.length; i++) {
      fd.append('images', files[i]);
    }

    const onProgress = (percent, loadedBytes, totalBytes) => {
      setUploadState({ isUploading: true, progress: percent, loaded: loadedBytes, total: totalBytes });
    };

    try {
      setSubmitting(true);
      setUploadState({ isUploading: true, progress: 0, loaded: 0, total: 0 });

      const res = await api.post('/trainer-certificates/admin', fd, true, onProgress);
      alert(res.message || 'تم رفع صور الشهادات بنجاح');
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchCertificates();
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء رفع الصور');
    } finally {
      setSubmitting(false);
      setUploadState({ isUploading: false, progress: 0, loaded: 0, total: 0 });
    }
  };

  const handleDelete = async (cert, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذه الشهادة من المعرض؟')) {
      return;
    }

    try {
      await api.delete(`/trainer-certificates/admin/${cert._id}`);
      setCertificates(prev => prev.filter(c => c._id !== cert._id));
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء حذف الشهادة');
    }
  };

  return (
    <AdminLayout title="معرض شهادات المدرب">
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-award text-red"></i>
            معرض شهادات المدرب ({certificates.length} شهادة)
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            ارفع صور شهاداتك مباشرة وستظهر كمعرض صور بفريم بسيط وأنيق في صفحة "عن المدرب" مع إمكانية التكبير
          </p>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFilesSelect}
            accept="image/*"
            multiple
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            style={{ padding: '10px 20px', fontSize: '14px', gap: '8px' }}
          >
            <i className="fa-solid fa-cloud-arrow-up"></i> رفع صور شهادات جديدة
          </button>
        </div>
      </div>

      {/* Drag & Drop / Quick Upload Box */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed #cbd5e1',
          borderRadius: '16px',
          padding: '30px 20px',
          textAlign: 'center',
          background: '#f8fafc',
          cursor: 'pointer',
          marginBottom: '28px',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#c81e1e';
          e.currentTarget.style.background = '#fef2f2';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#cbd5e1';
          e.currentTarget.style.background = '#f8fafc';
        }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#fee2e2',
          color: '#c81e1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          fontSize: '22px'
        }}>
          <i className="fa-solid fa-images"></i>
        </div>
        <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>
          اضغط هنا لاختيار صورة أو عدة صور شهادات لرفعها فوراً
        </h4>
        <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
          يمكنك تحديد أكثر من صورة في نفس الوقت (JPG, PNG, WebP) - لا يتطلب كتابة اسم
        </p>
      </div>

      {/* Certificates Gallery Grid */}
      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center' }}>
          <i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i>
        </div>
      ) : certificates.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '16px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fee2e2', color: '#c81e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '36px' }}>
            <i className="fa-solid fa-award"></i>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>
            لم تقم برفع أي شهادات بعد
          </h3>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '450px', margin: '0 auto 20px' }}>
            اضغط فوق لرفع صور الشهادات والاعتمادات لتظهر كمعرض راقٍ ومميز للزوار في صفحة عن المدرب.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '20px'
        }}>
          {certificates.map((cert, idx) => {
            const imgSrc = cert.image ? getAssetUrl(cert.image) : '';
            return (
              <div
                key={cert._id}
                style={{
                  background: '#fff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* Frame Container */}
                <div
                  style={{
                    position: 'relative',
                    height: '200px',
                    background: '#090a0f',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                  onClick={() => setLightboxImg(imgSrc)}
                  title="اضغط لتكبير ومعاينة الصورة"
                >
                  <img
                    src={imgSrc}
                    alt="Certificate"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      padding: '8px',
                      transition: 'transform 0.3s ease'
                    }}
                  />

                  {/* Top Zoom Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <i className="fa-solid fa-magnifying-glass-plus"></i> تكبير
                  </div>

                  {/* Index Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    #{idx + 1}
                  </div>
                </div>

                {/* Footer Bar with Actions */}
                <div style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc'
                }}>
                  <button
                    type="button"
                    className="btn btn-light btn-sm"
                    style={{ fontSize: '12px', padding: '4px 10px', gap: '6px' }}
                    onClick={() => setLightboxImg(imgSrc)}
                  >
                    <i className="fa-solid fa-eye text-red"></i> معاينة
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={(e) => handleDelete(cert, e)}
                    title="حذف الشهادة"
                    style={{ width: '28px', height: '28px', fontSize: '11px' }}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              fontSize: '24px',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
          <img
            src={lightboxImg}
            alt="Certificate Preview"
            style={{
              maxWidth: '92vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Upload Progress Modal */}
      <UploadProgressModal
        isUploading={uploadState.isUploading}
        progress={uploadState.progress}
        loaded={uploadState.loaded}
        total={uploadState.total}
        title="جاري رفع صور الشهادات..."
      />
    </AdminLayout>
  );
}

export default TrainerCertificates;
