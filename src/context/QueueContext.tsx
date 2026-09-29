'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { MenuId, Summary } from '../types/admin';
import { useAuth } from './AuthContext';

/**
 * Angka antrean di sidebar diambil dari kartu /summary. Satu menu bisa punya
 * beberapa kartu (Uang = refund + tarik saldo), jadi dijumlahkan.
 */
type QueueState = {
  summary: Summary | null;
  counts: Partial<Record<MenuId, number>>;
  refresh: () => void;
};

const QueueContext = createContext<QueueState | null>(null);

export function QueueProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  const refresh = useCallback(() => {
    if (!me) return;
    api
      .get<Summary>('/summary')
      .then((s) => setSummary({ cards: s.cards ?? [], recent_transactions: s.recent_transactions ?? [] }))
      .catch(() => {
        // badge bukan hal kritis; biarkan kosong kalau gagal
      });
  }, [me]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const counts = useMemo(() => {
    const out: Partial<Record<MenuId, number>> = {};
    for (const card of summary?.cards ?? []) {
      out[card.menu] = (out[card.menu] ?? 0) + (card.count ?? 0);
    }
    return out;
  }, [summary]);

  return (
    <QueueContext.Provider value={{ summary, counts, refresh }}>{children}</QueueContext.Provider>
  );
}

export function useQueue(): QueueState {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used inside QueueProvider');
  return ctx;
}
