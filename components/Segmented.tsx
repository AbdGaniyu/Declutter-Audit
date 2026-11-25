'use client';
import Link from 'next/link';

// DESIGN.md › Segmented control: --fill track, raised selected segment, count after the label.
export type Segment = { key: string; label: string; count?: number; href?: string };

export function Segmented({
  segments,
  value,
  onChange,
  label,
  className = '',
}: {
  segments: Segment[];
  value: string;
  onChange?: (key: string) => void;
  /** Accessible name for the group. */
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`squircle flex gap-0.5 rounded-control bg-fill p-0.5 ${className}`}>
      {segments.map((s) => {
        const on = s.key === value;
        const cls = `pressable flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] px-3 text-subhead font-semibold
          transition-colors duration-300 ease-spring ${on ? 'bg-surface text-label shadow-[0_1px_4px_rgba(0,0,0,0.12)]' : 'text-secondary'}`;
        const inner = (
          <>
            {s.label}
            {s.count !== undefined && (
              <span className={`tnum min-w-5 rounded-pill px-1.5 text-footnote ${on ? 'bg-label text-on-label' : 'bg-fill text-label'}`}>
                {s.count}
              </span>
            )}
          </>
        );
        return s.href ? (
          <Link key={s.key} href={s.href} role="tab" aria-selected={on} className={cls} scroll={false}>{inner}</Link>
        ) : (
          <button key={s.key} type="button" role="tab" aria-selected={on} className={cls} onClick={() => onChange?.(s.key)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
