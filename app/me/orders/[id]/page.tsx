import { notFound, redirect } from 'next/navigation';
import { GroupedRow } from '@/components/GroupedList';
import { Price } from '@/components/Price';
import { TopBarBack } from '@/components/TopBarContext';
import { photoUrl } from '@/lib/photos';
import { getServerSupabase } from '@/lib/supabase/server';
import { BuyerOrderActions } from './BuyerOrderActions';

export const dynamic = 'force-dynamic';

/** DESIGN.md › Key screens › Pay (PDF p.8, drawn in v2) and the buyer's handover code. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/me/orders/${id}`);
  const { data: orders } = await supabase.rpc('my_orders', { p_role: 'buyer' });
  const order = orders?.find((o) => o.id === id);
  if (!order) notFound();
  const src = photoUrl(order.photo);
  const seller = order.counterpart_name ?? 'the seller';

  const summary = (
    <section className="squircle rounded-group bg-surface p-4">
      <div className="flex gap-3">
        <div className="squircle h-20 w-24 shrink-0 overflow-hidden rounded-thumb bg-fill">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src && <img src={src} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="text-eyebrow uppercase text-secondary">{order.offer_round === 2 ? 'Second-chance offer' : 'You won'}</p>
          <h2 className="text-headline">{order.title}</h2>
          <p className="text-subhead text-secondary">From {seller} · {order.area}</p>
        </div>
      </div>
      <dl className="mt-4">
        <GroupedRow label={order.offer_round === 2 ? 'Your bid' : 'Winning bid'}><Price kobo={order.amount} /></GroupedRow>
        <div className="flex items-end justify-between gap-4 pt-3">
          <dt className="text-headline">You pay</dt>
          <dd><Price kobo={order.amount} className="text-price-lot-sm" /></dd>
        </div>
      </dl>
    </section>
  );

  return (
    <div className="mx-auto max-w-lot space-y-4">
      <TopBarBack href="/me/orders" label="Orders" />
      <h1 className="text-title-sm md:text-title">{order.status === 'awaiting_payment' ? 'Pay for your lot' : order.title}</h1>
      <BuyerOrderActions
        order={{
          id: order.id, status: order.status, pay_by: order.pay_by, offer_round: order.offer_round, amount: order.amount,
          title: order.title, area: order.area, seller_name: seller,
          seller_phone: order.counterpart_phone, refunded_at: order.refunded_at,
        }}
        summary={summary}
        userId={auth.user.id}
      />
    </div>
  );
}
