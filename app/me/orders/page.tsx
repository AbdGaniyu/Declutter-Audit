import Link from 'next/link';
import { Pill } from '@/components/Badge';
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
    <div className="mx-auto max-w-lot space-y-4">
      <h1 className="font-display text-display">My wins & orders</h1>
      {!orders?.length ? (
        <p className="text-ink-muted">No wins yet.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const src = photoUrl(o.photo);
            const toPay = o.status === 'awaiting_payment';
            return (
              <li key={o.id}>
                <Link href={`/me/orders/${o.id}`} className="flex gap-3 rounded-card bg-surface p-3 shadow-elev">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" loading="lazy" className="aspect-[4/3] w-24 shrink-0 rounded-card object-cover" />
                  ) : <div className="aspect-[4/3] w-24 shrink-0 rounded-card bg-bg" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{o.title}</p>
                    <div className="mt-1 flex items-center gap-2"><Pill>{o.area}</Pill><Price kobo={o.amount} className="font-semibold" /></div>
                    <p className={`mt-1 text-body ${toPay ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
                      {toPay ? `Pay by ${formatLagosTime(o.pay_by)} →` : statusLabel(o.status)}
                    </p>
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
