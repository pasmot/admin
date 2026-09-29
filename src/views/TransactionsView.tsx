'use client';

import { useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { TransactionDrawer, transactionColumns } from '../components/domain/TransactionParts';
import { DataTable, Pagination } from '../components/ui/Data';
import { FilterTabs, SearchInput } from '../components/ui/Form';
import { useDebounced, useList } from '../hooks/useApi';
import type { TransactionRow } from '../types/admin';

type Filter = '' | 'bermasalah' | 'menunggu_bayar' | 'diproses' | 'dikirim' | 'selesai' | 'dibatalkan';
const FILTERS: { value: Filter; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'bermasalah', label: 'Bermasalah' },
  { value: 'menunggu_bayar', label: 'Menunggu bayar' },
  { value: 'diproses', label: 'Diproses' },
  { value: 'dikirim', label: 'Dikirim' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'dibatalkan', label: 'Dibatalkan' },
];

export function TransactionsView({ initialFilter }: { initialFilter?: string }) {
  const [filter, setFilter] = useState<Filter>(
    FILTERS.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : '',
  );
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const list = useList<TransactionRow>('/transactions', { filter, q: query });
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Page
      menu="transaksi"
      title="Transaksi"
      description="Semua pesanan di platform. Packing dan resi tetap diurus kios."
    >
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Cari nomor pesanan, pembeli, atau kios" />
        <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      </Toolbar>
      <DataTable
        columns={transactionColumns}
        rows={list.data}
        rowKey={(r) => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={(r) => setOpenId(r.id)}
        empty="Tidak ada transaksi yang cocok."
        footer={<Pagination meta={list.meta} page={list.page} onPage={list.setPage} />}
      />
      <TransactionDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </Page>
  );
}
