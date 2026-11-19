'use client';
import Link from 'next/link';
import { Badge } from '@/components/Badge';
import { Countdown } from '@/components/Countdown';
import { Price } from '@/components/Price';
import { conditionLabel } from '@/lib/areas';
import { photoUrl } from '@/lib/photos';
import { formatLagosTime, lotPhase } from '@/lib/time';

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

export function LotCard({ lot, now }: { lot: LotSummary; now: number }) {
  const phase = lotPhase(lot.starts_at, lot.ends_at, lot.closed_at, now);
  const src = photoUrl(lot.photo);
  const ended = phase === 'ended';

  return (
    <Link href={`/lot/${lot.id}`} className="block overflow-hidden rounded-card border border-line bg-surface">
      <div className="relative aspect-square bg-bg">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-small text-muted">No photo</div>
        )}
        <div className="absolute left-2 top-2">
          {phase === 'live' && <Badge kind="live">Live</Badge>}
          {phase === 'upcoming' && <Badge kind="upcoming">Closes {formatLagosTime(lot.ends_at)}</Badge>}
          {ended && lot.outcome === 'sold' && <Badge kind="sold">Sold</Badge>}
          {ended && lot.outcome !== 'sold' && <Badge kind="unsold">{lot.closed_at ? 'Unsold' : 'Closing'}</Badge>}
        </div>
      </div>
      <div className="p-3">
        <p className="truncate font-semibold">{lot.title}</p>
        <p className="truncate text-small text-muted">
          {lot.area} · {conditionLabel(lot.condition)}
        </p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-micro uppercase text-muted">
              {lot.current_bid ? `${lot.bid_count} bid${lot.bid_count === 1 ? '' : 's'}` : 'Opening bid'}
            </p>
            <Price kobo={lot.current_bid ?? lot.start_price} className="text-body font-bold" />
          </div>
          {phase === 'live' && <Countdown endsAt={lot.ends_at} now={now} className="text-small font-semibold" />}
        </div>
      </div>
    </Link>
  );
}
