import { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { AuthContext } from '../context/AuthContext';

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/admin-login', { email, password });
      if (res.user && res.user.role === 'admin') {
        login(res.user);
        navigate(from, { replace: true });
      } else {
        setError('ليس لديك صلاحيات للدخول إلى هذه اللوحة');
        await api.post('/auth/logout');
      }
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#1c1c21', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#2a2a35', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ background: '#c81e1e', color: '#fff', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', fontWeight: 'bold', margin: '0 auto 15px' }}>ب</div>
          <h2 style={{ margin: 0 }}>لوحة تحكم الإدارة</h2>
        </div>
        {error && <div style={{ background: '#ff4d4d22', color: '#ff4d4d', padding: '12px', borderRadius: '6px', marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#a0a0b0' }}>البريد الإلكتروني</label>
            <input type="email" required style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #3f3f4e', background: '#1c1c21', color: '#fff', outline: 'none' }} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="admin@example.com" />
          </div>
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#a0a0b0' }}>كلمة المرور</label>
            <input type="password" required style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #3f3f4e', background: '#1c1c21', color: '#fff', outline: 'none' }} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" placeholder="••••••••" />
          </div>
          <button disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: '6px', background: '#c81e1e', color: '#fff', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'جاري التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
