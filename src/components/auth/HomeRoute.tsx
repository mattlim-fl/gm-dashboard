import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';

interface HomeRouteProps {
  children?: ReactNode;
}

/**
 * HomeRoute redirects users to their appropriate home page based on role:
 * - Admins: Dashboard
 * - Basic users: Calendar
 */
export function HomeRoute({ children }: HomeRouteProps) {
  const { role, loading, user } = useAuth();

  if (loading) {
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

  // Redirect based on role
  if (isAdmin(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Basic users go to calendar
  return <Navigate to="/calendar" replace />;
}

