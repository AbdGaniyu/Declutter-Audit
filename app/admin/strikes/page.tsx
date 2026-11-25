import { RpcButton } from '@/components/admin/AdminActions';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

type Struck = { id: string; display_name: string | null; phone: string | null; strikes: number; bidding_suspended: boolean };
type Strike = { user_id: string; display_name: string | null; phone: string | null; lot_title: string | null; struck_at: string };

/** Admin › Strikes: who's suspended or close to it, and this week's strikes. */
export default async function AdminStrikesPage() {
  const supabase = await getServerSupabase();
  const [{ data: overview }, { data: week }] = await Promise.all([supabase.rpc('admin_overview'), supabase.rpc('admin_strikes_week')]);
  const struck = ((overview as { struck_users?: Struck[] } | null)?.struck_users ?? []);
  const recent = (week ?? []) as Strike[];

  return (
    <div className="space-y-8">
      <h1 className="text-title-sm md:text-title">Strikes</h1>
      <section className="space-y-3">
        <p className="text-subhead text-secondary">A winner who doesn&apos;t pay within 30 minutes gets a strike. Two strikes pause bidding until you review them.</p>
        {struck.length === 0 ? <p className="text-subhead text-secondary">Nobody has strikes.</p> : (
          <ul className="squircle overflow-hidden rounded-group bg-surface">
            {struck.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 [&:not(:last-child)]:hairline-b">
                <span>
                  <span className="block text-headline">{u.display_name ?? 'Unnamed'} <span className="tnum font-normal text-secondary">+{u.phone}</span></span>
                  <span className="block text-footnote text-secondary">
                    <span className="tnum">{u.strikes}</span> strike{u.strikes === 1 ? '' : 's'}{u.bidding_suspended ? ' · bidding paused' : ''}
                  </span>
                </span>
                <RpcButton rpc="admin_review_user" args={{ p_user_id: u.id, p_reset_strikes: true }} confirm="Clear strikes and restore bidding?">
                  Clear strikes
                </RpcButton>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-title-sm">This week</h2>
        {recent.length === 0 ? <p className="text-subhead text-secondary">No strikes in the last 7 days.</p> : (
          <ul className="squircle overflow-hidden rounded-group bg-surface">
            {recent.map((s) => (
              <li key={`${s.user_id}-${s.struck_at}`} className="px-4 py-3 text-subhead [&:not(:last-child)]:hairline-b">
                <span className="font-semibold">{s.display_name ?? 'Unnamed'}</span> won {s.lot_title ?? 'a lot'} and didn&apos;t pay ·{' '}
                <span className="text-secondary">{formatLagosDateTime(s.struck_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
