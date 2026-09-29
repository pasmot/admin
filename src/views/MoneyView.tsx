'use client';

import { useEffect, useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { TransactionDrawer, paymentColumns } from '../components/domain/TransactionParts';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout, DataTable, DetailList, DrawerState, Pagination, SectionLabel, type Column } from '../components/ui/Data';
import { FilterTabs, TextArea } from '../components/ui/Form';
import { Drawer } from '../components/ui/Overlay';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../context/ToastContext';
import { useAction, useList, useResource } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatDate, formatDateTime, formatRupiah } from '../lib/format';
import { WITHDRAWAL_STATE, statusMeta } from '../lib/labels';
import type { TransactionRow, WithdrawalDetail, WithdrawalRow } from '../types/admin';

type Tab = '' | 'refund' | 'pencairan';
const TABS: { value: Tab; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'refund', label: 'Refund' },
  { value: 'pencairan', label: 'Tarik saldo' },
];

type WStatus = '' | 'menunggu' | 'dicairkan' | 'ditolak';
const W_FILTERS: { value: WStatus; label: string }[] = [
  { value: '', label: 'Semua status' },
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'dicairkan', label: 'Dicairkan' },
  { value: 'ditolak', label: 'Ditolak' },
];

const withdrawalCode = (w: Pick<WithdrawalRow, 'id' | 'code'>) => w.code || `PO-${w.id}`;

const withdrawalColumns: Column<WithdrawalRow>[] = [
  { key: 'id', header: 'ID', render: (r) => <strong>{withdrawalCode(r)}</strong> },
  { key: 'kios', header: 'Kios', render: (r) => r.kios },
  { key: 'date', header: 'Diajukan', render: (r) => formatDate(r.requested_at ?? r.created_at) },
  { key: 'amount', header: 'Nominal', render: (r) => <span className="num">{formatRupiah(r.amount)}</span> },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge meta={statusMeta(WITHDRAWAL_STATE, r.status)} /> },
];

export function MoneyView({ initialFilter }: { initialFilter?: string }) {
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.value === initialFilter) ? (initialFilter as Tab) : '');
  const [wStatus, setWStatus] = useState<WStatus>('');
  const showWithdrawals = tab !== 'refund';
  const showPayments = tab !== 'pencairan';

  const withdrawals = useList<WithdrawalRow>(
    showWithdrawals ? '/withdrawals' : null,
    { status: tab === 'pencairan' ? wStatus : '' },
    tab === 'pencairan' ? 20 : 10,
  );
  const payments = useList<TransactionRow>(
    showPayments ? '/payments' : null,
    { filter: tab === 'refund' ? 'refund' : '' },
    tab === 'refund' ? 20 : 10,
  );
  const [withdrawalId, setWithdrawalId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);

  return (
    <Page menu="uang" title="Uang" description="Pembayaran DOKU, refund, dan pencairan saldo penjual.">
      <Toolbar>
        <FilterTabs options={TABS} value={tab} onChange={setTab} />
        {tab === 'pencairan' ? <FilterTabs options={W_FILTERS} value={wStatus} onChange={setWStatus} /> : null}
      </Toolbar>

      <div className="stack-lg">
        {showWithdrawals ? (
          <DataTable
            title="Pencairan"
            aside={<span className="muted small">Plafon tanpa KYC Rp 2.000.000</span>}
            columns={withdrawalColumns}
            rows={withdrawals.data}
            rowKey={(r) => r.id}
            loading={withdrawals.loading}
            error={withdrawals.error}
            onRetry={withdrawals.reload}
            onRowClick={(r) => setWithdrawalId(r.id)}
            empty="Belum ada permintaan pencairan."
            footer={<Pagination meta={withdrawals.meta} page={withdrawals.page} onPage={withdrawals.setPage} />}
          />
        ) : null}

        {showPayments ? (
          <DataTable
            title={tab === 'refund' ? 'Perlu refund' : 'Pembayaran'}
            columns={paymentColumns}
            rows={payments.data}
            rowKey={(r) => r.id}
            loading={payments.loading}
            error={payments.error}
            onRetry={payments.reload}
            onRowClick={(r) => setOrderId(r.id)}
            empty={tab === 'refund' ? 'Tidak ada pembayaran yang perlu refund.' : 'Belum ada pembayaran.'}
            footer={<Pagination meta={payments.meta} page={payments.page} onPage={payments.setPage} />}
          />
        ) : null}
      </div>

      <WithdrawalDrawer id={withdrawalId} onClose={() => setWithdrawalId(null)} onChanged={withdrawals.reload} />
      <TransactionDrawer id={orderId} onClose={() => setOrderId(null)} onChanged={payments.reload} />
    </Page>
  );
}

function WithdrawalDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: d, loading, error, reload } = useResource<WithdrawalDetail>(id ? `/withdrawals/${id}` : null);
  const toast = useToast();
  const queue = useQueue();
  const { busy, run } = useAction();
  const [reason, setReason] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);

  useEffect(() => {
    setReason('');
    setConfirmApprove(false);
  }, [id]);

  const decide = async (kind: 'approve' | 'reject') => {
    if (!d) return;
    if (kind === 'reject' && !reason.trim()) {
      toast.show('Alasan tolak wajib diisi.');
      return;
    }
    try {
      await run(kind, () =>
        api.post(`/withdrawals/${d.id}/${kind}`, kind === 'reject' ? { reason: reason.trim() } : undefined),
      );
      toast.show(kind === 'approve' ? 'Pencairan dicatat sudah ditransfer.' : 'Pencairan ditolak, saldo dikembalikan.');
      onChanged();
      queue.refresh();
      onClose();
    } catch (err) {
      toast.error(err);
      reload();
    }
  };

  const pending = d?.status === 'menunggu';
  const kycOk = d?.kyc_passed ?? d?.owner_kyc === 'disetujui';

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      title={d ? withdrawalCode(d) : 'Pencairan'}
      footer={
        d && pending ? (
          <div className="stack-gap">
            {confirmApprove ? (
              <Callout tone="warning">
                Pastikan {formatRupiah(d.amount)} sudah ditransfer manual ke rekening di atas. &ldquo;Cairkan&rdquo;
                hanya mencatat transfer.
              </Callout>
            ) : null}
            <Button
              variant="primary"
              block
              loading={busy === 'approve'}
              disabled={!!busy || d.can_approve === false}
              onClick={() => (confirmApprove ? decide('approve') : setConfirmApprove(true))}
            >
              {confirmApprove ? 'Ya, sudah ditransfer' : 'Cairkan'}
            </Button>
            <TextArea
              label="Alasan tolak"
              placeholder="Wajib diisi sebelum menolak"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button block loading={busy === 'reject'} disabled={!reason.trim() || !!busy} onClick={() => decide('reject')}>
              Tolak
            </Button>
          </div>
        ) : undefined
      }
    >
      {loading || error || !d ? (
        <DrawerState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <DetailList
            items={[
              ['Kios', d.kios],
              ['Nominal', <strong key="n">{formatRupiah(d.amount)}</strong>],
              ['Diajukan', formatDateTime(d.requested_at ?? d.created_at)],
              ['KYC pemilik', d.owner_kyc ?? (kycOk ? 'disetujui' : 'belum')],
              ['Status', <StatusBadge key="s" meta={statusMeta(WITHDRAWAL_STATE, d.status)} />],
              ...(d.processed_by ? ([['Diproses oleh', d.processed_by]] as [string, string][]) : []),
              ...(d.processed_at ? ([['Diproses', formatDateTime(d.processed_at)]] as [string, string][]) : []),
            ]}
          />

          {d.cap?.message ? (
            <Callout tone={d.cap.ok ? 'success' : 'danger'}>{d.cap.message}</Callout>
          ) : kycOk ? (
            <Callout tone="success">KYC penjual sudah disetujui.</Callout>
          ) : null}
          {d.frozen ? <Callout tone="danger">Kios sedang dibekukan — pencairan tidak bisa disetujui.</Callout> : null}
          {d.status === 'ditolak' && d.rejection_reason ? (
            <Callout tone="danger">Alasan tolak: {d.rejection_reason}</Callout>
          ) : null}

          {d.bank ? (
            <>
              <SectionLabel>Rekening tujuan</SectionLabel>
              <DetailList
                items={[
                  ['Bank', d.bank.bank_code],
                  ['No. rekening', <span key="a" className="mono">{d.bank.account_number}</span>],
                  ['Atas nama', d.bank.holder_name],
                ]}
              />
              <p className="muted small">Setiap pembukaan detail rekening dicatat di audit log.</p>
            </>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
