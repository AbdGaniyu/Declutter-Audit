import Link from 'next/link';
import { DropBoard, type DropWithLots } from '@/components/DropBoard';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await getServerSupabase();
  const { data: drops } = await supabase.rpc('current_drops', { p_limit: 3 });

  const withLots: DropWithLots[] = await Promise.all(
    (drops ?? []).map(async (d) => {
      const { data: lots } = await supabase
        .from('auctions')
        .select(
          'id, title, area, condition, start_price, current_bid, bid_count, starts_at, ends_at, closed_at, outcome, auction_photos(storage_path, position)',
        )
        .eq('drop_id', d.id)
        .or('outcome.is.null,outcome.neq.cancelled')
        .order('slot');
      return {
        id: d.id,
        title: d.title,
        opens_at: d.opens_at,
        first_close_at: d.first_close_at,
        last_close_at: d.last_close_at,
        lot_count: d.lot_count,
        lots: (lots ?? []).map(({ auction_photos, ...l }) => ({
          ...l,
          photo: [...(auction_photos ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null,
        })),
      };
    }),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-brand p-5 text-brand-ink">
        <h1 className="text-display">Declutter, live.</h1>
        <p className="mt-1">
          Short auctions every evening across Lagos. Bid from your phone, pick up nearby, pay safely.
        </p>
        <Link href="/sell" className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-surface px-5 font-semibold text-brand">
          List an item
        </Link>
      </section>
      <DropBoard drops={withLots} />
    </div>
  );
}
