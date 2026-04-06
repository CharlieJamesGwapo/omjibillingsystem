import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../lib/auth';
import type { UserRole } from '../lib/types';

interface ProtectedRouteProps {
  roles?: UserRole[];
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0) {
    const userRole = getUserRole();
    if (!userRole || !roles.includes(userRole)) {
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
}
