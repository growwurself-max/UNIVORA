import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AcademicManagement from './pages/AcademicManagement';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import Exams from './pages/Exams';
import Results from './pages/Results';
import Fees from './pages/Fees';
import Payments from './pages/Payments';
import FeeDashboard from './pages/FeeDashboard';
import Payroll from './pages/Payroll';
import Reports from './pages/Reports';
import AIChatBot from './components/AIChatBot';
import StaffManagement from './pages/StaffManagement';

const getDashboardPath = (user) =>
  user?.profile?.role === 'super_admin' ? '/admin' : '/dashboard';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!user.profile?.role) {
    return <AccessDenied message="Your account has no assigned role. Contact your administrator." />;
  }

  return children;
}

function AccessDenied({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-gray-900">Access unavailable</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <Link to="/login" className="inline-block mt-5 text-sm font-medium text-primary-600 hover:text-primary-700">
          Return to sign in
        </Link>
      </div>
    </div>
  );
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!user.profile?.role) {
    return <AccessDenied message="Your account has no assigned role. Contact your administrator." />;
  }

  if (user.profile?.role !== 'super_admin') {
    return <AccessDenied message="Your account is not authorized to access the Super Admin dashboard." />;
  }

  return children;
}

const ADMIN_ROLES = ['owner', 'admin', 'super_admin', 'College Admin'];

function InstitutionAdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!ADMIN_ROLES.includes(user.profile?.role)) {
    return <AccessDenied message="Your account is not authorized to access this page." />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to={getDashboardPath(user)} />;
  }

  return children;
}

function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (!user.profile?.role) {
    return <AccessDenied message="Your account has no assigned role. Contact your administrator." />;
  }
  return <Navigate to={getDashboardPath(user)} />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/academic" element={<AcademicManagement />} />
          <Route path="/academic/:resource" element={<AcademicManagement />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/results" element={<Results />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/fees/dashboard" element={<FeeDashboard />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/payroll" element={<InstitutionAdminRoute><Payroll /></InstitutionAdminRoute>} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/staff" element={<InstitutionAdminRoute><StaffManagement /></InstitutionAdminRoute>} />
        </Route>

        <Route path="/admin" element={<AdminRoute><SuperAdminDashboard /></AdminRoute>} />
        <Route path="/" element={<HomeRoute />} />
      </Routes>
      {!loading && user && <AIChatBot />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
