import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { login as loginApi } from '../api/client';
import { tokenStorage } from '../api/tokenStorage';
import type { UserProfile } from '../api/types';

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => tokenStorage.getUser());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null && tokenStorage.getAccessToken() !== null,
      async login(email: string, password: string) {
        const res = await loginApi(email, password);
        tokenStorage.save(res.token, res.user);
        setUser(res.user);
      },
      logout() {
        tokenStorage.clear();
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
