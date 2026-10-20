import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCountdown } from '../hooks/useCountdown';

function DiscountBanner({ variant = 'hero' }) {
  const [offer, setOffer] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.get('/orders/active-offer')
      .then(res => {
        if (isMounted && res && res.offer) {
          setOffer(res.offer);
        }
      })
      .catch(() => { });

    return () => { isMounted = false; };
  }, []);

  const countdown = useCountdown(offer?.expires_at);

  if (!offer || countdown.isExpired) {
    return null;
  }

  const handleCopy = (e) => {
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

  // Badge label
  const badgeLabel = isLaunch ? 'خصم إطلاق' : 'خصم';

  // Scope / Target text
  let scopeText = '';
  if (isLaunch) {
    if (hasMultipleCourses) {
      scopeText = isAllCourses ? 'علي جميع الكورسات' : 'علي كورسات محددة';
    } else if (offer.course) {
      scopeText = `علي "${offer.course.title}"`;
    } else {
      scopeText = isAllCourses ? 'علي جميع الكورسات' : 'علي كورسات محددة';
    }
  } else {
    scopeText = offer.course ? `علي "${offer.course.title}"` : 'علي جميع الكورسات';
  }

  const targetLink = offer.course ? `/course/${offer.course.slug}` : '/courses';
  const padZero = (n) => String(n).padStart(2, '0');

  const usedCount = offer.used_count || 0;
  const maxUses = offer.max_uses;
  const remainingCount = maxUses ? Math.max(0, maxUses - usedCount) : null;

  if (variant === 'student') {
    return (
      <div className="hero-offer-card hero-horizontal-card student-dashboard-discount">
        <div className="hero-offer-glow"></div>

        {/* الجزء 1: شارة العرض للطلاب + اسم الكورس + المستفيدين */}
        <div className="hh-meta-col">
          <div className="hh-top-line">
            <span className="hero-offer-badge" style={{ background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.3), rgba(220, 38, 38, 0.15))' }}>
              <i className={`fa-solid ${isLaunch ? 'fa-rocket' : 'fa-gift'} text-red`}></i>
              <span>
                {badgeLabel}
                {hasValue && <strong className="badge-discount-val"> {discountText}</strong>}
              </span>
            </span>
            <span className="hh-course-name" style={{ fontSize: '16px' }}>
              {scopeText}
            </span>
          </div>

          <div className="hh-stats-bottom-row">
            <div className="offer-stat-pill users">
              <i className="fa-solid fa-users"></i>
              <span><strong>{usedCount}</strong> طالب استفادوا</span>
            </div>

            {remainingCount !== null && (
              <div className="offer-stat-pill remaining">
                <i className="fa-solid fa-bolt text-red"></i>
                <span>متبقي <strong>{remainingCount}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* الجزء 2: العداد التنازلي الاحترافي */}
        <div className="hh-countdown-col">
          <span className="hh-countdown-title"><i className="fa-regular fa-clock"></i> ينتهي خلال:</span>
          <div className="countdown-timer" dir="ltr">
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

        {/* الجزء 3: كود الخصم وزر الاستفادة والتصفح */}
        <div className="hh-action-col">
          <div className="coupon-code-pill" onClick={handleCopy} role="button" tabIndex={0} title="اضغط لنسخ الكود">
            <div className="coupon-code-text">
              <span className="coupon-label">الكوبون:</span>
              <span className="coupon-code-val">{offer.code}</span>
            </div>
            <button type="button" className={`coupon-copy-btn ${copied ? 'copied' : ''}`} aria-label="نسخ الكوبون">
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
              <span>{copied ? 'تم' : 'نسخ'}</span>
            </button>
          </div>

          <Link to={targetLink} className="hero-claim-btn" title="تصفح واستفد الآن">
            <span>اشترك واستفد</span>
            <i className="fa-solid fa-arrow-left"></i>
          </Link>
        </div>
      </div>
    );
  }

  const usedPercent = maxUses ? Math.min(100, Math.round((usedCount / maxUses) * 100)) : null;

  // Hero variant
  return (
    <div className="hero-offer-card hero-horizontal-card reveal reveal-d2">
      <div className="hero-offer-glow"></div>

      {/* الجزء 1: شارة العرض واسم الكورس كامل من فوق، والمتبقي والمستفيدين من تحت */}
      <div className="hh-meta-col">
        <div className="hh-top-line">
          <span className="hero-offer-badge">
            <i className={`fa-solid ${isLaunch ? 'fa-rocket' : 'fa-fire'} text-red`}></i>
            <span>
              {badgeLabel}
              {hasValue && <strong className="badge-discount-val"> {discountText}</strong>}
            </span>
          </span>
          <span className="hh-course-name">
            {scopeText}
          </span>
        </div>

        {/* المتبقي والمستفيدين من تحت */}
        <div className="hh-stats-bottom-row">
          <div className="offer-stat-pill users">
            <i className="fa-solid fa-users"></i>
            <span><strong>{usedCount}</strong> استفادوا</span>
          </div>

          {remainingCount !== null && (
            <div className="offer-stat-pill remaining">
              <i className="fa-solid fa-bolt text-red"></i>
              <span>متبقي <strong>{remainingCount}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* الجزء 2: الكاونت داون بمربعاته المميزة */}
      <div className="hh-countdown-col">
        <span className="hh-countdown-title"><i className="fa-regular fa-clock"></i> ينتهي خلال:</span>
        <div className="countdown-timer" dir="ltr">
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

      {/* الجزء 3: كود الخصم وزر الاستفادة السريع */}
      <div className="hh-action-col">
        <div className="coupon-code-pill" onClick={handleCopy} role="button" tabIndex={0} title="اضغط لنسخ الكود">
          <div className="coupon-code-text">
            <span className="coupon-label">الكوبون:</span>
            <span className="coupon-code-val">{offer.code}</span>
          </div>
          <button type="button" className={`coupon-copy-btn ${copied ? 'copied' : ''}`} aria-label="نسخ الكوبون">
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
            <span>{copied ? 'تم' : 'نسخ'}</span>
          </button>
        </div>

        <Link to={targetLink} className="hero-claim-btn" title="احصل على العرض">
          <span>احصل على العرض</span>
          <i className="fa-solid fa-arrow-left"></i>
        </Link>
      </div>
    </div>
  );
}

export default DiscountBanner;
