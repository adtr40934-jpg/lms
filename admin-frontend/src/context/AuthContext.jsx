import { createContext, useState, useEffect } from 'react';
import api from '../api/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.user && res.data.user.role === 'admin') {
        setUser(res.data.user);
        localStorage.setItem('admin_user', JSON.stringify(res.data.user));
      } else {
        setUser(null);
        localStorage.removeItem('admin_user');
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        setUser(null);
        localStorage.removeItem('admin_user');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem('admin_user', JSON.stringify(userData));
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    localStorage.removeItem('admin_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
