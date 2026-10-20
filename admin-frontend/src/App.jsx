import { lazy, Suspense, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import AdminLogin from './pages/AdminLogin';
import './index.css';

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const DetailedStats = lazy(() => import('./pages/admin/DetailedStats'));
const CoursesAdmin = lazy(() => import('./pages/admin/Courses'));
const CourseForm = lazy(() => import('./pages/admin/CourseForm'));
const TracksAdmin = lazy(() => import('./pages/admin/Tracks'));
const TrackForm = lazy(() => import('./pages/admin/TrackForm'));
const CourseContent = lazy(() => import('./pages/admin/CourseContent'));
const Categories = lazy(() => import('./pages/admin/Categories'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const Students = lazy(() => import('./pages/admin/Students'));
const Messages = lazy(() => import('./pages/admin/Messages'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const Reviews = lazy(() => import('./pages/admin/Reviews'));
const Certificates = lazy(() => import('./pages/admin/Certificates'));
const TrainerCertificates = lazy(() => import('./pages/admin/TrainerCertificates'));
const LogsExplorer = lazy(() => import('./pages/admin/LogsExplorer'));
const UserActivityTimeline = lazy(() => import('./pages/admin/UserActivityTimeline'));
const SecurityCenter = lazy(() => import('./pages/admin/SecurityCenter'));

function AdminLoadingScreen() {
  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#1c1c21', color: '#fff' }}>
      <i className="fa-solid fa-circle-notch fa-spin fa-3x" style={{ color: '#c81e1e' }}></i>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading && !user) {
    return <AdminLoadingScreen />;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<AdminLoadingScreen />}>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/stats" element={<ProtectedRoute><DetailedStats /></ProtectedRoute>} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/admin/courses" element={<ProtectedRoute><CoursesAdmin /></ProtectedRoute>} />
        <Route path="/admin/course-form" element={<ProtectedRoute><CourseForm /></ProtectedRoute>} />
        <Route path="/admin/tracks" element={<ProtectedRoute><TracksAdmin /></ProtectedRoute>} />
        <Route path="/admin/track-form" element={<ProtectedRoute><TrackForm /></ProtectedRoute>} />
        <Route path="/admin/course-content" element={<ProtectedRoute><CourseContent /></ProtectedRoute>} />
        <Route path="/admin/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
        <Route path="/admin/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
        <Route path="/admin/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/admin/coupons" element={<ProtectedRoute><Coupons /></ProtectedRoute>} />
        <Route path="/admin/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
        <Route path="/admin/certificates" element={<ProtectedRoute><Certificates /></ProtectedRoute>} />
        <Route path="/admin/trainer-certificates" element={<ProtectedRoute><TrainerCertificates /></ProtectedRoute>} />
        <Route path="/admin/logs" element={<ProtectedRoute><LogsExplorer /></ProtectedRoute>} />
        <Route path="/admin/user-activity" element={<ProtectedRoute><UserActivityTimeline /></ProtectedRoute>} />
        <Route path="/admin/security" element={<ProtectedRoute><SecurityCenter /></ProtectedRoute>} />
        <Route path="/admin/security/incidents" element={<Navigate to="/admin/security" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
