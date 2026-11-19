import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Price } from '@/components/Price';
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

  return (
    <div className="space-y-4">
      <Link href="/me/orders" className="text-small text-brand">‹ All orders</Link>
      <div>
        <h1 className="text-title">{order.title}</h1>
        <p className="text-small text-muted">
          Pickup in {order.area} · sold by {order.counterpart_name ?? 'the seller'}
          {order.offer_round === 2 ? ' · second-chance offer' : ''}
        </p>
      </div>
      <div className="rounded-card border border-line bg-surface p-4">
        <p className="text-micro uppercase text-muted">Total</p>
        <Price kobo={order.amount} className="text-display" />
      </div>
      <BuyerOrderActions
        order={{
          id: order.id,
          auction_id: order.auction_id,
          status: order.status,
          pay_by: order.pay_by,
          offer_round: order.offer_round,
          seller_phone: order.counterpart_phone,
          refunded_at: order.refunded_at,
        }}
        userId={auth.user.id}
      />
    </div>
  );
}
