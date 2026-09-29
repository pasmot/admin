'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Page } from '../components/layout/Page';
import { Button } from '../components/ui/Button';
import { DataTable, Pagination, Stack, type Column } from '../components/ui/Data';
import { Field, SelectField } from '../components/ui/Form';
import { Modal } from '../components/ui/Overlay';
import { useToast } from '../context/ToastContext';
import { useAction, useList } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatDate, formatRupiah, toDateInput } from '../lib/format';
import type { DiscountType, Voucher } from '../types/admin';

function potongan(v: Voucher) {
  return v.discount_type === 'persen' ? `${v.value}%` : formatRupiah(v.value);
}

function syarat(v: Voucher) {
  const parts = [`Min. ${formatRupiah(v.min_purchase)}`];
  if (v.discount_type === 'persen') {
    parts.push(v.max_discount ? `maks. ${formatRupiah(v.max_discount)}` : 'tanpa batas');
  }
  return parts.join(' · ');
}

export function VouchersView(_: { initialFilter?: string }) {
  const list = useList<Voucher>('/vouchers', {}, 50);
  const toast = useToast();
  const { busy, run } = useAction();
  const [addOpen, setAddOpen] = useState(false);

  const toggle = async (v: Voucher) => {
    try {
      await run(`v-${v.id}`, () => api.post(`/vouchers/${v.id}/active`, { active: !v.active }));
      toast.show(v.active ? 'Voucher dimatikan.' : 'Voucher diaktifkan.');
      list.reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const columns: Column<Voucher>[] = [
    { key: 'code', header: 'Kode', render: (v) => <Stack primary={v.code} secondary={`s.d. ${formatDate(v.ends_at)}`} /> },
    { key: 'cut', header: 'Potongan', render: potongan },
    { key: 'terms', header: 'Syarat', render: (v) => <span className="muted small">{syarat(v)}</span> },
    { key: 'used', header: 'Terpakai', render: (v) => `${v.used ?? v.used_count ?? 0}/${v.quota}` },
    {
      key: 'status',
      header: 'Status',
      render: (v) => (
        <Button
          size="sm"
          variant={v.active ? 'danger-soft' : 'dark'}
          loading={busy === `v-${v.id}`}
          onClick={() => toggle(v)}
        >
          {v.active ? 'Matikan' : 'Aktifkan'}
        </Button>
      ),
    },
  ];

  return (
    <Page
      menu="voucher"
      title="Voucher platform"
      description="Kode diskon yang berlaku di checkout aplikasi."
      action={
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
          Add Voucher
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(v) => v.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        empty="Belum ada voucher."
        footer={<Pagination meta={list.meta} page={list.page} onPage={list.setPage} />}
      />
      <AddVoucherModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false);
          list.reload();
        }}
      />
    </Page>
  );
}

const EMPTY = {
  code: '',
  discount_type: 'persen' as DiscountType,
  value: '',
  quota: '',
  max_discount: '0',
  min_purchase: '0',
  ends_at: '',
  per_user_limit: '1',
  description: '',
};

function AddVoucherModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const value = Number(form.value);
    if (code.length < 4 || code.length > 50) return toast.show('Kode harus 4–50 karakter.');
    if (form.discount_type === 'persen' && (value < 1 || value > 100)) return toast.show('Persen harus 1–100.');
    if (!value || value < 1) return toast.show('Nilai potongan wajib diisi.');
    if (!Number(form.quota)) return toast.show('Kuota wajib diisi.');
    if (!form.ends_at) return toast.show('Tanggal berlaku wajib diisi.');

    setBusy(true);
    try {
      await api.post('/vouchers', {
        code,
        discount_type: form.discount_type,
        value,
        max_discount: form.discount_type === 'persen' ? Number(form.max_discount) || 0 : 0,
        min_purchase: Number(form.min_purchase) || 0,
        quota: Number(form.quota),
        ends_at: form.ends_at,
        per_user_limit: Number(form.per_user_limit) || 1,
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      });
      toast.show(`Voucher ${code} dibuat.`);
      setForm(EMPTY);
      onCreated();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const persen = form.discount_type === 'persen';

  return (
    <Modal open={open} onClose={onClose} title="Add voucher" width={480}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <Field
            label="Kode"
            placeholder="HEMAT10"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            maxLength={50}
            required
          />
          <SelectField label="Jenis" value={form.discount_type} onChange={set('discount_type')}>
            <option value="persen">Persen</option>
            <option value="nominal">Nominal</option>
          </SelectField>
          <Field
            label={persen ? 'Nilai (%)' : 'Nilai (Rp)'}
            type="number"
            inputMode="numeric"
            min={1}
            max={persen ? 100 : undefined}
            placeholder={persen ? '10' : '50000'}
            value={form.value}
            onChange={set('value')}
            required
          />
          <Field label="Kuota" type="number" inputMode="numeric" min={1} placeholder="100" value={form.quota} onChange={set('quota')} required />
          <Field
            label="Batas potongan (Rp)"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.max_discount}
            onChange={set('max_discount')}
            disabled={!persen}
            hint={persen ? '0 = tanpa batas' : undefined}
          />
          <Field label="Minimal belanja (Rp)" type="number" inputMode="numeric" min={0} value={form.min_purchase} onChange={set('min_purchase')} />
          <Field label="Berlaku sampai" type="date" min={toDateInput()} value={form.ends_at} onChange={set('ends_at')} required />
          <Field label="Batas per pembeli" type="number" inputMode="numeric" min={1} value={form.per_user_limit} onChange={set('per_user_limit')} />
        </div>
        <Field label="Deskripsi (opsional)" value={form.description} onChange={set('description')} />
        <Button type="submit" variant="primary" block loading={busy}>
          Buat voucher
        </Button>
      </form>
    </Modal>
  );
}
