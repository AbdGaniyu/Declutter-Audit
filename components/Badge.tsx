import { ArrowUp, Check, CircleAlert, CircleCheck, Clock, Minus, Trophy, X } from 'lucide-react';
import { iconProps } from '@/components/icons';

// DESIGN.md › Badges and status. Status is monochrome and always carries an icon or
// a word. No green, amber or orange.
type Kind = 'live' | 'upcoming' | 'ended' | 'unsold' | 'sold' | 'action';

const labels: Record<Kind, string> = {
  live: 'Live', upcoming: 'Upcoming', ended: 'Ended', unsold: 'Unsold', sold: 'Sold', action: '',
};

/** Uppercase eyebrow capsule. `action` is the one that needs doing (READY FOR PICKUP). */
export function Badge({ kind, children }: { kind: Kind; children?: React.ReactNode }) {
  const solid = kind === 'action';
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-eyebrow uppercase
      ${solid ? 'bg-label text-on-label' : 'bg-fill text-secondary'}`}>
      {kind === 'live' && <LiveDot />}
      {kind === 'upcoming' && <Clock {...iconProps} size={12} />}
      {(kind === 'ended' || kind === 'unsold') && <Minus {...iconProps} size={12} />}
      {kind === 'sold' && <Check {...iconProps} size={12} />}
      {children ?? labels[kind]}
    </span>
  );
}

/** The "●" before LIVE NOW. Monochrome; pulses unless reduced motion. */
export function LiveDot({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-pill bg-current motion-reduce:animate-none ${className}`} aria-hidden />;
}

/** Sentence-case pills for area, condition and category. */
export function Pill({ children, glass = false }: { children: React.ReactNode; glass?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-3 py-0.5 text-footnote font-semibold text-label
      ${glass ? 'glass-chip' : 'bg-fill'}`}>
      {children}
    </span>
  );
}

export type Standing = 'winning' | 'outbid' | 'won' | 'lost';

/** Compact standing for lists (My bids). Same icons and words as WhereYouStand. */
export function StatusChip({ kind }: { kind: Standing }) {
  switch (kind) {
    case 'winning':
      return (
        <span className="inline-flex items-center gap-1 text-eyebrow uppercase text-label">
          <CircleCheck {...iconProps} size={14} /> Top bidder
        </span>
      );
    case 'outbid':
      return (
        <span className="inline-flex items-center gap-1 rounded-pill bg-label px-2 py-0.5 text-eyebrow uppercase text-on-label">
          <ArrowUp {...iconProps} size={12} /> Outbid
        </span>
      );
    case 'won':
      return (
        <span className="inline-flex items-center gap-1 text-eyebrow uppercase text-label">
          <Trophy {...iconProps} size={14} /> Won
        </span>
      );
    case 'lost':
      return (
        <span className="inline-flex items-center gap-1 text-eyebrow uppercase text-secondary">
          <X {...iconProps} size={14} /> Lost
        </span>
      );
  }
}

export { CircleAlert as RejectedIcon };
