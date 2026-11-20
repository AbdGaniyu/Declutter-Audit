import { getServerSupabase } from '@/lib/supabase/server';
import { BidTabs, type BidRow } from './BidTabs';

export const dynamic = 'force-dynamic';

export default async function MyBidsPage() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('my_bids');
  return (
    <div className="mx-auto max-w-lot space-y-4">
      <h1 className="font-display text-display">My bids</h1>
      <BidTabs rows={(data ?? []) as BidRow[]} renderedAt={Date.now()} />
    </div>
  );
}
