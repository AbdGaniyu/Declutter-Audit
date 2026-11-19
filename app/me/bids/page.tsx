import Link from 'next/link';
import { Badge } from '@/components/Badge';
import { Price } from '@/components/Price';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function MyBidsPage() {
  const supabase = await getServerSupabase();
  const { data: bids } = await supabase.rpc('my_bids');
  const now = Date.now();

  return (
    <div className="space-y-4">
      <h1 className="text-title">My bids</h1>
      {!bids?.length ? (
        <p className="text-muted">You haven't bid on anything yet. <Link className="text-brand" href="/">See what's live</Link>.</p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {bids.map((b) => {
            const live = !b.closed_at && Date.parse(b.ends_at) > now;
            return (
              <li key={b.auction_id}>
                <Link href={`/lot/${b.auction_id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.title}</p>
                    <p className="text-small text-muted">
                      {b.area} · {live ? `closes ${formatLagosDateTime(b.ends_at, now)}` : 'closed'}
                    </p>
                    <p className="text-small">Your top bid <Price kobo={b.my_max_bid} /></p>
                  </div>
                  <div className="shrink-0 text-right">
                    {live && b.is_leading && <Badge kind="leading">Winning</Badge>}
                    {live && !b.is_leading && <Badge kind="outbid">Outbid</Badge>}
                    {!live && b.is_leading && b.outcome === 'sold' && <Badge kind="sold">Won</Badge>}
                    {!live && !(b.is_leading && b.outcome === 'sold') && <Badge kind="unsold">Ended</Badge>}
                    <p className="mt-1 text-small"><Price kobo={b.current_bid} /></p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
