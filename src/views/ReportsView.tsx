'use client';

import { useEffect, useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout, DataTable, DetailList, DrawerState, Pagination, Stack, type Column } from '../components/ui/Data';
import { FilterTabs, SearchInput } from '../components/ui/Form';
import { Drawer } from '../components/ui/Overlay';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../context/ToastContext';
import { useAction, useDebounced, useList, useResource } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import { REPORT_STATE, statusMeta } from '../lib/labels';
import type { ReportDetail, ReportRow } from '../types/admin';

type Filter = 'baru' | 'selesai' | '';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'baru', label: 'Baru' },
  { value: 'selesai', label: 'Selesai' },
  { value: '', label: 'Semua' },
];

const reportCode = (r: Pick<ReportRow, 'id' | 'code'>) => r.code || `LP-${r.id}`;
const targetType = (r: Pick<ReportRow, 'target_type' | 'kind'>) => r.target_type ?? r.kind ?? '';

const ACTION_LABEL: Record<string, string> = {
  akun: 'Akun ditangguhkan',
  kios: 'Kios dibekukan',
  catat: 'Ditutup tanpa tindakan',
};

const columns: Column<ReportRow>[] = [
  { key: 'id', header: 'Laporan', render: (r) => <Stack primary={reportCode(r)} secondary={formatDate(r.created_at)} /> },
  { key: 'reporter', header: 'Pelapor', render: (r) => r.reporter },
  {
    key: 'target',
    header: 'Target',
    render: (r) => (
      <span className="inline-gap">
        {r.target}
        {targetType(r) ? <Badge>{targetType(r)}</Badge> : null}
      </span>
    ),
  },
  { key: 'reason', header: 'Alasan', render: (r) => <span className="truncate">{r.reason || '—'}</span>, width: '32%' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge meta={statusMeta(REPORT_STATE, r.status)} /> },
];

export function ReportsView({ initialFilter }: { initialFilter?: string }) {
  const [filter, setFilter] = useState<Filter>(
    FILTERS.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : 'baru',
  );
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const list = useList<ReportRow>('/reports', { status: filter, q: query });
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Page
      menu="masalah"
      title="Masalah"
      description="Laporan dari pengguna. Tindakan yang tersedia: tangguhkan akun atau bekukan kios."
    >
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Cari pelapor atau target" />
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
        empty={filter === 'baru' ? 'Tidak ada laporan baru.' : 'Tidak ada laporan.'}
        footer={<Pagination meta={list.meta} page={list.page} onPage={list.setPage} />}
      />
      <ReportDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </Page>
  );
}

function ReportDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const { data: d, loading, error, reload } = useResource<ReportDetail>(id ? `/reports/${id}` : null);
  const toast = useToast();
  const queue = useQueue();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState<'akun' | 'kios' | 'catat' | null>(null);

  useEffect(() => setConfirm(null), [id]);

  const resolve = async (action: 'akun' | 'kios' | 'catat') => {
    if (!d) return;
    try {
      await run(action, () => api.post(`/reports/${d.id}/resolve`, { action }));
      toast.show(ACTION_LABEL[action] + '.');
      onChanged();
      queue.refresh();
      onClose();
    } catch (err) {
      toast.error(err);
      setConfirm(null);
      reload();
    }
  };

  const type = d ? targetType(d) : '';
  const isNew = d?.status === 'baru';
  // Tindakan hanya relevan kalau target masih aktif.
  const canSuspend = type === 'akun' && d?.target_user_active !== false;
  const canFreeze = type === 'kios' && d?.target_kios_frozen !== true;

  const confirmText =
    confirm === 'akun'
      ? `Tangguhkan akun ${d?.target}? Akun langsung tidak bisa memakai aplikasi.`
      : confirm === 'kios'
        ? `Bekukan kios ${d?.target}? Semua listing hilang dari katalog.`
        : 'Tutup laporan tanpa tindakan?';

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      title={d ? reportCode(d) : 'Laporan'}
      footer={
        d && isNew ? (
          confirm ? (
            <div className="confirm-row">
              <p className="small">{confirmText}</p>
              <div className="btn-row">
                <Button block onClick={() => setConfirm(null)} disabled={!!busy}>
                  Batal
                </Button>
                <Button
                  variant={confirm === 'catat' ? 'dark' : 'primary'}
                  block
                  loading={busy === confirm}
                  onClick={() => resolve(confirm)}
                >
                  Ya, lanjutkan
                </Button>
              </div>
            </div>
          ) : (
            <div className="stack-gap">
              {canSuspend ? (
                <Button variant="danger-soft" block onClick={() => setConfirm('akun')}>
                  Tangguhkan akun
                </Button>
              ) : null}
              {canFreeze ? (
                <Button variant="danger-soft" block onClick={() => setConfirm('kios')}>
                  Bekukan kios
                </Button>
              ) : null}
              <Button block onClick={() => setConfirm('catat')}>
                Tutup tanpa tindakan
              </Button>
            </div>
          )
        ) : undefined
      }
    >
      {loading || error || !d ? (
        <DrawerState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <DetailList
            items={[
              ['Pelapor', d.reporter],
              ['Target', d.target],
              ['Jenis', type || null],
              ['Dibuka', formatDate(d.created_at)],
              ['Status', <StatusBadge key="s" meta={statusMeta(REPORT_STATE, d.status)} />],
              ...(d.action ? ([['Tindakan', ACTION_LABEL[d.action] ?? d.action]] as [string, string][]) : []),
              ...(d.resolved_by ? ([['Oleh', d.resolved_by]] as [string, string][]) : []),
              ...(d.resolved_at ? ([['Diselesaikan', formatDateTime(d.resolved_at)]] as [string, string][]) : []),
            ]}
          />
          {d.reason ? (
            <Callout tone="warning">
              <span className="pre-line">{d.reason}</span>
            </Callout>
          ) : null}
          {isNew && type === 'akun' && d.target_user_active === false ? (
            <Callout>Akun target sudah ditangguhkan.</Callout>
          ) : null}
          {isNew && type === 'kios' && d.target_kios_frozen ? <Callout>Kios target sudah dibekukan.</Callout> : null}
        </>
      )}
    </Drawer>
  );
}
