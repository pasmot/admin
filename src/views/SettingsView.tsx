'use client';

import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Page, Toolbar } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataTable, SectionLabel, type Column } from '../components/ui/Data';
import { Field, FilterTabs, SelectField } from '../components/ui/Form';
import { Modal } from '../components/ui/Overlay';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAction } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { MENU_LABELS } from '../lib/labels';
import type { AdminAccount, MenuId, Role } from '../types/admin';

type Tab = 'member' | 'role';
const TABS: { value: Tab; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'role', label: 'Role' },
];

function useFetch<T>(path: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<T[]>(path)
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [path]);
  useEffect(load, [load]);
  return { data, loading, error, reload: load };
}

export function SettingsView({ initialFilter }: { initialFilter?: string }) {
  const [tab, setTab] = useState<Tab>(initialFilter === 'role' ? 'role' : 'member');
  const accounts = useFetch<AdminAccount>('/settings/accounts');
  const roles = useFetch<Role>('/settings/roles');
  const [editAccount, setEditAccount] = useState<AdminAccount | 'new' | null>(null);
  const [editRole, setEditRole] = useState<Role | 'new' | null>(null);

  return (
    <Page
      menu="settings"
      title="Settings"
      description="Akun admin dashboard dan akses menu per role."
      action={
        tab === 'member' ? (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditAccount('new')}>
            Add Member
          </Button>
        ) : (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditRole('new')}>
            Add Role
          </Button>
        )
      }
    >
      <Toolbar>
        <FilterTabs options={TABS} value={tab} onChange={setTab} />
      </Toolbar>

      {tab === 'member' ? (
        <AccountsTable
          state={accounts}
          onEdit={setEditAccount}
          onChanged={() => {
            accounts.reload();
            roles.reload();
          }}
        />
      ) : (
        <RolesTable state={roles} onEdit={setEditRole} onChanged={roles.reload} />
      )}

      <AccountModal
        target={editAccount}
        roles={roles.data}
        onClose={() => setEditAccount(null)}
        onSaved={() => {
          setEditAccount(null);
          accounts.reload();
          roles.reload();
        }}
      />
      <RoleModal
        target={editRole}
        onClose={() => setEditRole(null)}
        onSaved={() => {
          setEditRole(null);
          roles.reload();
          accounts.reload();
        }}
      />
    </Page>
  );
}

/* ---------- Member ---------- */

function DeleteButton({ label, onConfirm, busy }: { label: string; onConfirm: () => void; busy: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size="sm"
      variant="danger-soft"
      icon={<Trash2 size={14} />}
      loading={busy}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      aria-label={armed ? `Konfirmasi hapus ${label}` : `Hapus ${label}`}
    >
      {armed ? 'Yakin?' : 'Delete'}
    </Button>
  );
}

function AccountsTable({
  state,
  onEdit,
  onChanged,
}: {
  state: ReturnType<typeof useFetch<AdminAccount>>;
  onEdit: (a: AdminAccount) => void;
  onChanged: () => void;
}) {
  const { me } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();

  const remove = async (a: AdminAccount) => {
    try {
      await run(`a-${a.id}`, () => api.del(`/settings/accounts/${a.id}`));
      toast.show(`Akun ${a.name} dihapus.`);
      onChanged();
    } catch (err) {
      toast.error(err);
    }
  };

  const columns: Column<AdminAccount>[] = [
    {
      key: 'name',
      header: 'Nama',
      render: (a) => (
        <span className="inline-gap">
          <strong>{a.name}</strong>
          {a.status && a.status !== 'aktif' ? <Badge>{a.status}</Badge> : null}
        </span>
      ),
    },
    { key: 'email', header: 'Email', render: (a) => a.email },
    { key: 'role', header: 'Role', render: (a) => a.role_name },
    { key: 'login', header: 'Login terakhir', render: (a) => <span className="muted small">{formatDateTime(a.last_login_at)}</span> },
    {
      key: 'act',
      header: 'Aksi',
      render: (a) =>
        a.locked ? (
          <span className="muted small">{a.id === me?.id ? 'Akun kamu' : 'Terkunci'}</span>
        ) : (
          <span className="btn-row btn-row-tight">
            <Button size="sm" icon={<Pencil size={14} />} onClick={() => onEdit(a)}>
              Edit
            </Button>
            <DeleteButton label={a.name} busy={busy === `a-${a.id}`} onConfirm={() => remove(a)} />
          </span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={state.data}
      rowKey={(a) => a.id}
      loading={state.loading}
      error={state.error}
      onRetry={state.reload}
      empty="Belum ada akun admin."
    />
  );
}

function AccountModal({
  target,
  roles,
  onClose,
  onSaved,
}: {
  target: AdminAccount | 'new' | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isNew = target === 'new';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('aktif');
  const [busy, setBusy] = useState(false);

  // Role Super Admin tidak bisa diberikan ke akun lain.
  const assignable = roles.filter((r) => !r.is_super);

  useEffect(() => {
    if (!target) return;
    if (target === 'new') {
      setName('');
      setEmail('');
      setRoleId(assignable[0] ? String(assignable[0].id) : '');
      setStatus('aktif');
    } else {
      setName(target.name);
      setEmail(target.email);
      setRoleId(String(target.role_id));
      setStatus(target.status || 'aktif');
    }
    setPassword('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((isNew || password) && password.length < 8) return toast.show('Password minimal 8 karakter.');
    if (!roleId) return toast.show('Pilih role.');
    setBusy(true);
    try {
      if (isNew) {
        await api.post('/settings/accounts', { name: name.trim(), email: email.trim(), password, role_id: Number(roleId) });
        toast.show('Akun dibuat.');
      } else if (target) {
        await api.put(`/settings/accounts/${target.id}`, {
          name: name.trim(),
          email: email.trim(),
          role_id: Number(roleId),
          status,
          ...(password ? { password } : {}),
        });
        toast.show('Akun diperbarui.');
      }
      onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={target !== null} onClose={onClose} title={isNew ? 'Add member' : 'Edit member'}>
      <form className="modal-form" onSubmit={submit}>
        <Field label="Nama" placeholder="Nama lengkap" value={name} onChange={(e) => setName(e.target.value)} required />
        <Field
          label="Email"
          type="email"
          placeholder="admin@pasarmotor.id"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder={isNew ? 'Minimal 8 karakter' : 'Kosongkan kalau tidak diubah'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={password || isNew ? 8 : undefined}
          required={isNew}
        />
        <SelectField label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
          {assignable.length === 0 ? <option value="">Buat role dulu</option> : null}
          {assignable.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
        {!isNew ? (
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </SelectField>
        ) : null}
        {!isNew ? (
          <p className="muted small">Mengganti password atau menonaktifkan akun langsung mengakhiri semua sesinya.</p>
        ) : null}
        <Button type="submit" variant="primary" block loading={busy}>
          {isNew ? 'Buat akun' : 'Simpan'}
        </Button>
      </form>
    </Modal>
  );
}

/* ---------- Role ---------- */

function RolesTable({
  state,
  onEdit,
  onChanged,
}: {
  state: ReturnType<typeof useFetch<Role>>;
  onEdit: (r: Role) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { busy, run } = useAction();

  const remove = async (r: Role) => {
    try {
      await run(`r-${r.id}`, () => api.del(`/settings/roles/${r.id}`));
      toast.show(`Role ${r.name} dihapus.`);
      onChanged();
    } catch (err) {
      toast.error(err);
    }
  };

  const columns: Column<Role>[] = [
    { key: 'name', header: 'Role', render: (r) => <strong>{r.name}</strong> },
    {
      key: 'menus',
      header: 'Akses menu',
      width: '46%',
      render: (r) =>
        r.is_super ? (
          <span className="muted small">Semua menu</span>
        ) : (
          <span className="chip-wrap">
            {r.menus.map((m) => (
              <Badge key={m}>{MENU_LABELS[m] ?? m}</Badge>
            ))}
          </span>
        ),
    },
    { key: 'members', header: 'Member', render: (r) => r.member_count },
    {
      key: 'act',
      header: 'Aksi',
      render: (r) =>
        r.is_super ? (
          <span className="muted small">Terkunci</span>
        ) : (
          <span className="btn-row btn-row-tight">
            <Button size="sm" icon={<Pencil size={14} />} onClick={() => onEdit(r)}>
              Edit
            </Button>
            <DeleteButton label={r.name} busy={busy === `r-${r.id}`} onConfirm={() => remove(r)} />
          </span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={state.data}
      rowKey={(r) => r.id}
      loading={state.loading}
      error={state.error}
      onRetry={state.reload}
      empty="Belum ada role."
    />
  );
}

function RoleModal({
  target,
  onClose,
  onSaved,
}: {
  target: Role | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isNew = target === 'new';
  const [name, setName] = useState('');
  const [menus, setMenus] = useState<MenuId[]>([]);
  const [options, setOptions] = useState<MenuId[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setName(target === 'new' ? '' : target.name);
    setMenus(target === 'new' ? ['ringkasan'] : target.menus);
    if (options) return;
    api
      .get<(MenuId | { id: MenuId })[]>('/settings/menus')
      .then((list) =>
        setOptions(
          (Array.isArray(list) ? list : [])
            .map((m) => (typeof m === 'string' ? m : m.id))
            .filter((m) => m !== 'settings'),
        ),
      )
      .catch((err) => {
        toast.error(err);
        setOptions([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const toggle = (m: MenuId) =>
    setMenus((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.show('Nama role wajib diisi.');
    if (menus.length === 0) return toast.show('Pilih minimal satu menu.');
    // kirim sesuai urutan sidebar
    const ordered = (options ?? menus).filter((m) => menus.includes(m));
    setBusy(true);
    try {
      if (isNew) {
        await api.post('/settings/roles', { name: name.trim(), menus: ordered });
        toast.show('Role dibuat.');
      } else if (target) {
        await api.put(`/settings/roles/${target.id}`, { name: name.trim(), menus: ordered });
        toast.show('Role diperbarui.');
      }
      onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={target !== null} onClose={onClose} title={isNew ? 'Add role' : 'Edit role'} width={500}>
      <form className="modal-form" onSubmit={submit}>
        <Field label="Nama role" placeholder="Contoh: Moderator" value={name} onChange={(e) => setName(e.target.value)} required />
        <SectionLabel>Akses menu</SectionLabel>
        <div className="check-chips">
          {options === null ? (
            <span className="skeleton" />
          ) : (
            options.map((m) => {
              const on = menus.includes(m);
              return (
                <button
                  type="button"
                  key={m}
                  className={`check-chip${on ? ' check-chip-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggle(m)}
                >
                  <span className="check-box">{on ? <Check size={12} strokeWidth={3} /> : null}</span>
                  {MENU_LABELS[m] ?? m}
                </button>
              );
            })
          )}
        </div>
        {!isNew ? <p className="muted small">Perubahan akses langsung berlaku di request berikutnya.</p> : null}
        <Button type="submit" variant="primary" block loading={busy}>
          {isNew ? 'Buat role' : 'Simpan'}
        </Button>
      </form>
    </Modal>
  );
}
