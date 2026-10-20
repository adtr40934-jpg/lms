import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SettingsProvider>
  </React.StrictMode>,
)
