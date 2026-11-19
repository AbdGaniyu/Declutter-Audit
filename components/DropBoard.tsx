'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Badge } from '@/components/Badge';
import { Countdown } from '@/components/Countdown';
import { LotCard, type LotSummary } from '@/components/LotCard';
import { formatLagosDateTime } from '@/lib/time';
import { useServerNow } from '@/lib/time-sync';

export type DropWithLots = {
  id: string;
  title: string;
  opens_at: string;
  first_close_at: string;
  last_close_at: string;
  lot_count: number;
  lots: LotSummary[];
};

export function DropBoard({ drops, renderedAt }: { drops: DropWithLots[]; renderedAt: number }) {
  const now = useServerNow(500, renderedAt);
  const router = useRouter();

  // The list page polls lightly; the lot page is the realtime view.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && router.refresh();
    const id = setInterval(refresh, 20_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);

  if (drops.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 text-center">
        <p className="text-title">No drops scheduled yet</p>
        <p className="mt-1 text-muted">Check back soon. Drops run every evening at 7pm.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {drops.map((drop) => {
        const opens = Date.parse(drop.opens_at);
        const live = now >= opens && now < Date.parse(drop.last_close_at);
        return (
          <section key={drop.id} aria-labelledby={`drop-${drop.id}`}>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id={`drop-${drop.id}`} className="text-title">
                  {drop.title}
                </h2>
                <p className="text-small text-muted">
                  {live ? 'Bidding is open · ' : `Opens ${formatLagosDateTime(drop.opens_at, now)} · `}
                  {drop.lot_count} lot{drop.lot_count === 1 ? '' : 's'}
                </p>
              </div>
              {live ? (
                <Badge kind="live">Live</Badge>
              ) : now < opens ? (
                <span className="text-small text-muted">
                  in <Countdown endsAt={drop.opens_at} now={now} className="font-semibold text-ink" />
                </span>
              ) : null}
            </div>
            {drop.lots.length === 0 ? (
              <p className="rounded-card border border-dashed border-line p-4 text-small text-muted">
                No lots yet. Be the first to list something.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {drop.lots.map((lot) => (
                  <LotCard key={lot.id} lot={lot} now={now} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
