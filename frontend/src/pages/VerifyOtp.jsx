import { useState, useContext, useEffect, useRef } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AuthSide from '../components/AuthSide';
import api from '../api/axios';
import SEO from '../components/common/SEO';

function VerifyOtp() {
  const navigate = useNavigate();
  usePageReady(true);
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const redirect = searchParams.get('redirect');
  const { user, login } = useContext(AuthContext);

  const [email, setEmail] = useState(emailParam);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(!emailParam);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/account/dashboard');
    }
  }, [user, navigate]);

  // Focus the first empty digit box on load
  useEffect(() => {
    if (!isEditingEmail && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isEditingEmail]);

  // Resend countdown timer
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleDigitChange = (index, value) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (!cleaned) {
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // Take the last entered character if multiple
    newDigits[index] = cleaned.slice(-1);
    setOtpDigits(newDigits);
    setErrorMsg('');

    // Advance focus to next input
    if (index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }

    // If all digits are filled, automatically verify
    const fullOtp = newDigits.join('');
    if (fullOtp.length === 6 && !newDigits.includes('')) {
      performVerify(fullOtp);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0 && inputRefs.current[index - 1]) {
        // If current is empty, backspace previous
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1].focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowRight' && index > 0) {
      // In RTL, ArrowRight might move left depending on direction, standard handling:
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (!pastedData) return;

    const digits = pastedData.slice(0, 6).split('');
    const newDigits = ['', '', '', '', '', ''];
    digits.forEach((d, i) => {
      newDigits[i] = d;
    });
    setOtpDigits(newDigits);
    setErrorMsg('');

    if (digits.length >= 6) {
      if (inputRefs.current[5]) inputRefs.current[5].focus();
      performVerify(newDigits.join(''));
    } else if (inputRefs.current[digits.length]) {
      inputRefs.current[digits.length].focus();
    }
  };

  const performVerify = async (codeToVerify) => {
    const code = codeToVerify || otpDigits.join('');
    if (!email) {
      setErrorMsg('يرجى تحديد البريد الإلكتروني أولاً');
      return;
    }
    if (code.length !== 6) {
      setErrorMsg('يرجى إدخال رمز التحقق كاملاً المكوّن من 6 أرقام');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await api.post('/auth/verify-otp', {
        email: email.trim(),
        otp: code
      });

      const result = response.data;
      setSuccessMsg('تم تأكيد حسابك بنجاح! جاري تحويلك...');
      login(result.user);

      setTimeout(() => {
        if (redirect) {
          navigate(redirect);
        } else {
          navigate('/account/dashboard');
        }
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.message || 'رمز التحقق غير صحيح، يرجى المحاولة مرة أخرى';
      setErrorMsg(msg);
      // Highlight/shake inputs and select first empty or first digit
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performVerify();
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    if (!email) {
      setErrorMsg('يرجى كتابة البريد الإلكتروني لإعادة إرسال الرمز');
      return;
    }

    setResending(true);
    setErrorMsg('');
    try {
      const response = await api.post('/auth/resend-otp', {
        email: email.trim()
      });
      setSuccessMsg(response.data?.message || 'تم إرسال رمز تحقق جديد بنجاح إلى بريدك!');
      setCountdown(60);
      setOtpDigits(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'تعذر إعادة إرسال الرمز حالياً، يرجى المحاولة لاحقاً');
    } finally {
      setResending(false);
    }
  };

  return (
    <section className="auth-wrap">
      <SEO
        title="تأكيد البريد الإلكتروني"
        description="تأكيد البريد الإلكتروني وتفعيل الحساب في منصة محمد بهاء التعليمية."
        canonical="/verify-otp"
        robots="noindex, nofollow"
      />
      <AuthSide
        title="خطوة واحدة فقط لتأكيد هويتك"
        text="لحماية حسابك وبياناتك والتأكد من وصول إشعارات وكورساتك، أرسلنا رمز تحقق لبريدك الإلكتروني."
      />
      <div className="auth-main">
        <div className="auth-box" style={{ maxWidth: '480px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: 'rgba(200, 30, 30, 0.1)',
                color: '#c81e1e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                border: '1px solid rgba(200, 30, 30, 0.25)',
                boxShadow: '0 8px 24px rgba(200, 30, 30, 0.12)'
              }}
            >
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '900', marginBottom: '8px', color: '#111827' }}>تأكيد البريد الإلكتروني</h1>
            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
              أدخل رمز التحقق (OTP) المكوّن من 6 أرقام المرسل إلى:
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '12px',
                background: '#f1f5f9',
                padding: '8px 16px',
                borderRadius: '24px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                color: '#0f172a',
                direction: 'ltr'
              }}
            >
              <i className="fa-regular fa-envelope" style={{ color: '#c81e1e' }}></i>
              <strong style={{ letterSpacing: '0.5px' }}>{email || 'لم يتم تحديد بريد'}</strong>
              <button
                type="button"
                onClick={() => setIsEditingEmail(!isEditingEmail)}
                title="تعديل البريد"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <i className="fa-solid fa-pen-to-square"></i>
              </button>
            </div>

            {isEditingEmail && (
              <div style={{ marginTop: '14px', textAlign: 'right' }}>
                <label style={{ fontSize: '12.5px', color: '#64748b', display: 'block', marginBottom: '6px' }}>تعديل البريد الإلكتروني:</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (email) setIsEditingEmail(false);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '13.5px' }}
                  >
                    حفظ
                  </button>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', textAlign: 'center', fontSize: '13.5px', color: '#64748b', fontWeight: '600', marginBottom: '12px' }}>
                رمز التحقق (6 أرقام)
              </label>
              <div
                dir="ltr"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                  direction: 'ltr'
                }}
                onPaste={handlePaste}
              >
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    style={{
                      width: '50px',
                      height: '58px',
                      textAlign: 'center',
                      fontSize: '26px',
                      fontWeight: '800',
                      fontFamily: "'Cairo', sans-serif",
                      borderRadius: '12px',
                      background: '#fff',
                      border: digit ? '2px solid #c81e1e' : '1.5px solid #cbd5e1',
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: digit ? '0 0 0 3px rgba(200, 30, 30, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  />
                ))}
              </div>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: '#fef2f2',
                  color: '#b91c1c',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '18px',
                  lineHeight: '1.5'
                }}
              >
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '16px', flexShrink: 0 }}></i>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  background: '#f0fdf4',
                  color: '#15803d',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '18px',
                  lineHeight: '1.5'
                }}
              >
                <i className="fa-solid fa-circle-check" style={{ fontSize: '16px', flexShrink: 0 }}></i>
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading || otpDigits.join('').length < 6}
              style={{ padding: '14px', fontSize: '15.5px', fontWeight: '700' }}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> جاري التحقق...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check-circle" style={{ marginLeft: '6px' }}></i> تأكيد الرمز وتفعيل الحساب
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: '22px',
              paddingTop: '18px',
              borderTop: '1px solid #e2e8f0',
              textAlign: 'center',
              fontSize: '14px',
              color: '#475569'
            }}
          >
            {countdown > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <i className="fa-regular fa-clock" style={{ color: '#c81e1e', fontSize: '15px' }}></i>
                <span>يمكنك إعادة إرسال الرمز خلال:</span>
                <strong
                  style={{
                    color: '#c81e1e',
                    background: 'rgba(200, 30, 30, 0.08)',
                    border: '1px solid rgba(200, 30, 30, 0.2)',
                    padding: '2px 10px',
                    borderRadius: '8px',
                    fontSize: '15.5px',
                    fontWeight: '800',
                    direction: 'ltr',
                    display: 'inline-block'
                  }}
                >
                  {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </strong>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>لم يصلك الرمز؟</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#c81e1e',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '14px',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  {resending ? 'جاري الإرسال...' : 'إعادة إرسال الرمز الآن'}
                </button>
              </div>
            )}
          </div>

          <div className="auth-switch" style={{ marginTop: '20px' }}>
            تريد العودة؟ <Link to="/login">تسجيل الدخول</Link> أو <Link to="/register">إنشاء حساب جديد</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default VerifyOtp;
