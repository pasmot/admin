'use client';

import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { initials } from '../../lib/format';
import { Button } from '../ui/Button';
import { Field } from '../ui/Form';
import { Modal } from '../ui/Overlay';

export function AccountMenu() {
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!me) return null;

  return (
    <div className="account" ref={ref}>
      <button className="account-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="avatar">{initials(me.name)}</span>
        <span className="account-name">{me.name}</span>
        <ChevronDown size={15} aria-hidden />
      </button>
      {open ? (
        <div className="account-pop" role="menu">
          <div className="account-pop-head">
            <strong>{me.name}</strong>
            <span>{me.email}</span>
            <span className="account-role">{me.role_name}</span>
          </div>
          <button
            role="menuitem"
            className="account-pop-item"
            onClick={() => {
              setOpen(false);
              setPwOpen(true);
            }}
          >
            <KeyRound size={15} aria-hidden /> Ganti password
          </button>
          <button role="menuitem" className="account-pop-item account-pop-danger" onClick={logout}>
            <LogOut size={15} aria-hidden /> Keluar
          </button>
        </div>
      ) : null}
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.show('Password baru minimal 8 karakter.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/password', { current_password: current, new_password: next });
      toast.show('Password diganti. Silakan masuk lagi.');
      await logout();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Ganti password">
      <form className="modal-form" onSubmit={submit}>
        <Field
          label="Password sekarang"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <Field
          label="Password baru"
          type="password"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          minLength={8}
          required
        />
        <p className="muted small">Semua sesi akun ini akan berakhir dan kamu perlu masuk lagi.</p>
        <Button type="submit" variant="primary" block loading={busy}>
          Simpan password
        </Button>
      </form>
    </Modal>
  );
}
