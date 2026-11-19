type Kind = 'live' | 'upcoming' | 'sold' | 'unsold' | 'leading' | 'outbid' | 'neutral';

const styles: Record<Kind, string> = {
  live: 'bg-live text-brand-ink',
  upcoming: 'bg-bg text-muted border border-line',
  sold: 'bg-success text-brand-ink',
  unsold: 'bg-bg text-muted border border-line',
  leading: 'bg-success text-brand-ink',
  outbid: 'bg-danger text-brand-ink',
  neutral: 'bg-bg text-ink border border-line',
};

export function Badge({ kind, children }: { kind: Kind; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro uppercase ${styles[kind]}`}>
      {kind === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-brand-ink" aria-hidden />}
      {children}
    </span>
  );
}
