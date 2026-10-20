import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.alert = async (message) => {
  const { default: Swal } = await import('sweetalert2');
  const isSuccess = /تم|بنجاح/.test(message);
  const isError = /خطأ|موقوف|مرفوض|غير صحيح/.test(message);
  return Swal.fire({
    text: message,
    icon: isSuccess ? 'success' : isError ? 'error' : 'info',
    confirmButtonText: 'حسناً',
    confirmButtonColor: '#c81e1e'
  });
};

window.SwalConfirm = async (message, onConfirm) => {
  const { default: Swal } = await import('sweetalert2');
  return Swal.fire({
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#c81e1e',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'نعم، متأكد',
    cancelButtonText: 'إلغاء'
  }).then((result) => {
    if (result.isConfirmed) {
      onConfirm();
    }
  });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
