import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, type Role } from '../store/auth.store';

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'patient' ? '/dashboard' : '/soignant/dashboard'} replace />;
  }

  return <Outlet />;
}
