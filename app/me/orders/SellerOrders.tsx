import { Phone } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/Badge';
import { DisputeButton } from '@/components/DisputeButton';
import { GroupedList, GroupedRow } from '@/components/GroupedList';
import { iconProps } from '@/components/icons';
import { Price } from '@/components/Price';
import { Segmented } from '@/components/Segmented';
import { shortTitle } from '@/lib/drop';
import { photoUrl } from '@/lib/photos';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosDateTime, formatLagosTime } from '@/lib/time';
import { HandoverForm } from '../sales/HandoverForm';
import { RelistButton } from '../sales/RelistButton';

type Order = {
  id: string; title: string; area: string; offer_round: number; amount: number; commission: number; payout_amount: number;
  status: string; pay_by: string; paid_at: string | null; photo: string | null;
  counterpart_name: string | null; counterpart_phone: string | null;
};

export type SellerTab = 'awaiting' | 'ready' | 'paid';

function Thumb({ photo }: { photo: string | null }) {
  const src = photoUrl(photo);
  return (
    <div className="squircle h-20 w-24 shrink-0 overflow-hidden rounded-thumb bg-fill">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </div>
  );
}

/** DESIGN.md › Key screens › Orders, for sellers (PDF p.13, drawn in v2). */
export async function SellerOrders({ tab }: { tab: SellerTab | null }) {
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
  const groups: Record<SellerTab, Order[]> = {
    awaiting: all.filter((o) => o.status === 'awaiting_payment'),
    ready: all.filter((o) => o.status === 'paid' || o.status === 'disputed'),
    paid: all.filter((o) => o.status === 'handed_over' || o.status === 'paid_out'),
  };
  const current: SellerTab = tab ?? (groups.ready.length ? 'ready' : groups.awaiting.length ? 'awaiting' : 'ready');
  const href = (t: SellerTab) => `/me/orders?view=selling&tab=${t}`;

  return (
    <div className="space-y-5">
      {!bank && (
        <Link href="/me/bank" className="squircle block rounded-group bg-fill p-4 text-headline">
          Add your bank account so we can pay you after pickup →
        </Link>
      )}

      <Segmented label="Sales" value={current} segments={[
        { key: 'awaiting', label: 'Awaiting payment', count: groups.awaiting.length, href: href('awaiting') },
        { key: 'ready', label: 'Ready for pickup', count: groups.ready.length, href: href('ready') },
        { key: 'paid', label: 'Paid out', count: groups.paid.length, href: href('paid') },
      ]} />

      <div role="tabpanel" aria-label={current} className="space-y-3">
        {groups[current].length === 0 && (
          <p className="py-10 text-center text-subhead text-secondary">
            {current === 'ready' ? 'Nothing to hand over right now.' : current === 'awaiting' ? 'No buyers waiting to pay.' : 'No payouts yet.'}
          </p>
        )}

        {current === 'ready' && groups.ready.map((o) => {
          const buyer = o.counterpart_name ?? 'The buyer';
          return (
            <article key={o.id} aria-label={o.title} className="squircle space-y-4 rounded-group bg-surface p-4">
              <div className="flex gap-3">
                <Thumb photo={o.photo} />
                <div className="min-w-0">
                  <Badge kind={o.status === 'disputed' ? 'ended' : 'action'}>{o.status === 'disputed' ? 'Under review' : 'Ready for pickup'}</Badge>
                  <h2 className="mt-1 text-headline">{o.title}</h2>
                  <p className="text-subhead text-secondary">Sold for <Price kobo={o.amount} className="font-semibold text-label" /></p>
                </div>
              </div>
              <div className="flex items-center gap-3 [box-shadow:inset_0_0.5px_0_var(--hairline)] pt-4">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-fill text-headline">
                  {buyer.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-headline">{buyer}{o.offer_round === 2 ? ' (second chance)' : ''}</p>
                  <p className="text-subhead text-secondary">{o.paid_at ? `Paid ${formatLagosTime(o.paid_at)} · money held` : 'Paid · money held'}</p>
                </div>
                {o.counterpart_phone && (
                  <a href={`tel:+${o.counterpart_phone}`} aria-label={`Call ${buyer}`}
                    className="pressable flex h-11 w-11 items-center justify-center rounded-pill bg-fill">
                    <Phone {...iconProps} size={18} />
                  </a>
                )}
              </div>
              {o.status === 'disputed' ? (
                <p className="text-subhead text-secondary">A problem was reported. Our team will call you. Payout is paused.</p>
              ) : (
                <>
                  <p className="squircle rounded-control bg-fill p-3 text-subhead">
                    Meet {buyer} in {o.area}. Once they have the {shortTitle(o.title).toLowerCase()}, ask for their 6-digit code.
                  </p>
                  <HandoverForm orderId={o.id} />
                  <GroupedList className="!bg-fill">
                    <GroupedRow label="Our fee"><Price kobo={o.commission} /></GroupedRow>
                    <GroupedRow label="You get"><Price kobo={o.payout_amount} /></GroupedRow>
                  </GroupedList>
                  <DisputeButton orderId={o.id} />
                </>
              )}
            </article>
          );
        })}

        {current === 'awaiting' && groups.awaiting.map((o) => (
          <article key={o.id} aria-label={o.title} className="squircle flex gap-3 rounded-group bg-surface p-4">
            <Thumb photo={o.photo} />
            <div className="min-w-0">
              <Badge kind="upcoming">Awaiting payment</Badge>
              <h2 className="mt-1 text-headline">{o.title}</h2>
              <p className="text-subhead text-secondary">
                {o.counterpart_name ?? 'The buyer'} has until {formatLagosDateTime(o.pay_by, now)} to pay <Price kobo={o.amount} className="font-semibold text-label" />. If they don&apos;t, it goes to the next bidder.
              </p>
            </div>
          </article>
        ))}

        {current === 'paid' && groups.paid.length > 0 && (
          <GroupedList>
            {groups.paid.map((o) => (
              <GroupedRow key={o.id} label={<span className="text-label">{o.title}<br /><span className="text-footnote text-secondary">{o.status === 'paid_out' ? 'Sent to your bank' : 'Payout on its way'}</span></span>}>
                <Price kobo={o.payout_amount} />
              </GroupedRow>
            ))}
          </GroupedList>
        )}
      </div>

      <section className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title-sm">Your lots</h2>
          <Link href="/sell" className="pressable inline-flex min-h-11 items-center rounded-pill bg-fill px-4 text-subhead font-semibold">Sell another</Link>
        </div>
        {!lots?.length ? (
          <p className="text-subhead text-secondary">You haven&apos;t listed anything yet.</p>
        ) : (
          <ul className="squircle overflow-hidden rounded-group bg-surface">
            {lots.map((l) => {
              const live = !l.closed_at && Date.parse(l.starts_at) <= now && Date.parse(l.ends_at) > now;
              const upcoming = !l.closed_at && Date.parse(l.starts_at) > now;
              return (
                <li key={l.id} className="flex gap-3 p-3 [&:not(:last-child)]:hairline-b">
                  <Thumb photo={l.photo} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/lot/${l.id}`} className="block truncate text-headline">{l.title}</Link>
                    <p className="text-subhead text-secondary">
                      <span className="tnum">{l.bid_count}</span> bid{l.bid_count === 1 ? '' : 's'} · <Price kobo={l.current_bid ?? l.start_price} />
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
