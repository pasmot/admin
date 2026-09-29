'use client';

import { useEffect, useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Callout,
  DataTable,
  DetailList,
  DrawerState,
  Pagination,
  SectionLabel,
  Stack,
  type Column,
} from '../components/ui/Data';
import { FilterTabs, SearchInput, TextArea } from '../components/ui/Form';
import { Drawer } from '../components/ui/Overlay';
import { useToast } from '../context/ToastContext';
import { useAction, useDebounced, useList, useResource } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatDate, formatRupiah } from '../lib/format';
import { KYC_STATE, statusMeta } from '../lib/labels';
import type { KiosDetail, KiosRow, KiosStatus } from '../types/admin';

type Filter = '' | 'baru' | 'terpercaya' | 'beku';
const FILTERS: { value: Filter; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'baru', label: 'Seller Baru' },
  { value: 'terpercaya', label: 'Seller Terpercaya' },
  { value: 'beku', label: 'Dibekukan' },
];

function KiosStatusBadge({ row }: { row: Pick<KiosRow, 'frozen' | 'kios_status'> }) {
  if (row.frozen) return <Badge tone="danger">Dibekukan</Badge>;
  return row.kios_status === 'terpercaya' ? (
    <Badge tone="success">Seller Terpercaya</Badge>
  ) : (
    <Badge tone="warning">Seller Baru</Badge>
  );
}

const columns: Column<KiosRow>[] = [
  { key: 'name', header: 'Kios', render: (r) => <Stack primary={r.name} secondary={r.city} /> },
  { key: 'owner', header: 'Pemilik', render: (r) => r.owner },
  { key: 'tier', header: 'Tier', render: (r) => `Tier ${r.tier}` },
  { key: 'balance', header: 'Saldo', render: (r) => <span className="num">{formatRupiah(r.balance)}</span> },
  { key: 'status', header: 'Status', render: (r) => <KiosStatusBadge row={r} /> },
];

export function KiosView({ initialFilter }: { initialFilter?: string }) {
  const [filter, setFilter] = useState<Filter>(
    FILTERS.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : '',
  );
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const list = useList<KiosRow>('/kios', { filter, q: query });
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Page
      menu="kios"
      title="Kios"
      description="Status kios: Seller Baru atau Seller Terpercaya. Isi barang tetap di aplikasi penjual."
    >
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Cari nama kios, kota, atau pemilik" />
        <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(r) => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={(r) => setOpenId(r.id)}
        empty="Tidak ada kios yang cocok."
        footer={<Pagination meta={list.meta} page={list.page} onPage={list.setPage} />}
      />
      <KiosDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </Page>
  );
}

function KiosDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const { data: d, loading, error, reload } = useResource<KiosDetail>(id ? `/kios/${id}` : null);
  const toast = useToast();
  const { busy, run } = useAction();
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    setConfirmFreeze(false);
    setReason('');
  }, [id]);

  const act = async (key: string, fn: () => Promise<unknown>, message: string) => {
    try {
      await run(key, fn);
      toast.show(message);
      setConfirmFreeze(false);
      reload();
      onChanged();
    } catch (err) {
      toast.error(err);
    }
  };

  const setStatus = (status: KiosStatus) =>
    act('status', () => api.post(`/kios/${id}/status`, { status }), 'Status kios diperbarui.');
  const setTier = (tier: number) =>
    act(`tier-${tier}`, () => api.post(`/kios/${id}/tier`, { tier }), `Tier diubah ke ${tier}.`);

  return (
    <Drawer open={id !== null} onClose={onClose} title={d?.name ?? 'Kios'}>
      {loading || error || !d ? (
        <DrawerState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <DetailList
            items={[
              ['Pemilik', d.owner],
              ['Kota', d.city],
              ['Status', <KiosStatusBadge key="s" row={d} />],
              ['Tier', `Tier ${d.tier}`],
              ['Penjualan', d.sales ?? 0],
              ['Penjualan manual', d.manual_sales ?? 0],
              ['Listing aktif', d.active_listings ?? 0],
              ['Saldo', formatRupiah(d.balance)],
              ['Tertahan', formatRupiah(d.withheld)],
              ['KYC pemilik', statusMeta(KYC_STATE, d.owner_kyc ?? (d.kyc_passed ? 'disetujui' : 'belum')).label],
              ...(!d.kyc_passed && d.withdrawal_limit_without_kyc !== undefined
                ? ([['Plafon tarik tanpa KYC', formatRupiah(d.withdrawal_limit_without_kyc)]] as [string, string][])
                : []),
            ]}
          />

          {d.frozen ? (
            <Callout tone="danger">
              Dibekukan {formatDate(d.frozen_at)}
              {d.frozen_reason ? ` — ${d.frozen_reason}` : ''}. Listing hilang dari katalog dan kios tidak bisa
              tarik saldo.
            </Callout>
          ) : null}

          <SectionLabel>Status kios</SectionLabel>
          <div className="segmented">
            {(['baru', 'terpercaya'] as KiosStatus[]).map((s) => (
              <button
                key={s}
                className={`segment${d.kios_status === s ? ' segment-active' : ''}`}
                disabled={!!busy || d.kios_status === s}
                onClick={() => setStatus(s)}
              >
                {s === 'baru' ? 'Seller Baru' : 'Seller Terpercaya'}
              </button>
            ))}
          </div>

          <SectionLabel>Tier</SectionLabel>
          <div className="segmented">
            {[1, 2, 3].map((t) => (
              <button
                key={t}
                className={`segment${d.tier === t ? ' segment-active' : ''}`}
                disabled={!!busy || d.tier === t}
                onClick={() => setTier(t)}
              >
                Tier {t}
              </button>
            ))}
          </div>
          <p className="muted small">Hanya mengubah angka tier. Aturan kenaikan tier otomatis tetap berjalan.</p>

          <div className="drawer-actions">
            {d.frozen ? (
              <Button
                variant="dark"
                loading={busy === 'unfreeze'}
                onClick={() => act('unfreeze', () => api.post(`/kios/${d.id}/unfreeze`), 'Kios diaktifkan kembali.')}
              >
                Aktifkan kios
              </Button>
            ) : confirmFreeze ? (
              <div className="confirm-box">
                <TextArea
                  label="Alasan pembekuan (opsional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <p className="muted small">
                  Semua listing hilang dari katalog, tidak bisa di-checkout, dan kios tidak bisa tarik saldo.
                  Pesanan yang sudah dibayar tetap jalan.
                </p>
                <div className="btn-row">
                  <Button block onClick={() => setConfirmFreeze(false)}>
                    Batal
                  </Button>
                  <Button
                    variant="primary"
                    block
                    loading={busy === 'freeze'}
                    onClick={() =>
                      act(
                        'freeze',
                        () => api.post(`/kios/${d.id}/freeze`, reason.trim() ? { reason: reason.trim() } : {}),
                        'Kios dibekukan.',
                      )
                    }
                  >
                    Bekukan
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger-soft" size="sm" onClick={() => setConfirmFreeze(true)}>
                Bekukan kios
              </Button>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
