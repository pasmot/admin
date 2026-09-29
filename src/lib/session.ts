/**
 * Token admin disimpan di sessionStorage (bukan localStorage) sesuai panduan
 * backend: berlaku 12 jam, hilang saat tab ditutup.
 */
const TOKEN_KEY = 'pm_admin_token';
const EXPIRES_KEY = 'pm_admin_expires_at';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  const s = storage();
  if (!s) return null;
  const token = s.getItem(TOKEN_KEY);
  const expiresAt = s.getItem(EXPIRES_KEY);
  if (token && expiresAt && Date.parse(expiresAt) <= Date.now()) {
    clearSession();
    return null;
  }
  return token;
}

export function saveSession(token: string, expiresAt?: string) {
  const s = storage();
  if (!s) return;
  s.setItem(TOKEN_KEY, token);
  if (expiresAt) s.setItem(EXPIRES_KEY, expiresAt);
  else s.removeItem(EXPIRES_KEY);
}

export function clearSession() {
  const s = storage();
  if (!s) return;
  s.removeItem(TOKEN_KEY);
  s.removeItem(EXPIRES_KEY);
}
