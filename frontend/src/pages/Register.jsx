import { useState, useContext, useEffect } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AuthSide from '../components/AuthSide';
import api from '../api/axios';
import SEO from '../components/common/SEO';

function Register() {
  const navigate = useNavigate();
  usePageReady(true);
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const { user, login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', password: '', passwordConfirm: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      navigate('/account/dashboard');
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    let newErrors = {};
    if (!formData.name) newErrors.name = 'الاسم بالكامل مطلوب';
    if (!formData.phone) newErrors.phone = 'رقم الموبايل مطلوب';
    if (!formData.email) newErrors.email = 'البريد الإلكتروني مطلوب';
    if (!formData.password) {
      newErrors.password = 'كلمة المرور مطلوبة';
    } else if (formData.password.length < 6) {
      newErrors.password = 'كلمة المرور يجب ألا تقل عن 6 خانات';
    } else if (!/[A-Za-z]/.test(formData.password) || !/\d/.test(formData.password)) {
      newErrors.password = 'كلمة المرور يجب أن تحتوي على حروف وأرقام معاً';
    }
    if (!formData.passwordConfirm) newErrors.passwordConfirm = 'تأكيد كلمة المرور مطلوب';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setErrors({ ...newErrors, passwordConfirm: 'كلمات المرور غير متطابقة' });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        password: formData.password
      });

      const result = response.data;
      if (result.requiresVerification) {
        const dest = `/verify-otp?email=${encodeURIComponent(result.email || formData.email)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`;
        navigate(dest);
        return;
      }

      if (result.user) {
        login(result.user);
        if (redirect) {
          navigate(redirect);
        } else {
          navigate('/account/dashboard');
        }
      }
    } catch (err) {
      if (err.response && err.response.data) {
        setErrorMsg(err.response.data.message || 'خطأ أثناء التسجيل');
      } else {
        setErrorMsg('فشل الاتصال بالخادم');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-wrap">
      <SEO
        title="إنشاء حساب جديد"
        description="إنشاء حساب طالب جديد في منصة محمد بهاء التعليمية."
        canonical="/register"
        robots="noindex, nofollow"
      />
      <AuthSide title="ابدأ رحلتك في التسويق النهارده" text="انشاء حساب في ثواني وتابع كورساتك وتقدمك من أي جهاز." />
      <div className="auth-main">
        <div className="auth-box">
          <h1>إنشاء حساب جديد</h1>
          <p>املأ بياناتك علشان تعمل حساب طالب.</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">

              <div className="field">
                <label>الاسم بالكامل</label>
                <div className="input-icon">
                  <i className="fa-regular fa-user"></i>
                  <input className={errors.name ? 'invalid' : ''} name="name" value={formData.name} onChange={handleChange} required autoComplete="name" minLength="3" pattern="^[\u0600-\u06FF\sA-Za-z]{3,}$" title="يجب إدخال حروف عربية أو إنجليزية فقط ولا يقل عن 3 حروف" placeholder="اكتب اسمك الثنائي على الأقل" />
                </div>
                {errors.name && <small className="error-text">{errors.name}</small>}
              </div>
              <div className="field">
                <label>رقم الموبايل</label>
                <div className="input-icon">
                  <i className="fa-solid fa-mobile-screen"></i>
                  <input className={errors.phone ? 'invalid' : ''} name="phone" value={formData.phone} onChange={handleChange} type="tel" dir="ltr" required placeholder="01xxxxxxxxx" autoComplete="tel" pattern="^01[0125][0-9]{8}$" title="يجب إدخال رقم محمول مصري صحيح مكون من 11 رقم ويبدأ بـ 01" />
                </div>
                {errors.phone && <small className="error-text">{errors.phone}</small>}
              </div>
              <div className="field">
                <label>البريد الإلكتروني</label>
                <div className="input-icon">
                  <i className="fa-regular fa-envelope"></i>
                  <input className={errors.email ? 'invalid' : ''} name="email" value={formData.email} onChange={handleChange} type="email" dir="ltr" required autoComplete="email" placeholder="name@example.com" />
                </div>
                {errors.email && <small className="error-text">{errors.email}</small>}
              </div>
              <div className="field">
                <label>كلمة المرور</label>
                <div className="input-icon">
                  <i className="fa-solid fa-lock"></i>
                  <input
                    className={errors.password ? 'invalid' : ''}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    type="password"
                    dir="ltr"
                    required
                    autoComplete="new-password"
                    minLength="6"
                    pattern="(?=.*[A-Za-z])(?=.*\d).{6,}"
                    title="كلمة المرور يجب أن تتكون من 6 خانات على الأقل وتحتوي على حروف وأرقام معاً"
                    placeholder="مثال: Pass123"
                  />
                </div>
                {errors.password && <small className="error-text">{errors.password}</small>}
                {!errors.password && (
                  <small style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                    يجب أن تتكون من 6 خانات على الأقل وتجمع بين الحروف والأرقام
                  </small>
                )}
              </div>
              <div className="field">
                <label>تأكيد كلمة المرور</label>
                <div className="input-icon">
                  <i className="fa-solid fa-lock"></i>
                  <input className={errors.passwordConfirm ? 'invalid' : ''} name="passwordConfirm" value={formData.passwordConfirm} onChange={handleChange} type="password" dir="ltr" required autoComplete="new-password" minLength="6" placeholder="••••••••" />
                </div>
                {errors.passwordConfirm && <small className="error-text">{errors.passwordConfirm}</small>}
              </div>

              {errorMsg && (
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '14px 16px', borderRadius: '10px', fontSize: '14.5px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '16px' }}></i>
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-user-plus"></i>}
                {loading ? ' جاري التسجيل...' : ' إنشاء الحساب'}
              </button>
            </div>
          </form>
          <div className="auth-switch">عندك حساب بالفعل؟ <Link to="/login">سجّل دخولك</Link></div>
        </div>
      </div>
    </section>
  );
}

export default Register;
