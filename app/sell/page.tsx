import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { SellFlow } from './SellForm';

export const dynamic = 'force-dynamic';

export default async function SellPage() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/sell');

  const [{ data: drops }, { data: profile }, { data: bank }] = await Promise.all([
    supabase.rpc('listable_drops', { p_limit: 10 }),
    supabase.from('profiles').select('area').eq('id', auth.user.id).maybeSingle(),
    supabase.from('seller_bank').select('account_name').eq('seller_id', auth.user.id).maybeSingle(),
  ]);
  const open = drops ?? [];

  return (
    <div className="mx-auto max-w-lot space-y-5">
      {!bank && (
        <p className="squircle rounded-group bg-surface p-3 text-body">
          Add your bank account before your lot sells, so we can pay you after pickup.{' '}
          <Link href="/me/bank" className="font-semibold text-label underline underline-offset-2">Add bank account</Link>
        </p>
      )}
      {open.length === 0 ? (
        <div className="squircle rounded-group bg-surface p-4">
          <h1 className="text-title-sm md:text-title">Sell an item</h1>
          <p className="mt-1 text-secondary">No drops are taking listings right now. Check back soon.</p>
        </div>
      ) : (
        <SellFlow
          drops={open.map((d) => ({ id: d.id, title: d.title, opens_at: d.opens_at, lot_count: d.lot_count }))}
          defaultArea={profile?.area ?? ''}
        />
      )}
    </div>
  );
}
