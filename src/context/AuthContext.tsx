'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, apiRequest, setUnauthorizedHandler } from '../lib/api';
import { clearSession, getToken, saveSession } from '../lib/session';
import type { AdminMe, LoginResponse, MenuId } from '../types/admin';

type AuthState = {
  me: AdminMe | null;
  /** true selama sesi awal sedang dicek. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  can: (menu: MenuId) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const data = await api.get<AdminMe>('/me');
    setMe({ ...data, menus: data.menus ?? [] });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe(null);
      router.replace('/login?expired=1');
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        await refreshMe();
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      saveSession(res.token, res.expires_at);
      await refreshMe();
    },
    [refreshMe],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // token mungkin sudah tidak berlaku — tetap keluar
    }
    clearSession();
    setMe(null);
    router.replace('/login');
  }, [router]);

  const can = useCallback((menu: MenuId) => !!me?.menus.includes(menu), [me]);

  const value = useMemo(
    () => ({ me, loading, login, logout, refreshMe, can }),
    [me, loading, login, logout, refreshMe, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
