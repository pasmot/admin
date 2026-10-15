import { clearSession, getToken } from './session';

/**
 * PasarMotor admin API client.
 *
 * Semua endpoint dashboard ada di bawah `/api/v1/admin`. Base URL bisa diganti
 * lewat NEXT_PUBLIC_API_BASE_URL. Domain dashboard wajib terdaftar di
 * FRONTEND_URLS server, kalau tidak semua request ditolak 403.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.pasarmotor.com'
).replace(/\/$/, '');

export const ADMIN_API = `${API_BASE_URL}/api/v1/admin`;

export type ListMeta = { page: number; limit: number; total_count: number };
export type ListResult<T> = { data: T[]; meta: ListMeta };

type ErrorEnvelope = {
  success?: false;
  errors?: { status_code?: string; detail?: string }[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Dipanggil saat token tidak berlaku lagi (401) — AuthContext mendaftarkan handler-nya. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Input tidak valid.',
  401: 'Sesi berakhir. Silakan masuk lagi.',
  403: 'Kamu tidak punya akses ke menu ini.',
  404: 'Data tidak ditemukan.',
  409: 'Status data sudah berubah. Muat ulang halaman.',
  429: 'Terlalu banyak percobaan. Coba lagi nanti.',
  500: 'Terjadi kesalahan, coba lagi.',
  503: 'Server sedang sibuk, coba lagi sebentar lagi.',
};

/**
 * Endpoint Verifikasi mengirim `detail` berbahasa Inggris, jadi pesannya
 * dipetakan dari HTTP status, bukan ditampilkan mentah.
 */
const VERIFICATION_MESSAGES: Record<number, string> = {
  400: 'Permintaan tidak valid.',
  404: 'Pengajuan tidak ditemukan.',
  409: 'Pengajuan ini sudah diputuskan.',
  410: 'Foto tidak tersedia.',
};

function localizeError(path: string, status: number, detail: string | undefined): string {
  if (status === 403 && detail === 'origin not allowed') {
    return 'Domain dashboard belum terdaftar di server. Hubungi tim backend.';
  }
  if (path.startsWith('/verifications')) {
    if (status === 400 && detail?.includes('reason')) return 'Alasan penolakan wajib diisi.';
    return VERIFICATION_MESSAGES[status] ?? FALLBACK_MESSAGES[status] ?? 'Terjadi kesalahan, coba lagi.';
  }
  return detail ?? FALLBACK_MESSAGES[status] ?? `Terjadi kesalahan (HTTP ${status}).`;
}

async function toApiError(path: string, res: Response): Promise<ApiError> {
  let detail: string | undefined;
  try {
    const json = (await res.json()) as ErrorEnvelope;
    detail = json.errors?.find((e) => e.detail)?.detail;
  } catch {
    // body bukan JSON
  }
  return new ApiError(res.status, localizeError(path, res.status, detail));
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function rawRequest(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<Response> {
  const { auth = true, headers, ...rest } = init;
  const token = auth ? getToken() : null;

  let res: Response;
  try {
    res = await fetch(`${ADMIN_API}${path}`, {
      ...rest,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Tidak bisa terhubung ke server. Periksa koneksi internet.');
  }

  if (!res.ok) {
    const err = await toApiError(path, res);
    if (res.status === 401 && auth) {
      clearSession();
      onUnauthorized?.();
    }
    throw err;
  }
  return res;
}

/** Request yang mengembalikan item tunggal (`{ success, data }`). */
export async function apiRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const res = await rawRequest(path, {
    method: init.method ?? 'GET',
    auth: init.auth,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  const json = JSON.parse(text) as { data?: T };
  return (json && 'data' in json ? json.data : json) as T;
}

/** Request list (`{ data: [...], meta }`). */
export async function apiList<T>(path: string, query?: Query): Promise<ListResult<T>> {
  const res = await rawRequest(`${path}${buildQuery(query)}`);
  const json = (await res.json()) as { data?: T[] | null; meta?: Partial<ListMeta> & { per_page?: number } };
  const data = Array.isArray(json.data) ? json.data : [];
  return {
    data,
    meta: {
      page: json.meta?.page ?? 1,
      // Sebagian endpoint (mis. Verifikasi) mengirim `per_page`, bukan `limit`.
      limit: json.meta?.limit ?? json.meta?.per_page ?? data.length,
      total_count: json.meta?.total_count ?? data.length,
    },
  };
}

/**
 * Mengambil gambar terproteksi (KTP/selfie) sebagai object URL. Pemanggil
 * wajib `URL.revokeObjectURL` saat selesai. Tidak di-cache.
 */
export async function apiBlobUrl(path: string): Promise<string> {
  const res = await rawRequest(path, { headers: { Accept: 'image/*' } });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const api = {
  get: <T>(path: string, query?: Query) => apiRequest<T>(`${path}${buildQuery(query)}`),
  post: <T = unknown>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T = unknown>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body: body ?? {} }),
  del: <T = unknown>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  list: apiList,
};
