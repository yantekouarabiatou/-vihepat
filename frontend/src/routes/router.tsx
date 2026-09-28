import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from '../features/marketing/LandingPage';
import { AuthPage } from '../features/auth/AuthPage';
import { DashboardPage as PatientDashboardPage } from '../features/patient/DashboardPage';
import { PeerGroupsPage } from '../features/patient/PeerGroupsPage';
import { DashboardPage as SoignantDashboardPage } from '../features/soignant/DashboardPage';
import { PatientsPage } from '../features/soignant/PatientsPage';
import { PatientDetailPage } from '../features/soignant/PatientDetailPage';
import { CommuniquesPage } from '../features/soignant/CommuniquesPage';
import { AdminPage } from '../features/admin/AdminPage';
import { ProtectedRoute } from '../components/ProtectedRoute';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <AuthPage /> },
  {
    element: <ProtectedRoute allowedRoles={['patient']} />,
    children: [
      { path: '/dashboard', element: <PatientDashboardPage /> },
      { path: '/groupes', element: <PeerGroupsPage /> },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['soignant', 'admin']} />,
    children: [
      { path: '/soignant/dashboard', element: <SoignantDashboardPage /> },
      { path: '/soignant/patients', element: <PatientsPage /> },
      { path: '/soignant/patients/:id', element: <PatientDetailPage /> },
      { path: '/soignant/communiques', element: <CommuniquesPage /> },
    ],

  },
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [
      { path: '/soignant/administration', element: <AdminPage /> },
    ],
  },
]);
