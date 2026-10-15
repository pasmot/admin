'use client';

import { AlertCircle, ImageOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Callout,
  DataTable,
  DetailList,
  DrawerState,
  Pagination,
  SectionLabel,
  type Column,
} from '../components/ui/Data';
import { FilterTabs, SearchInput, TextArea } from '../components/ui/Form';
import { Drawer, Modal } from '../components/ui/Overlay';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../context/ToastContext';
import { useAction, useDebounced, useList, useResource } from '../hooks/useApi';
import { api, apiBlobUrl, ApiError } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import { KYC_DETAIL_STATE, KYC_STATE, statusMeta } from '../lib/labels';
import type { VerificationDetail, VerificationRow } from '../types/admin';

type Filter = 'menunggu' | 'disetujui' | 'ditolak' | 'semua';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'semua', label: 'Semua' },
];

/** Alasan tolak masuk ke notifikasi penjual, jadi dibatasi supaya muat. */
const REASON_MAX = 200;

const bankText = (bank?: string, account?: string) => [bank, account].filter(Boolean).join(' · ') || '—';

const columns: Column<VerificationRow>[] = [
  { key: 'seller', header: 'Penjual', render: (r) => <strong>{r.full_name || '—'}</strong> },
  { key: 'kios', header: 'Kios', render: (r) => r.seller || '—' },
  { key: 'nik', header: 'KTP', render: (r) => <span className="mono">{r.nik || '—'}</span> },
  { key: 'email', header: 'Email', render: (r) => r.email ?? '—' },
  { key: 'bank', header: 'Bank', render: (r) => <span className="mono">{bankText(r.bank_code, r.account_number)}</span> },
  { key: 'date', header: 'Diajukan', render: (r) => formatDate(r.submitted_at) },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge meta={statusMeta(KYC_STATE, r.status)} /> },
];

export function VerificationsView({ initialFilter }: { initialFilter?: string }) {
  const [filter, setFilter] = useState<Filter>(
    FILTERS.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : 'menunggu',
  );
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const list = useList<VerificationRow>('/verifications', { status: filter, q: query });
  // Baris list dibawa ke drawer karena nomor rekening lengkap hanya ada di list.
  const [open, setOpen] = useState<VerificationRow | null>(null);

  return (
    <Page
      menu="verifikasi"
      title="Verifikasi penjual"
      description="Review e-KTP, selfie, dan rekening. Tanpa persetujuan, total pencairan penjual dibatasi Rp 2.000.000."
    >
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Cari nama, kios, email, atau NIK" />
        <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(r) => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={setOpen}
        empty={filter === 'menunggu' ? 'Tidak ada verifikasi yang menunggu.' : 'Tidak ada data.'}
        footer={<Pagination meta={list.meta} page={list.page} onPage={list.setPage} />}
      />
      <VerificationDrawer row={open} onClose={() => setOpen(null)} onChanged={list.reload} />
    </Page>
  );
}

type ImageState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; url: string };

/**
 * Foto KTP/selfie diambil lewat fetch ber-token → object URL, tidak di-cache,
 * dan di-revoke saat drawer ditutup. Tidak ada tombol unduh.
 */
function SecureImage({ path, label, available }: { path: string; label: string; available: boolean }) {
  const [state, setState] = useState<ImageState>({ kind: available ? 'loading' : 'missing' });
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!available) {
      setState({ kind: 'missing' });
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    setState({ kind: 'loading' });
    apiBlobUrl(path)
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else {
          url = u;
          setState({ kind: 'ready', url: u });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // 410: foto sudah tidak tersimpan — bukan error.
        setState({ kind: err instanceof ApiError && err.status === 410 ? 'missing' : 'error' });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, available]);

  return (
    <figure className="doc-figure">
      <div className="doc-image">
        {state.kind === 'ready' ? (
          <button type="button" onClick={() => setZoom(true)} title="Perbesar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.url} alt={label} />
          </button>
        ) : state.kind === 'missing' ? (
          <span className="doc-placeholder">
            <ImageOff size={20} aria-hidden />
            Foto tidak tersedia
          </span>
        ) : state.kind === 'error' ? (
          <span className="doc-placeholder">
            <AlertCircle size={20} aria-hidden />
            Gagal memuat foto
          </span>
        ) : (
          <Loader2 size={20} className="spin" aria-label="Memuat" />
        )}
      </div>
      <figcaption>{label}</figcaption>
      {state.kind === 'ready' ? (
        <Modal open={zoom} onClose={() => setZoom(false)} title={label} width={760}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="doc-zoom" src={state.url} alt={label} />
        </Modal>
      ) : null}
    </figure>
  );
}

function VerificationDrawer({
  row,
  onClose,
  onChanged,
}: {
  row: VerificationRow | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const id = row?.id ?? null;
  const { data: d, loading, error, reload } = useResource<VerificationDetail>(id ? `/verifications/${id}` : null);
  const toast = useToast();
  const queue = useQueue();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    setConfirm(null);
    setReason('');
  }, [id]);

  const decide = async (kind: 'approve' | 'reject') => {
    if (!d) return;
    if (kind === 'reject' && !reason.trim()) {
      toast.show('Alasan penolakan wajib diisi.');
      return;
    }
    try {
      await run(kind, () =>
        api.post(`/verifications/${d.id}/${kind}`, kind === 'reject' ? { reason: reason.trim() } : undefined),
      );
      toast.show(kind === 'approve' ? 'Verifikasi disetujui.' : 'Verifikasi ditolak.');
      onChanged();
      queue.refresh();
      onClose();
    } catch (err) {
      toast.error(err);
      setConfirm(null);
      // 409: admin lain sudah memutuskan — muat ulang detail dan list.
      if (err instanceof ApiError && err.status === 409) {
        reload();
        onChanged();
        queue.refresh();
      }
    }
  };

  const pending = d?.status === 'submitted';
  const name = d?.full_name || row?.full_name || 'Verifikasi';
  const birthDate = d?.birth_date ? formatDate(d.birth_date.slice(0, 10)) : null;
  const hasBank = !!(d?.bank_code || d?.bank_account_last4);
  const accountNumber =
    row?.account_number && row.id === d?.id
      ? row.account_number
      : d?.bank_account_last4
        ? `•••• ${d.bank_account_last4}`
        : null;

  return (
    <Drawer
      open={row !== null}
      onClose={onClose}
      eyebrow="Verifikasi KYC"
      title={name}
      footer={
        d && pending ? (
          confirm === 'approve' ? (
            <div className="confirm-row">
              <p className="small">
                Setujui verifikasi {name}? Penjual langsung terverifikasi dan batas pencairan Rp 2 juta dihapus.
                Keputusan ini tidak bisa dibatalkan.
              </p>
              <div className="btn-row">
                <Button block onClick={() => setConfirm(null)} disabled={!!busy}>
                  Batal
                </Button>
                <Button variant="primary" block loading={busy === 'approve'} onClick={() => decide('approve')}>
                  Ya, setujui
                </Button>
              </div>
            </div>
          ) : confirm === 'reject' ? (
            <div className="confirm-row">
              <TextArea
                label="Alasan penolakan"
                placeholder="Contoh: Foto KTP buram, NIK tidak terbaca"
                value={reason}
                maxLength={REASON_MAX}
                autoFocus
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="small muted">
                Dibaca langsung oleh penjual di notifikasi. Tulis dengan jelas, tanpa catatan internal. ·{' '}
                {reason.length}/{REASON_MAX}
              </p>
              <div className="btn-row">
                <Button block onClick={() => setConfirm(null)} disabled={!!busy}>
                  Batal
                </Button>
                <Button
                  variant="danger-soft"
                  block
                  loading={busy === 'reject'}
                  disabled={!reason.trim()}
                  onClick={() => decide('reject')}
                >
                  Tolak pengajuan
                </Button>
              </div>
            </div>
          ) : (
            <div className="btn-row">
              <Button block onClick={() => setConfirm('reject')}>
                Tolak
              </Button>
              <Button variant="primary" block onClick={() => setConfirm('approve')}>
                Setujui KYC
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
          <SectionLabel>Dokumen</SectionLabel>
          <div className="doc-grid">
            <SecureImage path={`/verifications/${d.id}/ktp`} label="Foto e-KTP" available={d.has_ktp_photo} />
            <SecureImage path={`/verifications/${d.id}/selfie`} label="Selfie" available={d.has_selfie_photo} />
          </div>

          <SectionLabel>Data e-KTP</SectionLabel>
          <DetailList
            items={[
              ['NIK', d.nik ? <span key="n" className="mono">{d.nik}</span> : null],
              ['Nama', d.full_name],
              ['Tempat, tgl lahir', [d.birth_place, birthDate].filter(Boolean).join(', ') || null],
              ['Alamat', d.address],
            ]}
          />

          <SectionLabel>Rekening pencairan</SectionLabel>
          {hasBank ? (
            <>
              <DetailList
                items={[
                  ['Bank', d.bank_code],
                  ['No. rekening', accountNumber ? <span key="a" className="mono">{accountNumber}</span> : null],
                  ['Nama pemilik', d.account_holder_name],
                ]}
              />
              {d.account_name_matches ? (
                <Callout tone="success">Nama pemilik rekening sesuai dengan e-KTP.</Callout>
              ) : (
                <Callout tone="warning">
                  <strong>Nama pemilik rekening tidak sama dengan nama di e-KTP.</strong> Periksa sebelum menyetujui.
                </Callout>
              )}
            </>
          ) : (
            <Callout>Penjual belum punya rekening aktif.</Callout>
          )}

          <SectionLabel>Pengajuan</SectionLabel>
          <DetailList
            items={[
              ['Kios', d.seller_name ?? row?.seller],
              ['Email', row?.email],
              ['Diajukan', formatDateTime(d.submitted_at)],
              ['Persetujuan data', d.consent_at ? `${formatDateTime(d.consent_at)}${d.consent_version ? ` · v${d.consent_version}` : ''}` : null],
              ['Status', <StatusBadge key="s" meta={statusMeta(KYC_DETAIL_STATE, d.status)} />],
              ...(d.reviewed_at ? ([['Diputuskan', formatDateTime(d.reviewed_at)]] as [string, string][]) : []),
            ]}
          />
          {d.status === 'rejected' && d.rejection_reason ? (
            <Callout tone="danger">Alasan penolakan: {d.rejection_reason}</Callout>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
