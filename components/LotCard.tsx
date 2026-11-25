'use client';
import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { Pill } from '@/components/Badge';
import { CountdownPill } from '@/components/Countdown';
import { Price } from '@/components/Price';
import { iconProps } from '@/components/icons';
import { conditionLabel } from '@/lib/areas';
import { photoUrl } from '@/lib/photos';
import { formatMonthYear } from '@/lib/time';

export type LotSummary = {
  id: string;
  title: string;
  area: string;
  condition: string;
  category?: string;
  start_price: number;
  current_bid: number | null;
  bid_count: number;
  starts_at: string;
  ends_at: string;
  closed_at: string | null;
  outcome: string | null;
  photo: string | null;
};

const hoverOnly = '[@media(hover:hover)]';

/**
 * DESIGN.md › Lot card: photo in a --fill well, title (2 lines), price and the
 * countdown pill. No border, no shadow. Hover (pointer devices): the photo eases
 * up and area / condition / bids rise in as glass chips.
 */
export function LotCard({ lot, now }: { lot: LotSummary; now: number }) {
  const src = photoUrl(lot.photo);
  return (
    <Link href={`/lot/${lot.id}`} className="group flex flex-col gap-3 rounded-card focus-visible:outline-offset-4">
      <div className="squircle relative aspect-[4/3] overflow-hidden rounded-card bg-fill">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" decoding="async"
            className={`h-full w-full object-cover transition-transform duration-500 ease-spring motion-reduce:transition-none ${hoverOnly}:group-hover:-translate-y-1`} />
        ) : (
          <div className="flex h-full items-center justify-center text-footnote text-secondary">No photo</div>
        )}
        <div className={`absolute inset-x-2 bottom-2 flex flex-wrap gap-1 opacity-0 transition duration-500 ease-spring motion-reduce:transition-none
          translate-y-2 ${hoverOnly}:group-hover:translate-y-0 ${hoverOnly}:group-hover:opacity-100`} aria-hidden>
          <Pill glass>{lot.area}</Pill>
          <Pill glass>{conditionLabel(lot.condition)}</Pill>
          <Pill glass><span className="tnum">{lot.bid_count}</span> bid{lot.bid_count === 1 ? '' : 's'}</Pill>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-1">
        <p className="line-clamp-2 text-headline">{lot.title}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <Price kobo={lot.current_bid ?? lot.start_price} className="text-price-card" />
          <CountdownPill startsAt={lot.starts_at} endsAt={lot.ends_at} closedAt={lot.closed_at} now={now} />
        </div>
        <p className="sr-only">{lot.area}, {conditionLabel(lot.condition)}, {lot.bid_count} bids</p>
      </div>
    </Link>
  );
}

/** DESIGN.md › Lot page: initial avatar, name, verified icon, member since. */
export function SellerRow({ name, verified, since }: { name: string; verified: boolean; since: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-fill text-headline">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-headline">
          {name}
          {verified && <BadgeCheck {...iconProps} size={16} aria-label="Phone verified" />}
        </p>
        <p className="text-footnote text-secondary">
          {[verified ? 'Phone verified' : null, since ? `Member since ${formatMonthYear(since)}` : null].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
}
