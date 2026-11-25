import { getServerSupabase } from '@/lib/supabase/server';
import { BidTabs, type BidRow } from './BidTabs';

export const dynamic = 'force-dynamic';

export default async function MyBidsPage() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('my_bids');
  return (
    <div className="mx-auto max-w-lot space-y-5">
      <h1 className="text-title-sm md:text-title">My bids</h1>
      <BidTabs rows={(data ?? []) as BidRow[]} renderedAt={Date.now()} />
    </div>
  );
}
