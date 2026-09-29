'use client';

import { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { useToast } from '../../context/ToastContext';
import { useAction, useResource } from '../../hooks/useApi';
import { api } from '../../lib/api';
import {
  addressRecipient,
  formatAddress,
  formatDate,
  formatDateTime,
  formatRupiah,
  paymentMethodLabel,
} from '../../lib/format';
import { ORDER_STATE, PAY_STATE, REFUND_REASON, statusMeta } from '../../lib/labels';
import type { TransactionDetail, TransactionRow } from '../../types/admin';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout, DetailList, DrawerState, SectionLabel, Stack, type Column } from '../ui/Data';
import { Drawer } from '../ui/Overlay';

export const transactionColumns: Column<TransactionRow>[] = [
  {
    key: 'order',
    header: 'Pesanan',
    render: (r) => <Stack primary={r.order_number} secondary={formatDate(r.created_at)} />,
  },
  { key: 'buyer', header: 'Pembeli', render: (r) => r.buyer || '—' },
  { key: 'seller', header: 'Kios', render: (r) => r.seller || '—' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge meta={statusMeta(ORDER_STATE, r.order_state)} /> },
  { key: 'pay', header: 'Bayar', render: (r) => <StatusBadge meta={statusMeta(PAY_STATE, r.pay_state)} /> },
  { key: 'total', header: 'Total', render: (r) => <span className="num">{formatRupiah(r.total)}</span> },
];

export const paymentColumns: Column<TransactionRow>[] = [
  {
    key: 'order',
    header: 'Pesanan',
    render: (r) => <Stack primary={r.order_number} secondary={r.seller} />,
  },
  { key: 'method', header: 'Metode', render: (r) => paymentMethodLabel(r.payment_method) },
  { key: 'date', header: 'Tanggal', render: (r) => formatDate(r.created_at) },
  { key: 'pay', header: 'Status bayar', render: (r) => <StatusBadge meta={statusMeta(PAY_STATE, r.pay_state)} /> },
  { key: 'total', header: 'Total', render: (r) => <span className="num">{formatRupiah(r.total)}</span> },
];

/** Drawer detail transaksi. Dipakai di Ringkasan, Transaksi, Uang, dan Pengguna. */
export function TransactionDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { data, loading, error, reload } = useResource<TransactionDetail>(
    id ? `/transactions/${id}` : null,
  );
  const toast = useToast();
  const queue = useQueue();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState<'failed' | 'expired' | null>(null);

  const mark = async (kind: 'failed' | 'expired') => {
    if (!id) return;
    try {
      await run(kind, () => api.post(`/transactions/${id}/mark-${kind}`));
      toast.show(kind === 'failed' ? 'Pesanan ditandai gagal.' : 'Pesanan ditandai hangus.');
      setConfirm(null);
      reload();
      onChanged?.();
      queue.refresh();
    } catch (err) {
      toast.error(err);
      setConfirm(null);
      reload();
    }
  };

  const d = data;
  const canAct = !!(d?.can_mark_failed || d?.can_mark_expired);

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      title={d?.order_number ?? 'Transaksi'}
      footer={
        d && canAct ? (
          confirm ? (
            <div className="confirm-row">
              <p className="small">
                {confirm === 'failed' ? 'Tandai pesanan ini gagal?' : 'Tandai pesanan ini hangus?'} Stok,
                voucher, dan VA/QRIS aktif akan dilepas.
              </p>
              <div className="btn-row">
                <Button onClick={() => setConfirm(null)} disabled={!!busy}>
                  Batal
                </Button>
                <Button variant="dark" loading={busy === confirm} onClick={() => mark(confirm)}>
                  Ya, tandai
                </Button>
              </div>
            </div>
          ) : (
            <div className="btn-row">
              {d.can_mark_failed ? (
                <Button variant="danger-soft" block onClick={() => setConfirm('failed')}>
                  Tandai gagal
                </Button>
              ) : null}
              {d.can_mark_expired ? (
                <Button block onClick={() => setConfirm('expired')}>
                  Tandai hangus
                </Button>
              ) : null}
            </div>
          )
        ) : undefined
      }
    >
      {loading || error || !d ? (
        <DrawerState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <div className="badge-row">
            <StatusBadge meta={statusMeta(ORDER_STATE, d.order_state)} />
            <StatusBadge meta={statusMeta(PAY_STATE, d.pay_state)} />
          </div>

          {d.items?.length ? (
            <div className="item-list">
              {d.items.map((it, i) => (
                <div key={i} className="item-card">
                  <Stack
                    primary={it.title}
                    secondary={`${it.quantity} barang${it.quantity > 1 ? ` · @ ${formatRupiah(it.price)}` : ''}`}
                  />
                  <strong className="num">{formatRupiah(it.subtotal)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <DetailList
            items={[
              ['Pembeli', d.buyer],
              ['Kios', d.seller],
              ['Tanggal', formatDateTime(d.created_at)],
              ['Metode', paymentMethodLabel(d.payment_method)],
              ['Subtotal', d.subtotal !== undefined ? formatRupiah(d.subtotal) : null],
              [
                'Ongkir',
                d.shipping_cost !== undefined
                  ? `${formatRupiah(d.shipping_cost)}${d.shipping_method ? ` · ${d.shipping_method}` : ''}`
                  : null,
              ],
              ['Diskon', d.discount ? `- ${formatRupiah(d.discount)}` : formatRupiah(0)],
              ['Total', <strong key="t">{formatRupiah(d.total)}</strong>],
              ['Biaya platform', d.platform_fee !== undefined ? formatRupiah(d.platform_fee) : null],
              ['Diterima kios', d.seller_amount !== undefined ? formatRupiah(d.seller_amount) : null],
            ]}
          />

          <SectionLabel>Pengiriman</SectionLabel>
          <DetailList
            items={[
              ['Penerima', addressRecipient(d.address)],
              ['Alamat', formatAddress(d.address)],
              ['Kurir', d.courier],
              ['Resi', d.resi],
            ]}
          />
          <p className="muted small">Resi hanya ditampilkan. Nomor resi diisi kios dari aplikasi.</p>

          {d.refund_status || d.pay_state === 'perlu_refund' ? (
            <>
              <SectionLabel>Refund</SectionLabel>
              <DetailList
                items={[
                  ['Status refund', d.refund_status ?? 'perlu refund'],
                  ['Alasan', d.refund_reason ? REFUND_REASON[d.refund_reason] ?? d.refund_reason : null],
                ]}
              />
              <Callout tone="warning">
                Refund belum bisa diproses dari dashboard. Proses manual lalu status akan diperbarui
                sistem.
              </Callout>
            </>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
