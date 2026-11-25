'use client';
import Link from 'next/link';
import { useState } from 'react';
import { StatusChip, type Standing } from '@/components/Badge';
import { CountdownPill } from '@/components/Countdown';
import { Price } from '@/components/Price';
import { Segmented } from '@/components/Segmented';
import { formatNaira } from '@/lib/money';
import { photoUrl } from '@/lib/photos';
import { useServerNow } from '@/lib/time-sync';

export type BidRow = {
  auction_id: string; title: string; area: string; starts_at: string; ends_at: string; closed_at: string | null;
  outcome: string | null; current_bid: number; min_next: number; my_max_bid: number; is_leading: boolean; photo: string | null;
};

type Tab = 'live' | 'won' | 'lost';

/** DESIGN.md › Key screens › My bids (PDF p.6, drawn in v2). */
export function BidTabs({ rows, renderedAt }: { rows: BidRow[]; renderedAt: number }) {
  const now = useServerNow(1000, renderedAt);
  const isLive = (r: BidRow) => !r.closed_at && Date.parse(r.ends_at) > now;
  const won = (r: BidRow) => r.is_leading && r.outcome !== 'cancelled';
  const groups: Record<Tab, BidRow[]> = {
    live: rows.filter(isLive),
    won: rows.filter((r) => !isLive(r) && won(r)),
    lost: rows.filter((r) => !isLive(r) && !won(r)),
  };
  const [tab, setTab] = useState<Tab>(groups.live.length ? 'live' : groups.won.length ? 'won' : 'live');

  return (
    <div className="space-y-4">
      <Segmented label="Bids" value={tab} onChange={(k) => setTab(k as Tab)} segments={[
        { key: 'live', label: 'Live', count: groups.live.length },
        { key: 'won', label: 'Won', count: groups.won.length },
        { key: 'lost', label: 'Lost', count: groups.lost.length },
      ]} />

      <div role="tabpanel" aria-label={tab}>
        {groups[tab].length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-headline">
              {tab === 'live' ? 'No live bids' : tab === 'won' ? 'No wins yet' : 'Nothing lost'}
            </p>
            <p className="mt-1 text-subhead text-secondary">
              {tab === 'live' ? <>Lots close one by one every evening. <Link href="/" className="font-semibold text-label underline underline-offset-2">See tonight&apos;s drop</Link></> : 'Lots you bid on show up here when they close.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {groups[tab].map((b) => <BidRowCard key={b.auction_id} b={b} tab={tab} now={now} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function BidRowCard({ b, tab, now }: { b: BidRow; tab: Tab; now: number }) {
  const standing: Standing = tab === 'live' ? (b.is_leading ? 'winning' : 'outbid') : tab === 'won' ? 'won' : 'lost';
  const src = photoUrl(b.photo);
  const outbid = standing === 'outbid';
  return (
    <li className="squircle overflow-hidden rounded-group bg-surface">
      <Link href={`/lot/${b.auction_id}`} className="flex items-center gap-3 p-3">
        <div className="squircle h-20 w-24 shrink-0 overflow-hidden rounded-thumb bg-fill">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src && <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <StatusChip kind={standing} />
            <CountdownPill startsAt={b.starts_at} endsAt={b.ends_at} closedAt={b.closed_at} now={now} />
          </div>
          <p className="mt-1 truncate text-headline">{b.title}</p>
          <p className="text-subhead text-secondary">
            Your bid <Price kobo={b.my_max_bid} className="font-semibold text-label" />
          </p>
        </div>
      </Link>
      {outbid && (
        <div className="flex items-center justify-between gap-3 bg-fill px-3 py-2">
          <p className="text-subhead">Top bid now <Price kobo={b.current_bid} className="font-semibold" /></p>
          <Link href={`/lot/${b.auction_id}?amount=${b.min_next}`}
            className="pressable inline-flex min-h-11 items-center rounded-pill bg-accent px-4 text-subhead font-semibold text-white">
            Bid {formatNaira(b.min_next)}
          </Link>
        </div>
      )}
    </li>
  );
}
