'use client';

import { Clock, ImageOff, MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout, DataTable, DetailList, DrawerState, Pagination, SectionLabel, Stack, type Column } from '../components/ui/Data';
import { FilterTabs, SearchInput } from '../components/ui/Form';
import { Drawer } from '../components/ui/Overlay';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../context/ToastContext';
import { useAction, useDebounced, useList, useResource } from '../hooks/useApi';
import { api, ApiError } from '../lib/api';
import { formatAge, formatDate, formatDateTime, hoursSince } from '../lib/format';
import { REPORT_SOURCE, REPORT_STATE, REPORT_TARGET, statusMeta, type Tone } from '../lib/labels';
import type { ReportAction, ReportDetail, ReportEvidence, ReportRow } from '../types/admin';

type Filter = 'baru' | 'selesai' | '';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'baru', label: 'Baru' },
  { value: 'selesai', label: 'Selesai' },
  { value: '', label: 'Semua' },
];

/** Laporan wajib ditindak dalam 24 jam (Apple Guideline 1.2). */
const DEADLINE_HOURS = 24;
const WARN_HOURS = 18;

const reportCode = (r: Pick<ReportRow, 'id' | 'code'>) => r.code || `LP-${r.id}`;
const targetType = (r: Pick<ReportRow, 'target_type' | 'kind'>) => r.target_type ?? r.kind ?? '';
const targetLabel = (r: Pick<ReportRow, 'target_type' | 'kind'>) => REPORT_TARGET[targetType(r)] ?? targetType(r);

/** Umur laporan baru: kuning mendekati 24 jam, merah kalau sudah lewat. */
function ageTone(r: Pick<ReportRow, 'status' | 'created_at'>): Tone {
  if (r.status !== 'baru') return 'neutral';
  const h = hoursSince(r.created_at);
  return h >= DEADLINE_HOURS ? 'danger' : h >= WARN_HOURS ? 'warning' : 'neutral';
}

const ACTION_BUTTON: Record<ReportAction, string> = {
  akun: 'Tangguhkan akun',
  pesan: 'Hapus pesan bukti',
  kios: 'Bekukan kios',
  listing: 'Turunkan iklan',
  catat: 'Tutup tanpa tindakan',
};

const ACTION_DONE: Record<string, string> = {
  akun: 'Akun ditangguhkan',
  pesan: 'Pesan bukti dihapus',
  kios: 'Kios dibekukan',
  listing: 'Iklan diturunkan',
  catat: 'Ditutup tanpa tindakan',
};

function confirmText(action: ReportAction, d: ReportDetail): string {
  const evidence = d.evidence?.length ?? 0;
  switch (action) {
    case 'akun':
      return `Tangguhkan akun ${d.target}? Akun langsung tidak bisa memakai aplikasi${
        evidence ? ` dan ${evidence} pesan bukti dihapus dari chat` : ''
      }.`;
    case 'pesan':
      return `Hapus ${evidence} pesan bukti dari chat? Akun tetap aktif, pengirim diberi tahu.`;
    case 'kios':
      return targetType(d) === 'listing'
        ? 'Bekukan kios pemilik iklan ini? Semua iklannya hilang dari katalog.'
        : `Bekukan kios ${d.target}? Semua iklannya hilang dari katalog.`;
    case 'listing':
      return `Turunkan iklan ${d.target}? Iklan tidak bisa dinaikkan lagi dari dashboard.`;
    default:
      return 'Tutup laporan tanpa tindakan?';
  }
}

const columns: Column<ReportRow>[] = [
  {
    key: 'id',
    header: 'Laporan',
    render: (r) => (
      <Stack
        primary={reportCode(r)}
        secondary={
          r.status === 'baru' ? (
            <Badge tone={ageTone(r)}>
              <Clock size={11} aria-hidden /> {formatAge(r.created_at)}
            </Badge>
          ) : (
            formatDate(r.created_at)
          )
        }
      />
    ),
  },
  { key: 'reporter', header: 'Pelapor', render: (r) => r.reporter },
  {
    key: 'target',
    header: 'Target',
    render: (r) => (
      <span className="inline-gap">
        {r.target}
        {targetType(r) ? <Badge>{targetLabel(r)}</Badge> : null}
      </span>
    ),
  },
  {
    key: 'reason',
    header: 'Alasan',
    width: '34%',
    render: (r) => (
      <div className="stack">
        <span className="inline-gap">
          {r.category_label ? <strong>{r.category_label}</strong> : null}
          {r.source === 'blokir' ? <Badge tone="dark">Blokir</Badge> : null}
          {r.has_evidence ? (
            <span className="muted" title="Membawa bukti chat">
              <MessageSquareText size={14} aria-label="Ada bukti chat" />
            </span>
          ) : null}
        </span>
        {r.reason ? <span className="truncate stack-secondary">{r.reason}</span> : null}
        {!r.category_label && !r.reason ? '—' : null}
      </div>
    ),
  },
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
      description="Laporan akun, kios, dan iklan dari pengguna. Tindak lanjuti dalam 24 jam sejak laporan masuk."
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
  const { can } = useAuth();
  const toast = useToast();
  const queue = useQueue();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState<ReportAction | null>(null);

  useEffect(() => setConfirm(null), [id]);

  const resolve = async (action: ReportAction) => {
    if (!d) return;
    try {
      await run(action, () => api.post(`/reports/${d.id}/resolve`, { action }));
      toast.show(ACTION_DONE[action] + '.');
      onChanged();
      queue.refresh();
      onClose();
    } catch (err) {
      toast.error(err);
      setConfirm(null);
      reload();
      if (err instanceof ApiError && err.status === 409) onChanged();
    }
  };

  const unfreeze = async () => {
    if (!d?.target_kios_id) return;
    try {
      await run('unfreeze', () => api.post(`/kios/${d.target_kios_id}/unfreeze`));
      toast.show('Kios diaktifkan kembali.');
      reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const type = d ? targetType(d) : '';
  const isNew = d?.status === 'baru';
  // Tombol dirender dari `actions` server, bukan ditebak dari target_type.
  const actions = (d?.actions ?? []).filter((a): a is ReportAction => a in ACTION_BUTTON);
  const age = d ? hoursSince(d.created_at) : 0;
  const evidence = d?.evidence ?? [];

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      eyebrow={d && type ? `Laporan ${targetLabel(d).toLowerCase()}` : 'Laporan'}
      title={d ? reportCode(d) : 'Laporan'}
      footer={
        d && isNew && actions.length ? (
          confirm ? (
            <div className="confirm-row">
              <p className="small">{confirmText(confirm, d)}</p>
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
              {actions.map((a) => (
                <Button key={a} variant={a === 'catat' ? 'soft' : 'danger-soft'} block onClick={() => setConfirm(a)}>
                  {a === 'kios' && type === 'listing' ? 'Bekukan kios pemilik' : ACTION_BUTTON[a]}
                </Button>
              ))}
            </div>
          )
        ) : undefined
      }
    >
      {loading || error || !d ? (
        <DrawerState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          {isNew && age >= WARN_HOURS ? (
            <Callout tone={age >= DEADLINE_HOURS ? 'danger' : 'warning'}>
              {age >= DEADLINE_HOURS
                ? `Laporan sudah ${formatAge(d.created_at)} — melewati batas tindak lanjut 24 jam.`
                : `Laporan sudah ${formatAge(d.created_at)}. Batas tindak lanjut 24 jam.`}
            </Callout>
          ) : null}

          <DetailList
            items={[
              ['Pelapor', d.reporter],
              ['Target', d.target],
              ['Jenis', type ? targetLabel(d) : null],
              ['Kategori', d.category_label || d.category || null],
              ['Sumber', d.source ? (REPORT_SOURCE[d.source] ?? d.source) : null],
              ['Masuk', `${formatDateTime(d.created_at)}${isNew ? ` · ${formatAge(d.created_at)} lalu` : ''}`],
              ['Status', <StatusBadge key="s" meta={statusMeta(REPORT_STATE, d.status)} />],
              ...(d.action ? ([['Tindakan', ACTION_DONE[d.action] ?? d.action]] as [string, string][]) : []),
              ...(d.resolved_by ? ([['Oleh', d.resolved_by]] as [string, string][]) : []),
              ...(d.resolved_at ? ([['Diselesaikan', formatDateTime(d.resolved_at)]] as [string, string][]) : []),
            ]}
          />

          {d.reason ? (
            <Callout tone="warning">
              <span className="pre-line">{d.reason}</span>
            </Callout>
          ) : null}

          <TargetState d={d} canUnfreeze={can('kios')} busy={busy === 'unfreeze'} onUnfreeze={unfreeze} />

          {evidence.length ? (
            <>
              <SectionLabel>Bukti chat ({evidence.length})</SectionLabel>
              <p className="small muted">
                Hanya pesan pihak yang dilaporkan. Teks sudah tersamar seperti yang dilihat penerima.
              </p>
              <ul className="evidence-list">
                {evidence.map((m) => (
                  <EvidenceItem key={m.message_id} m={m} onExpired={reload} />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </Drawer>
  );
}

/** Kondisi target saat ini, plus tombol batal-bekukan kios. */
function TargetState({
  d,
  canUnfreeze,
  busy,
  onUnfreeze,
}: {
  d: ReportDetail;
  canUnfreeze: boolean;
  busy: boolean;
  onUnfreeze: () => void;
}) {
  const type = targetType(d);
  const notes: string[] = [];
  if (type === 'akun' && d.target_user_active === false) notes.push('Akun target sudah ditangguhkan.');
  if (type === 'listing' && d.target_listing_status === 'deleted') notes.push('Iklan sudah diturunkan.');
  else if (type === 'listing' && d.target_listing_status) notes.push(`Status iklan: ${d.target_listing_status}.`);

  return (
    <>
      {notes.map((n) => (
        <Callout key={n}>{n}</Callout>
      ))}
      {d.target_kios_frozen ? (
        <Callout tone="info">
          <div className="callout-row">
            <span>{type === 'listing' ? 'Kios pemilik iklan sedang dibekukan.' : 'Kios target sedang dibekukan.'}</span>
            {canUnfreeze && d.target_kios_id ? (
              <Button size="sm" loading={busy} onClick={onUnfreeze}>
                Aktifkan kios
              </Button>
            ) : null}
          </div>
        </Callout>
      ) : null}
    </>
  );
}

function EvidenceItem({ m, onExpired }: { m: ReportEvidence; onExpired: () => void }) {
  const [broken, setBroken] = useState(false);
  const isImage = m.kind === 'image';

  return (
    <li className={`evidence${m.removed ? ' evidence-removed' : ''}`}>
      <div className="evidence-meta">
        <span>{formatDateTime(m.sent_at)}</span>
        {m.removed ? <Badge>dihapus dari chat</Badge> : null}
      </div>
      {isImage ? (
        m.removed || !(m.thumbnail_url || m.image_url) ? (
          <span className="evidence-noimg">
            <ImageOff size={14} aria-hidden /> Foto tidak tersedia
          </span>
        ) : broken ? (
          <span className="evidence-noimg">
            <ImageOff size={14} aria-hidden /> Tautan foto kedaluwarsa.{' '}
            <button className="link-btn" onClick={onExpired}>
              Muat ulang
            </button>
          </span>
        ) : (
          <a href={m.image_url ?? m.thumbnail_url ?? undefined} target="_blank" rel="noreferrer" className="evidence-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.thumbnail_url ?? m.image_url ?? undefined} alt="Foto bukti" onError={() => setBroken(true)} />
          </a>
        )
      ) : null}
      {m.text ? <p className="pre-line">{m.text}</p> : null}
    </li>
  );
}
