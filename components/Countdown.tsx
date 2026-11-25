'use client';
import { Clock, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { iconProps } from '@/components/icons';
import { formatClock, formatLagosTime } from '@/lib/time';

type Props = {
  startsAt: string;
  endsAt: string;
  closedAt?: string | null;
  /** Server-synced now (Date.now() + offset). */
  now: number;
  /** Connection dropped: never show a stale timer as live. */
  stale?: boolean;
  /** 'lot' = large numerals (lot panel / dock); 'card' = the countdown pill. */
  size?: 'lot' | 'card';
  /** Announce at 60s, 30s, 10s and the end (lot page only). */
  announce?: boolean;
  className?: string;
};

const ENDING_SOON_MS = 60_000;

type Phase = 'upcoming' | 'live' | 'ending' | 'ended';

function phaseOf(startsAt: string, endsAt: string, closedAt: string | null | undefined, now: number): Phase {
  if (now < Date.parse(startsAt)) return 'upcoming';
  const ms = Date.parse(endsAt) - now;
  if (closedAt || ms <= 0) return 'ended';
  return ms <= ENDING_SOON_MS ? 'ending' : 'live';
}

/** "+30s" pill key: bumps whenever ends_at moves later, clears after 1.8s. */
function useExtension(endsAt: string): number {
  const ends = Date.parse(endsAt);
  const prev = useRef(ends);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (ends > prev.current) setKey((k) => k + 1);
    prev.current = ends;
  }, [ends]);
  useEffect(() => {
    if (!key) return;
    const id = setTimeout(() => setKey(0), 1800);
    return () => clearTimeout(id);
  }, [key]);
  return key;
}

/** Polite announcements only at 60s, 30s, 10s and the end, never every second. */
function Announcer({ ms, phase, on }: { ms: number; phase: Phase; on: boolean }) {
  const bucket = phase === 'upcoming' ? null : phase === 'ended' ? 'end'
    : ms <= 10_000 ? '10' : ms <= 30_000 ? '30' : ms <= 60_000 ? '60' : null;
  const [spoken, setSpoken] = useState('');
  const last = useRef<string | null>(bucket);
  useEffect(() => {
    if (!on || bucket === last.current) return;
    last.current = bucket;
    if (bucket === 'end') setSpoken('Bidding has ended.');
    else if (bucket) setSpoken(`${bucket} seconds left.`);
  }, [bucket, on]);
  return on ? <span className="sr-only" aria-live="polite">{spoken}</span> : null;
}

function ExtensionPill({ k }: { k: number }) {
  return k > 0 ? (
    <span key={k} className="extension-pill tnum inline-flex h-7 items-center rounded-pill bg-accent px-3 text-footnote font-semibold text-white">
      +30s
    </span>
  ) : null;
}

/**
 * DESIGN.md › Countdown pill: Live · Ending soon · Extended · Ended · Upcoming · Paused.
 */
export function CountdownPill({ startsAt, endsAt, closedAt, now, stale = false, className = '' }: Omit<Props, 'size' | 'announce'>) {
  const phase = phaseOf(startsAt, endsAt, closedAt, now);
  const ext = useExtension(endsAt);
  const ms = Date.parse(endsAt) - now;
  const base = 'tnum inline-flex h-7 shrink-0 items-center gap-1 rounded-pill px-3 text-footnote font-semibold';

  let pill: React.ReactNode;
  if (stale && phase !== 'ended') {
    pill = (
      <span className={`${base} bg-fill text-secondary`}>
        <Loader2 {...iconProps} size={13} className="animate-spin motion-reduce:animate-none" /> Reconnecting…
      </span>
    );
  } else if (phase === 'upcoming') {
    pill = <span className={`${base} bg-fill text-label`}><Clock {...iconProps} size={13} /> Opens {formatLagosTime(startsAt)}</span>;
  } else if (phase === 'ended') {
    pill = <span className={`${base} bg-fill text-secondary`}><Clock {...iconProps} size={13} /> Ended</span>;
  } else {
    const soon = phase === 'ending';
    pill = (
      <span className={`${base} ${soon ? 'bg-accent text-white' : 'bg-fill text-label'}`}>
        <Clock {...iconProps} size={13} /> {formatClock(ms)}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {pill}
      {!stale && <ExtensionPill k={ext} />}
    </span>
  );
}

/**
 * Lot page timer: plain large numerals. --label normally, --accent-text when
 * ending soon, --secondary "Ended" after close. `size="card"` renders the pill.
 */
export function Countdown(props: Props) {
  const { startsAt, endsAt, closedAt, now, stale = false, size = 'lot', announce = false, className = '' } = props;
  const phase = phaseOf(startsAt, endsAt, closedAt, now);
  const ext = useExtension(endsAt);
  if (size === 'card') return <CountdownPill {...props} />;

  const ms = Date.parse(endsAt) - now;
  const text = 'tnum text-price-lot-sm md:text-price-lot';
  const live = <Announcer ms={ms} phase={phase} on={announce} />;

  if (phase === 'upcoming') {
    return <span className={`${text} text-secondary ${className}`}>{formatLagosTime(startsAt)}{live}</span>;
  }
  if (phase === 'ended') {
    return <span className={`${text} text-secondary ${className}`}>Ended{live}</span>;
  }
  const color = stale ? 'text-secondary' : phase === 'ending' ? 'text-accent-text' : 'text-label';
  return (
    <span className={`relative inline-flex items-center gap-2 ${className}`}>
      {!stale && <span className="absolute -top-7 right-0"><ExtensionPill k={ext} /></span>}
      <span className={`${text} ${color}`}>{formatClock(ms)}</span>
      {live}
    </span>
  );
}
