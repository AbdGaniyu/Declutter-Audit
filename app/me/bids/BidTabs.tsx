'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, StatusChip } from '@/components/Badge';
import { Countdown } from '@/components/Countdown';
import { Price } from '@/components/Price';
import { useServerNow } from '@/lib/time-sync';

export type BidRow = {
  auction_id: string; title: string; area: string; ends_at: string; closed_at: string | null;
  outcome: string | null; current_bid: number; my_max_bid: number; is_leading: boolean;
};

type Tab = 'live' | 'won' | 'lost';

/** DESIGN.md › My bids: Live / Won / Lost. Live rows show winning/outbid at a glance. */
export function BidTabs({ rows, renderedAt }: { rows: BidRow[]; renderedAt: number }) {
  const now = useServerNow(1000, renderedAt);
  const isLive = (r: BidRow) => !r.closed_at && Date.parse(r.ends_at) > now;
  const groups: Record<Tab, BidRow[]> = {
    live: rows.filter(isLive),
    won: rows.filter((r) => !isLive(r) && r.is_leading && r.outcome !== 'cancelled'),
    lost: rows.filter((r) => !isLive(r) && !(r.is_leading && r.outcome !== 'cancelled')),
  };
  const [tab, setTab] = useState<Tab>(groups.live.length ? 'live' : groups.won.length ? 'won' : 'live');
  const labels: Record<Tab, string> = { live: 'Live', won: 'Won', lost: 'Lost' };

  return (
    <div>
      <div role="tablist" aria-label="Bids" className="grid grid-cols-3 gap-1 rounded-pill bg-surface p-1 shadow-elev">
        {(Object.keys(labels) as Tab[]).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`min-h-11 rounded-pill font-semibold ${tab === t ? 'bg-ink text-white' : 'text-ink'}`}>
            {labels[t]} <span className="font-num tabular-nums">{groups[t].length}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-4">
        {groups[tab].length === 0 ? (
          <p className="text-ink-muted">
            {tab === 'live' ? <>No live bids. <Link href="/" className="font-semibold text-focus">See tonight's drop</Link></> : 'Nothing here yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-elev">
            {groups[tab].map((b) => (
              <li key={b.auction_id}>
                <Link href={`/lot/${b.auction_id}`} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.title}</p>
                    <p className="text-body text-ink-muted">{b.area} · your top bid <Price kobo={b.my_max_bid} /></p>
                    {tab === 'live' && (
                      <div className="mt-1"><StatusChip kind={b.is_leading ? 'winning' : 'outbid'} /></div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Price kobo={b.current_bid} className="text-price-card" />
                    {tab === 'live'
                      ? <Countdown startsAt="1970-01-01T00:00:00Z" endsAt={b.ends_at} closedAt={null} now={now} size="card" />
                      : tab === 'won' ? <Badge kind="sold">Won</Badge> : <Badge kind="ended" />}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
