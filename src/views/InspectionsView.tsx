'use client';

import { UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout, DataTable, DetailList, DrawerState, Pagination, SectionLabel, Stack, type Column } from '../components/ui/Data';
import { Field, FilterTabs, SearchInput, SelectField, TextArea } from '../components/ui/Form';
import { Drawer, Modal } from '../components/ui/Overlay';
import { useQueue } from '../context/QueueContext';
import { useToast } from '../context/ToastContext';
import { useAction, useDebounced, useList, useResource } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatDate, toDateInput } from '../lib/format';
import { INSPECTION_STATE, statusMeta } from '../lib/labels';
import type { InspectionDetail, InspectionRow, Mechanic } from '../types/admin';

type Filter = '' | 'menunggu' | 'dijadwalkan' | 'selesai' | 'dibatalkan';
const FILTERS: { value: Filter; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'dijadwalkan', label: 'Dijadwalkan' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'dibatalkan', label: 'Dibatalkan' },
];

const inspectionCode = (r: Pick<InspectionRow, 'id' | 'code'>) => r.code || `INS-${String(r.id).padStart(3, '0')}`;

const columns: Column<InspectionRow>[] = [
  { key: 'id', header: 'ID', render: (r) => <strong>{inspectionCode(r)}</strong> },
  { key: 'unit', header: 'Unit', render: (r) => <Stack primary={r.listing} secondary={r.city} /> },
  { key: 'buyer', header: 'Pembeli', render: (r) => r.buyer },
  {
    key: 'date',
    header: 'Jadwal',
    render: (r) =>
      r.inspection_date ? (
        formatDate(r.inspection_date)
      ) : (
        <Stack strong={false} primary={formatDate(r.requested_date)} secondary="diminta pembeli" />
      ),
  },
  { key: 'mechanic', header: 'Montir', render: (r) => r.mechanic || '—' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge meta={statusMeta(INSPECTION_STATE, r.status)} /> },
];

export function InspectionsView({ initialFilter }: { initialFilter?: string }) {
  const [filter, setFilter] = useState<Filter>(
    FILTERS.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : '',
  );
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const list = useList<InspectionRow>('/inspections', { status: filter, q: query });
  const [openId, setOpenId] = useState<number | null>(null);
  const [mechanicsOpen, setMechanicsOpen] = useState(false);

  return (
    <Page
      menu="inspeksi"
      title="Inspeksi"
      description="Tugaskan montir, terbitkan laporan, atau batalkan permintaan."
      action={
        <Button icon={<UserCog size={16} />} onClick={() => setMechanicsOpen(true)}>
          Kelola montir
        </Button>
      }
    >
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Cari unit atau kota" />
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
        empty="Tidak ada permintaan inspeksi."
        footer={<Pagination meta={list.meta} page={list.page} onPage={list.setPage} />}
      />
      <InspectionDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
      <MechanicsModal open={mechanicsOpen} onClose={() => setMechanicsOpen(false)} />
    </Page>
  );
}

type Mode = null | 'schedule' | 'complete' | 'cancel';

function InspectionDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const { data: d, loading, error, reload } = useResource<InspectionDetail>(id ? `/inspections/${id}` : null);
  const toast = useToast();
  const queue = useQueue();
  const { busy, run } = useAction();
  const [mode, setMode] = useState<Mode>(null);
  const [mechanics, setMechanics] = useState<Mechanic[] | null>(null);
  const [mechanicId, setMechanicId] = useState('');
  const [date, setDate] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    setMode(null);
    setText('');
    setMechanicId('');
    setDate('');
  }, [id]);

  useEffect(() => {
    if (mode !== 'schedule' || mechanics) return;
    api
      .get<Mechanic[]>('/inspection-mechanics')
      .then((m) => setMechanics(Array.isArray(m) ? m : []))
      .catch((err) => {
        toast.error(err);
        setMechanics([]);
      });
  }, [mode, mechanics, toast]);

  useEffect(() => {
    if (mode === 'schedule' && d && !date) {
      const requested = d.requested_date?.slice(0, 10);
      setDate(requested && requested >= toDateInput() ? requested : toDateInput());
    }
  }, [mode, d, date]);

  const submit = async () => {
    if (!d || !mode) return;
    let body: Record<string, unknown>;
    let message: string;
    if (mode === 'schedule') {
      if (!mechanicId || !date) return toast.show('Pilih montir dan tanggal.');
      body = { mechanic: Number(mechanicId), date };
      message = 'Inspeksi dijadwalkan.';
    } else if (mode === 'complete') {
      if (!text.trim()) return toast.show('Laporan wajib diisi.');
      body = { report: text.trim() };
      message = 'Laporan inspeksi diterbitkan.';
    } else {
      if (!text.trim()) return toast.show('Alasan pembatalan wajib diisi.');
      body = { reason: text.trim() };
      message = 'Inspeksi dibatalkan.';
    }
    try {
      await run(mode, () => api.post(`/inspections/${d.id}/${mode}`, body));
      toast.show(message);
      setMode(null);
      setText('');
      reload();
      onChanged();
      queue.refresh();
    } catch (err) {
      toast.error(err);
    }
  };

  const status = d?.status;
  const footer =
    d && (status === 'menunggu' || status === 'dijadwalkan') ? (
      mode ? (
        <div className="stack-gap">
          {mode === 'schedule' ? (
            <>
              <SelectField label="Montir" value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}>
                <option value="">{mechanics === null ? 'Memuat…' : 'Pilih montir'}</option>
                {mechanics?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </SelectField>
              {mechanics?.length === 0 ? (
                <p className="muted small">Belum ada montir aktif. Tambahkan lewat &ldquo;Kelola montir&rdquo;.</p>
              ) : null}
              <Field label="Tanggal inspeksi" type="date" min={toDateInput()} value={date} onChange={(e) => setDate(e.target.value)} />
            </>
          ) : (
            <TextArea
              label={mode === 'complete' ? 'Laporan inspeksi' : 'Alasan pembatalan'}
              placeholder={mode === 'complete' ? 'Tampil di aplikasi pembeli' : 'Wajib diisi'}
              rows={mode === 'complete' ? 5 : 3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
          <div className="btn-row">
            <Button block onClick={() => setMode(null)} disabled={!!busy}>
              Batal
            </Button>
            <Button variant={mode === 'cancel' ? 'dark' : 'primary'} block loading={busy === mode} onClick={submit}>
              {mode === 'schedule' ? 'Jadwalkan' : mode === 'complete' ? 'Terbitkan laporan' : 'Batalkan inspeksi'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="stack-gap">
          {status === 'menunggu' ? (
            <Button variant="primary" block onClick={() => setMode('schedule')}>
              Tugaskan montir
            </Button>
          ) : (
            <Button variant="primary" block onClick={() => setMode('complete')}>
              Terbitkan laporan
            </Button>
          )}
          <Button variant="danger-soft" block onClick={() => setMode('cancel')}>
            Batalkan permintaan
          </Button>
        </div>
      )
    ) : undefined;

  return (
    <Drawer open={id !== null} onClose={onClose} title={d ? inspectionCode(d) : 'Inspeksi'} footer={footer}>
      {loading || error || !d ? (
        <DrawerState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <DetailList
            items={[
              ['Unit', d.listing],
              ['Kota', d.city],
              ['Pembeli', d.buyer],
              ['Kios', d.seller],
              ['Diajukan', formatDate(d.created_at)],
              ['Tanggal diminta', formatDate(d.requested_date)],
              ['Jadwal', formatDate(d.inspection_date)],
              ['Montir', d.mechanic],
              ['Lokasi', d.meeting_location],
              ['Status', <StatusBadge key="s" meta={statusMeta(INSPECTION_STATE, d.status)} />],
            ]}
          />
          {d.status === 'selesai' && d.report ? (
            <>
              <SectionLabel>Laporan</SectionLabel>
              <Callout tone="success">
                <span className="pre-line">{d.report}</span>
              </Callout>
            </>
          ) : null}
          {d.status === 'dibatalkan' && d.cancel_reason ? (
            <Callout tone="danger">Dibatalkan: {d.cancel_reason}</Callout>
          ) : null}
        </>
      )}
    </Drawer>
  );
}

/** Desain belum punya layar montir — form kecil untuk menambah & menonaktifkan. */
function MechanicsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [items, setItems] = useState<Mechanic[] | null>(null);
  const [name, setName] = useState('');

  const load = () =>
    api
      .get<Mechanic[]>('/inspection-mechanics', { all: 1 })
      .then((m) => setItems(Array.isArray(m) ? m : []))
      .catch((err) => {
        toast.error(err);
        setItems([]);
      });

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await run('add', () => api.post('/inspection-mechanics', { name: name.trim() }));
      setName('');
      toast.show('Montir ditambahkan.');
      load();
    } catch (err) {
      toast.error(err);
    }
  };

  const toggle = async (m: Mechanic) => {
    try {
      await run(`t-${m.id}`, () => api.post(`/inspection-mechanics/${m.id}/active`, { active: !m.active }));
      load();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Montir inspeksi">
      <form className="inline-form" onSubmit={add}>
        <Field label="Nama montir" placeholder="Mis. Adi Prasetyo" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="primary" loading={busy === 'add'} disabled={!name.trim()}>
          Tambah
        </Button>
      </form>
      <div className="mechanic-list">
        {items === null ? (
          <span className="skeleton" />
        ) : items.length === 0 ? (
          <p className="muted small">Belum ada montir.</p>
        ) : (
          items.map((m) => (
            <div key={m.id} className="item-card">
              <span>{m.name}</span>
              <span className="item-card-end">
                {m.active ? <Badge tone="success">aktif</Badge> : <Badge>nonaktif</Badge>}
                <Button size="sm" loading={busy === `t-${m.id}`} onClick={() => toggle(m)}>
                  {m.active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
