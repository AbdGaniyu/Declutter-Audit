import { Badge } from '@/components/Badge';
import { RpcButton } from '@/components/admin/AdminActions';
import { Pager, SearchForm } from '@/components/admin/SearchForm';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatMonthYear } from '@/lib/time';

export const dynamic = 'force-dynamic';

const LIMIT = 50;
type User = { id: string; display_name: string | null; phone: string | null; area: string | null; strikes: number;
  bidding_suspended: boolean; is_admin: boolean; created_at: string; total_count: number };

/** Admin › Users: find someone by phone or name; review strikes or pause bidding. */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; offset?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 40);
  const offset = Math.max(0, Number(sp.offset) || 0);
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('admin_users', { p_query: q, p_offset: offset, p_limit: LIMIT });
  const users = (data ?? []) as User[];
  const total = users[0]?.total_count ?? 0;

  return (
    <div className="space-y-5">
      <h1 className="text-title-sm md:text-title">Users</h1>
      <SearchForm action="/admin/users" q={q} placeholder="Search by phone or name" />
      <ul className="squircle overflow-hidden rounded-group bg-surface">
        {users.length === 0 && <li className="px-4 py-8 text-center text-subhead text-secondary">No users match.</li>}
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 [&:not(:last-child)]:hairline-b">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-fill text-headline">
              {(u.display_name ?? '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-headline">
                {u.display_name ?? 'Unnamed'}
                {u.is_admin && <Badge kind="action">Admin</Badge>}
                {u.bidding_suspended && <Badge kind="ended">Bidding paused</Badge>}
              </p>
              <p className="text-footnote text-secondary">
                <span className="tnum">+{u.phone}</span>{u.area ? ` · ${u.area}` : ''} · joined {formatMonthYear(u.created_at)} ·{' '}
                <span className="tnum">{u.strikes}</span> strike{u.strikes === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {(u.strikes > 0 || u.bidding_suspended) && (
                <RpcButton rpc="admin_review_user" args={{ p_user_id: u.id, p_reset_strikes: true }} confirm="Clear strikes and restore bidding?">Review</RpcButton>
              )}
              {!u.bidding_suspended && !u.is_admin && (
                <RpcButton rpc="admin_suspend_user" args={{ p_user_id: u.id }} variant="text" confirm={`Pause bidding for ${u.display_name ?? 'this user'}?`}>Suspend</RpcButton>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Pager base={`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`} offset={offset} limit={LIMIT} total={total} />
    </div>
  );
}
