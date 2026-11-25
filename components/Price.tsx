'use client';
import { useEffect, useRef, useState } from 'react';
import { formatNaira } from '@/lib/money';
import { SPRINGS, settleTime, springEasing } from '@/lib/spring';

/** Static price with tabular figures. */
export function Price({ kobo, className = '' }: { kobo: number | null | undefined; className?: string }) {
  return <span className={`tnum ${className}`}>{formatNaira(kobo)}</span>;
}

const ROLL_MS = settleTime(SPRINGS.calm);
const ROLL_EASE = springEasing(SPRINGS.calm, ROLL_MS);
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function DigitColumn({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1.1em] overflow-hidden align-top leading-[1.1em]" aria-hidden>
      <span
        className="flex flex-col motion-reduce:!transition-none"
        style={{ transform: `translateY(${-digit * 1.1}em)`, transition: `transform ${ROLL_MS}ms ${ROLL_EASE}` }}
      >
        {DIGITS.map((d) => <span key={d} className="h-[1.1em]">{d}</span>)}
      </span>
    </span>
  );
}

/**
 * DESIGN.md › Live price: each digit rolls on its own (calm) spring, and a soft
 * sheen crosses it when the price changes. Reduced motion: instant change.
 * Screen readers get the plain amount.
 */
export function LivePrice({ kobo, className = '' }: { kobo: number; className?: string }) {
  const text = formatNaira(kobo);
  const [sheenKey, setSheenKey] = useState(0);
  const prev = useRef(kobo);
  useEffect(() => {
    if (prev.current !== kobo) setSheenKey((k) => k + 1);
    prev.current = kobo;
  }, [kobo]);

  // Key digits by place from the right, so ones stay ones as the number grows.
  const chars = [...text];
  return (
    <span className={`tnum relative inline-flex overflow-hidden leading-[1.1em] ${className}`}>
      {sheenKey > 0 && <span key={sheenKey} className="sheen-sweep pointer-events-none absolute inset-0" aria-hidden />}
      <span className="sr-only">{text}</span>
      {chars.map((c, i) => {
        const place = chars.length - i;
        return /\d/.test(c)
          ? <DigitColumn key={`d${place}`} digit={Number(c)} />
          : <span key={`s${place}`} aria-hidden>{c}</span>;
      })}
    </span>
  );
}
