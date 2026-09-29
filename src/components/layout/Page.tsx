'use client';

import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { MenuId } from '../../types/admin';

/**
 * Kerangka halaman: judul, deskripsi, aksi kanan. Kalau role tidak punya
 * `menu`, tampilkan pesan tanpa memanggil API (server tetap memeriksa izin).
 */
export function Page({
  menu,
  title,
  description,
  action,
  children,
}: {
  menu: MenuId;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { can } = useAuth();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-desc">{description}</p> : null}
        </div>
        {action && can(menu) ? <div className="page-action">{action}</div> : null}
      </div>
      {can(menu) ? (
        children
      ) : (
        <div className="card no-access">
          <Lock size={22} aria-hidden />
          <h2>Tidak ada akses</h2>
          <p>Role kamu tidak punya akses ke menu ini. Hubungi Super Admin kalau perlu.</p>
        </div>
      )}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}
