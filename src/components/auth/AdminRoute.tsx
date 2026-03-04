import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { role, loading, user } = useAuth();

  // Only show loading on initial mount when we don't know auth state yet
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

  // Don't block on role loading - only redirect if we know they're not admin
  if (!loading && !isAdmin(role)) {
    return <Navigate to="/calendar" replace />;
  }

  return <>{children}</>;
}


