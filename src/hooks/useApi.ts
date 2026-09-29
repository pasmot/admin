'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ListMeta } from '../lib/api';

type Query = Record<string, string | number | boolean | undefined | null>;

/** List dengan paging `?page=&limit=`. Ganti `query` → otomatis kembali ke halaman 1. */
export function useList<T>(path: string | null, query: Query = {}, limit = 20) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<T[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const queryKey = JSON.stringify(query);
  const lastQueryKey = useRef(queryKey);

  useEffect(() => {
    if (lastQueryKey.current !== queryKey) {
      lastQueryKey.current = queryKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .list<T>(path, { ...JSON.parse(queryKey), page, limit })
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setMeta(res.meta);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, queryKey, page, limit, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, meta, loading, error, page, setPage, reload, limit };
}

/** GET item tunggal. `path` null → tidak memuat apa-apa. */
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload, setData };
}

/** Membungkus aksi (POST/PUT/DELETE) dengan state `busy`. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <R,>(key: string, fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(key);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, run };
}

export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
