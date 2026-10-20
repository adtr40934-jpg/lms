import { useState, useEffect } from 'react';
import { api } from '../api';

const RATING_LABELS = {
  1: 'يحتاج إلى تحسين كبير ⭐️',
  2: 'مقبول ⭐️⭐️',
  3: 'جيد ومفيد ⭐️⭐️⭐️',
  4: 'جيد جداً وممتاز ⭐️⭐️⭐️⭐️',
  5: 'رائع جداً وأنصح به بشدة! ⭐️⭐️⭐️⭐️⭐️'
};

function CourseReviewModal({ course, track, existingReview, onClose, onSuccess }) {
  const isTrack = !!track || (!course && !!track);
  const targetItem = track || course;

  const [rating, setRating] = useState(existingReview?.rating || 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5);
      setComment(existingReview.comment || '');
    }
  }, [existingReview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError(isTrack ? 'يرجى كتابة رأيك وتجربتك في التراك.' : 'يرجى كتابة رأيك وتجربتك في الكورس.');
      return;
    }
    if (comment.trim().length < 10) {
      setError('يرجى كتابة رأي أكثر تفصيلاً (10 أحرف على الأقل).');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = isTrack
        ? await api.post('/reviews/track', {
            trackId: targetItem._id,
            rating,
            comment: comment.trim()
          })
        : await api.post('/reviews/course', {
            courseId: targetItem._id,
            rating,
            comment: comment.trim()
          });

      alert(res.message || 'تم إرسال تقييمك ورأيك بنجاح، شكراً لك!');
      if (onSuccess) onSuccess(res.review);
      onClose();
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء إرسال التقييم');
    } finally {
      setSubmitting(false);
    }
  };

  const activeRating = hoverRating || rating;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      direction: 'rtl'
    }}>
      <div style={{
        background: '#161619',
        border: '1px solid #28282e',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
        animation: 'fadeIn 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 18px',
          background: 'linear-gradient(135deg, rgba(200, 30, 30, 0.12) 0%, rgba(245, 158, 11, 0.1) 100%)',
          borderBottom: '1px solid #28282e',
          position: 'relative',
          textAlign: 'center'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#9ea0a8',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px'
            }}
          >
            ✕
          </button>

          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            margin: '0 auto 14px',
            boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)'
          }}>
            🎓
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '800', color: '#fff' }}>
            {existingReview
              ? (isTrack ? 'تعديل تقييمك ورأيك في التراك' : 'تعديل تقييمك ورأيك في الكورس')
              : (isTrack ? 'تهانينا لإتمام المسار التعليمي بنجاح! 🎉' : 'تهانينا لإتمام الكورس بنجاح! 🎉')}
          </h3>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#9ea0a8' }}>
            {isTrack
              ? <>رأيك يهمنا جداً لتطوير محتوى المسار ومساعدة زملائك المتدربين: <strong style={{ color: '#fff' }}>{targetItem?.title}</strong></>
              : <>رأيك يهمنا جداً لتطوير المحتوى ومساعدة زملائك المتدربين: <strong style={{ color: '#fff' }}>{targetItem?.title}</strong></>}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginLeft: '6px' }}></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Stars selection */}
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>
                {isTrack ? 'تقييمك العام للمسار التعليمي *' : 'تقييمك العام للكورس *'}
              </label>
              <div style={{
                display: 'inline-flex',
                gap: '10px',
                direction: 'ltr',
                fontSize: '34px',
                cursor: 'pointer'
              }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <i
                    key={star}
                    className="fa-solid fa-star"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    style={{
                      color: star <= activeRating ? '#f59e0b' : '#33353d',
                      transform: star <= activeRating ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}
                  ></i>
                ))}
              </div>
              <div style={{ fontSize: '12.5px', color: '#f59e0b', fontWeight: 'bold', marginTop: '6px', minHeight: '18px' }}>
                {RATING_LABELS[activeRating] || ''}
              </div>
            </div>

            {/* Comment */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                {isTrack ? 'رأيك وانطباعك عن المسار التعليمي وكورساته *' : 'رأيك وانطباعك عن الكورس والشرح *'}
              </label>
              <textarea
                rows="4"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={isTrack ? 'اكتب رأيك بصراحة.. ما الذي أعجبك في المسار ومحتواه؟ وكيف ساعدك في التطبيق العملي وسوق العمل؟' : 'اكتب رأيك بصراحة.. ما الذي أعجبك في الكورس؟ وكيف ساعدك في التطبيق العملي؟'}
                required
                style={{
                  width: '100%',
                  background: '#0d0d0f',
                  border: '1px solid #28282e',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <small style={{ color: '#64748b', fontSize: '11.5px' }}>
                  <i className="fa-solid fa-sparkles text-red" style={{ marginLeft: '4px' }}></i>
                  قد يظهر رأيك في قسم "آراء المتدربين" في الصفحة الرئيسية للمنصة 🌟
                </small>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-light"
                onClick={onClose}
                disabled={submitting}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                لاحقاً
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {submitting ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...</>
                ) : (
                  <><i className="fa-solid fa-paper-plane"></i> {existingReview ? 'تحديث الرأي' : 'إرسال التقييم'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CourseReviewModal;
