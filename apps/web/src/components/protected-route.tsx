import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'RECEPTION' | 'CASHIER' | 'ADMIN'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-slate-400">
        Cargando interfaz...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'RECEPTION') {
      return <Navigate to="/recepcion" replace />;
    }
    if (user.role === 'CASHIER') {
      return <Navigate to="/cajero" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
