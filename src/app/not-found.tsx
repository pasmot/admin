import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="boot boot-col">
      <h1 className="page-title">Halaman tidak ditemukan</h1>
      <Link href="/" className="link-btn">
        Kembali ke Ringkasan
      </Link>
    </div>
  );
}
