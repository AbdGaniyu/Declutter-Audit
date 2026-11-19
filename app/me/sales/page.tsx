import Link from 'next/link';
import { Badge } from '@/components/Badge';
import { Price } from '@/components/Price';
import { formatNaira } from '@/lib/money';
import { statusLabel } from '@/lib/orders';
import { photoUrl } from '@/lib/photos';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosDateTime } from '@/lib/time';
import { HandoverForm } from './HandoverForm';
import { RelistButton } from './RelistButton';
import { DisputeButton } from '@/components/DisputeButton';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const supabase = await getServerSupabase();
  const [{ data: lots }, { data: orders }, { data: drops }, { data: bank }] = await Promise.all([
    supabase.rpc('my_listings'),
    supabase.rpc('my_orders', { p_role: 'seller' }),
    supabase.rpc('current_drops', { p_limit: 10 }),
    supabase.from('seller_bank').select('account_name, bank_name, account_number').maybeSingle(),
  ]);
  const openDrops = (drops ?? []).filter((d) => d.accepting_listings).map((d) => ({ id: d.id, title: d.title, opens_at: d.opens_at }));
  const now = Date.now();
  const active = (orders ?? []).filter((o) => ['awaiting_payment', 'paid', 'handed_over', 'disputed'].includes(o.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-title">My lots & sales</h1>
        <Link href="/sell" className="rounded-pill bg-brand px-4 py-2 text-small font-semibold text-brand-ink">+ List</Link>
      </div>

      {!bank && (
        <Link href="/me/bank" className="block rounded-card bg-warn p-3 text-small font-semibold text-brand-ink">
          Add your bank account so we can pay you →
        </Link>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-small font-semibold">Sales in progress</h2>
          {active.map((o) => (
            <div key={o.id} className="space-y-3 rounded-card border border-line bg-surface p-4">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.title}</p>
                  <p className="text-small text-muted">Buyer: {o.counterpart_name ?? 'Buyer'}{o.offer_round === 2 ? ' (second chance)' : ''}</p>
                </div>
                <Badge kind={o.status === 'paid' ? 'leading' : 'neutral'}>{statusLabel(o.status)}</Badge>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-small">
                <div><dt className="text-muted">Sold for</dt><dd className="tabular-nums">{formatNaira(o.amount)}</dd></div>
                <div><dt className="text-muted">Fee (8%)</dt><dd className="tabular-nums">{formatNaira(o.commission)}</dd></div>
                <div><dt className="text-muted">You get</dt><dd className="font-semibold tabular-nums">{formatNaira(o.payout_amount)}</dd></div>
              </dl>
              {o.status === 'awaiting_payment' && (
                <p className="text-small text-muted">Waiting for the buyer to pay (until {formatLagosDateTime(o.pay_by, now)}).</p>
              )}
              {o.status === 'paid' && (
                <>
                  {o.counterpart_phone && (
                    <a href={`tel:+${o.counterpart_phone}`} className="flex min-h-11 items-center justify-center rounded-pill border border-line font-semibold">
                      Call buyer to arrange pickup
                    </a>
                  )}
                  <HandoverForm orderId={o.id} />
                  <DisputeButton orderId={o.id} />
                </>
              )}
              {o.status === 'handed_over' && <p className="text-small text-muted">Collected. Your payout is on its way.</p>}
              {o.status === 'disputed' && <p className="text-small text-muted">Under review by our team.</p>}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-small font-semibold">My lots</h2>
        {!lots?.length ? (
          <p className="text-muted">You haven't listed anything yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {lots.map((l) => {
              const src = photoUrl(l.photo);
              const live = !l.closed_at && Date.parse(l.starts_at) <= now && Date.parse(l.ends_at) > now;
              return (
                <li key={l.id} className="flex gap-3 p-3">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" loading="lazy" className="h-14 w-14 flex-none rounded-card object-cover" />
                  ) : <div className="h-14 w-14 flex-none rounded-card bg-bg" />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/lot/${l.id}`} className="block truncate font-semibold">{l.title}</Link>
                    <p className="text-small text-muted">
                      {l.drop_title} · {l.bid_count} bid{l.bid_count === 1 ? '' : 's'} · <Price kobo={l.current_bid ?? l.start_price} />
                    </p>
                    {(l.outcome === 'unsold' || l.outcome === 'defaulted') && !l.relisted && openDrops.length > 0 && (
                      <RelistButton auctionId={l.id} drops={openDrops} />
                    )}
                  </div>
                  <div className="shrink-0">
                    {live && <Badge kind="live">Live</Badge>}
                    {!l.closed_at && !live && Date.parse(l.ends_at) > now && <Badge kind="upcoming">Upcoming</Badge>}
                    {l.outcome === 'sold' && <Badge kind="sold">Sold</Badge>}
                    {l.outcome === 'unsold' && <Badge kind="unsold">Unsold</Badge>}
                    {l.outcome === 'defaulted' && <Badge kind="unsold">Not paid</Badge>}
                    {l.outcome === 'cancelled' && <Badge kind="unsold">Withdrawn</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
