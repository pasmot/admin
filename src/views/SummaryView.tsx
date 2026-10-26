'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Page } from '../components/layout/Page';
import { TransactionDrawer, transactionColumns } from '../components/domain/TransactionParts';
import { DataTable } from '../components/ui/Data';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import { HIDDEN_MENUS, MENU_ORDER, menuHref } from '../lib/labels';

export function SummaryView() {
  const { me, can } = useAuth();
  const router = useRouter();
  const { summary, refresh } = useQueue();
  const [openId, setOpenId] = useState<number | null>(null);

  // Role tanpa menu Ringkasan → arahkan ke menu pertama yang dimiliki.
  useEffect(() => {
    if (me && !can('ringkasan')) {
      const first = MENU_ORDER.find((m) => me.menus.includes(m) && !HIDDEN_MENUS.has(m));
      if (first) router.replace(menuHref(first));
    }
  }, [me, can, router]);

  const cards = (summary?.cards ?? []).filter((c) => !HIDDEN_MENUS.has(c.menu));
  const recent = summary?.recent_transactions ?? [];
  const loading = summary === null;

  return (
    <Page
      menu="ringkasan"
      title="Ringkasan operasional"
      description="Antrean yang membuat jual-beli di platform tetap jalan."
    >
      <div className="stat-grid">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card stat-card">
                <span className="skeleton" style={{ width: '50%' }} />
                <span className="skeleton skeleton-lg" />
              </div>
            ))
          : cards.map((c) => (
              <Link key={c.key} href={menuHref(c.menu, c.filter)} className="card stat-card stat-link">
                <span className="stat-label">{c.label}</span>
                <span className="stat-value">{c.count}</span>
                <span className="stat-cta">Buka antrean</span>
              </Link>
            ))}
      </div>

      {can('transaksi') ? (
        <DataTable
          title="Transaksi terbaru"
          aside={
            <Link href="/transaksi" className="link-btn">
              Lihat semua
            </Link>
          }
          columns={transactionColumns}
          rows={recent}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={(r) => setOpenId(r.id)}
          empty="Belum ada transaksi."
        />
      ) : null}

      <TransactionDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
    </Page>
  );
}
