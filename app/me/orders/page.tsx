import Link from 'next/link';
import { Badge } from '@/components/Badge';
import { Price } from '@/components/Price';
import { statusLabel } from '@/lib/orders';
import { photoUrl } from '@/lib/photos';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const supabase = await getServerSupabase();
  const { data: orders } = await supabase.rpc('my_orders', { p_role: 'buyer' });

  return (
    <div className="space-y-4">
      <h1 className="text-title">My wins & orders</h1>
      {!orders?.length ? (
        <p className="text-muted">No wins yet.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const src = photoUrl(o.photo);
            return (
              <li key={o.id}>
                <Link href={`/me/orders/${o.id}`} className="flex gap-3 rounded-card border border-line bg-surface p-3">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" loading="lazy" className="h-16 w-16 flex-none rounded-card object-cover" />
                  ) : <div className="h-16 w-16 flex-none rounded-card bg-bg" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{o.title}</p>
                    <p className="text-small text-muted">{o.area} · <Price kobo={o.amount} /></p>
                    {o.status === 'awaiting_payment' ? (
                      <p className="text-small font-semibold text-warn">Pay by {formatLagosTime(o.pay_by)}</p>
                    ) : (
                      <p className="text-small">{statusLabel(o.status)}</p>
                    )}
                  </div>
                  {o.status === 'awaiting_payment' && <div><Badge kind="live">Pay now</Badge></div>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
