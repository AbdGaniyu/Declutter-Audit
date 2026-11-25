import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/Badge';
import { Price } from '@/components/Price';
import { Segmented } from '@/components/Segmented';
import { statusLabel } from '@/lib/orders';
import { photoUrl } from '@/lib/photos';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosTime } from '@/lib/time';
import { SellerOrders, type SellerTab } from './SellerOrders';

export const dynamic = 'force-dynamic';

const SELLER_TABS: SellerTab[] = ['awaiting', 'ready', 'paid'];

/**
 * Orders: Buying | Selling. The switch only shows for people who do both;
 * sellers with no wins land straight on Selling.
 */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; tab?: string }> }) {
  const sp = await searchParams;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/me/orders');
  const [{ data: orders }, { count: lotCount }] = await Promise.all([
    supabase.rpc('my_orders', { p_role: 'buyer' }),
    supabase.from('auctions').select('id', { count: 'exact', head: true }).eq('seller_id', auth.user.id),
  ]);
  const buying = orders ?? [];
  const sells = (lotCount ?? 0) > 0;
  const view = sp.view === 'selling' || (!sp.view && sells && buying.length === 0) ? 'selling' : 'buying';
  const tab = SELLER_TABS.includes(sp.tab as SellerTab) ? (sp.tab as SellerTab) : null;

  return (
    <div className="mx-auto max-w-lot space-y-5">
      <h1 className="text-title-sm md:text-title">Orders</h1>
      {sells && buying.length > 0 && (
        <Segmented label="Orders" value={view} segments={[
          { key: 'buying', label: 'Buying', count: buying.length, href: '/me/orders?view=buying' },
          { key: 'selling', label: 'Selling', href: '/me/orders?view=selling' },
        ]} />
      )}

      {view === 'selling' ? <SellerOrders tab={tab} /> : buying.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-headline">No wins yet</p>
          <p className="mt-1 text-subhead text-secondary">When you win a lot, you pay and get your handover code here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {buying.map((o) => {
            const src = photoUrl(o.photo);
            const toPay = o.status === 'awaiting_payment';
            return (
              <li key={o.id}>
                <Link href={`/me/orders/${o.id}`} className="squircle flex gap-3 rounded-group bg-surface p-3">
                  <div className="squircle h-20 w-24 shrink-0 overflow-hidden rounded-thumb bg-fill">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge kind={toPay || o.status === 'paid' ? 'action' : 'ended'}>{toPay ? 'Pay now' : statusLabel(o.status)}</Badge>
                    <p className="mt-1 truncate text-headline">{o.title}</p>
                    <p className="text-subhead text-secondary">
                      <Price kobo={o.amount} className="font-semibold text-label" /> · {o.area}
                      {toPay && <> · by {formatLagosTime(o.pay_by)}</>}
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
