import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import DiscountPopup from './components/DiscountPopup';
import { useMainJs } from './hooks/useMainJs';
import socket, { getDeviceId } from './socket';

const CourseDetails = lazy(() => import('./pages/CourseDetails'));
const Courses = lazy(() => import('./pages/Courses'));
const TrackDetails = lazy(() => import('./pages/TrackDetails'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyOtp = lazy(() => import('./pages/VerifyOtp'));
const Subscribe = lazy(() => import('./pages/Subscribe'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Account = lazy(() => import('./pages/account/Account'));
const Learn = lazy(() => import('./pages/account/Learn'));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'));

function AppLayout() {
  useMainJs();
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/verify-otp';
  const isLearnPage = location.pathname.startsWith('/account/learn');

  useEffect(() => {
    // Identify user, country, and deviceId for accurate stats
    const deviceId = getDeviceId();
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        socket.emit('identify', { countryCode: data.country_code || '', deviceId });
      })
      .catch(() => {
        socket.emit('identify', { deviceId });
      });
  }, []);

  useEffect(() => {
    if (window.showGlobalLoader) {
      window.showGlobalLoader();
    }
  }, [location.pathname]);

  return (
    <>
      <DiscountPopup />
      {!isLearnPage && <Header />}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/course/:slug" element={<CourseDetails />} />
          <Route path="/tracks" element={<Courses defaultTab="tracks" />} />
          <Route path="/courses" element={<Navigate to="/tracks?tab=courses" replace />} />
          <Route path="/track/:slug" element={<TrackDetails />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/verify-certificate" element={<VerifyCertificate />} />
          <Route path="/verify-certificate/:id" element={<VerifyCertificate />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/account/*" element={<Account />} />
          <Route path="/account/learn/:slug" element={<Learn />} />
          <Route path="/account/learn/track/:slug" element={<Learn />} />
        </Routes>
      </Suspense>
      {!isAuthPage && !isLearnPage && <Footer />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
