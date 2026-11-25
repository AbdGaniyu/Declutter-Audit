import { Badge } from '@/components/Badge';
import { RpcButton } from '@/components/admin/AdminActions';
import { Pager, SearchForm } from '@/components/admin/SearchForm';
import { Price } from '@/components/Price';
import { Segmented } from '@/components/Segmented';
import { photoUrl } from '@/lib/photos';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

const LIMIT = 50;
const STATUSES = ['all', 'live', 'upcoming', 'closed'] as const;
type Lot = { id: string; drop_title: string; drop_number: number; title: string; area: string; seller_name: string;
  start_price: number; current_bid: number | null; bid_count: number; starts_at: string; ends_at: string;
  closed_at: string | null; outcome: string | null; photo: string | null; total_count: number };

/** Admin › Lots: every lot across drops. Search titles, filter by status, pull live ones. */
export default async function AdminLotsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; offset?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 100);
  const status = (STATUSES as readonly string[]).includes(sp.status ?? '') ? sp.status! : 'all';
  const offset = Math.max(0, Number(sp.offset) || 0);
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('admin_lots', { p_query: q, p_status: status, p_offset: offset, p_limit: LIMIT });
  const lots = (data ?? []) as Lot[];
  const total = lots[0]?.total_count ?? 0;
  const now = Date.now();
  const base = `/admin/lots?${new URLSearchParams({ ...(q ? { q } : {}), status })}`;

  return (
    <div className="space-y-5">
      <h1 className="text-title-sm md:text-title">Lots</h1>
      <SearchForm action="/admin/lots" q={q} placeholder="Search lot titles" keep={{ status }} />
      <Segmented label="Status" value={status} segments={STATUSES.map((s) => ({
        key: s, label: s[0]!.toUpperCase() + s.slice(1), href: `/admin/lots?${new URLSearchParams({ ...(q ? { q } : {}), status: s })}`,
      }))} />
      <ul className="squircle overflow-hidden rounded-group bg-surface">
        {lots.length === 0 && <li className="px-4 py-8 text-center text-subhead text-secondary">No lots match.</li>}
        {lots.map((l) => {
          const live = !l.outcome && !l.closed_at && Date.parse(l.starts_at) <= now && Date.parse(l.ends_at) > now;
          const upcoming = !l.outcome && Date.parse(l.starts_at) > now;
          const src = photoUrl(l.photo);
          return (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:hairline-b">
              <div className="squircle h-12 w-14 shrink-0 overflow-hidden rounded-thumb bg-fill">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <a href={`/lot/${l.id}`} className="block truncate text-headline hover:underline">{l.title}</a>
                <p className="truncate text-footnote text-secondary">
                  {l.seller_name} · {l.area} · Drop <span className="tnum">{l.drop_number}</span> · closes {formatLagosDateTime(l.ends_at)}
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <Price kobo={l.current_bid ?? l.start_price} className="block text-subhead font-semibold" />
                <span className="tnum text-footnote text-secondary">{l.bid_count} bids</span>
              </div>
              <div className="shrink-0">
                {live || upcoming
                  ? <RpcButton rpc="admin_cancel_auction" args={{ p_auction_id: l.id }} variant="text" confirm={`Pull "${l.title}" now?`}>Pull</RpcButton>
                  : <Badge kind={l.outcome === 'sold' ? 'sold' : 'ended'}>{l.outcome ?? 'Closed'}</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
      <Pager base={base} offset={offset} limit={LIMIT} total={total} />
    </div>
  );
}
