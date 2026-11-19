'use client';
import { useEffect, useRef, useState } from 'react';
import { formatCountdown } from '@/lib/time';

/** Countdown to `endsAt` using a server-synced `now`. Live color under 60s. */
export function Countdown({ endsAt, now, className = '' }: { endsAt: string; now: number; className?: string }) {
  const ms = Date.parse(endsAt) - now;
  const prevEnds = useRef(endsAt);
  const [extended, setExtended] = useState(false);

  useEffect(() => {
    if (Date.parse(endsAt) > Date.parse(prevEnds.current)) {
      setExtended(true);
      const id = setTimeout(() => setExtended(false), 2500);
      prevEnds.current = endsAt;
      return () => clearTimeout(id);
    }
    prevEnds.current = endsAt;
  }, [endsAt]);

  return (
    <span className={`tabular-nums ${ms < 60_000 ? 'text-live' : ''} ${className}`} aria-live="off">
      {formatCountdown(ms)}
      {extended && <span className="ml-2 text-micro uppercase text-live">Extended</span>}
    </span>
  );
}
