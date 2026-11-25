import { Phone } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/Badge';
import { DisputeButton } from '@/components/DisputeButton';
import { iconProps } from '@/components/icons';
import { Price } from '@/components/Price';
import { photoUrl } from '@/lib/photos';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosDateTime } from '@/lib/time';
import { HandoverForm } from './HandoverForm';
import { RelistButton } from './RelistButton';

export const dynamic = 'force-dynamic';

type Order = {
  id: string; title: string; offer_round: number; amount: number; commission: number; payout_amount: number;
  status: string; pay_by: string; counterpart_name: string | null; counterpart_phone: string | null;
};

function Money({ o }: { o: Order }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      <div><dt className="text-eyebrow uppercase text-ink-muted">Sold for</dt><dd><Price kobo={o.amount} /></dd></div>
      <div><dt className="text-eyebrow uppercase text-ink-muted">Our fee</dt><dd><Price kobo={o.commission} /></dd></div>
      <div><dt className="text-eyebrow uppercase text-ink-muted">You get</dt><dd><Price kobo={o.payout_amount} className="font-semibold" /></dd></div>
    </dl>
  );
}

/** DESIGN.md › Seller orders: awaiting payment / ready for pickup / paid out. */
export default async function SalesPage() {
  const supabase = await getServerSupabase();
  const [{ data: lots }, { data: orders }, { data: drops }, { data: bank }] = await Promise.all([
    supabase.rpc('my_listings'),
    supabase.rpc('my_orders', { p_role: 'seller' }),
    supabase.rpc('listable_drops', { p_limit: 10 }),
    supabase.from('seller_bank').select('account_name').maybeSingle(),
  ]);
  const openDrops = (drops ?? []).map((d) => ({ id: d.id, title: d.title, opens_at: d.opens_at }));
  const now = Date.now();
  const all = (orders ?? []) as Order[];
  const awaiting = all.filter((o) => o.status === 'awaiting_payment');
  const ready = all.filter((o) => o.status === 'paid');
  const review = all.filter((o) => o.status === 'disputed');
  const paidOut = all.filter((o) => o.status === 'handed_over' || o.status === 'paid_out');

  return (
    <div className="mx-auto max-w-lot space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-display">My sales</h1>
        <Link href="/sell" className="inline-flex min-h-11 items-center rounded-pill bg-ink px-4 font-semibold text-white">Sell</Link>
      </div>

      {!bank && (
        <Link href="/me/bank" className="block rounded-card bg-outbid-soft p-3 font-semibold text-ink">
          Add your bank account so we can pay you →
        </Link>
      )}

      {ready.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-heading">Ready for pickup</h2>
          {ready.map((o) => (
            <article key={o.id} aria-label={o.title} className="space-y-4 rounded-card bg-surface p-4 shadow-elev">
              <div>
                <p className="font-semibold">{o.title}</p>
                <p className="text-body text-ink-muted">Paid by {o.counterpart_name ?? 'the buyer'}{o.offer_round === 2 ? ' (second chance)' : ''}</p>
              </div>
              <Money o={o} />
              {o.counterpart_phone && (
                <a href={`tel:+${o.counterpart_phone}`} className="flex min-h-11 items-center justify-center gap-2 rounded-pill border border-line font-semibold">
                  <Phone {...iconProps} size={18} /> Call buyer to arrange pickup
                </a>
              )}
              <HandoverForm orderId={o.id} />
              <DisputeButton orderId={o.id} />
            </article>
          ))}
        </section>
      )}

      {awaiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-heading">Awaiting payment</h2>
          {awaiting.map((o) => (
            <div key={o.id} className="space-y-3 rounded-card bg-surface p-4 shadow-elev">
              <p className="font-semibold">{o.title}</p>
              <Money o={o} />
              <p className="text-body text-ink-muted">
                {o.counterpart_name ?? 'The buyer'} has until {formatLagosDateTime(o.pay_by, now)} to pay. If they don&apos;t, it goes to the next bidder.
              </p>
            </div>
          ))}
        </section>
      )}

      {review.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-heading">Under review</h2>
          {review.map((o) => (
            <div key={o.id} className="rounded-card bg-surface p-4 shadow-elev">
              <p className="font-semibold">{o.title}</p>
              <p className="text-body text-ink-muted">A problem was reported. Our team will call you. Payout is paused.</p>
            </div>
          ))}
        </section>
      )}

      {paidOut.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-heading">Paid out</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-elev">
            {paidOut.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.title}</p>
                  <p className="text-body text-ink-muted">{o.status === 'paid_out' ? 'Sent to your bank' : 'Payout on its way'}</p>
                </div>
                <Price kobo={o.payout_amount} className="text-price-card" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-heading">My lots</h2>
        {!lots?.length ? (
          <p className="text-ink-muted">You haven&apos;t listed anything yet.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-elev">
            {lots.map((l) => {
              const src = photoUrl(l.photo);
              const live = !l.closed_at && Date.parse(l.starts_at) <= now && Date.parse(l.ends_at) > now;
              const upcoming = !l.closed_at && Date.parse(l.starts_at) > now;
              return (
                <li key={l.id} className="flex gap-3 p-3">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" loading="lazy" className="aspect-[4/3] w-20 shrink-0 rounded-card object-cover" />
                  ) : <div className="aspect-[4/3] w-20 shrink-0 rounded-card bg-bg" />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/lot/${l.id}`} className="block truncate font-semibold">{l.title}</Link>
                    <p className="text-body text-ink-muted">
                      <span className="font-num tabular-nums">{l.bid_count}</span> bid{l.bid_count === 1 ? '' : 's'} · <Price kobo={l.current_bid ?? l.start_price} />
                    </p>
                    {(l.outcome === 'unsold' || l.outcome === 'defaulted') && !l.relisted && openDrops.length > 0 && (
                      <RelistButton auctionId={l.id} drops={openDrops} />
                    )}
                  </div>
                  <div className="shrink-0">
                    {live && <Badge kind="live" />}
                    {upcoming && <Badge kind="upcoming" />}
                    {l.outcome === 'sold' && <Badge kind="sold" />}
                    {(l.outcome === 'unsold' || l.outcome === 'defaulted') && <Badge kind="unsold" />}
                    {l.outcome === 'cancelled' && <Badge kind="ended">Withdrawn</Badge>}
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
