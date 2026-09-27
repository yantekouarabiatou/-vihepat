import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from '../features/marketing/LandingPage';
import { AuthPage } from '../features/auth/AuthPage';
import { DashboardPage as PatientDashboardPage } from '../features/patient/DashboardPage';
import { DashboardPage as SoignantDashboardPage } from '../features/soignant/DashboardPage';
import { ProtectedRoute } from '../components/ProtectedRoute';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <AuthPage /> },
  {
    element: <ProtectedRoute allowedRoles={['patient']} />,
    children: [{ path: '/dashboard', element: <PatientDashboardPage /> }],
  },
  {
    element: <ProtectedRoute allowedRoles={['soignant']} />,
    children: [{ path: '/soignant/dashboard', element: <SoignantDashboardPage /> }],
  },
]);
