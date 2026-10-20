import { useState, useContext, useEffect } from 'react';
import { usePageReady } from '../hooks/usePageReady';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AuthSide from '../components/AuthSide';
import api from '../api/axios';
import SEO from '../components/common/SEO';

function Login() {
  const navigate = useNavigate();
  usePageReady(true);
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const { user, login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user && user.role !== 'admin') {
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
    if (!formData.email) newErrors.email = 'البريد الإلكتروني مطلوب';
    if (!formData.password) newErrors.password = 'كلمة المرور مطلوبة';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email: formData.email,
        password: formData.password
      });

      const result = response.data;
      if (result.user?.role === 'admin') {
        await api.post('/auth/logout');
        login(null);
        setErrorMsg('هذا الحساب غير موجود');
        alert('هذا الحساب غير موجود');
        return;
      }

      login(result.user);
      if (redirect) {
        navigate(redirect);
      } else {
        navigate('/account/dashboard');
      }
    } catch (err) {
      if (err.response?.data?.requiresVerification) {
        const emailToVerify = err.response.data.email || formData.email;
        alert(err.response.data.message || 'يرجى تأكيد بريدك الإلكتروني أولاً لتفعيل حسابك');
        const dest = `/verify-otp?email=${encodeURIComponent(emailToVerify)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`;
        navigate(dest);
        return;
      }
      const msg = err.response?.data?.message || 'بيانات الدخول غير صحيحة';
      setErrorMsg(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-wrap">
      <SEO
        title="تسجيل الدخول"
        description="تسجيل الدخول إلى حسابك في منصة محمد بهاء التعليمية."
        canonical="/login"
        robots="noindex, nofollow"
      />
      <AuthSide title="أهلاً بيك تاني" text="سجّل دخولك وكمّل التعلم من آخر درس وقفت عنده." />
      <div className="auth-main">
        <div className="auth-box">
          <h1>تسجيل الدخول</h1>
          <p>ادخل على حسابك لمتابعة كورساتك.</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
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
                  <input className={errors.password ? 'invalid' : ''} name="password" value={formData.password} onChange={handleChange} type="password" dir="ltr" required autoComplete="current-password" placeholder="••••••••" />
                </div>
                {errors.password && <small className="error-text">{errors.password}</small>}
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
                {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-right-to-bracket"></i>}
                {loading ? ' جاري الدخول...' : ' دخول'}
              </button>
            </div>
          </form>
          <div className="auth-switch">ليس لديك حساب؟ <Link to="/register">اعمل حساب جديد</Link></div>
        </div>
      </div>
    </section>
  );
}

export default Login;
