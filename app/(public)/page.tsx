import { DropBoard, type DropInfo } from '@/components/DropBoard';
import type { LotSummary } from '@/components/LotCard';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await getServerSupabase();
  const [{ data: drops }, { data: auth }] = await Promise.all([
    supabase.rpc('current_drops', { p_limit: 6 }),
    supabase.auth.getUser(),
  ]);
  const all: DropInfo[] = (drops ?? []).map((d) => ({
    id: d.id, number: d.number, title: d.title, opens_at: d.opens_at, last_close_at: d.last_close_at,
    close_interval_seconds: d.close_interval_seconds, lot_count: d.lot_count, areas: d.areas ?? [],
    total_bids: d.total_bids, reminded: d.reminded,
  }));
  const [hero, ...upcoming] = all;

  let lots: LotSummary[] = [];
  if (hero) {
    const { data } = await supabase
      .from('auctions')
      .select('id, title, area, condition, category, start_price, current_bid, bid_count, starts_at, ends_at, closed_at, outcome, auction_photos(storage_path, position)')
      .eq('drop_id', hero.id)
      .or('outcome.is.null,outcome.neq.cancelled')
      .order('ends_at'); // sorted by close time
    lots = (data ?? []).map(({ auction_photos, ...l }) => ({
      ...l,
      photo: [...(auction_photos ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null,
    }));
  }

  return <DropBoard hero={hero ?? null} lots={lots} upcoming={upcoming} renderedAt={Date.now()} signedIn={Boolean(auth.user)} />;
}
