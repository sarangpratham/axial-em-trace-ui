import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, loginWithPassword, logoutCurrentUser } from '../lib/authApi.ts';
import type { AuthStatus } from '../lib/authRouting.ts';
import { subscribeUnauthorized } from '../lib/http.ts';
import type { AuthenticatedUser } from '../types.ts';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (email: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (cancelled) return;
        setUser(currentUser);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        setUser(null);
        setStatus('unauthenticated');
      }
    };

    void bootstrap();
    const unsubscribe = subscribeUnauthorized(() => {
      if (cancelled) return;
      setUser(null);
      setStatus('unauthenticated');
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    status,
    user,
    async login(email: string, password: string) {
      const currentUser = await loginWithPassword(email, password);
      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    },
    async logout() {
      try {
        await logoutCurrentUser();
      } finally {
        setUser(null);
        setStatus('unauthenticated');
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
