import React from 'react';

function UploadProgressModal({ progress, loaded, total, title = "جاري رفع الملفات...", isUploading = false }) {
  if (!isUploading) return null;

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="upload-progress-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px',
      direction: 'rtl'
    }}>
      <div className="upload-progress-card" style={{
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(200, 30, 30, 0.2)',
        textAlign: 'center',
        color: '#fff',
        animation: 'fadeIn 0.3s ease'
      }}>
        <div style={{
          width: '70px',
          height: '70px',
          margin: '0 auto 20px',
          borderRadius: '50%',
          background: 'rgba(200, 30, 30, 0.15)',
          border: '2px solid rgba(200, 30, 30, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          color: '#e53e3e',
          boxShadow: '0 0 20px rgba(200, 30, 30, 0.3)'
        }}>
          <i className={progress >= 100 ? "fa-solid fa-sync fa-spin" : "fa-solid fa-cloud-arrow-up fa-bounce"}></i>
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#f8fafc' }}>
          {progress >= 100 ? 'جاري معالجة البيانات وحفظها...' : title}
        </h3>

        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
          {progress >= 100 
            ? 'تم اكتما الرفع، يتم الآن إعداد الملف والمعالجة...' 
            : 'يرجى عدم إغلاق الصفحة حتى يتم إكمال الرفع بنجاح.'}
        </p>

        {/* Progress Bar Container */}
        <div style={{
          width: '100%',
          height: '14px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: '16px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: 'linear-gradient(90deg, #c81e1e 0%, #ff4d4d 100%)',
            borderRadius: '10px',
            transition: 'width 0.2s ease-out',
            boxShadow: '0 0 12px rgba(255, 77, 77, 0.8)'
          }} />
        </div>

        {/* Percentage & Sizes */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          fontWeight: '600',
          color: '#cbd5e1'
        }}>
          <span>{progress}%</span>
          {loaded > 0 && total > 0 && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {formatSize(loaded)} / {formatSize(total)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadProgressModal;
