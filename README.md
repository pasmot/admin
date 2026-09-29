# PasarMotor Admin

Dashboard operasional PasarMotor. Next.js 16 + React 19, design system sama dengan `pasar-motor-web`
(token di `src/styles/tokens.css`, font Plus Jakarta Sans, ikon lucide-react).

## Menjalankan

```bash
cp .env.example .env.local   # isi NEXT_PUBLIC_API_BASE_URL
npm install
npm run dev                  # http://localhost:3000
```

Domain dashboard (termasuk `http://localhost:3000` saat development) wajib terdaftar di
`FRONTEND_URLS` server, kalau tidak semua request ditolak `403 origin not allowed`.

## Struktur

- `src/app/login` — login email + password (akun admin terpisah dari akun app).
- `src/app/(dashboard)/*` — satu route per menu: `/` (Ringkasan), `/pengguna`, `/verifikasi`, `/kios`,
  `/transaksi`, `/uang`, `/inspeksi`, `/masalah`, `/voucher`, `/settings`. `?filter=` membuka tab
  tertentu (dipakai tombol "Buka antrean").
- `src/views/*View.tsx` — isi tiap halaman (tabel + drawer detail + aksi).
- `src/lib/api.ts` — client `/api/v1/admin`: header Bearer, parsing error Indonesia, redirect ke login
  saat 401, gambar KTP/selfie via `fetch` → object URL.
- `src/lib/session.ts` — token disimpan di `sessionStorage` (bukan localStorage), berlaku 12 jam.
- `src/context/` — `AuthContext` (`/me`, sidebar dari `menus`), `QueueContext` (angka antrean dari
  `/summary`, refresh tiap 60 detik), `ToastContext`.

Panduan API lengkap: `admin-dashboard-portal.md`.
