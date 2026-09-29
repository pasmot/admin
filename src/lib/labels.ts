import type { MenuId } from '../types/admin';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'dark';

export const MENU_LABELS: Record<MenuId, string> = {
  ringkasan: 'Ringkasan',
  pengguna: 'Pengguna',
  verifikasi: 'Verifikasi',
  kios: 'Kios',
  transaksi: 'Transaksi',
  uang: 'Uang',
  inspeksi: 'Inspeksi',
  masalah: 'Masalah',
  voucher: 'Voucher',
  settings: 'Settings',
};

export const MENU_ORDER: MenuId[] = [
  'ringkasan',
  'pengguna',
  'verifikasi',
  'kios',
  'transaksi',
  'uang',
  'inspeksi',
  'masalah',
  'voucher',
  'settings',
];

export function menuHref(menu: MenuId, filter?: string): string {
  const base = menu === 'ringkasan' ? '/' : `/${menu}`;
  return filter ? `${base}?filter=${encodeURIComponent(filter)}` : base;
}

type StatusMeta = { label: string; tone: Tone };

export const ORDER_STATE: Record<string, StatusMeta> = {
  menunggu_bayar: { label: 'Menunggu bayar', tone: 'warning' },
  diproses: { label: 'Diproses', tone: 'warning' },
  dikirim: { label: 'Dikirim', tone: 'info' },
  selesai: { label: 'Selesai', tone: 'success' },
  dibatalkan: { label: 'Dibatalkan', tone: 'danger' },
};

export const PAY_STATE: Record<string, StatusMeta> = {
  menunggu: { label: 'Menunggu bayar', tone: 'warning' },
  sukses: { label: 'Sukses', tone: 'success' },
  gagal: { label: 'Gagal', tone: 'danger' },
  hangus: { label: 'Hangus', tone: 'neutral' },
  batal: { label: 'Dibatalkan pembeli', tone: 'neutral' },
  perlu_refund: { label: 'Perlu refund', tone: 'warning' },
  refund: { label: 'Refund', tone: 'info' },
};

export const KYC_STATE: Record<string, StatusMeta> = {
  belum: { label: 'belum', tone: 'neutral' },
  menunggu: { label: 'menunggu', tone: 'warning' },
  disetujui: { label: 'disetujui', tone: 'success' },
  ditolak: { label: 'ditolak', tone: 'danger' },
};

export const USER_STATUS: Record<string, StatusMeta> = {
  aktif: { label: 'aktif', tone: 'success' },
  ditangguhkan: { label: 'ditangguhkan', tone: 'danger' },
};

export const WITHDRAWAL_STATE: Record<string, StatusMeta> = {
  menunggu: { label: 'menunggu', tone: 'warning' },
  dicairkan: { label: 'dicairkan', tone: 'success' },
  ditolak: { label: 'ditolak', tone: 'danger' },
};

export const INSPECTION_STATE: Record<string, StatusMeta> = {
  menunggu: { label: 'menunggu', tone: 'warning' },
  dijadwalkan: { label: 'dijadwalkan', tone: 'info' },
  selesai: { label: 'selesai', tone: 'success' },
  dibatalkan: { label: 'dibatalkan', tone: 'danger' },
};

export const REPORT_STATE: Record<string, StatusMeta> = {
  baru: { label: 'baru', tone: 'warning' },
  selesai: { label: 'selesai', tone: 'success' },
};

export const REFUND_REASON: Record<string, string> = {
  paid_after_close: 'Dibayar setelah pesanan ditutup',
  returned: 'Barang dikembalikan',
};

export function statusMeta(map: Record<string, StatusMeta>, value: string | null | undefined): StatusMeta {
  if (!value) return { label: '—', tone: 'neutral' };
  return map[value] ?? { label: value.replace(/_/g, ' '), tone: 'neutral' };
}
