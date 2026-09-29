'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wordmark } from '../components/layout/Wordmark';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Data';
import { Field } from '../components/ui/Form';
import { useAuth } from '../context/AuthContext';

export function LoginView({ expired }: { expired: boolean }) {
  const { me, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && me) router.replace('/');
  }, [loading, me, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.');
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-side">
        <Wordmark size="lg" />
        <p>Dashboard operasional untuk menjaga jual-beli di platform tetap jalan.</p>
      </div>
      <div className="login-main">
        <form className="login-card" onSubmit={submit}>
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="page-title">Masuk ke dashboard</h1>
          </div>
          {expired && !error ? <Callout tone="warning">Sesi berakhir. Silakan masuk lagi.</Callout> : null}
          {error ? <Callout tone="danger">{error}</Callout> : null}
          <Field
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="admin@pasarmotor.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" block loading={busy}>
            Masuk
          </Button>
          <p className="muted small">Akun admin terpisah dari akun aplikasi PasarMotor.</p>
        </form>
      </div>
    </div>
  );
}
