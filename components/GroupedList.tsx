import { ShieldCheck } from 'lucide-react';
import { iconProps } from '@/components/icons';

// DESIGN.md › Lists and grouped panels: --surface, 20px radius, rows ≥ 44px,
// 0.5px inset hairlines between rows. No borders.
export function GroupedList({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <dl className={`squircle overflow-hidden rounded-group bg-surface ${className}`}>{children}</dl>;
}

export function GroupedRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 [&:not(:last-child)]:hairline-b">
      <dt className="text-body text-secondary">{label}</dt>
      <dd className="text-right text-body font-semibold">{children}</dd>
    </div>
  );
}

/**
 * DESIGN.md › Trust card. Compact: one line. With `steps`: the Pay explainer.
 */
export function TrustCard({
  title = 'Your money is held until you collect',
  children,
  steps,
  footer,
}: {
  title?: string;
  children?: React.ReactNode;
  steps?: React.ReactNode[];
  footer?: React.ReactNode;
}) {
  return (
    <section className="squircle flex gap-3 rounded-group bg-fill p-4">
      <ShieldCheck {...iconProps} size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 className="text-headline">{title}</h2>
        {children && <p className="mt-0.5 text-subhead text-secondary">{children}</p>}
        {steps && (
          <ol className="mt-3 flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-subhead">
                <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface text-footnote font-semibold">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
        {footer && <p className="mt-3 pt-3 text-footnote text-secondary [box-shadow:inset_0_0.5px_0_var(--hairline)]">{footer}</p>}
      </div>
    </section>
  );
}
