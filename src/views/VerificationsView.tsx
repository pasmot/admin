'use client';

import { ImageOff, Loader2 } from 'lucide-react';
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
import { Drawer } from '../components/ui/Overlay';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../context/ToastContext';
import { useAction, useDebounced, useList, useResource } from '../hooks/useApi';
import { api, apiBlobUrl } from '../lib/api';
import { formatDate } from '../lib/format';
import { KYC_STATE, statusMeta } from '../lib/labels';
import type { VerificationDetail, VerificationRow } from '../types/admin';

type Filter = 'menunggu' | 'disetujui' | 'ditolak' | 'semua';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'semua', label: 'Semua' },
];

const columns: Column<VerificationRow>[] = [
  { key: 'seller', header: 'Penjual', render: (r) => <strong>{r.full_name}</strong> },
  { key: 'kios', header: 'Kios', render: (r) => r.seller || '—' },
  { key: 'nik', header: 'KTP', render: (r) => <span className="mono">{r.nik}</span> },
  { key: 'email', header: 'Email', render: (r) => r.email },
  { key: 'bank', header: 'Bank', render: (r) => `${r.bank_code} · ${r.account_number}` },
  { key: 'date', header: 'Diajukan', render: (r) => formatDate(r.submitted_at) },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge meta={statusMeta(KYC_STATE, r.status)} /> },
];

export function VerificationsView({ initialFilter }: { initialFilter?: string }) {
  const [filter, setFilter] = useState<Filter>(
    FILTERS.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : 'menunggu',
  );
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const list = useList<VerificationRow>('/verifications', { status: filter, q: query });
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Page
      menu="verifikasi"
      title="Verifikasi penjual"
      description="Review e-KTP, selfie, dan rekening. Tanpa persetujuan, saldo di atas Rp 2.000.000 tidak bisa ditarik."
    >
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Cari nama, NIK, atau kios" />
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
        empty={filter === 'menunggu' ? 'Tidak ada verifikasi yang menunggu.' : 'Tidak ada data.'}
        footer={<Pagination meta={list.meta} page={list.page} onPage={list.setPage} />}
      />
      <VerificationDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </Page>
  );
}

/** Gambar KTP/selfie diambil lewat fetch ber-token → object URL, tidak di-cache. */
function SecureImage({ path, label }: { path: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    apiBlobUrl(path)
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else {
          url = u;
          setSrc(u);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  return (
    <figure className="doc-figure">
      <div className="doc-image">
        {src ? (
          <a href={src} target="_blank" rel="noreferrer" title="Buka ukuran penuh">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={label} />
          </a>
        ) : failed ? (
          <ImageOff size={22} aria-label="Gambar tidak tersedia" />
        ) : (
          <Loader2 size={20} className="spin" aria-label="Memuat" />
        )}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function VerificationDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: d, loading, error, reload } = useResource<VerificationDetail>(id ? `/verifications/${id}` : null);
  const toast = useToast();
  const queue = useQueue();
  const { busy, run } = useAction();
  const [reason, setReason] = useState('');

  useEffect(() => setReason(''), [id]);

  const decide = async (kind: 'approve' | 'reject') => {
    if (!d) return;
    if (kind === 'reject' && !reason.trim()) {
      toast.show('Alasan tolak wajib diisi.');
      return;
    }
    try {
      await run(kind, () =>
        api.post(`/verifications/${d.id}/${kind}`, kind === 'reject' ? { reason: reason.trim() } : undefined),
      );
      toast.show(kind === 'approve' ? 'KYC disetujui.' : 'KYC ditolak.');
      onChanged();
      queue.refresh();
      onClose();
    } catch (err) {
      toast.error(err);
      reload();
    }
  };

  const pending = d?.status === 'menunggu';
  const birthPlace = d?.birth_place ?? d?.place_of_birth;
  const birthDate = d?.birth_date ?? d?.date_of_birth;
  const holder = d?.account_name ?? d?.account_holder ?? d?.holder_name;

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      eyebrow={`Verifikasi KYC${d?.tier_target ? ` · menuju tier ${d.tier_target}` : ''}`}
      title={d?.full_name ?? 'Verifikasi'}
      footer={
        d && pending ? (
          <div className="stack-gap">
            <TextArea
              label="Alasan tolak"
              placeholder="Wajib diisi sebelum menolak"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="btn-row">
              <Button block loading={busy === 'reject'} disabled={!reason.trim() || !!busy} onClick={() => decide('reject')}>
                Tolak
              </Button>
              <Button variant="primary" block loading={busy === 'approve'} disabled={!!busy} onClick={() => decide('approve')}>
                Setujui KYC
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {loading || error || !d ? (
        <DrawerState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <SectionLabel>Dokumen</SectionLabel>
          <div className="doc-grid">
            <SecureImage path={`/verifications/${d.id}/ktp`} label="Foto e-KTP" />
            <SecureImage path={`/verifications/${d.id}/selfie`} label="Selfie + liveness" />
          </div>

          <SectionLabel>Data e-KTP</SectionLabel>
          <DetailList
            items={[
              ['NIK', <span key="n" className="mono">{d.nik}</span>],
              ['Nama', d.full_name],
              ['Tempat, tgl lahir', [birthPlace, birthDate ? formatDate(birthDate) : null].filter(Boolean).join(', ') || null],
              ['Alamat', d.address],
            ]}
          />

          <SectionLabel>Rekening pencairan</SectionLabel>
          <DetailList
            items={[
              ['Bank', d.bank_code],
              ['No. rekening', <span key="a" className="mono">{d.account_number}</span>],
              ['Nama pemilik', holder],
            ]}
          />
          {d.account_name_matches === false ? (
            <Callout tone="warning">Nama pemilik rekening tidak sama dengan nama di e-KTP.</Callout>
          ) : d.account_name_matches === true ? (
            <Callout tone="success">Nama pemilik rekening sesuai dengan e-KTP.</Callout>
          ) : null}

          <SectionLabel>Pengajuan</SectionLabel>
          <DetailList
            items={[
              ['Kios', d.seller],
              ['Email', d.email],
              ['Diajukan', formatDate(d.submitted_at)],
              ['Status', <StatusBadge key="s" meta={statusMeta(KYC_STATE, d.status)} />],
              ...(d.reviewed_at ? ([['Direview', formatDate(d.reviewed_at)]] as [string, string][]) : []),
              ...(d.reviewed_by ? ([['Oleh', d.reviewed_by]] as [string, string][]) : []),
            ]}
          />
          {d.status === 'ditolak' && d.rejection_reason ? (
            <Callout tone="danger">Alasan tolak: {d.rejection_reason}</Callout>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
