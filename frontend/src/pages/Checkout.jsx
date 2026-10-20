import { useState, useContext, useEffect } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { api } from '../api';
import UploadProgressModal from '../components/UploadProgressModal';
import Swal from 'sweetalert2';
import SEO from '../components/common/SEO';

function Checkout() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { settings, loadingSettings } = useSettings();
  const [searchParams] = useSearchParams();
  const courseSlug = searchParams.get('course');
  const trackSlug = searchParams.get('track');
  const done = searchParams.get('done');

  const [courses, setCourses] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);

  const isReady = !loadingPage && !loadingSettings;
  usePageReady(isReady);

  const [copied, setCopied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('instapay');

  const [loading, setLoading] = useState(false);
  const [uploadState, setUploadState] = useState({ isUploading: false, progress: 0, loaded: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    amount: '',
    senderPhone: ''
  });
  const [receipt, setReceipt] = useState(null);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Exchange Rate State (USD -> EGP)
  const [exchangeRate, setExchangeRate] = useState(53.0);
  const [rateLoading, setRateLoading] = useState(true);

  const isWholeTrack = Boolean(trackSlug && !courseSlug);

  useEffect(() => {
    if (!user) {
      const redirectParams = [];
      if (courseSlug) redirectParams.push(`course=${courseSlug}`);
      if (trackSlug) redirectParams.push(`track=${trackSlug}`);
      const qs = redirectParams.length > 0 ? `?${redirectParams.join('&')}` : '';
      navigate('/login?redirect=/checkout' + qs);
      return;
    }
    fetchData();
  }, [user, navigate, courseSlug, trackSlug]);

  const fetchData = async () => {
    try {
      setLoadingPage(true);
      const [coursesRes, tracksRes, ordersRes, rateRes] = await Promise.all([
        api.get('/courses'),
        api.get('/tracks').catch(() => ({ tracks: [] })),
        api.get('/orders/my').catch(() => ({ orders: [] })),
        api.get('/settings/exchange-rate').catch(() => null)
      ]);
      setCourses(coursesRes.courses || []);
      setTracks(tracksRes.tracks || []);
      setMyOrders(ordersRes.orders || []);

      if (rateRes?.rate && Number(rateRes.rate) > 0) {
        setExchangeRate(Number(rateRes.rate));
        setRateLoading(false);
      } else {
        // Fallback direct fetch if backend endpoint had an issue
        fetch('https://open.er-api.com/v6/latest/USD')
          .then(r => r.json())
          .then(d => {
            if (d?.rates?.EGP) setExchangeRate(Number(d.rates.EGP));
          })
          .catch(() => {})
          .finally(() => setRateLoading(false));
      }

      if (trackSlug && !courseSlug) {
        const matchedTrack = (tracksRes.tracks || []).find(t => t.slug === trackSlug);
        if (matchedTrack) {
          setFormData(prev => ({ ...prev, amount: matchedTrack.price }));
        }
      } else if (courseSlug) {
        const matchedCourse = (coursesRes.courses || []).find(c => c.slug === courseSlug);
        if (matchedCourse) {
          setFormData(prev => ({ ...prev, amount: matchedCourse.price }));
          const couponParam = searchParams.get('coupon');
          if (couponParam) {
            setCouponCode(couponParam);
            api.post('/orders/validate-coupon', { code: couponParam, courseId: matchedCourse._id })
              .then(res => {
                setAppliedCoupon(res);
                let finalPrice = matchedCourse.old_price || matchedCourse.price;
                if (res.discount_type === 'percentage') {
                  finalPrice = finalPrice - (finalPrice * (res.discount_value / 100));
                } else {
                  finalPrice = Math.max(0, finalPrice - res.discount_value);
                }
                setFormData(prev => ({ ...prev, amount: finalPrice }));
              })
              .catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPage(false);
    }
  };

  const selectedTrack = tracks.find(t => t.slug === trackSlug);
  const selectedCourse = courses.find(c => c.slug === courseSlug);

  // If purchasing an individual course, resolve if it is associated with a track
  const associatedTrack = !isWholeTrack && selectedCourse
    ? (
        (selectedCourse.track && typeof selectedCourse.track === 'object' && selectedCourse.track.title ? selectedCourse.track : null) ||
        tracks.find(t => t.slug === trackSlug) ||
        tracks.find(t => t._id === (selectedCourse.track?._id || selectedCourse.track)) ||
        tracks.find(t => t.courses?.some(c => (c._id || c) === selectedCourse._id)) ||
        null
      )
    : null;

  const pendingOrderForSelectedCourse = !isWholeTrack && selectedCourse && myOrders.find(o => 
    o.status === 'pending' && o.order_type !== 'track' && (o.course?._id === selectedCourse._id || o.course === selectedCourse._id)
  );

  const pendingOrderForSelectedTrack = isWholeTrack && selectedTrack && myOrders.find(o => 
    o.status === 'pending' && o.order_type === 'track' && (o.track?._id === selectedTrack._id || o.track === selectedTrack._id)
  );

  const activePendingOrder = isWholeTrack ? pendingOrderForSelectedTrack : pendingOrderForSelectedCourse;
  const payNum = settings.payment_number || '';

  const getItemPricing = () => {
    const rate = Number(exchangeRate) || 53.0;

    if (isWholeTrack && selectedTrack) {
      const coursesSum = selectedTrack.courses?.reduce((sum, c) => sum + (Number(c.price) || 0), 0) || 0;
      let originalPrice = selectedTrack.old_price || (coursesSum > (selectedTrack.price || 0) ? coursesSum : (selectedTrack.price || 0));
      let finalPrice = Number(selectedTrack.price) || 0;
      const hasDiscount = originalPrice > finalPrice;
      const discountText = hasDiscount ? `${Math.round(100 - (finalPrice / originalPrice) * 100)}%` : '';
      const finalEgp = Math.round(finalPrice * rate);
      return { originalPrice, finalPrice, hasDiscount, discountText, rate, finalEgp, isTrack: true, coursesSum };
    }

    let originalPrice = selectedCourse?.old_price || selectedCourse?.price || 0;
    let finalPrice = selectedCourse?.price || 0;

    if (appliedCoupon && selectedCourse) {
      if (appliedCoupon.discount_type === 'percentage') {
        finalPrice = originalPrice - (originalPrice * (appliedCoupon.discount_value / 100));
      } else {
        finalPrice = Math.max(0, originalPrice - appliedCoupon.discount_value);
      }
    } else if (selectedCourse?.has_coupon) {
      finalPrice = selectedCourse.price;
    }

    const hasDiscount = !!(appliedCoupon || selectedCourse?.has_coupon || (selectedCourse?.old_price && selectedCourse.old_price > selectedCourse.price));
    const discountText = appliedCoupon
      ? (appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}%` : `$${appliedCoupon.discount_value}`)
      : (originalPrice > finalPrice ? `${Math.round(100 - (finalPrice / originalPrice) * 100)}%` : '');

    const finalEgp = Math.round(finalPrice * rate);

    return { originalPrice, finalPrice, hasDiscount, discountText, rate, finalEgp, isTrack: false, coursesSum: 0 };
  };

  if (!user || loadingPage) {
    return <main style={{ padding: '100px 0', textAlign: 'center' }}><i className="fa-solid fa-circle-notch fa-spin fa-3x text-red"></i></main>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(payNum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors({ ...errors, [name]: '' });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        setErrors({ ...errors, receipt: 'يجب أن تكون الصورة بصيغة PNG أو JPG' });
        e.target.value = null;
        setReceipt(null);
        return;
      }
      setReceipt(file);
      setErrors({ ...errors, receipt: '' });
    }
  };

  const handleCourseChange = (e) => {
    const cid = e.target.value;
    const matched = courses.find(c => c._id === cid);
    if (matched) {
      navigate(`/checkout?course=${matched.slug}`, { replace: true });
      setFormData(prev => ({ ...prev, amount: matched.price }));
    } else {
      navigate(`/checkout`, { replace: true });
      setFormData(prev => ({ ...prev, amount: '' }));
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (!selectedCourse) {
      setCouponError('برجاء اختيار الكورس أولاً');
      return;
    }
    try {
      setApplyingCoupon(true);
      setCouponError('');
      const res = await api.post('/orders/validate-coupon', { code: couponCode, courseId: selectedCourse._id });
      setAppliedCoupon(res);
      setCouponError('');

      // Update amount automatically
      let finalPrice = selectedCourse.old_price || selectedCourse.price;
      if (res.discount_type === 'percentage') {
        finalPrice = finalPrice - (finalPrice * (res.discount_value / 100));
      } else {
        finalPrice = Math.max(0, finalPrice - res.discount_value);
      }
      setFormData(prev => ({ ...prev, amount: finalPrice }));
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || 'كوبون خاطئ');
      setFormData(prev => ({ ...prev, amount: selectedCourse ? selectedCourse.price : '' }));
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    if (selectedCourse) {
      setFormData(prev => ({ ...prev, amount: selectedCourse.price }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    let newErrors = {};
    if (!formData.senderPhone) newErrors.senderPhone = 'رقم التحويل مطلوب';
    if (!receipt) newErrors.receipt = 'يرجى إرفاق صورة التحويل';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (activePendingOrder) {
      Swal.fire({
        icon: 'warning',
        title: 'طلبك قيد المراجعة بالفعل!',
        text: isWholeTrack
          ? 'لديك بالفعل طلب اشتراك قيد المراجعة لهذا التراك. لا يمكنك إرسال طلب جديد إلا بعد مراجعة الطلب الحالي أو رفضه من قبل الإدارة.'
          : 'لديك بالفعل طلب اشتراك قيد المراجعة لهذا الكورس. لا يمكنك إرسال طلب جديد إلا بعد مراجعة الطلب الحالي أو رفضه من قبل الإدارة.',
        confirmButtonText: 'عرض طلباتي',
        confirmButtonColor: '#c81e1e'
      }).then(() => {
        navigate('/account?tab=orders');
      });
      return;
    }

    setLoading(true);

    try {
      const { finalPrice, finalEgp, rate } = getItemPricing();

      const data = new FormData();
      data.append('order_type', isWholeTrack ? 'track' : 'course');
      if (isWholeTrack) {
        data.append('trackId', selectedTrack ? selectedTrack._id : '');
      } else {
        data.append('courseId', selectedCourse ? selectedCourse._id : '');
      }

      data.append('full_name', user?.name || 'Unknown');
      data.append('email', user?.email || 'unknown@domain.com');
      data.append('phone', user?.phone || '00000000000');
      data.append('paymentMethod', paymentMethod);
      data.append('amount', finalPrice); // Inject computed amount in USD
      data.append('amount_egp', finalEgp); // Inject computed amount in EGP
      data.append('exchange_rate', rate);
      data.append('senderPhone', formData.senderPhone);
      data.append('proof', receipt);
      
      if (!isWholeTrack) {
        if (appliedCoupon) {
          data.append('couponCode', appliedCoupon.code);
        } else if (selectedCourse?.active_coupon_code) {
          data.append('couponCode', selectedCourse.active_coupon_code);
        }
      }

      const onProgress = (percent, loadedBytes, totalBytes) => {
        setUploadState({ isUploading: true, progress: percent, loaded: loadedBytes, total: totalBytes });
      };

      setUploadState({ isUploading: true, progress: 0, loaded: 0, total: 0 });
      await api.post('/orders', data, true, onProgress);

      Swal.fire({
        icon: 'success',
        title: isWholeTrack ? 'تم إرسال طلب اشتراك التراك بنجاح!' : 'تم إرسال طلب الاشتراك بنجاح!',
        text: isWholeTrack
          ? 'تم استلام صورة التحويل بنجاح، وسيتم مراجعة الطلب وتفعيل جميع كورسات التراك على حسابك فوراً.'
          : 'تم استلام صورة التحويل بنجاح، وسيتم مراجعة الطلب وتفعيل الكورس على حسابك.',
        confirmButtonText: 'حسناً',
        confirmButtonColor: '#c81e1e',
        timer: 3500,
        timerProgressBar: true
      });

      navigate('/account?tab=orders');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'تعذر إرسال الطلب');
    } finally {
      setLoading(false);
      setUploadState({ isUploading: false, progress: 0, loaded: 0, total: 0 });
    }
  };

  return (
    <main>
      <SEO
        title="تأكيد الدفع والاشتراك"
        description="صفحة تأكيد الدفع والاشتراك في كورسات وتراكات منصة محمد بهاء التعليمية."
        canonical="/checkout"
        robots="noindex, nofollow"
      />
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">الرئيسية</Link><i className="fa-solid fa-chevron-left"></i><span>تأكيد الدفع</span>
          </div>
          <h1>{isWholeTrack ? 'تأكيد الاشتراك في التراك' : 'تأكيد الدفع والاشتراك'}</h1>
          <p>الدفع يدوي وآمن من خلال InstaPay أو Vodafone Cash — وبعد مراجعة التحويل يتم التفعيل على حسابك مباشرة.</p>
        </div>
      </section>

      <section className="section section-gray" style={{ paddingTop: '60px' }}>
        <div className="container">
          {done ? (
            <div className="form-card success-box reveal" style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div className="ic"><i className="fa-solid fa-check"></i></div>
              <h2>تم استلام طلبك بنجاح</h2>
              <p>
                تم استلام طلبك بنجاح، وسيتم مراجعة عملية الدفع وتفعيل المحتوى على حسابك.<br />
                {isWholeTrack ? (
                  <strong>التراك: {selectedTrack?.title || ''}</strong>
                ) : (
                  <>
                    <strong>الكورس: {selectedCourse?.title || ''}</strong>
                    {associatedTrack && (
                      <span style={{ display: 'block', fontSize: '13px', color: '#b45309', marginTop: '4px' }}>
                        (ضمن تراك: {associatedTrack.title})
                      </span>
                    )}
                  </>
                )}
              </p>
              <div className="hero-actions" style={{ justifyContent: 'center' }}>
                <Link to="/account?tab=orders" className="btn btn-primary"><i className="fa-solid fa-receipt"></i> متابعة طلباتي</Link>
                {settings.whatsapp && <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer" className="btn btn-whatsapp"><i className="fa-brands fa-whatsapp"></i> تأكيد على واتساب</a>}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>

              <div className="form-card reveal reveal-d1" id="form">
                {!selectedCourse && !selectedTrack ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <i className="fa-solid fa-box-open" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '16px' }}></i>
                    <h3>برجاء اختيار كورس أو تراك أولاً لإتمام الدفع</h3>
                    <p className="muted" style={{ marginBottom: '24px' }}>يجب أن تختار الكورس أو التراك الذي ترغب في الاشتراك به.</p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Link to="/tracks" className="btn btn-primary"><i className="fa-solid fa-arrow-right"></i> تصفح المسارات والكورسات</Link>
                    </div>
                  </div>
                ) : (
                  <>
                    {activePendingOrder && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '24px 20px', marginBottom: '24px', textAlign: 'center' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center', fontSize: '24px', margin: '0 auto 12px' }}>
                          <i className="fa-solid fa-hourglass-half"></i>
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#92400e', marginBottom: '8px' }}>
                          {isWholeTrack ? 'لديك طلب اشتراك قيد المراجعة بالفعل لهذا التراك!' : 'لديك طلب اشتراك قيد المراجعة بالفعل لهذا الكورس!'}
                        </h3>
                        <p style={{ color: '#b45309', fontSize: '14px', maxWidth: '520px', margin: '0 auto 18px', lineHeight: '1.7' }}>
                          {isWholeTrack ? (
                            <>لقد أرسلت مسبقاً طلب اشتراك لتراك <strong>{selectedTrack?.title}</strong> برقم <strong>#{activePendingOrder._id?.slice(-6).toUpperCase()}</strong>، وهو حالياً قيد الفحص من قبل الإدارة.</>
                          ) : (
                            <>لقد أرسلت مسبقاً طلب اشتراك لكورس <strong>{selectedCourse?.title}</strong> برقم <strong>#{activePendingOrder._id?.slice(-6).toUpperCase()}</strong>، وهو حالياً قيد الفحص من قبل الإدارة.</>
                          )}
                          <br />لا يمكنك إرسال طلب جديد إلا في حال تم مراجعة الطلب أو رفضه.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <Link to="/account?tab=orders" className="btn btn-warning" style={{ background: '#d97706', color: '#fff', border: 'none', padding: '10px 22px' }}>
                            <i className="fa-solid fa-receipt"></i> متابعة حالة طلبي
                          </Link>
                          <Link to="/tracks" className="btn btn-light" style={{ padding: '10px 20px' }}>
                            تصفح باقي المسارات والكورسات
                          </Link>
                        </div>
                      </div>
                    )}

                    <h2><i className="fa-solid fa-file-invoice-dollar text-red"></i>تأكيد الدفع</h2>
                    <p className="muted" style={{ marginBottom: '20px' }}>املأ البيانات وارفع صورة الإثبات.</p>
                    <form onSubmit={handleSubmit} noValidate>
                      <div className="form-grid">
                        <div className="field full">
                          <label>تفاصيل الفاتورة</label>
                          <div className="checkout-invoice-card">
                            <div className="checkout-invoice-header">
                              <div className="checkout-invoice-course-info">
                                {isWholeTrack ? (
                                  <>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e0e7ff', color: '#4338ca', fontSize: '11.5px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px', marginBottom: '6px' }}>
                                      <i className="fa-solid fa-layer-group"></i>
                                      <span>مسار تعليمي متكامل (تراك)</span>
                                    </div>
                                    <div className="checkout-invoice-course-title">{selectedTrack?.title}</div>
                                    <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#64748b', lineHeight: '1.5' }}>
                                      {selectedTrack?.short_desc || 'يشمل جميع الكورسات داخل هذا المسار التعليمي وتفعيلها فوري بمجرد تأكيد الإيصال.'}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <h4 style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>الكورس</h4>
                                    <div className="checkout-invoice-course-title">{selectedCourse?.title}</div>
                                    {associatedTrack && (
                                      <div style={{
                                        marginTop: '10px',
                                        background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
                                        border: '1.5px solid #fde68a',
                                        borderRadius: '10px',
                                        padding: '9px 12px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                      }}>
                                        <i className="fa-solid fa-route" style={{ color: '#d97706', fontSize: '14px' }}></i>
                                        <span style={{ fontSize: '12.5px', color: '#92400e', fontWeight: '700' }}>
                                          تم اختيار هذا الكورس من داخل تراك: <strong>{associatedTrack.title}</strong>
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="checkout-invoice-price-section">
                                <h4 style={{ margin: '0 0 6px', color: '#64748b', fontSize: '13px' }}>المبلغ المطلوب</h4>
                                {(() => {
                                  const { originalPrice, finalPrice, hasDiscount, discountText, rate, finalEgp, isTrack } = getItemPricing();

                                  return (
                                    <>
                                      <div className="checkout-price-row">
                                        {hasDiscount && (
                                          <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '14px' }}>
                                            ${originalPrice}
                                          </span>
                                        )}
                                        <span style={{ fontWeight: '900', color: '#c81e1e', fontSize: '22px' }}>
                                          ${finalPrice}
                                        </span>
                                        <span style={{
                                          color: '#0f172a',
                                          fontSize: '13.5px',
                                          fontWeight: '800',
                                          background: '#e2e8f0',
                                          padding: '3px 8px',
                                          borderRadius: '6px'
                                        }}>
                                          ≈ {finalEgp.toLocaleString('en-US')} ج.م
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                                        سعر الصرف: 1$ = {rate.toFixed(2)} ج.م
                                      </div>
                                      {hasDiscount && discountText && (
                                        <div style={{ marginTop: '6px' }}>
                                          <span className="badge badge-success" style={{ background: '#dcfce7', color: '#16a34a', fontSize: '12px', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <i className="fa-solid fa-check"></i>
                                            {isTrack ? `وفرت ${discountText} بسعر الحزمة` : appliedCoupon?.is_launch ? `تم تطبيق خصم الإطلاق (${discountText})` : `تم خصم ${discountText}`}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* قائمة الكورسات في حال شراء التراك بالكامل */}
                            {isWholeTrack && selectedTrack?.courses?.length > 0 && (
                              <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '12px 14px',
                                marginBottom: '16px'
                              }}>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }}></i>
                                  <span>الكورسات المشمولة في هذا التراك ({selectedTrack.courses.length} كورسات):</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                                  {selectedTrack.courses.map((c, idx) => (
                                    <div key={c._id || idx} style={{
                                      background: '#ffffff',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '8px',
                                      padding: '8px 10px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '12.5px'
                                    }}>
                                      <span style={{ fontWeight: '700', color: '#0f172a' }}>
                                        {idx + 1}. {c.title}
                                      </span>
                                      <span style={{ color: '#64748b', fontSize: '11.5px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                        سعر منفرد: ${c.price}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* كود الخصم (كوبون التخفيض) - خاص بشراء الكورسات فقط */}
                            {!isWholeTrack && (
                              <div className="checkout-coupon-section">
                                {appliedCoupon ? (
                                  <div className="checkout-applied-coupon-card">
                                    <div className="checkout-applied-coupon-info">
                                      <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '20px', flexShrink: 0 }}></i>
                                      <div>
                                        <span style={{ fontSize: '12px', color: '#166534', display: 'block' }}>الكوبون المطبق:</span>
                                        <strong className="checkout-applied-coupon-code">{appliedCoupon.code}</strong>
                                      </div>
                                      {(() => {
                                        const { discountText } = getItemPricing();
                                        return discountText ? (
                                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '12px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px' }}>
                                            {appliedCoupon.is_launch ? `خصم إطلاق (${discountText})` : `خصم ${discountText}`}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                    <button
                                      type="button"
                                      className="checkout-remove-coupon-btn"
                                      onClick={removeCoupon}
                                      title="إلغاء واستخدام كوبون آخر"
                                    >
                                      <i className="fa-solid fa-xmark"></i>
                                      <span>إلغاء الخصم</span>
                                    </button>
                                  </div>
                                ) : !selectedCourse?.has_coupon ? (
                                  <div className="checkout-coupon-block">
                                    <label className="checkout-coupon-label">
                                      <i className="fa-solid fa-tag text-red"></i>
                                      <span>كود الخصم (الكوبون)</span>
                                    </label>
                                    <div className="checkout-coupon-wrapper">
                                      <input
                                        type="text"
                                        placeholder="أدخل كود الخصم (مثال: LAUNCH)"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                        className="checkout-coupon-input"
                                      />
                                      <button
                                        type="button"
                                        onClick={applyCoupon}
                                        disabled={applyingCoupon || !couponCode.trim()}
                                        className="btn btn-dark checkout-coupon-btn"
                                      >
                                        {applyingCoupon ? <i className="fa-solid fa-spinner fa-spin"></i> : 'تطبيق'}
                                      </button>
                                    </div>
                                    {couponError && (
                                      <small style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '7px', fontSize: '12.5px', fontWeight: '600' }}>
                                        <i className="fa-solid fa-circle-exclamation"></i>
                                        {couponError}
                                      </small>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )}
                            <div>
                              <h4 style={{ margin: '0 0 10px 0', color: 'var(--black)', fontSize: '14px', fontWeight: '800' }}>بيانات الطالب</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '13.5px' }}>
                                <div><span className="muted">الاسم:</span> <strong>{user?.name}</strong></div>
                                <div><span className="muted">البريد الإلكتروني:</span> <strong>{user?.email}</strong></div>
                                <div><span className="muted">رقم الموبايل:</span> <strong dir="ltr">{user?.phone}</strong></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="field full">
                          <label>طريقة الدفع <span className="req">*</span></label>
                          <div className="radio-cards">
                            <label className="radio-card"><input type="radio" name="payment_method" value="instapay" checked={paymentMethod === 'instapay'} onChange={() => setPaymentMethod('instapay')} /><span><img src="https://play-lh.googleusercontent.com/_ks0_XUbrZOkeiXkjaiZEK1S-j1skuQgF1E8S3ff702CoVyaiGnbfXPK74WjgxMk0Q4v2hlhu8WTHxp52Wq0=w240-h480-rw" alt="InstaPay" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} /></span></label>
                            <label className="radio-card"><input type="radio" name="payment_method" value="vodafone_cash" checked={paymentMethod === 'vodafone_cash'} onChange={() => setPaymentMethod('vodafone_cash')} /><span><b className="m-voda"><i className="fa-solid fa-wallet"></i></b>محفظة إلكترونية</span></label>
                          </div>

                          <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px dashed var(--gray-200)', borderRadius: '16px', padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ flexShrink: 0, width: '180px' }}>
                              <div style={{ position: 'relative', width: '180px', height: '180px', background: '#fff', borderRadius: '14px', border: '1px solid var(--gray-200)', padding: '10px' }}>
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=${payNum}`} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                {paymentMethod === 'instapay' ? (
                                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: '10px', padding: '8px 12px', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>
                                    <img src="https://play-lh.googleusercontent.com/_ks0_XUbrZOkeiXkjaiZEK1S-j1skuQgF1E8S3ff702CoVyaiGnbfXPK74WjgxMk0Q4v2hlhu8WTHxp52Wq0=w240-h480-rw" alt="InstaPay" style={{ height: '28px', width: 'auto', display: 'block', objectFit: 'contain' }} />
                                  </div>
                                ) : (
                                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', width: '42px', height: '42px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                    <i className="fa-solid fa-wallet" style={{ color: '#e60000', fontSize: '18px' }}></i>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ flex: 1, minWidth: '200px' }}>
                              <h4 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px', color: 'var(--black)' }}>
                                {paymentMethod === 'instapay' ? 'خطوات الدفع عبر إنستاباي' : 'خطوات الدفع عبر المحفظة الإلكترونية'}
                              </h4>
                              <p style={{ fontSize: '13.5px', color: 'var(--muted)', marginBottom: '14px', lineHeight: '1.6' }}>
                                افتح تطبيق <strong>{paymentMethod === 'instapay' ? 'InstaPay' : 'المحفظة الخاصة بك (فودافون/أورانج/اتصالات/وي)'}</strong> وقم بعمل مسح (Scan) للـ QR Code، أو قم بتحويل المبلغ مباشرة إلى الرقم التالي:
                              </p>
                              <div className="pay-number" style={{ marginTop: 0 }}>
                                <strong>{payNum}</strong>
                                <button type="button" className="copy-btn" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {copied ? <><i className="fa-solid fa-check" style={{ color: '#16a34a' }}></i> تم النسخ!</> : <><i className="fa-regular fa-copy"></i> نسخ الرقم</>}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* بطاقة تحويل العملة التلقائية بالدولار والجنيه المصري */}
                          {(() => {
                            const { finalPrice, finalEgp, rate } = getItemPricing();

                            return (
                              <div style={{
                                marginTop: '16px',
                                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                                border: '1.5px solid #fde68a',
                                borderRadius: '14px',
                                padding: '16px 20px',
                                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.12)'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                      width: '46px',
                                      height: '46px',
                                      borderRadius: '50%',
                                      background: '#fef08a',
                                      color: '#b45309',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '22px',
                                      flexShrink: 0
                                    }}>
                                      <i className="fa-solid fa-coins"></i>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: '13.5px', color: '#92400e', fontWeight: 'bold', display: 'block' }}>
                                        المبلغ المطلوب تحويله بالجنيه المصري (EGP):
                                      </span>
                                      <span style={{ fontSize: '12px', color: '#b45309' }}>
                                        سعر الصرف المباشر: <strong>1 دولار = {rate.toFixed(2)} ج.م</strong> (تحديث تلقائي)
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{ textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <strong style={{ fontSize: '28px', color: '#92400e', fontWeight: '900' }}>
                                      {finalEgp.toLocaleString('en-US')}
                                    </strong>
                                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#b45309' }}>جنيه مصري</span>
                                  </div>
                                </div>

                                <div style={{
                                  marginTop: '12px',
                                  paddingTop: '10px',
                                  borderTop: '1px dashed #fcd34d',
                                  fontSize: '12.5px',
                                  color: '#78350f',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  <i className="fa-solid fa-circle-info" style={{ color: '#d97706' }}></i>
                                  <span>
                                    قيمة {isWholeTrack ? 'التراك' : 'الكورس'} الأساسية هي <strong>${finalPrice}</strong> — يرجى إرسال مبلغ <strong>{finalEgp.toLocaleString('en-US')} ج.م</strong> تماماً عبر {paymentMethod === 'instapay' ? 'تطبيق إنستاباي' : 'المحفظة الإلكترونية'} لسرعة تأكيد التحويل.
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Amount is calculated automatically, no need to show input */}

                        <div className="field full">
                          <label>
                            {paymentMethod === 'instapay' ? 'حساب إنستاباي أو الرقم الذي تم التحويل منه' : 'رقم الموبايل الذي تم التحويل منه'}
                            <span className="req">*</span>
                          </label>
                          <input 
                            className={errors.senderPhone ? 'invalid' : ''} 
                            name="senderPhone" 
                            dir="ltr" 
                            placeholder={paymentMethod === 'instapay' ? 'عنوان الدفع الخاص بك (username@instapay) أو رقم الموبايل' : '01xxxxxxxxx'} 
                            value={formData.senderPhone} 
                            onChange={handleInputChange} 
                            required 
                            minLength="3" 
                          />
                          {errors.senderPhone && <small className="error-text">{errors.senderPhone}</small>}
                        </div>

                        <div className="field full">
                          <label>صورة إثبات الدفع (Screenshot) <span className="req">*</span></label>
                          <label className={`upload-box ${errors.receipt ? 'invalid' : ''}`} style={{ borderColor: receipt ? '#16a34a' : (errors.receipt ? '#dc2626' : 'var(--gray-200)'), background: receipt ? '#f0fdf4' : 'transparent', position: 'relative' }}>
                            <input type="file" name="proof" accept="image/png, image/jpeg, image/jpg" onChange={handleFileChange} required />
                            {receipt ? (
                              <div style={{ color: '#16a34a' }}><i className="fa-solid fa-check-circle" style={{ fontSize: '24px', marginBottom: '8px' }}></i><br />تم إرفاق الصورة: {receipt.name}</div>
                            ) : (
                              <>
                                <i className="fa-solid fa-cloud-arrow-up"></i>
                                <div><strong>اضغط لرفع الصورة</strong> أو اسحبها هنا</div>
                                <small className="muted">JPG / PNG — حد أقصى 5 ميجا</small>
                              </>
                            )}
                          </label>
                          {errors.receipt && <small className="error-text">{errors.receipt}</small>}
                        </div>

                        {errorMsg && (
                          <div className="field full">
                            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '14px 16px', borderRadius: '10px', fontSize: '14.5px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '16px' }}></i>
                              <span>{errorMsg}</span>
                            </div>
                          </div>
                        )}

                        <div className="full">
                          <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={loading || !!activePendingOrder}
                            style={activePendingOrder ? { background: '#94a3b8', borderColor: '#94a3b8', cursor: 'not-allowed' } : undefined}
                          >
                            {loading ? (
                              <><i className="fa-solid fa-circle-notch fa-spin"></i> جاري الإرسال...</>
                            ) : activePendingOrder ? (
                              <><i className="fa-solid fa-hourglass-half"></i> طلب الاشتراك قيد المراجعة بالفعل</>
                            ) : (
                              <><i className="fa-solid fa-paper-plane"></i> {isWholeTrack ? 'إرسال وتأكيد اشتراك التراك' : 'إرسال وتأكيد الطلب'}</>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <UploadProgressModal
        isUploading={uploadState.isUploading}
        progress={uploadState.progress}
        loaded={uploadState.loaded}
        total={uploadState.total}
        title="جاري رفع إثبات الدفع والصورة..."
      />
    </main>
  );
}
export default Checkout;
