import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';

function AuthLoadingState() {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      loading workspace…
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <AuthLoadingState />;
  }
  if (status !== 'authenticated') {
    return (
      <Navigate
        replace
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <>{children}</>;
}
