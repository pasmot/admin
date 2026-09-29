'use client';

import { AlertCircle, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ListMeta } from '../../lib/api';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'right';
};

/** Tabel data di dalam kartu putih. Klik baris → `onRowClick`. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  onRowClick,
  empty = 'Belum ada data.',
  title,
  aside,
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  empty?: string;
  title?: string;
  aside?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="card table-card">
      {title ? (
        <div className="table-card-head">
          <h2 className="section-title">{title}</h2>
          {aside ? <div className="table-card-aside">{aside}</div> : null}
        </div>
      ) : null}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: c.align }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="row-skeleton">
                    {columns.map((c) => (
                      <td key={c.key}>
                        <span className="skeleton" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={onRowClick ? 'row-click' : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === 'Enter') onRowClick(row);
                          }
                        : undefined
                    }
                  >
                    {columns.map((c) => (
                      <td key={c.key} style={{ textAlign: c.align }}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && error ? (
          <div className="table-state">
            <AlertCircle size={20} aria-hidden />
            <p>{error}</p>
            {onRetry ? (
              <button className="link-btn" onClick={onRetry}>
                Coba lagi
              </button>
            ) : null}
          </div>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <div className="table-state">
            <Inbox size={20} aria-hidden />
            <p>{empty}</p>
          </div>
        ) : null}
      </div>
      {footer}
    </section>
  );
}

export function Pagination({
  meta,
  page,
  onPage,
}: {
  meta: ListMeta | null;
  page: number;
  onPage: (p: number) => void;
}) {
  if (!meta || !meta.limit) return null;
  const pages = Math.max(1, Math.ceil(meta.total_count / meta.limit));
  if (pages <= 1) return null;
  const from = (page - 1) * meta.limit + 1;
  const to = Math.min(page * meta.limit, meta.total_count);
  return (
    <div className="pager">
      <span>
        {from}–{to} dari {meta.total_count}
      </span>
      <div className="pager-btns">
        <button className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Sebelumnya">
          <ChevronLeft size={16} />
        </button>
        <button className="icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Berikutnya">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/** Nama tebal + sub-teks abu (mis. nomor pesanan + tanggal). */
export function Stack({ primary, secondary, strong = true }: { primary: ReactNode; secondary?: ReactNode; strong?: boolean }) {
  return (
    <div className="stack">
      <span className={strong ? 'stack-primary' : undefined}>{primary}</span>
      {secondary ? <span className="stack-secondary">{secondary}</span> : null}
    </div>
  );
}

/** Daftar label–nilai di drawer detail. */
export function DetailList({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="detail-list">
      {items.map(([label, value]) => (
        <div key={label} className="detail-row">
          <dt>{label}</dt>
          <dd>{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Callout({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'; children: ReactNode }) {
  return <div className={`callout callout-${tone}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="section-label">{children}</p>;
}

export function DrawerState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry?: () => void }) {
  if (loading) {
    return (
      <div className="drawer-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="skeleton" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="table-state">
        <AlertCircle size={20} aria-hidden />
        <p>{error}</p>
        {onRetry ? (
          <button className="link-btn" onClick={onRetry}>
            Coba lagi
          </button>
        ) : null}
      </div>
    );
  }
  return null;
}
