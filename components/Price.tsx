'use client';
import { useEffect, useRef, useState } from 'react';
import { formatNaira } from '@/lib/money';

/** Static price in the numeric font with tabular figures. */
export function Price({ kobo, className = '' }: { kobo: number | null | undefined; className?: string }) {
  return <span className={`font-num tabular-nums ${className}`}>{formatNaira(kobo)}</span>;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Price that rolls up over 250ms and flashes --live-soft for 400ms when it
 * changes. With reduced motion: instant change, color flash only.
 */
export function LivePrice({ kobo, className = '' }: { kobo: number; className?: string }) {
  const [shown, setShown] = useState(kobo);
  const [flashKey, setFlashKey] = useState(0);
  const prev = useRef(kobo);

  useEffect(() => {
    const from = prev.current;
    prev.current = kobo;
    if (from === kobo) return;
    setFlashKey((k) => k + 1);
    if (prefersReducedMotion() || from > kobo) {
      setShown(kobo);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 250);
      const eased = 1 - (1 - p) ** 3;
      // Roll in whole naira so intermediate values look like real prices.
      setShown(p === 1 ? kobo : Math.round((from + (kobo - from) * eased) / 100) * 100);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kobo]);

  return (
    <span key={flashKey} className={`-mx-1 rounded-card px-1 font-num tabular-nums ${flashKey ? 'flash-live-soft' : ''} ${className}`}>
      {formatNaira(shown)}
    </span>
  );
}
