# Admin Dashboard: Panduan Integrasi API

Untuk tim FE yang membangun dashboard admin sesuai desain
https://motor-pasar.vercel.app/dashboard-admin. Semua endpoint ada di bawah `/api/v1/admin`.

## Dasar

- **Origin**: domain dashboard wajib didaftarkan di `FRONTEND_URLS` (dipisah koma) server, sama seperti app.
  Tanpa itu semua request ditolak `403 origin not allowed`.
- **Akun admin terpisah dari akun app.** Login memakai email + password, bukan Google/Apple. Token
  admin tidak bisa dipakai di endpoint app, dan token app tidak bisa dipakai di dashboard.
- **Header**: `Authorization: Bearer <token>` di semua endpoint kecuali login.
- **Token berlaku 12 jam.** Simpan di memori atau `sessionStorage`, **jangan** di `localStorage`.
  Kalau dapat `401`, arahkan ke halaman login.
- **`403`** berarti role akun tidak punya akses ke menu itu. Sidebar sebaiknya dibangun dari
  `menus` di `/me`, tapi server tetap memeriksa izin di setiap request.
- **Format respons** sama dengan API app. Item tunggal: `{ "success": true, "data": {...} }`. List:
  `{ "data": [...], "meta": { "page", "limit", "total_count" } }`, dengan paging `?page=&limit=`
  (maksimal 100). Error: `{ "success": false, "errors": [{ "status_code": "409", "detail": "pesan" }] }`.
  Pesan error sudah berbahasa Indonesia dan boleh langsung ditampilkan sebagai toast.
- Semua respons dashboard dikirim `Cache-Control: no-store`.
- Tanggal dikirim dalam ISO 8601; untuk input tanggal pakai `YYYY-MM-DD`. Nominal uang dalam
  rupiah (integer).

## Login & akun sendiri

| Method | Path             | Body                               | Keterangan                                                   |
| ------ | ---------------- | ---------------------------------- | ------------------------------------------------------------ |
| POST   | `/auth/login`    | `{email, password}`                | → `{token, expires_at, admin}`                               |
| GET    | `/me`            |                                    | → `{id, name, email, role_id, role_name, is_super, menus[]}` |
| POST   | `/auth/logout`   |                                    | Mengakhiri **semua** sesi akun ini                           |
| POST   | `/auth/password` | `{current_password, new_password}` | Semua sesi berakhir, login ulang                             |

`menus` berisi id menu dengan urutan sidebar: `ringkasan, pengguna, verifikasi, kios, transaksi,
uang, inspeksi, masalah, voucher`, lalu `settings` khusus Super Admin.

Error login:

- `401` untuk email atau password salah. Pesannya sama persis untuk email yang tidak terdaftar.
- `403` kalau akun nonaktif.
- `429` setelah 5× salah berturut-turut (akun dikunci 15 menit) atau terlalu banyak percobaan dari
  jaringan yang sama.

Super Admin pertama dibuat server dari env `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`.
Tidak ada password default seperti `admin123` di desain.

## Ringkasan — `GET /summary`

```json
{
  "cards": [
    {
      "key": "verifikasi_menunggu",
      "label": "Verifikasi menunggu",
      "count": 1,
      "menu": "verifikasi",
      "filter": "menunggu"
    },
    {
      "key": "transaksi_bermasalah",
      "label": "Transaksi bermasalah",
      "count": 2,
      "menu": "transaksi",
      "filter": "bermasalah"
    },
    {
      "key": "perlu_refund",
      "label": "Perlu refund",
      "count": 1,
      "menu": "uang",
      "filter": "refund"
    },
    {
      "key": "inspeksi_menunggu",
      "label": "Inspeksi menunggu",
      "count": 2,
      "menu": "inspeksi",
      "filter": "menunggu"
    },
    {
      "key": "tarik_saldo",
      "label": "Tarik saldo",
      "count": 3,
      "menu": "uang",
      "filter": "pencairan"
    },
    {
      "key": "laporan_baru",
      "label": "Laporan baru",
      "count": 2,
      "menu": "masalah",
      "filter": "baru"
    }
  ],
  "recent_transactions": [
    /* 5 baris, format sama dengan list Transaksi */
  ]
}
```

Kartu sudah difilter sesuai role. "Buka antrean" membuka `menu` dengan tab `filter`.
`recent_transactions` kosong kalau role tidak punya menu Transaksi.

## Pengguna (menu `pengguna`)

| Method | Path                                   | Keterangan                                                                |
| ------ | -------------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/users?status=aktif\|ditangguhkan&q=` | `q`: nama, email, HP, kota                                                |
| GET    | `/users/{id}`                          | Detail + `kios[]`, `orders[]`, `inspections[]` (masing-masing 20 terbaru) |
| POST   | `/users/{id}/note`                     | `{note}`: catatan internal, hanya terlihat admin                          |
| POST   | `/users/{id}/suspend`                  | `{reason?}`: akun langsung tidak bisa memakai app                         |
| POST   | `/users/{id}/reactivate`               |                                                                           |

Baris list: `id, name, email, phone, city, kind (pembeli|penjual), kyc (belum|menunggu|disetujui|ditolak),
status (aktif|ditangguhkan), joined_at`.
HP dan kota penjual diambil dari data kios, sedangkan untuk pembeli dari alamat default. KYC hanya
berlaku untuk penjual, jadi pembeli selalu `belum`.

## Verifikasi (menu `verifikasi`)

| Method | Path                                                           | Keterangan                                                                  |
| ------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/verifications?status=menunggu\|disetujui\|ditolak\|semua&q=` | Default `menunggu`                                                          |
| GET    | `/verifications/{id}`                                          | Detail lengkap: NIK, alamat, tempat/tgl lahir, bank, `account_name_matches` |
| GET    | `/verifications/{id}/ktp`                                      | **Gambar** (bytes), bukan JSON                                              |
| GET    | `/verifications/{id}/selfie`                                   | **Gambar** (bytes)                                                          |
| POST   | `/verifications/{id}/approve`                                  |                                                                             |
| POST   | `/verifications/{id}/reject`                                   | `{reason}` wajib                                                            |

Baris list: `id, seller_id, seller, full_name, nik, email, bank_code, account_number, status,
submitted_at, reviewed_at`. Sesuai desain, NIK dan nomor rekening tampil lengkap.

- Setiap baris yang dikirim dicatat di log akses KYC atas nama admin yang membuka. Jangan
  mem-prefetch tab lain tanpa perlu.
- `q` bisa berisi nama, nama kios, email, NIK lengkap (16 digit), atau 4 digit terakhir NIK.
- Gambar KTP/selfie harus diambil lewat `fetch` dengan header Authorization lalu dibuat
  `URL.createObjectURL(blob)`. Tidak ada URL publik. Jangan simpan hasilnya di cache.

## Kios (menu `kios`)

| Method | Path                                     | Body                             |
| ------ | ---------------------------------------- | -------------------------------- |
| GET    | `/kios?filter=baru\|terpercaya\|beku&q=` | `q`: nama kios, kota, pemilik    |
| GET    | `/kios/{id}`                             |                                  |
| POST   | `/kios/{id}/status`                      | `{status: "baru"\|"terpercaya"}` |
| POST   | `/kios/{id}/tier`                        | `{tier: 1\|2\|3}`                |
| POST   | `/kios/{id}/freeze`                      | `{reason?}`                      |
| POST   | `/kios/{id}/unfreeze`                    |                                  |

Baris list: `id, name, city, owner, tier, kios_status, frozen, balance, withheld, kyc_passed`. Detail
menambahkan:

- `sales`: pesanan checkout yang selesai.
- `manual_sales`: penjualan yang dicatat sendiri oleh penjual, tanpa pembeli di platform.
- `active_listings`, `owner_kyc`, `withdrawal_limit_without_kyc`, `frozen_at`, `frozen_reason`.

**Bekukan** berarti semua listing kios hilang dari katalog dan halaman detail, tidak bisa masuk
keranjang atau checkout, dan kios tidak bisa tarik saldo. Pesanan yang sudah dibayar tetap jalan.
**Aktifkan kios** memulihkan semuanya.

Tombol tier hanya mengubah angka tier. Aturan kenaikan tier otomatis belum diubah.

## Transaksi (menu `transaksi`)

| Method | Path                              | Keterangan                                                                                               |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET    | `/transactions?filter=&q=`        | `filter`: `bermasalah`, `diproses`, `dikirim`, `selesai`, `dibatalkan`, `menunggu_bayar`; kosong = semua |
| GET    | `/transactions/{id}`              | Detail (boleh juga untuk menu Uang)                                                                      |
| POST   | `/transactions/{id}/mark-failed`  | "Tandai gagal", hanya untuk yang menunggu bayar                                                          |
| POST   | `/transactions/{id}/mark-expired` | "Tandai hangus", hanya untuk yang menunggu bayar                                                         |

Baris: `id, order_number, created_at, buyer, seller, order_state, pay_state, payment_method, total`.

| `order_state`    | Label          | `pay_state`    | Label              |
| ---------------- | -------------- | -------------- | ------------------ |
| `menunggu_bayar` | Menunggu bayar | `menunggu`     | Menunggu bayar     |
| `diproses`       | Diproses       | `sukses`       | Sukses             |
| `dikirim`        | Dikirim        | `gagal`        | Gagal              |
| `selesai`        | Selesai        | `hangus`       | Hangus             |
| `dibatalkan`     | Dibatalkan     | `batal`        | Dibatalkan pembeli |
|                  |                | `perlu_refund` | Perlu refund       |
|                  |                | `refund`       | Refund             |

`bermasalah` mencakup pay_state menunggu, gagal, hangus, dan perlu_refund.

Detail menambahkan:

- `items[] {title, quantity, price, subtotal}`, `subtotal`, `shipping_method`, `shipping_cost`,
  `discount`, `platform_fee`, `seller_amount`, `address` (JSON alamat),
  `resi` (hanya tampil; diisi kios dari app), `courier`.
- `refund_status`, `refund_reason` (`paid_after_close` | `returned`), `can_mark_failed`,
  `can_mark_expired`.

`payment_method` berisi kode DOKU mentah, misalnya `VIRTUAL_ACCOUNT_BCA` atau `QRIS`; tampilkan
dengan label sendiri.

**Refund belum bisa dieksekusi dari dashboard.** Tombol "Proses refund" ditunda: API baru menampilkan
statusnya saja.

Tandai gagal/hangus melepas stok, voucher, dan VA/QRIS yang masih aktif, sama seperti pesanan yang
kedaluwarsa otomatis. Kalau pembeli ternyata sudah membayar di detik yang sama, respons `409` dan
pembayaran tetap menang.

## Uang (menu `uang`)

**Pembayaran**: `GET /payments?filter=refund` memakai format baris yang sama dengan Transaksi.
Tanpa filter, semua pesanan ditampilkan.

**Pencairan**

| Method | Path                                               | Body                                             |
| ------ | -------------------------------------------------- | ------------------------------------------------ |
| GET    | `/withdrawals?status=menunggu\|dicairkan\|ditolak` | kosong = semua; yang menunggu tampil paling atas |
| GET    | `/withdrawals/{id}`                                |                                                  |
| POST   | `/withdrawals/{id}/approve`                        | "Cairkan"                                        |
| POST   | `/withdrawals/{id}/reject`                         | `{reason}` wajib                                 |

Detail pencairan:

- `bank {bank_code, account_number, last4, holder_name}`. Nomor rekening tampil lengkap untuk
  transfer manual, dan setiap pembukaan detail dicatat di audit log.
- `cap {ok, cap, already_used, message}`: tampilkan `message` sebagai callout seperti di desain.
- `can_approve`: false kalau plafon terlampaui atau kios dibeku.
- `frozen`, `rejection_reason`, `processed_by`.

**Aturan plafon tanpa KYC:** total pencairan seller yang KYC-nya belum disetujui maksimal **Rp2 juta
secara kumulatif**, bukan per permintaan. KYC yang disetujui menghapus plafon ini.

"Cairkan" hanya **mencatat** bahwa uang sudah ditransfer. Transfernya sendiri tetap dilakukan manual,
karena belum ada integrasi disbursement. "Tolak" mengembalikan nominal ke saldo penjual.

## Inspeksi (menu `inspeksi`)

| Method | Path                                                                | Body                                                                    |
| ------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| GET    | `/inspections?status=menunggu\|dijadwalkan\|selesai\|dibatalkan&q=` |                                                                         |
| GET    | `/inspections/{id}`                                                 |                                                                         |
| POST   | `/inspections/{id}/schedule`                                        | `{mechanic, date: "YYYY-MM-DD"}` hanya dari status menunggu             |
| POST   | `/inspections/{id}/complete`                                        | `{report}` hanya dari status dijadwalkan; laporan tampil di app pembeli |
| POST   | `/inspections/{id}/cancel`                                          | `{reason}` wajib; dari menunggu atau dijadwalkan                        |
| GET    | `/inspection-mechanics`                                             | Montir aktif, untuk dropdown (`?all=1` termasuk yang nonaktif)          |
| POST   | `/inspection-mechanics`                                             | `{name}`                                                                |
| POST   | `/inspection-mechanics/{id}/active`                                 | `{active}`                                                              |

Baris: `id, status, listing, city, buyer, seller, requested_date` (tanggal yang diminta pembeli),
`inspection_date` (yang dijadwalkan admin), `mechanic, meeting_location`.

Daftar montir **kosong di awal**. Tambahkan dulu lewat `POST /inspection-mechanics`, karena desain
belum punya layar untuk ini; bisa dibuat form kecil di halaman Inspeksi.

## Masalah (menu `masalah`)

| Method | Path                               | Body                                          |
| ------ | ---------------------------------- | --------------------------------------------- |
| GET    | `/reports?status=baru\|selesai&q=` |                                               |
| GET    | `/reports/{id}`                    | + `target_user_active` / `target_kios_frozen` |
| POST   | `/reports/{id}/resolve`            | `{action: "akun"\|"kios"\|"catat"}`           |

- `akun` menangguhkan akun yang dilaporkan dan hanya berlaku untuk laporan akun.
- `kios` membekukan kios yang dilaporkan dan hanya berlaku untuk laporan kios.
- `catat` menutup laporan tanpa tindakan.

Laporan dan tindakannya tersimpan bersamaan.

**Laporan dibuat dari app**, bukan dari dashboard: `POST /api/v1/reports` dengan token app.

- Kios: `{seller_id, reason}`.
- Lawan chat: `{conversation_id, reason}`. App tidak pernah tahu user id orang lain, jadi akun
  dilaporkan lewat percakapan dengannya.
- `reason` 5–1000 karakter.
- Maksimal 10 laporan per hari per akun.
- Tidak bisa melaporkan kios sendiri (`422`).

## Voucher (menu `voucher`)

| Method | Path                    | Body                                                                                                                                         |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/vouchers`             |                                                                                                                                              |
| POST   | `/vouchers`             | `{code, discount_type: "persen"\|"nominal", value, max_discount, min_purchase, quota, ends_at: "YYYY-MM-DD", description?, per_user_limit?}` |
| POST   | `/vouchers/{id}/active` | `{active}`                                                                                                                                   |

Aturan:

- Kode disimpan huruf besar, 4–50 karakter.
- Persen harus 1–100.
- `max_discount` 0 berarti tanpa batas.
- `quota` wajib.
- `per_user_limit` default 1 per pembeli.
- Voucher berlaku sampai akhir hari `ends_at` (WIB).

## Settings (Super Admin saja)

| Method | Path                      | Body                                                                               |
| ------ | ------------------------- | ---------------------------------------------------------------------------------- |
| GET    | `/settings/menus`         | Daftar id menu untuk checklist role                                                |
| GET    | `/settings/roles`         | `[{id, name, menus, is_super, member_count}]`                                      |
| POST   | `/settings/roles`         | `{name, menus[]}`                                                                  |
| PUT    | `/settings/roles/{id}`    | `{name, menus[]}`                                                                  |
| DELETE | `/settings/roles/{id}`    | `409` kalau masih dipakai member                                                   |
| GET    | `/settings/accounts`      | `[{id, name, email, status, role_id, role_name, is_super, last_login_at, locked}]` |
| POST   | `/settings/accounts`      | `{name, email, password, role_id}`                                                 |
| PUT    | `/settings/accounts/{id}` | `{name, email, role_id, password?, status?}`; password kosong = tidak diubah       |
| DELETE | `/settings/accounts/{id}` | Akun langsung tidak bisa masuk lagi                                                |

Aturan Settings:

- `locked: true` berarti tampilkan "Terkunci" atau "Akun kamu" tanpa tombol Edit/Delete.
- Role Super Admin tidak bisa diedit, dihapus, atau diberikan ke akun lain.
- Password minimal **8 karakter**. Desain menulis 4; itu terlalu lemah untuk akun yang bisa
  mencairkan uang.
- Perubahan role langsung berlaku di request berikutnya.
- Mengganti password atau menonaktifkan akun langsung mengakhiri semua sesinya.

## Ringkasan kode error

| Status | Kapan                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------- |
| 400    | Input tidak valid (alasan kosong, tanggal salah format, filter tidak dikenal, dll.)            |
| 401    | Token tidak ada, kedaluwarsa, logout, akun dihapus/nonaktif, atau salah login                  |
| 403    | Role tidak punya akses ke menu, atau aksi terkunci (Super Admin, akun sendiri)                 |
| 404    | Data tidak ada                                                                                 |
| 409    | Status sudah berubah: sudah diproses, bukan menunggu bayar, masih dipakai, email/kode duplikat |
| 429    | Terlalu banyak percobaan login                                                                 |

## Dampak ke aplikasi pembeli & penjual

Bagian ini untuk tim app (bukan dashboard): perilaku app yang berubah karena keputusan admin.

**Tarik saldo penjual (`POST /api/v1/seller/wallet/withdraw`, `GET /api/v1/seller/wallet`)**

- Penjual yang **KYC-nya belum disetujui kini bisa tarik saldo sampai Rp2 juta total** (dulu diblokir
  sama sekali). Syaratnya tetap punya rekening, dan rekening hanya bisa didaftarkan lewat langkah
  terakhir KYC.
- `GET /seller/wallet` menambah `remaining_without_kyc` (sisa plafon; tidak ada kalau sudah
  terverifikasi) dan `frozen`. Tampilkan tombol tarik kalau `is_verified` **atau**
  `remaining_without_kyc > 0`, dan `has_bank_account`.
- Melebihi plafon → `422 {"reason": "seller must be verified to withdraw more", "limit", "remaining"}`
  → tampilkan ajakan verifikasi dengan sisa yang masih bisa ditarik.
- Kios dibekukan → `422 {"reason": "kios is frozen"}`.

**Kios dibekukan admin**

- Katalog, facet, halaman toko (`/api/v1/sellers/{id}` → 404, hilang dari `/api/v1/sellers`), detail
  listing (404) — semua menyembunyikan kios itu.
- Tambah ke keranjang / checkout → `422` (listing tidak tersedia); di keranjang, baris milik kios itu
  tampil `available: false`.
- Chat: tombol "Chat" dari listing-nya → `404`; menempel kartu listing-nya → `422`; kartu yang sudah
  ada di thread tampil `available: false`. **Thread yang sudah ada tetap bisa dipakai** (mis. untuk
  pesanan yang sudah dibayar).
- Pemilik kios mendapat notifikasi `transaksi` tipe `kios`.

**Akun ditangguhkan admin**

- Semua request app → `401 "account no longer active"` — keluarkan ke layar login dengan pesan
  akun ditangguhkan. Socket realtime tertutup dalam ≤60 detik, push berhenti.

**Laporan dari app** — `POST /api/v1/reports` (lihat bagian Masalah di atas). Tempat yang wajar:
menu "Laporkan" di halaman toko (`seller_id`) dan di header thread chat (`conversation_id`).

**Inspeksi** — `GET /api/v1/me/inspections` menambah `inspection_date`, `mechanic_name`, `report`,
`cancel_reason`; `status` kini bisa `pending` / `scheduled` / `completed` / `cancelled`.

**Notifikasi `transaksi`** — kini terisi dari keputusan admin (pencairan, KYC, inspeksi, kios,
laporan). Format dan routing: `docs/chat-frontend.md`, bagian Notifikasi dan Push.

**Timeline pengiriman** — langkah yang digeser admin tampil dengan `by: "Admin Pasar Motor"` dan
`source: "pasmot"`.
