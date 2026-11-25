'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Badge, LiveDot } from '@/components/Badge';
import { LotCard, type LotSummary } from '@/components/LotCard';
import { RemindMe } from '@/components/RemindMe';
import { formatDuration, formatLagosDateTime } from '@/lib/time';
import { useServerNow } from '@/lib/time-sync';

export type DropInfo = {
  id: string;
  title: string;
  opens_at: string;
  last_close_at: string;
  lot_count: number;
  reminded: boolean;
};

/** DESIGN.md › Home / Tonight's drop. */
export function DropBoard({ hero, lots, upcoming, renderedAt, signedIn }: {
  hero: DropInfo | null;
  lots: LotSummary[];
  upcoming: DropInfo[];
  renderedAt: number;
  signedIn: boolean;
}) {
  const now = useServerNow(500, renderedAt);
  const router = useRouter();

  // The grid polls lightly; the lot page is the realtime view.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && router.refresh();
    const id = setInterval(refresh, 20_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);

  if (!hero) {
    return (
      <section className="rounded-card bg-surface p-6 text-center shadow-elev">
        <h1 className="font-display text-display">No drop scheduled yet</h1>
        <p className="mt-1 text-ink-muted">Drops run every evening at 7pm. Check back soon.</p>
      </section>
    );
  }

  const opens = Date.parse(hero.opens_at);
  const live = now >= opens && now < Date.parse(hero.last_close_at);

  return (
    <div className="space-y-8">
      <section className="rounded-card bg-surface p-4 shadow-elev">
        <p className="text-label uppercase text-ink-muted">Tonight&apos;s drop</p>
        <h1 className="mt-1 font-display text-display">{hero.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {live ? (
            <p className="flex items-center gap-2 text-heading font-semibold">
              <LiveDot /> Live now
            </p>
          ) : now < opens ? (
            <p className="text-heading font-semibold">
              Opens in <span className="font-num tabular-nums">{formatDuration(opens - now)}</span>
            </p>
          ) : (
            <Badge kind="ended" />
          )}
          {!live && now < opens && <RemindMe dropId={hero.id} reminded={hero.reminded} signedIn={signedIn} />}
        </div>
        <p className="mt-2 text-body text-ink-muted">
          <span className="font-num tabular-nums">{hero.lot_count}</span> lot{hero.lot_count === 1 ? '' : 's'} · lots close one minute apart
        </p>
      </section>

      {lots.length === 0 ? (
        <p className="rounded-card border border-dashed border-line p-4 text-ink-muted">
          No lots in this drop yet. List something and it goes live with the drop.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {lots.map((lot) => <LotCard key={lot.id} lot={lot} now={now} />)}
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-display text-heading">Upcoming drops</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-elev">
            {upcoming.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{d.title}</p>
                  <p className="text-body text-ink-muted">
                    Opens {formatLagosDateTime(d.opens_at, now)} · <span className="font-num tabular-nums">{d.lot_count}</span> lots
                  </p>
                </div>
                <RemindMe dropId={d.id} reminded={d.reminded} signedIn={signedIn} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
