import { Check, CircleAlert, Clock, Minus } from 'lucide-react';
import { iconProps } from '@/components/icons';

// Badges are uppercase labels: LIVE, UPCOMING, ENDED, UNSOLD (+ SOLD).
// Small text never sits in a status color (contrast): status is carried by a
// colored dot or icon plus the label in --ink.
type Kind = 'live' | 'upcoming' | 'ended' | 'unsold' | 'sold';

const styles: Record<Kind, string> = {
  live: 'bg-live-soft text-ink',
  upcoming: 'bg-surface text-ink-muted border border-line',
  ended: 'bg-bg text-ink-muted border border-line',
  unsold: 'bg-bg text-ink-muted border border-line',
  sold: 'bg-winning-soft text-ink',
};

const labels: Record<Kind, string> = { live: 'Live', upcoming: 'Upcoming', ended: 'Ended', unsold: 'Unsold', sold: 'Sold' };

export function Badge({ kind, children }: { kind: Kind; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-label uppercase ${styles[kind]}`}>
      {kind === 'live' && <LiveDot />}
      {kind === 'upcoming' && <Clock {...iconProps} size={12} />}
      {(kind === 'ended' || kind === 'unsold') && <Minus {...iconProps} size={12} className="text-ended" />}
      {kind === 'sold' && <Check {...iconProps} size={12} className="text-winning" />}
      {children ?? labels[kind]}
    </span>
  );
}

export function LiveDot({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-pill bg-live motion-reduce:animate-none ${className}`} aria-hidden />;
}

/** Sentence-case pills for area and condition. */
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-pill border border-line bg-surface px-2 py-0.5 text-[12px] font-semibold leading-4 text-ink">
      {children}
    </span>
  );
}

/** Inline status chip with icon + label (never color alone). */
export function StatusChip({ kind }: { kind: 'winning' | 'outbid' }) {
  return kind === 'winning' ? (
    <span className="inline-flex items-center gap-1 rounded-pill bg-winning-soft px-2 py-0.5 text-label uppercase text-ink">
      <Check {...iconProps} size={12} className="text-winning" /> Winning
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-pill bg-outbid-soft px-2 py-0.5 text-label uppercase text-ink">
      <CircleAlert {...iconProps} size={12} className="text-outbid" /> Outbid
    </span>
  );
}
