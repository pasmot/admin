import type { Tone } from '../../lib/labels';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Badge untuk nilai status berdasarkan peta label → tone. */
export function StatusBadge({ meta }: { meta: { label: string; tone: Tone } }) {
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
