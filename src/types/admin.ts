/**
 * Bentuk data dari /api/v1/admin. Field yang tidak dijamin backend ditandai
 * opsional supaya UI tetap aman kalau ada yang kosong.
 */

export type MenuId =
  | 'ringkasan'
  | 'pengguna'
  | 'verifikasi'
  | 'kios'
  | 'transaksi'
  | 'uang'
  | 'inspeksi'
  | 'masalah'
  | 'voucher'
  | 'settings';

export type AdminMe = {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  is_super: boolean;
  menus: MenuId[];
};

export type LoginResponse = {
  token: string;
  expires_at: string;
  admin: Partial<AdminMe>;
};

/* ---------- Ringkasan ---------- */

export type SummaryCard = {
  key: string;
  label: string;
  count: number;
  menu: MenuId;
  filter: string;
};

export type Summary = {
  cards: SummaryCard[];
  recent_transactions: TransactionRow[];
};

/* ---------- Pengguna ---------- */

export type UserKind = 'pembeli' | 'penjual';
export type KycStatus = 'belum' | 'menunggu' | 'disetujui' | 'ditolak';
export type UserStatus = 'aktif' | 'ditangguhkan';

export type UserRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  kind: UserKind;
  kyc: KycStatus;
  status: UserStatus;
  joined_at?: string | null;
};

export type UserDetail = UserRow & {
  note?: string | null;
  suspended_reason?: string | null;
  kios?: { id: number; name: string; kios_status?: string; tier?: number; frozen?: boolean }[];
  orders?: TransactionRow[];
  inspections?: InspectionRow[];
};

/* ---------- Verifikasi ---------- */

export type VerificationStatus = 'menunggu' | 'disetujui' | 'ditolak';

export type VerificationRow = {
  id: number;
  seller_id: number;
  seller: string;
  full_name: string;
  nik: string;
  email: string;
  bank_code: string;
  account_number: string;
  status: VerificationStatus;
  submitted_at: string;
  reviewed_at?: string | null;
};

export type VerificationDetail = VerificationRow & {
  address?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  place_of_birth?: string | null;
  date_of_birth?: string | null;
  account_name?: string | null;
  account_holder?: string | null;
  holder_name?: string | null;
  account_name_matches?: boolean | null;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  tier_target?: number | null;
};

/* ---------- Kios ---------- */

export type KiosStatus = 'baru' | 'terpercaya';

export type KiosRow = {
  id: number;
  name: string;
  city?: string | null;
  owner: string;
  tier: number;
  kios_status: KiosStatus;
  frozen: boolean;
  balance: number;
  withheld: number;
  kyc_passed: boolean;
};

export type KiosDetail = KiosRow & {
  sales?: number;
  manual_sales?: number;
  active_listings?: number;
  owner_kyc?: KycStatus | string;
  withdrawal_limit_without_kyc?: number;
  frozen_at?: string | null;
  frozen_reason?: string | null;
};

/* ---------- Transaksi ---------- */

export type OrderState = 'menunggu_bayar' | 'diproses' | 'dikirim' | 'selesai' | 'dibatalkan';
export type PayState =
  | 'menunggu'
  | 'sukses'
  | 'gagal'
  | 'hangus'
  | 'batal'
  | 'perlu_refund'
  | 'refund';

export type TransactionRow = {
  id: number;
  order_number: string;
  created_at: string;
  buyer: string;
  seller: string;
  order_state: OrderState;
  pay_state: PayState;
  payment_method?: string | null;
  total: number;
};

export type TransactionDetail = TransactionRow & {
  items?: { title: string; quantity: number; price: number; subtotal: number }[];
  subtotal?: number;
  shipping_method?: string | null;
  shipping_cost?: number;
  discount?: number;
  platform_fee?: number;
  seller_amount?: number;
  address?: unknown;
  resi?: string | null;
  courier?: string | null;
  refund_status?: string | null;
  refund_reason?: 'paid_after_close' | 'returned' | string | null;
  can_mark_failed?: boolean;
  can_mark_expired?: boolean;
};

/* ---------- Uang ---------- */

export type WithdrawalStatus = 'menunggu' | 'dicairkan' | 'ditolak';

export type WithdrawalRow = {
  id: number;
  code?: string | null;
  kios: string;
  kios_id?: number;
  amount: number;
  status: WithdrawalStatus;
  requested_at?: string | null;
  created_at?: string | null;
};

export type WithdrawalDetail = WithdrawalRow & {
  bank?: {
    bank_code: string;
    account_number: string;
    last4?: string;
    holder_name?: string | null;
  } | null;
  cap?: { ok: boolean; cap?: number; already_used?: number; message?: string | null } | null;
  can_approve?: boolean;
  frozen?: boolean;
  owner_kyc?: string | null;
  kyc_passed?: boolean;
  rejection_reason?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
};

/* ---------- Inspeksi ---------- */

export type InspectionStatus = 'menunggu' | 'dijadwalkan' | 'selesai' | 'dibatalkan';

export type InspectionRow = {
  id: number;
  code?: string | null;
  status: InspectionStatus;
  listing: string;
  city?: string | null;
  buyer: string;
  seller: string;
  requested_date?: string | null;
  inspection_date?: string | null;
  mechanic?: string | null;
  meeting_location?: string | null;
};

export type InspectionDetail = InspectionRow & {
  created_at?: string | null;
  report?: string | null;
  cancel_reason?: string | null;
  notes?: string | null;
};

export type Mechanic = { id: number; name: string; active: boolean };

/* ---------- Masalah ---------- */

export type ReportStatus = 'baru' | 'selesai';

export type ReportRow = {
  id: number;
  code?: string | null;
  reporter: string;
  target: string;
  target_type?: 'akun' | 'kios' | string;
  kind?: 'akun' | 'kios' | string;
  reason?: string | null;
  status: ReportStatus;
  created_at: string;
};

export type ReportDetail = ReportRow & {
  target_user_active?: boolean | null;
  target_kios_frozen?: boolean | null;
  action?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
};

/* ---------- Voucher ---------- */

export type DiscountType = 'persen' | 'nominal';

export type Voucher = {
  id: number;
  code: string;
  discount_type: DiscountType;
  value: number;
  max_discount: number;
  min_purchase: number;
  quota: number;
  used?: number;
  used_count?: number;
  ends_at: string;
  active: boolean;
  description?: string | null;
  per_user_limit?: number;
};

/* ---------- Settings ---------- */

export type Role = {
  id: number;
  name: string;
  menus: MenuId[];
  is_super: boolean;
  member_count: number;
};

export type AdminAccount = {
  id: number;
  name: string;
  email: string;
  status: 'aktif' | 'nonaktif' | string;
  role_id: number;
  role_name: string;
  is_super: boolean;
  last_login_at?: string | null;
  locked: boolean;
};
