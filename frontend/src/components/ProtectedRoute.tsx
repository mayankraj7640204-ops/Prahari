import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function ProtectedRoute() {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="font-sans text-xs tracking-[0.2em] uppercase text-white/50">
            Verifying Credentials
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based routing protection
  if (location.pathname.startsWith('/dashboard/admin') && !isAdmin) {
    return <Navigate to="/dashboard/tourist" replace />;
  }

  if (location.pathname.startsWith('/dashboard/tourist') && isAdmin) {
    // Optional: Force admins to use admin dashboard
    return <Navigate to="/dashboard/admin" replace />;
  }

  return <Outlet />;
}
