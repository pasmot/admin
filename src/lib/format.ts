const rupiahFormatter = new Intl.NumberFormat('id-ID');

/** 31850000 → "Rp 31.850.000" */
export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}Rp ${rupiahFormatter.format(Math.abs(value))}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // "YYYY-MM-DD" diperlakukan sebagai tanggal lokal, bukan UTC.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO → "5 Jun 2026" */
export function formatDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO → "5 Jun 2026, 14.05" */
export function formatDateTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(value)}, ${hh}.${mm}`;
}

/** Date → "YYYY-MM-DD" (lokal) untuk input tanggal. */
export function toDateInput(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  QRIS: 'QRIS',
  GOPAY: 'GoPay',
  OVO: 'OVO',
  DANA: 'DANA',
  SHOPEEPAY: 'ShopeePay',
  LINKAJA: 'LinkAja',
  CREDIT_CARD: 'Kartu kredit',
  ALFAMART: 'Alfamart',
  INDOMARET: 'Indomaret',
};

/** Kode DOKU mentah → label. VIRTUAL_ACCOUNT_BCA → "Virtual Account BCA". */
export function paymentMethodLabel(code: string | null | undefined): string {
  if (!code) return '—';
  const upper = code.toUpperCase();
  if (PAYMENT_METHOD_LABELS[upper]) return PAYMENT_METHOD_LABELS[upper];
  const va = /^(?:VIRTUAL_ACCOUNT|VA)_(.+)$/.exec(upper);
  if (va) return `Virtual Account ${va[1].replace(/_/g, ' ')}`;
  const wallet = /^(?:EMONEY|WALLET)_(.+)$/.exec(upper);
  if (wallet) return PAYMENT_METHOD_LABELS[wallet[1]] ?? titleCase(wallet[1]);
  return titleCase(upper);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Alamat pesanan dikirim sebagai JSON — rangkai jadi satu baris teks. */
export function formatAddress(address: unknown): string {
  if (!address) return '—';
  if (typeof address === 'string') {
    try {
      return formatAddress(JSON.parse(address));
    } catch {
      return address;
    }
  }
  if (typeof address !== 'object') return String(address);
  const a = address as Record<string, unknown>;
  const pick = (...keys: string[]) =>
    keys.map((k) => a[k]).find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const parts = [
    pick('full_address', 'address', 'street', 'address_line', 'detail'),
    pick('district', 'kecamatan', 'subdistrict'),
    pick('city', 'kota', 'regency'),
    pick('province', 'provinsi'),
    pick('postal_code', 'zip', 'kode_pos'),
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return Object.values(a)
    .filter((v) => typeof v === 'string' && v.trim())
    .join(', ') || '—';
}

export function addressRecipient(address: unknown): string | null {
  let a = address;
  if (typeof a === 'string') {
    try {
      a = JSON.parse(a);
    } catch {
      return null;
    }
  }
  if (!a || typeof a !== 'object') return null;
  const r = a as Record<string, unknown>;
  const name = r.recipient_name ?? r.recipient ?? r.name;
  const phone = r.phone ?? r.recipient_phone;
  return [name, phone].filter((v) => typeof v === 'string' && v).join(' · ') || null;
}
