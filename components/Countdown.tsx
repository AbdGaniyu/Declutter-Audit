'use client';
import { useEffect, useRef, useState } from 'react';
import { formatCountdown, formatLagosTime } from '@/lib/time';

type Props = {
  startsAt: string;
  endsAt: string;
  closedAt?: string | null;
  /** Server-synced now (Date.now() + offset). */
  now: number;
  /** Connection dropped: never show a stale timer as live. */
  stale?: boolean;
  size?: 'lot' | 'card';
  /** Announce at 60s, 30s, 10s and the end (lot page only). */
  announce?: boolean;
};

const RING = 30_000;

/**
 * DESIGN.md › Countdown:
 * upcoming → "Opens 7:00pm" (--ink-muted); live → mm:ss (--ink);
 * ≤60s → --live; ≤30s → --live + draining ring; extension → "+30s" pill;
 * ended → "Ended" (--ended).
 */
export function Countdown({ startsAt, endsAt, closedAt, now, stale = false, size = 'lot', announce = false }: Props) {
  const ends = Date.parse(endsAt);
  const ms = ends - now;
  const upcoming = now < Date.parse(startsAt);
  const ended = Boolean(closedAt) || ms <= 0;

  // "+30s" pill when ends_at moves later.
  const prevEnds = useRef(ends);
  const [pillKey, setPillKey] = useState(0);
  useEffect(() => {
    if (ends > prevEnds.current) setPillKey((k) => k + 1);
    prevEnds.current = ends;
  }, [ends]);
  useEffect(() => {
    if (!pillKey) return;
    const id = setTimeout(() => setPillKey(0), 1800);
    return () => clearTimeout(id);
  }, [pillKey]);

  // Polite announcements only at thresholds, never every second.
  const bucket = upcoming ? null : ended ? 'end' : ms <= 10_000 ? '10' : ms <= 30_000 ? '30' : ms <= 60_000 ? '60' : null;
  const [spoken, setSpoken] = useState('');
  const lastBucket = useRef<string | null>(bucket);
  useEffect(() => {
    if (!announce || bucket === lastBucket.current) return;
    lastBucket.current = bucket;
    if (bucket === 'end') setSpoken('Bidding has ended.');
    else if (bucket) setSpoken(`${bucket} seconds left.`);
  }, [bucket, announce]);

  const text = size === 'lot' ? 'text-countdown' : 'text-[15px] leading-[22px] font-semibold';
  const live = announce ? (
    <span className="sr-only" aria-live="polite">{spoken}</span>
  ) : null;

  if (upcoming) {
    return (
      <span className={size === 'lot' ? 'text-heading font-num text-ink-muted' : 'text-[12px] font-semibold text-ink-muted'}>
        Opens {formatLagosTime(startsAt)}
        {live}
      </span>
    );
  }
  if (ended) {
    return (
      <span className={`font-num ${text} text-ended`}>
        Ended
        {live}
      </span>
    );
  }

  const finalMinute = ms <= 60_000;
  const color = stale ? 'text-ink-muted' : finalMinute ? 'text-live' : 'text-ink';
  const showRing = size === 'lot' && ms <= RING && !stale;
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <span className={`relative inline-flex items-center justify-center ${size === 'lot' ? 'h-20 min-w-20' : ''}`}>
      {showRing && (
        <svg className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 -rotate-90" viewBox="0 0 80 80" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--live-soft)" strokeWidth="3" />
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--live)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, ms) / RING)} />
        </svg>
      )}
      <span className={`relative font-num tabular-nums ${text} ${color}`}>{formatCountdown(ms)}</span>
      {pillKey > 0 && (
        <span key={pillKey} className="extension-pill absolute -right-2 top-0 rounded-pill bg-live px-2 text-[16px] font-semibold leading-6 text-white">
          +30s
        </span>
      )}
      {live}
    </span>
  );
}
