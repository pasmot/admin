# Verifikasi KYC di Dashboard Admin — Panduan Integrasi Frontend

Panduan untuk menu **Verifikasi** di dashboard admin: melihat antrean pengajuan KYC penjual, membuka
detail dan fotonya, lalu **menyetujui** atau **menolak**.

Semua endpoint di bawah sudah ada di branch `main` backend. Panduan umum dashboard (login, role,
menu lain) ada di `docs/admin-dashboard-api.md`; dokumen ini merinci bagian Verifikasi saja.
Sisi penjual (form pengajuan di app) ada di `docs/verifikasi-penjual-frontend.md`.

---

## 1. Ringkasan

Base path: `/api/v1/admin/verifications`

| Aksi | Method + path | Body | Balasan |
| --- | --- | --- | --- |
| Daftar pengajuan | `GET /` | — | JSON list |
| Detail pengajuan | `GET /{id}` | — | JSON |
| Foto KTP | `GET /{id}/ktp` | — | **bytes gambar**, bukan JSON |
| Foto selfie | `GET /{id}/selfie` | — | **bytes gambar**, bukan JSON |
| Setujui | `POST /{id}/approve` | tanpa body | JSON |
| Tolak | `POST /{id}/reject` | `{"reason": "..."}` | JSON |

`{id}` adalah **id pengajuan** (`id` di baris list), bukan `seller_id`.

Tidak ada endpoint untuk membatalkan keputusan. Approve dan reject bersifat final, jadi pasang
dialog konfirmasi sebelum memanggilnya.

---

## 2. Dasar

### Header

```http
Authorization: Bearer <token admin>
```

- Token didapat dari `POST /api/v1/admin/auth/login` dengan body `{email, password}`. Balasannya
  `data.token`, `data.expires_at`, dan `data.admin`.
- Token berlaku **12 jam**. Ini akun dashboard, bukan akun app: token app tidak berlaku di sini.
- Header `Origin` dikirim otomatis oleh browser. Domain dashboard harus sudah didaftarkan di server;
  kalau belum, semua request dibalas `403 origin not allowed`. Untuk tes lewat curl atau Postman,
  isi header `Origin` secara manual dengan domain yang terdaftar.

### Izin

Akun harus punya menu `verifikasi`. Cek `menus` dari `GET /api/v1/admin/me` untuk menampilkan atau
menyembunyikan menu di sidebar. Server tetap memeriksa izin di setiap request dan membalas `403`
kalau role tidak punya akses.

### Bentuk respons

Item tunggal:

```json
{ "success": true, "status_code": 200, "data": { } }
```

List:

```json
{
  "success": true,
  "status_code": 200,
  "data": [ ],
  "meta": { "total_count": 37, "page": 1, "per_page": 20 }
}
```

Error:

```json
{ "success": false, "errors": [ { "status_code": "409", "detail": "verification is not awaiting review" } ] }
```

`status_code` di dalam `errors` berupa **string**. Untuk percabangan, pakai HTTP status dari respons.

### Pesan error berbahasa Inggris

Berbeda dari menu dashboard lain, `detail` di endpoint Verifikasi berbahasa Inggris. Jangan
tampilkan mentah-mentah sebagai toast. Petakan dari HTTP status ke teks sendiri; tabelnya ada di
bagian 8.

### Setiap akses dicatat

Server mencatat ke log akses KYC, atas nama akun admin yang sedang login, setiap kali:

- satu baris list dikirim,
- detail dibuka,
- foto KTP atau selfie dibuka,
- pengajuan disetujui atau ditolak.

Karena itu:

- Jangan polling atau auto-refresh list dengan interval.
- Jangan prefetch tab atau halaman yang belum dibuka admin.
- Jangan ambil foto sebelum admin benar-benar membuka detailnya.

Semua respons dikirim dengan `Cache-Control: no-store`. Jangan simpan data KYC di `localStorage`,
`sessionStorage`, atau cache library data-fetching yang persisten.

---

## 3. Alur layar

1. Admin membuka menu Verifikasi. Panggil `GET /verifications` (default tab `menunggu`).
2. Admin mengklik satu baris. Panggil `GET /verifications/{id}`.
3. Kalau `has_ktp_photo` / `has_selfie_photo` bernilai `true`, ambil fotonya (bagian 6).
4. Admin menekan **Setujui** atau **Tolak**. Tampilkan konfirmasi; untuk Tolak, minta alasan.
5. Panggil `POST .../approve` atau `POST .../reject`.
6. Setelah sukses: tutup detail, muat ulang list tab yang aktif, dan muat ulang `GET /summary`
   kalau angka kartu "Verifikasi menunggu" sedang tampil.

---

## 4. `GET /verifications` — daftar pengajuan

### Query

| Param | Nilai | Keterangan |
| --- | --- | --- |
| `status` | `menunggu` \| `disetujui` \| `ditolak` \| `semua` | Kosong = `menunggu`. Nilai lain dibalas `400`. |
| `q` | teks bebas | Nama di KTP, nama kios, email, NIK lengkap 16 digit, atau 4 digit terakhir NIK. |
| `page` | angka, mulai 1 | Default 1. |
| `limit` | 1–100 | Default 20. Di luar rentang kembali ke 20. |

Pengajuan yang masih draft (belum dikirim penjual) tidak pernah muncul di sini.

Urutan: yang `menunggu` selalu di atas, dari yang paling lama menunggu. Sisanya diurutkan dari
keputusan terbaru.

### Response `200`

```json
{
  "success": true,
  "status_code": 200,
  "data": [
    {
      "id": 41,
      "seller_id": 318,
      "seller": "Kios Motor Jaya",
      "full_name": "BUDI SANTOSO",
      "nik": "3174091205900003",
      "email": "budi@example.com",
      "bank_code": "BCA",
      "account_number": "1234567890",
      "status": "menunggu",
      "submitted_at": "2026-10-12T03:14:07Z"
    }
  ],
  "meta": { "total_count": 1, "page": 1, "per_page": 20 }
}
```

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id` | number | Id pengajuan. Pakai ini untuk semua endpoint `{id}`. |
| `seller_id` | number | Id kios. |
| `seller` | string | Nama kios. |
| `full_name` | string | Nama sesuai KTP. |
| `nik` | string | NIK lengkap. Bisa `************0003` kalau gagal didekripsi, atau `""` untuk akun yang sudah dihapus. |
| `email` | string, opsional | Email pemilik kios. |
| `bank_code` | string, opsional | Kode bank rekening pencairan. |
| `account_number` | string, opsional | Nomor rekening lengkap. Bisa `****7890` kalau gagal didekripsi. |
| `status` | string | `menunggu` \| `disetujui` \| `ditolak`. |
| `submitted_at` | string ISO 8601, opsional | Waktu penjual mengirim pengajuan. |
| `reviewed_at` | string ISO 8601, opsional | Waktu diputuskan. Tidak ada selama masih `menunggu`. |

Field bertanda "opsional" **tidak dikirim sama sekali** kalau kosong, bukan dikirim sebagai `null`.

Satu penjual bisa punya lebih dari satu baris. Penjual yang ditolak lalu mengajukan ulang akan
mendapat pengajuan baru dengan `id` baru; baris lama tetap ada di tab `ditolak`. Pakai `id` sebagai
key baris, bukan `seller_id`.

### Contoh

```js
async function listVerifications({ status = "menunggu", q = "", page = 1, limit = 20 }) {
  const params = new URLSearchParams({ status, page, limit });
  if (q.trim()) params.set("q", q.trim());

  const res = await fetch(`${API}/api/v1/admin/verifications?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.errors?.[0]?.detail);
  return { rows: body.data, total: body.meta.total_count };
}
```

Untuk kolom pencarian, pakai debounce. Setiap hasil pencarian yang tampil ikut tercatat di log akses.

---

## 5. `GET /verifications/{id}` — detail

### Response `200`

```json
{
  "success": true,
  "status_code": 200,
  "data": {
    "id": 41,
    "seller_id": 318,
    "seller_name": "Kios Motor Jaya",
    "status": "submitted",
    "nik": "3174091205900003",
    "full_name": "BUDI SANTOSO",
    "birth_place": "Jakarta",
    "birth_date": "1990-05-12T00:00:00Z",
    "address": "Jl. Kebon Jeruk No. 12, Jakarta Barat",
    "has_ktp_photo": true,
    "has_selfie_photo": true,
    "bank_code": "BCA",
    "bank_account_last4": "7890",
    "account_holder_name": "BUDI SANTOSO",
    "account_name_matches": true,
    "consent_at": "2026-10-12T03:10:55Z",
    "consent_version": "2026-08-14",
    "submitted_at": "2026-10-12T03:14:07Z"
  }
}
```

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `id`, `seller_id` | number | Sama dengan list. |
| `seller_name` | string, opsional | Nama kios. Di list namanya `seller`. |
| `status` | string | `submitted` \| `approved` \| `rejected` \| `draft`. **Bahasa Inggris**, lihat catatan di bawah. |
| `nik` | string | NIK lengkap. |
| `full_name` | string, opsional | Nama sesuai KTP. |
| `birth_place` | string, opsional | Tempat lahir. |
| `birth_date` | string, opsional | Tanggal lahir, dikirim sebagai timestamp tengah malam UTC. |
| `address` | string, opsional | Alamat sesuai KTP. |
| `has_ktp_photo` | boolean | `true` kalau foto KTP masih tersimpan. |
| `has_selfie_photo` | boolean | `true` kalau foto selfie masih tersimpan. |
| `bank_code` | string, opsional | Kode bank. |
| `bank_account_last4` | string, opsional | **Hanya 4 digit terakhir** nomor rekening. |
| `account_holder_name` | string, opsional | Nama pemilik rekening. |
| `account_name_matches` | boolean | `true` kalau nama pemilik rekening cocok dengan nama KTP. |
| `consent_at` | string ISO 8601, opsional | Waktu penjual menyetujui pemrosesan data. |
| `consent_version` | string, opsional | Versi teks persetujuan. |
| `submitted_at` | string ISO 8601, opsional | Waktu dikirim. |
| `reviewed_at` | string ISO 8601, opsional | Waktu diputuskan. |
| `rejection_reason` | string, opsional | Alasan penolakan, hanya ada kalau `rejected`. |

### Yang berbeda dari list

- **`status` memakai kata yang berbeda.** List mengirim `menunggu` / `disetujui` / `ditolak`,
  sedangkan detail mengirim `submitted` / `approved` / `rejected`. Buat satu pemetaan di FE:

  ```js
  const STATUS_LABEL = { submitted: "menunggu", approved: "disetujui", rejected: "ditolak" };
  ```

- **Nomor rekening di detail hanya 4 digit terakhir.** Nomor lengkap hanya ada di list
  (`account_number`). Kalau layar detail perlu nomor lengkap, bawa dari baris list yang diklik.
- Nama kios bernama `seller_name` di detail, `seller` di list.

### Catatan tampilan

- Tombol Setujui dan Tolak hanya ditampilkan kalau `status === "submitted"`.
- `birth_date`: ambil 10 karakter pertama (`birth_date.slice(0, 10)`) lalu format sendiri. Jangan
  lewatkan ke `new Date()` dulu, supaya tanggalnya tidak bergeser karena zona waktu.
- `account_name_matches: false` perlu ditonjolkan (misalnya badge peringatan). Ini pemeriksaan yang
  paling penting sebelum menyetujui.
- Data bank diambil dari rekening aktif penjual saat ini. Field bank tidak ada kalau penjual belum
  punya rekening aktif.
- Untuk penjual yang akunnya sudah dihapus, `nik`, nama, dan alamat kosong, dan kedua `has_*_photo`
  bernilai `false`.

---

## 6. Foto KTP dan selfie

`GET /verifications/{id}/ktp` dan `GET /verifications/{id}/selfie` membalas **isi file gambar**
secara langsung. Tidak ada URL publik dan tidak ada JSON.

Karena butuh header `Authorization`, foto **tidak bisa** dipasang lewat `<img src="...">` biasa.
Ambil lewat `fetch`, lalu jadikan object URL:

```js
async function loadDocument(id, kind /* "ktp" | "selfie" */) {
  const res = await fetch(`${API}/api/v1/admin/verifications/${id}/${kind}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 410) return null; // foto sudah tidak tersimpan
  if (!res.ok) throw new ApiError(res.status);
  return URL.createObjectURL(await res.blob());
}
```

```js
// Contoh React: lepas object URL saat detail ditutup.
useEffect(() => {
  let url;
  loadDocument(id, "ktp").then((u) => { url = u; setKtpUrl(u); });
  return () => { if (url) URL.revokeObjectURL(url); };
}, [id]);
```

- Panggil hanya kalau `has_ktp_photo` / `has_selfie_photo` bernilai `true`.
- `Content-Type` balasan berupa `image/jpeg`, `image/png`, `image/webp`, `image/gif`, atau
  `image/bmp`. Ukuran maksimal 8 MB per foto.
- `410` berarti fotonya sudah tidak tersimpan. Tampilkan placeholder "Foto tidak tersedia", jangan
  perlakukan sebagai error.
- Selalu panggil `URL.revokeObjectURL` saat detail ditutup atau berganti pengajuan.
- Jangan sediakan tombol unduh, dan jangan simpan blob-nya di cache.

---

## 7. Setujui dan tolak

### `POST /verifications/{id}/approve`

Tanpa body.

```js
const res = await fetch(`${API}/api/v1/admin/verifications/${id}/approve`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
```

Response `200`:

```json
{
  "success": true,
  "status_code": 200,
  "data": {
    "verification_id": 41,
    "seller_id": 318,
    "status": "approved",
    "is_verified": true,
    "reviewed_at": "2026-10-13T02:01:44Z"
  }
}
```

Yang terjadi di server setelah approve:

- Pengajuan menjadi `approved` dan penjual menjadi terverifikasi.
- Batas penarikan saldo Rp2 juta untuk penjual itu hilang.
- Penjual menerima notifikasi "Verifikasi disetujui" di app.

### `POST /verifications/{id}/reject`

```js
const res = await fetch(`${API}/api/v1/admin/verifications/${id}/reject`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ reason: "Foto KTP buram, NIK tidak terbaca" }),
});
```

Response `200`:

```json
{
  "success": true,
  "status_code": 200,
  "data": {
    "verification_id": 41,
    "seller_id": 318,
    "status": "rejected",
    "is_verified": false,
    "reviewed_at": "2026-10-13T02:01:44Z"
  }
}
```

Aturan `reason`:

- **Wajib diisi.** Kosong atau hanya spasi dibalas `400`. Validasi di form sebelum mengirim.
- **Dibaca langsung oleh penjual.** Teksnya masuk ke notifikasi penjual sebagai
  `Alasan: <reason>. Perbaiki data lalu ajukan ulang dari menu Verifikasi.` dan tampil di layar
  status verifikasi di app. Tulis dalam bahasa Indonesia yang jelas, tanpa catatan internal.
- Server tidak membatasi panjangnya. Batasi di form (saran: 200 karakter) supaya muat di notifikasi.

Setelah ditolak, penjual bisa mengajukan ulang. Pengajuan ulang muncul sebagai baris baru di tab
`menunggu`.

### Perilaku tombol

- Nonaktifkan kedua tombol selama request berjalan, supaya tidak terkirim dua kali.
- `status` di balasan approve/reject berbahasa Inggris (`approved` / `rejected`), sama seperti detail.
- Kalau dua admin memutuskan pengajuan yang sama, yang kedua mendapat `409`. Tampilkan
  "Pengajuan ini sudah diputuskan", lalu muat ulang detail dan list.

---

## 8. Error

| HTTP | `detail` dari server | Kapan | Yang ditampilkan |
| --- | --- | --- | --- |
| 400 | `unknown status filter` | `status` di list tidak dikenal | Bug FE, perbaiki nilai tab |
| 400 | `invalid verification id` | `{id}` bukan angka | Bug FE |
| 400 | `invalid request body` | Body reject bukan JSON valid | Bug FE |
| 400 | `a rejection reason is required` | `reason` kosong | "Alasan penolakan wajib diisi" |
| 401 | `admin token required` / `invalid token` | Token tidak ada, salah, atau kedaluwarsa | Arahkan ke login |
| 401 | `session ended, please sign in again` | Akun di-logout, dinonaktifkan, atau ganti password | Arahkan ke login |
| 403 | `origin not allowed` | Domain dashboard belum terdaftar di server | Hubungi tim backend |
| 403 | `akses ke menu ini tidak diizinkan untuk role kamu` | Role tanpa menu `verifikasi` | "Kamu tidak punya akses ke menu ini" |
| 404 | `no verification in progress` | Pengajuan tidak ditemukan, atau penjualnya sudah dihapus saat approve | "Pengajuan tidak ditemukan" |
| 409 | `verification is not awaiting review` | Sudah diputuskan, atau masih draft | "Pengajuan ini sudah diputuskan" + muat ulang |
| 410 | `document is no longer stored` | Foto sudah tidak tersimpan | Placeholder "Foto tidak tersedia" |
| 500 | `failed to ...` | Kesalahan server | "Terjadi kesalahan, coba lagi" |
| 503 | `admin session check failed` | Pengecekan sesi gagal sementara | "Coba lagi sebentar lagi", **jangan** logout |

Contoh pemetaan:

```js
const VERIFICATION_ERROR = {
  404: "Pengajuan tidak ditemukan.",
  409: "Pengajuan ini sudah diputuskan.",
  410: "Foto tidak tersedia.",
  500: "Terjadi kesalahan, coba lagi.",
  503: "Server sedang sibuk, coba lagi sebentar lagi.",
};

function handleError(status) {
  if (status === 401) return redirectToLogin();
  if (status === 403) return toast("Kamu tidak punya akses ke menu ini.");
  toast(VERIFICATION_ERROR[status] ?? "Terjadi kesalahan, coba lagi.");
}
```

---

## 9. Tes cepat dengan curl

```bash
API=https://api.pasarmotor.com
ORIGIN=https://<domain-dashboard-yang-terdaftar>

# Login
TOKEN=$(curl -s -X POST "$API/api/v1/admin/auth/login" \
  -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}' | jq -r .data.token)

# Antrean menunggu
curl -s "$API/api/v1/admin/verifications?status=menunggu" \
  -H "Origin: $ORIGIN" -H "Authorization: Bearer $TOKEN" | jq

# Detail
curl -s "$API/api/v1/admin/verifications/41" \
  -H "Origin: $ORIGIN" -H "Authorization: Bearer $TOKEN" | jq

# Foto KTP ke file
curl -s "$API/api/v1/admin/verifications/41/ktp" \
  -H "Origin: $ORIGIN" -H "Authorization: Bearer $TOKEN" -o ktp.jpg

# Setujui
curl -s -X POST "$API/api/v1/admin/verifications/41/approve" \
  -H "Origin: $ORIGIN" -H "Authorization: Bearer $TOKEN" | jq

# Tolak
curl -s -X POST "$API/api/v1/admin/verifications/41/reject" \
  -H "Origin: $ORIGIN" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Foto KTP buram, NIK tidak terbaca"}' | jq
```

Approve dan reject di atas mengubah data sungguhan dan tidak bisa dibatalkan. Pakai pengajuan dari
akun tes.

---

## 10. Checklist

- [ ] Menu Verifikasi hanya tampil kalau `menus` dari `/me` berisi `verifikasi`.
- [ ] Tab `menunggu` / `disetujui` / `ditolak` / `semua` mengirim nilai `status` yang sama persis.
- [ ] Paging membaca `meta.total_count` dan `meta.per_page`.
- [ ] Key baris list memakai `id`, bukan `seller_id`.
- [ ] Status di detail dipetakan dari `submitted` / `approved` / `rejected`.
- [ ] Tombol Setujui dan Tolak hanya muncul saat `status === "submitted"`.
- [ ] Foto diambil lewat `fetch` + `createObjectURL`, dan di-`revokeObjectURL` saat ditutup.
- [ ] `410` pada foto menampilkan placeholder, bukan error.
- [ ] `account_name_matches: false` ditampilkan sebagai peringatan.
- [ ] Ada konfirmasi sebelum approve dan reject; alasan penolakan wajib diisi.
- [ ] Tombol nonaktif selama request berjalan.
- [ ] `409` memuat ulang detail dan list.
- [ ] `401` mengarahkan ke login; `503` tidak.
- [ ] Tidak ada polling, prefetch, atau penyimpanan data KYC di storage browser.
