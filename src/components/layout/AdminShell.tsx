'use client';

import { Loader2, Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { QueueProvider } from '../../context/QueueContext';
import { AccountMenu } from './AccountMenu';
import { Sidebar } from './Sidebar';
import { Wordmark } from './Wordmark';

export function AdminShell({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  useEffect(() => setNavOpen(false), [pathname]);

  if (loading || !me) {
    return (
      <div className="boot">
        <Loader2 size={22} className="spin" aria-label="Memuat" />
      </div>
    );
  }

  return (
    <QueueProvider>
      <div className="shell">
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        {navOpen ? <div className="sidebar-scrim" onClick={() => setNavOpen(false)} /> : null}
        <div className="main">
          <header className="topbar">
            <button className="icon-btn topbar-menu" onClick={() => setNavOpen(true)} aria-label="Buka menu">
              <Menu size={18} />
            </button>
            <span className="topbar-brand">
              <Wordmark tone="light" />
            </span>
            <AccountMenu />
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </QueueProvider>
  );
}
