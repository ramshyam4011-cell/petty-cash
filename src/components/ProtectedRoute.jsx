import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children, allowedRoles, requiredPage }) => {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin bypass (safety)
  if (user.role?.toUpperCase() === 'ADMIN') return <>{children}</>;

  // Role check
  if (allowedRoles && !allowedRoles.includes(user.role?.toUpperCase())) {
    return <Navigate to="/" replace />;
  }

  // Page Access check
  if (requiredPage) {
    const hasAccess = user.pageAccess && user.pageAccess.includes(requiredPage);
    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;