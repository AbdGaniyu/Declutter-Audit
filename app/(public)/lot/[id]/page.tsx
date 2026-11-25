import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveLot } from '@/components/LiveLot';
import type { Lot } from '@/lib/lot';
import { formatNaira } from '@/lib/money';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadLot(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await getServerSupabase();
  const [{ data }, { data: auth }] = await Promise.all([
    supabase.rpc('get_lot', { p_auction_id: id }),
    supabase.auth.getUser(),
  ]);
  return data ? { lot: data as unknown as Lot, signedIn: Boolean(auth.user) } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const r = await loadLot((await params).id);
  if (!r) return { title: 'Lot not found' };
  return {
    title: `${r.lot.title} · Declutter Auction`,
    description: `${r.lot.area} · bids from ${formatNaira(r.lot.current_bid ?? r.lot.start_price)}`,
  };
}

export default async function LotPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ amount?: string }>;
}) {
  const r = await loadLot((await params).id);
  if (!r) notFound();
  // "Bid ₦X" from My bids preselects that chip (kobo). Display only; place_bid re-checks it.
  const amount = Number((await searchParams).amount);
  return <LiveLot initial={r.lot} signedIn={r.signedIn} preferAmount={Number.isSafeInteger(amount) && amount > 0 ? amount : null} />;
}
