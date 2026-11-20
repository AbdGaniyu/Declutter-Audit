'use client';
import Link from 'next/link';
import { Badge, LiveDot, Pill } from '@/components/Badge';
import { Countdown } from '@/components/Countdown';
import { Price } from '@/components/Price';
import { conditionLabel } from '@/lib/areas';
import { photoUrl } from '@/lib/photos';
import { lotPhase } from '@/lib/time';

export type LotSummary = {
  id: string;
  title: string;
  area: string;
  condition: string;
  start_price: number;
  current_bid: number | null;
  bid_count: number;
  starts_at: string;
  ends_at: string;
  closed_at: string | null;
  outcome: string | null;
  photo: string | null;
};

/** DESIGN.md › Lot card: 4:3 photo, 2-line title, area + condition pills, price, bids, time left. */
export function LotCard({ lot, now }: { lot: LotSummary; now: number }) {
  const phase = lotPhase(lot.starts_at, lot.ends_at, lot.closed_at, now);
  const src = photoUrl(lot.photo);

  return (
    <Link href={`/lot/${lot.id}`} className="flex flex-col overflow-hidden rounded-card bg-surface shadow-elev">
      <div className="relative aspect-[4/3] bg-bg">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-muted">No photo</div>
        )}
        {phase === 'ended' && (
          <div className="absolute left-2 top-2">
            <Badge kind={lot.current_bid ? 'ended' : 'unsold'} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 font-semibold leading-5">{lot.title}</p>
        <div className="flex flex-wrap gap-1">
          <Pill>{lot.area}</Pill>
          <Pill>{conditionLabel(lot.condition)}</Pill>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <Price kobo={lot.current_bid ?? lot.start_price} className="text-price-card" />
            <p className="text-[12px] leading-4 text-ink-muted">
              <span className="font-num tabular-nums">{lot.bid_count}</span> bid{lot.bid_count === 1 ? '' : 's'}
            </p>
          </div>
          <span className="flex items-center gap-1">
            {phase === 'live' && <LiveDot />}
            <Countdown startsAt={lot.starts_at} endsAt={lot.ends_at} closedAt={lot.closed_at} now={now} size="card" />
          </span>
        </div>
      </div>
    </Link>
  );
}
