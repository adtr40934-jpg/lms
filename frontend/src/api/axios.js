import axios from 'axios';
import { getApiBaseUrl } from '../utils/backendUrl';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/me') && !url.includes('/auth/login') && !url.includes('/auth/admin-login')) {
        if (error.response.status === 403) {
          alert(error.response?.data?.message || 'هذا الحساب موقوف من قبل الإدارة.');
          window.location.href = '/login';
        } else if (error.response.status === 401) {
          if (error.response?.data?.message) {
            alert(error.response.data.message);
          }
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
