'use client';

import {
  Banknote,
  Flag,
  LayoutGrid,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  Ticket,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import { HIDDEN_MENUS, MENU_LABELS, MENU_ORDER, menuHref } from '../../lib/labels';
import type { MenuId } from '../../types/admin';
import { Wordmark } from './Wordmark';

const ICONS: Record<MenuId, LucideIcon> = {
  ringkasan: LayoutGrid,
  pengguna: Users,
  verifikasi: ShieldCheck,
  kios: Store,
  transaksi: ReceiptText,
  uang: Banknote,
  inspeksi: Wrench,
  masalah: Flag,
  voucher: Ticket,
  settings: Settings,
};

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { me } = useAuth();
  const { counts } = useQueue();

  // Urutan mengikuti `menus` dari /me, tapi settings selalu di bawah.
  const allowed = new Set(me?.menus ?? []);
  const main = MENU_ORDER.filter((m) => m !== 'settings' && allowed.has(m) && !HIDDEN_MENUS.has(m));
  const showSettings = allowed.has('settings');

  const isActive = (m: MenuId) =>
    m === 'ringkasan' ? pathname === '/' : pathname === `/${m}` || pathname.startsWith(`/${m}/`);

  const item = (m: MenuId) => {
    const Icon = ICONS[m];
    const count = counts[m];
    return (
      <Link
        key={m}
        href={menuHref(m)}
        className={`nav-item${isActive(m) ? ' nav-item-active' : ''}`}
        aria-current={isActive(m) ? 'page' : undefined}
        onClick={onNavigate}
      >
        <Icon size={18} strokeWidth={1.8} aria-hidden />
        <span>{MENU_LABELS[m]}</span>
        {count ? <span className="nav-count">{count > 99 ? '99+' : count}</span> : null}
      </Link>
    );
  };

  return (
    <nav className={`sidebar${open ? ' sidebar-open' : ''}`} aria-label="Menu admin">
      <div className="sidebar-brand">
        <Link href="/" onClick={onNavigate} aria-label="Pasar Motor Admin">
          <Wordmark />
        </Link>
      </div>
      <div className="sidebar-nav">{main.map(item)}</div>
      {showSettings ? <div className="sidebar-foot">{item('settings')}</div> : null}
    </nav>
  );
}
