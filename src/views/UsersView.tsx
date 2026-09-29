'use client';

import { useEffect, useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { TransactionDrawer } from '../components/domain/TransactionParts';
import { Badge, StatusBadge } from '../components/ui/Badge';
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
import { INSPECTION_STATE, KYC_STATE, ORDER_STATE, USER_STATUS, statusMeta } from '../lib/labels';
import type { UserDetail, UserRow } from '../types/admin';

type Filter = '' | 'aktif' | 'ditangguhkan';
const FILTERS: { value: Filter; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'aktif', label: 'Aktif' },
  { value: 'ditangguhkan', label: 'Ditangguhkan' },
];

const columns: Column<UserRow>[] = [
  { key: 'name', header: 'Nama', render: (r) => <Stack primary={r.name} secondary={r.email} /> },
  {
    key: 'kind',
    header: 'Jenis',
    render: (r) => <Badge tone="info">{r.kind === 'penjual' ? 'Penjual' : 'Pembeli'}</Badge>,
  },
  { key: 'city', header: 'Kota', render: (r) => r.city || '—' },
  { key: 'kyc', header: 'Verifikasi', render: (r) => <StatusBadge meta={statusMeta(KYC_STATE, r.kyc)} /> },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge meta={statusMeta(USER_STATUS, r.status)} /> },
];

export function UsersView({ initialFilter }: { initialFilter?: string }) {
  const [filter, setFilter] = useState<Filter>(
    FILTERS.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : '',
  );
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const list = useList<UserRow>('/users', { status: filter, q: query });
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Page menu="pengguna" title="Pengguna" description="Cari akun, lihat aktivitas, tangguhkan, atau aktifkan kembali.">
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Cari nama, email, atau HP" />
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
        empty="Tidak ada pengguna yang cocok."
        footer={<Pagination meta={list.meta} page={list.page} onPage={list.setPage} />}
      />
      <UserDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </Page>
  );
}

function UserDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const { data: d, loading, error, reload } = useResource<UserDetail>(id ? `/users/${id}` : null);
  const toast = useToast();
  const { busy, run } = useAction();
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  useEffect(() => {
    setNote(d?.note ?? '');
    setReason('');
    setConfirmSuspend(false);
  }, [d]);

  const act = async (key: string, fn: () => Promise<unknown>, message: string) => {
    try {
      await run(key, fn);
      toast.show(message);
      reload();
      onChanged();
    } catch (err) {
      toast.error(err);
    }
  };

  const suspended = d?.status === 'ditangguhkan';

  return (
    <Drawer open={id !== null} onClose={onClose} title={d?.name ?? 'Pengguna'}>
      {loading || error || !d ? (
        <DrawerState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <DetailList
            items={[
              ['Email', d.email],
              ['HP', d.phone],
              ['Kota', d.city],
              ['Jenis', d.kind === 'penjual' ? 'Penjual' : 'Pembeli'],
              ['Bergabung', formatDate(d.joined_at)],
              ['Verifikasi', d.kind === 'penjual' ? statusMeta(KYC_STATE, d.kyc).label : 'Tidak berlaku'],
              ['Status', <StatusBadge key="s" meta={statusMeta(USER_STATUS, d.status)} />],
            ]}
          />
          {suspended && d.suspended_reason ? (
            <Callout tone="danger">Ditangguhkan: {d.suspended_reason}</Callout>
          ) : null}

          <div className="stack-gap">
            <TextArea
              label="Catatan internal"
              placeholder="Hanya terlihat Admin"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              block
              loading={busy === 'note'}
              disabled={note === (d.note ?? '')}
              onClick={() => act('note', () => api.post(`/users/${d.id}/note`, { note }), 'Catatan disimpan.')}
            >
              Simpan catatan
            </Button>

            {suspended ? (
              <Button
                variant="dark"
                block
                loading={busy === 'reactivate'}
                onClick={() => act('reactivate', () => api.post(`/users/${d.id}/reactivate`), 'Akun diaktifkan kembali.')}
              >
                Aktifkan kembali
              </Button>
            ) : confirmSuspend ? (
              <div className="confirm-box">
                <TextArea
                  label="Alasan penangguhan (opsional)"
                  placeholder="Mis. penipuan, spam"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <p className="muted small">Akun langsung tidak bisa memakai aplikasi.</p>
                <div className="btn-row">
                  <Button block onClick={() => setConfirmSuspend(false)}>
                    Batal
                  </Button>
                  <Button
                    variant="primary"
                    block
                    loading={busy === 'suspend'}
                    onClick={() =>
                      act(
                        'suspend',
                        () => api.post(`/users/${d.id}/suspend`, reason.trim() ? { reason: reason.trim() } : {}),
                        'Akun ditangguhkan.',
                      )
                    }
                  >
                    Tangguhkan
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger-soft" block onClick={() => setConfirmSuspend(true)}>
                Tangguhkan akun
              </Button>
            )}
          </div>

          {d.kios?.length ? (
            <>
              <SectionLabel>Kios</SectionLabel>
              {d.kios.map((k) => (
                <div key={k.id} className="item-card">
                  <span>
                    {k.name}
                    {k.kios_status ? ` · Seller ${k.kios_status === 'terpercaya' ? 'Terpercaya' : 'Baru'}` : ''}
                  </span>
                  {k.frozen ? <Badge tone="danger">dibekukan</Badge> : null}
                </div>
              ))}
            </>
          ) : null}

          {d.orders?.length ? (
            <>
              <SectionLabel>Pesanan terbaru</SectionLabel>
              {d.orders.map((o) => (
                <button key={o.id} className="item-card item-card-btn" onClick={() => setOrderId(o.id)}>
                  <Stack primary={o.order_number} secondary={`${formatDate(o.created_at)} · ${o.seller}`} />
                  <span className="item-card-end">
                    <StatusBadge meta={statusMeta(ORDER_STATE, o.order_state)} />
                    <span className="num small">{formatRupiah(o.total)}</span>
                  </span>
                </button>
              ))}
            </>
          ) : null}

          {d.inspections?.length ? (
            <>
              <SectionLabel>Inspeksi</SectionLabel>
              {d.inspections.map((ins) => (
                <div key={ins.id} className="item-card">
                  <Stack primary={ins.listing} secondary={formatDate(ins.inspection_date ?? ins.requested_date)} />
                  <StatusBadge meta={statusMeta(INSPECTION_STATE, ins.status)} />
                </div>
              ))}
            </>
          ) : null}
        </>
      )}
      <TransactionDrawer id={orderId} onClose={() => setOrderId(null)} />
    </Drawer>
  );
}
