import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCountdown } from '../hooks/useCountdown';

function DiscountPopup() {
  const [offer, setOffer] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.get('/orders/active-offer')
      .then(res => {
        if (!isMounted) return;
        if (res && res.offer) {
          const dismissKey = `dismissed_offer_${res.offer.code}_${new Date(res.offer.expires_at).getTime()}`;
          const isDismissed = sessionStorage.getItem(dismissKey);
          setOffer(res.offer);
          if (!isDismissed) {
            // slight delay for smooth entrance after page load
            const timer = setTimeout(() => {
              if (isMounted) setIsOpen(true);
            }, 800);
            return () => clearTimeout(timer);
          }
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, []);

  const countdown = useCountdown(offer?.expires_at);

  // If expired while viewing, automatically close
  useEffect(() => {
    if (countdown.isExpired && offer) {
      setIsOpen(false);
    }
  }, [countdown.isExpired, offer]);

  if (!offer || !isOpen || countdown.isExpired) {
    return null;
  }

  const handleClose = () => {
    const dismissKey = `dismissed_offer_${offer.code}_${new Date(offer.expires_at).getTime()}`;
    sessionStorage.setItem(dismissKey, 'true');
    setIsOpen(false);
  };

  const handleCopyCode = (e) => {
    if (e) e.stopPropagation();
    if (navigator.clipboard && offer.code) {
      navigator.clipboard.writeText(offer.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const isLaunch = !!offer.is_launch;
  const hasMultipleCourses = isLaunch && (offer.has_multiple_courses || offer.courses_count > 1);
  const isAllCourses = offer.is_all_courses || (!offer.course && (!offer.courses_count || offer.courses_count > 1));

  // If launch discount has more than one course, DO NOT show percentage or price
  const hasValue = !hasMultipleCourses && offer.discount_value;
  const discountText = hasValue
    ? (offer.discount_type === 'percentage' ? `${offer.discount_value}%` : `$${offer.discount_value}`)
    : '';

  const targetLink = offer.course ? `/course/${offer.course.slug}` : '/courses';

  const padZero = (n) => String(n).padStart(2, '0');

  return (
    <div className="discount-popup-backdrop" onClick={handleClose}>
      <div className="discount-popup-modal" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="discount-popup-close"
          onClick={handleClose}
          aria-label="إغلاق"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="discount-popup-badge">
          <i className={`fa-solid ${isLaunch ? 'fa-rocket' : 'fa-fire'} text-red`}></i>
          <span>{isLaunch ? 'خصم إطلاق استثنائي 🚀' : 'عرض خاص ومحدود'}</span>
        </div>

        <div className="discount-popup-head">
          {isLaunch ? (
            hasMultipleCourses ? (
              <>
                <h2>خصم إطلاق مميز لفترة محدودة! 🚀</h2>
                <p>
                  {isAllCourses ? (
                    <>خصم إطلاق ساري <strong>علي جميع كورسات المنصة</strong> الآن</>
                  ) : (
                    <>خصم إطلاق ساري <strong>علي كورسات محددة</strong></>
                  )}
                </p>
              </>
            ) : (
              <>
                <h2>خصم إطلاق {hasValue ? <span className="text-red">({discountText})</span> : ''} لفترة محدودة! 🚀</h2>
                <p>
                  {offer.course ? (
                    <>خصم إطلاق مخصص علي <strong>"{offer.course.title}"</strong></>
                  ) : (
                    <>خصم إطلاق ساري علي جميع الكورسات</>
                  )}
                </p>
              </>
            )
          ) : (
            <>
              <h2>خصم خاص <span className="text-red">{discountText}</span> لفترة محدودة!</h2>
              <p>
                {offer.course ? (
                  <>علي <strong>"{offer.course.title}"</strong></>
                ) : (
                  <>ساري علي جميع كورسات المنصة الآن</>
                )}
              </p>
            </>
          )}
        </div>

        {/* Live Countdown Display */}
        <div className="discount-countdown-box">
          <span className="countdown-label">
            <i className="fa-regular fa-clock"></i> ينتهي العرض خلال:
          </span>
          <div className="countdown-timer">
            <div className="countdown-col">
              <span className="countdown-num">{padZero(countdown.days)}</span>
              <span className="countdown-unit">أيام</span>
            </div>
            <span className="countdown-sep">:</span>
            <div className="countdown-col">
              <span className="countdown-num">{padZero(countdown.hours)}</span>
              <span className="countdown-unit">ساعات</span>
            </div>
            <span className="countdown-sep">:</span>
            <div className="countdown-col">
              <span className="countdown-num">{padZero(countdown.minutes)}</span>
              <span className="countdown-unit">دقائق</span>
            </div>
            <span className="countdown-sep">:</span>
            <div className="countdown-col">
              <span className="countdown-num highlight">{padZero(countdown.seconds)}</span>
              <span className="countdown-unit">ثواني</span>
            </div>
          </div>
        </div>

        {/* Coupon Code Container */}
        <div className="discount-coupon-container">
          <div className="coupon-code-pill" onClick={handleCopyCode}>
            <div className="coupon-code-text">
              <span className="coupon-label">كود الخصم:</span>
              <strong className="coupon-code-val">{offer.code}</strong>
            </div>
            <button
              type="button"
              className={`coupon-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyCode}
            >
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
              <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
            </button>
          </div>
          {copied && <span className="copy-feedback-msg">تم نسخ الكود إلى الحافظة بنجاح! جاهز للاستخدام في صفحة الدفع.</span>}
        </div>

        {/* Actions */}
        <div className="discount-popup-actions">
          <Link
            to={targetLink}
            className="btn btn-primary discount-cta-btn"
            onClick={() => {
              handleCopyCode();
              handleClose();
            }}
          >
            <span>استفد من الخصم وتصفح الكورسات</span>
            <i className="fa-solid fa-arrow-left"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DiscountPopup;
