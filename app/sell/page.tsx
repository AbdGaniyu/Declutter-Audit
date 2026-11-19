import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { SellForm } from './SellForm';

export const dynamic = 'force-dynamic';

export default async function SellPage() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/sell');

  const [{ data: drops }, { data: profile }, { data: bank }] = await Promise.all([
    supabase.rpc('current_drops', { p_limit: 10 }),
    supabase.from('profiles').select('area').eq('id', auth.user.id).maybeSingle(),
    supabase.from('seller_bank').select('account_name').eq('seller_id', auth.user.id).maybeSingle(),
  ]);
  const open = (drops ?? []).filter((d) => d.accepting_listings);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-title">List an item</h1>
        <p className="text-small text-muted">
          Your asking price is the opening bid. The highest bid when the lot closes wins.
        </p>
      </div>
      {!bank && (
        <p className="rounded-card border border-line bg-surface p-3 text-small">
          Add your bank account before your lot sells so we can pay you after pickup.{' '}
          <Link href="/me/bank" className="font-semibold text-brand">Add bank account</Link>
        </p>
      )}
      {open.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-4 text-muted">
          No drops are taking listings right now. Check back soon.
        </p>
      ) : (
        <SellForm
          drops={open.map((d) => ({ id: d.id, title: d.title, opens_at: d.opens_at, lot_count: d.lot_count }))}
          defaultArea={profile?.area ?? ''}
        />
      )}
    </div>
  );
}
