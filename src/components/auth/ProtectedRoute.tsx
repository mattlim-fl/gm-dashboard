import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AccessDenied from '@/pages/AccessDenied';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, accessAllowed } = useAuth();

  // Only show loading on initial mount when we don't know auth state yet
  // Don't flash loading screen if user is already authenticated
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gm-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">GM</span>
          </div>
          <p className="text-gm-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Don't block on accessAllowed loading - show content while checking
  if (!loading && !accessAllowed) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
