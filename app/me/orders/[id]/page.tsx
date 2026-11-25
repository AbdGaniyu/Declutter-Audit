import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Pill } from '@/components/Badge';
import { Price } from '@/components/Price';
import { photoUrl } from '@/lib/photos';
import { getServerSupabase } from '@/lib/supabase/server';
import { BuyerOrderActions } from './BuyerOrderActions';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/me/orders/${id}`);
  const { data: orders } = await supabase.rpc('my_orders', { p_role: 'buyer' });
  const order = orders?.find((o) => o.id === id);
  if (!order) notFound();
  const src = photoUrl(order.photo);

  return (
    <div className="mx-auto max-w-lot space-y-4">
      <Link href="/me/orders" className="inline-flex min-h-11 items-center font-semibold text-focus">‹ All orders</Link>
      <section className="flex gap-3 rounded-card bg-surface p-4 shadow-elev">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="aspect-[4/3] w-28 shrink-0 rounded-card object-cover" />
        ) : null}
        <div className="min-w-0">
          <h1 className="font-display text-heading">{order.title}</h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill>{order.area}</Pill>
            {order.offer_round === 2 && <Pill>Second-chance offer</Pill>}
          </div>
          <p className="mt-1 text-body text-ink-muted">Sold by {order.counterpart_name ?? 'the seller'}</p>
        </div>
      </section>
      <section className="flex items-end justify-between rounded-card bg-surface p-4 shadow-elev">
        <div>
          <p className="text-eyebrow uppercase text-ink-muted">Total to pay</p>
          <Price kobo={order.amount} className="text-price-lot" />
        </div>
      </section>
      <BuyerOrderActions
        order={{
          id: order.id, status: order.status, pay_by: order.pay_by, offer_round: order.offer_round,
          seller_phone: order.counterpart_phone, refunded_at: order.refunded_at,
        }}
        userId={auth.user.id}
      />
    </div>
  );
}
