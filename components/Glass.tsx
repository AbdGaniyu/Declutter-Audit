import type { HTMLAttributes } from 'react';

// DESIGN.md › Material. Glass only on controls that float: nav, tab bar, bid dock,
// the active filter pill, photo controls. Never on cards, lists or text.
type Thickness = 'chip' | 'nav' | 'dock';

export function Glass({
  thickness = 'nav',
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { thickness?: Thickness }) {
  return <div {...props} className={`glass-${thickness} ${className}`} />;
}

/** The app mark: a ring around a dot, in the current text colour. Name/logo still undecided (DESIGN.md). */
export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} aria-hidden>
      <circle cx="14" cy="14" r="14" fill="currentColor" />
      <path d="M14 6.5a7.5 7.5 0 1 1-7.1 5.1" fill="none" stroke="var(--bg)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2.6" fill="var(--bg)" />
    </svg>
  );
}
