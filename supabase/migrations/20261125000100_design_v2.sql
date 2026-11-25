-- Design v2 backend support (DESIGN.md v2, .planning/plans/design-v2.md Phase 1).
--  * ₦200 step tier under ₦10,000
--  * drops.number ("Drop No. 14")
--  * current_drops / get_lot: fields the v2 drop page and lot page show
--  * search_lots for the nav search
--  * admin views: week calendar, all lots, users, strikes this week

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Step tiers. Stored on the auction at listing time, so live lots keep theirs.
-- -----------------------------------------------------------------------------
create or replace function public.step_for(p_start_price bigint)
returns bigint
language sql immutable
as $$
  select case
    when p_start_price < 1000000  then 20000    -- < ₦10,000   → ₦200
    when p_start_price < 2000000  then 50000    -- < ₦20,000   → ₦500
    when p_start_price < 10000000 then 100000   -- < ₦100,000  → ₦1,000
    else 250000                                 -- ≥ ₦100,000  → ₦2,500
  end::bigint
$$;

-- -----------------------------------------------------------------------------
-- Drop numbers: stable once assigned. A cancelled drop keeps its number.
-- -----------------------------------------------------------------------------
alter table public.drops add column number int;
update public.drops d
   set number = x.n
  from (select id, row_number() over (order by opens_at, created_at, id) as n from public.drops) x
 where x.id = d.id;
create sequence public.drops_number_seq owned by public.drops.number;
select setval('public.drops_number_seq', coalesce((select max(number) from public.drops), 0) + 1, false);
alter table public.drops
  alter column number set default nextval('public.drops_number_seq'),
  alter column number set not null,
  add constraint drops_number_key unique (number);

-- Literal match for LIKE/ILIKE: user input never acts as a wildcard.
create function private.like_escape(p_text text)
returns text
language sql immutable
as $$ select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_') $$;

-- -----------------------------------------------------------------------------
-- current_drops: + number, pickup areas, total bids.
-- -----------------------------------------------------------------------------
drop function public.current_drops(int);
create function public.current_drops(p_limit int default 5)
returns table (id uuid, number int, title text, opens_at timestamptz, first_close_at timestamptz,
               close_interval_seconds int, lot_count int, last_close_at timestamptz,
               accepting_listings boolean, reminded boolean, areas text[], total_bids int,
               server_now timestamptz)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.number, d.title, d.opens_at, d.first_close_at,
         extract(epoch from d.close_interval)::int,
         count(a.id) filter (where a.outcome is distinct from 'cancelled')::int,
         coalesce(max(a.ends_at), d.first_close_at),
         clock_timestamp() < d.opens_at
           and count(a.id) filter (where a.outcome is distinct from 'cancelled') < d.max_lots,
         exists (select 1 from public.drop_reminders r where r.drop_id = d.id and r.user_id = auth.uid()),
         coalesce(array_agg(distinct a.area order by a.area) filter (where a.outcome is distinct from 'cancelled'),
                  '{}'::text[]),
         coalesce(sum(a.bid_count) filter (where a.outcome is distinct from 'cancelled'), 0)::int,
         clock_timestamp()
  from public.drops d
  left join public.auctions a on a.drop_id = d.id
  where d.status = 'published'
  group by d.id
  having coalesce(max(a.ends_at), d.first_close_at) > clock_timestamp() - interval '10 minutes'
  order by d.opens_at
  limit least(greatest(p_limit, 1), 20)
$$;
grant execute on function public.current_drops(int) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- get_lot: + drop_number, lot_no ("Lot 07 of 38"), drop_lot_count.
-- The previous body moves to private and is extended rather than copied.
-- -----------------------------------------------------------------------------
alter function public.get_lot(uuid) rename to get_lot_base;
alter function public.get_lot_base(uuid) set schema private;
revoke all on function private.get_lot_base(uuid) from public, anon, authenticated;

create function public.get_lot(p_auction_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_base jsonb := private.get_lot_base(p_auction_id);
  a      public.auctions;
begin
  if v_base is null then
    return null;
  end if;
  select * into a from public.auctions where id = p_auction_id;
  return v_base || jsonb_build_object(
    'drop_number', (select d.number from public.drops d where d.id = a.drop_id),
    'lot_no', (select count(*) from public.auctions x
                where x.drop_id = a.drop_id and x.outcome is distinct from 'cancelled' and x.slot <= a.slot),
    'drop_lot_count', (select count(*) from public.auctions x
                        where x.drop_id = a.drop_id and x.outcome is distinct from 'cancelled')
  );
end;
$$;
grant execute on function public.get_lot(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Search: lots that haven't ended yet. Runs as the caller, so RLS applies.
-- -----------------------------------------------------------------------------
create index auctions_search_trgm_idx on public.auctions
  using gin ((title || ' ' || description) extensions.gin_trgm_ops);

create function public.search_lots(p_query text, p_limit int default 24)
returns table (id uuid, drop_id uuid, drop_title text, title text, category text, area text, condition text,
               start_price bigint, current_bid bigint, bid_count int, starts_at timestamptz,
               ends_at timestamptz, closed_at timestamptz, outcome text, photo text)
language sql stable security invoker set search_path = ''
as $$
  select a.id, a.drop_id, d.title, a.title, a.category, a.area, a.condition,
         a.start_price, a.current_bid, a.bid_count, a.starts_at, a.ends_at, a.closed_at, a.outcome,
         (select p.storage_path from public.auction_photos p where p.auction_id = a.id order by p.position limit 1)
  from public.auctions a
  join public.drops d on d.id = a.drop_id
  where btrim(coalesce(p_query, '')) <> ''
    and d.status = 'published'
    and a.outcome is distinct from 'cancelled'
    and a.closed_at is null
    and a.ends_at > clock_timestamp()
    and (a.title || ' ' || a.description) ilike '%' || private.like_escape(left(btrim(p_query), 100)) || '%'
  order by a.ends_at
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
$$;
grant execute on function private.like_escape(text) to anon, authenticated;
grant execute on function public.search_lots(text, int) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Admin: one week of drops (Lagos days), one row per day or per drop.
-- -----------------------------------------------------------------------------
create function public.admin_drops_week(p_week_start date)
returns table (day date, drop_id uuid, number int, title text, opens_at timestamptz,
               last_close_at timestamptz, state text, lots int, unsold int)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_admin();
  return query
  with days as (
    select (p_week_start + i)::date as day from generate_series(0, 6) i
  ), dd as (
    select d.id, d.number, d.title, d.opens_at, d.status,
           (d.opens_at at time zone 'Africa/Lagos')::date as day,
           coalesce(max(a.ends_at) filter (where a.outcome is distinct from 'cancelled'), d.first_close_at) as last_close,
           (count(a.id) filter (where a.outcome is distinct from 'cancelled'))::int as lots,
           (count(a.id) filter (where a.outcome = 'unsold'))::int as unsold
      from public.drops d
      left join public.auctions a on a.drop_id = d.id
     where d.opens_at >= (p_week_start::timestamp at time zone 'Africa/Lagos')
       and d.opens_at <  ((p_week_start + 7)::timestamp at time zone 'Africa/Lagos')
       and d.status <> 'draft'
     group by d.id
  )
  select days.day, dd.id, dd.number, dd.title, dd.opens_at, dd.last_close,
         case
           when dd.id is null then 'none'
           when dd.status = 'cancelled' then 'cancelled'
           when clock_timestamp() < dd.opens_at then 'upcoming'
           when clock_timestamp() < dd.last_close then 'live'
           else 'ended'
         end,
         coalesce(dd.lots, 0), coalesce(dd.unsold, 0)
    from days
    left join dd on dd.day = days.day
   order by days.day, dd.opens_at;
end;
$$;
grant execute on function public.admin_drops_week(date) to authenticated;

-- Admin: all lots across drops. p_status: all | live | upcoming | closed. Title search.
create function public.admin_lots(p_query text, p_status text, p_offset int default 0, p_limit int default 50)
returns table (id uuid, drop_id uuid, drop_title text, drop_number int, slot int, title text, area text,
               seller_name text, start_price bigint, current_bid bigint, bid_count int,
               starts_at timestamptz, ends_at timestamptz, closed_at timestamptz, outcome text,
               photo text, total_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_now timestamptz := clock_timestamp();
  v_q   text := nullif(btrim(coalesce(p_query, '')), '');
begin
  perform private.require_admin();
  return query
  select a.id, a.drop_id, d.title, d.number, a.slot, a.title, a.area,
         coalesce(p.display_name, 'Seller'), a.start_price, a.current_bid, a.bid_count,
         a.starts_at, a.ends_at, a.closed_at, a.outcome,
         (select ph.storage_path from public.auction_photos ph where ph.auction_id = a.id order by ph.position limit 1),
         count(*) over ()
    from public.auctions a
    join public.drops d on d.id = a.drop_id
    join public.profiles p on p.id = a.seller_id
   where (v_q is null or a.title ilike '%' || private.like_escape(left(v_q, 100)) || '%')
     and case coalesce(p_status, 'all')
           when 'live'     then a.outcome is null and a.closed_at is null and a.starts_at <= v_now and v_now < a.ends_at
           when 'upcoming' then a.outcome is null and v_now < a.starts_at
           when 'closed'   then a.closed_at is not null or a.outcome is not null or a.ends_at <= v_now
           else true
         end
   order by a.ends_at desc, a.slot
   offset greatest(coalesce(p_offset, 0), 0)
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
grant execute on function public.admin_lots(text, text, int, int) to authenticated;

-- Admin: find users by phone or name.
create function public.admin_users(p_query text, p_offset int default 0, p_limit int default 50)
returns table (id uuid, display_name text, phone text, area text, strikes int, bidding_suspended boolean,
               is_admin boolean, created_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  perform private.require_admin();
  return query
  select p.id, p.display_name, p.phone, p.area, p.strikes::int, p.bidding_suspended, p.is_admin, p.created_at,
         count(*) over ()
    from public.profiles p
   where v_q is null
      or p.phone ilike '%' || private.like_escape(left(v_q, 40)) || '%'
      or p.display_name ilike '%' || private.like_escape(left(v_q, 40)) || '%'
   order by p.strikes desc, p.created_at desc
   offset greatest(coalesce(p_offset, 0), 0)
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
grant execute on function public.admin_users(text, int, int) to authenticated;

-- Admin: strikes issued in the last 7 days (a round-1 winner who didn't pay).
create function public.admin_strikes_week()
returns table (user_id uuid, display_name text, phone text, strikes int, bidding_suspended boolean,
               lot_title text, struck_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select p.id, p.display_name, p.phone, p.strikes::int, p.bidding_suspended, n.payload ->> 'title', n.created_at
    from public.notifications n
    join public.profiles p on p.id = n.user_id
   where n.type = 'order_expired'
     and n.created_at > clock_timestamp() - interval '7 days'
   order by n.created_at desc
   limit 100;
end;
$$;
grant execute on function public.admin_strikes_week() to authenticated;

revoke execute on function public.admin_drops_week(date), public.admin_lots(text, text, int, int),
                           public.admin_users(text, int, int), public.admin_strikes_week()
  from anon;
