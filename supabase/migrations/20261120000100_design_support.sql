-- =============================================================================
-- Data the DESIGN.md screens need.
-- =============================================================================

-- Sell flow takes 3–8 photos.
update private.settings set value = '8' where key = 'max_photos_per_lot';

-- -----------------------------------------------------------------------------
-- Handover code: 5 tries per hour (rolling window), not a permanent lock.
-- -----------------------------------------------------------------------------
alter table public.orders add column handover_window_started_at timestamptz;

drop function public.confirm_handover(uuid, text);

-- Seller only. Returns { result: ok | already_confirmed | wrong_code | locked,
--                        tries_left?, retry_at? }
create function public.confirm_handover(p_order_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := private.require_verified_user();
  v_max    int := private.setting('handover_max_attempts')::int;
  o        public.orders;
  v_count  int;
  v_window timestamptz;
  v_title  text;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.seller_id <> v_uid then
    perform private.raise_app('not_found');
  end if;
  if o.status in ('handed_over', 'paid_out') then
    return jsonb_build_object('result', 'already_confirmed');
  end if;
  if o.status <> 'paid' or o.handover_code_hash is null then
    perform private.raise_app('not_confirmable');
  end if;

  -- Attempts only count within the current hour.
  if o.handover_window_started_at is null or o.handover_window_started_at < clock_timestamp() - interval '1 hour' then
    v_count := 0;
    v_window := null;
  else
    v_count := o.handover_attempts;
    v_window := o.handover_window_started_at;
  end if;
  if v_count >= v_max then
    return jsonb_build_object('result', 'locked', 'retry_at', v_window + interval '1 hour');
  end if;

  if extensions.crypt(btrim(coalesce(p_code, '')), o.handover_code_hash) <> o.handover_code_hash then
    v_count := v_count + 1;
    v_window := coalesce(v_window, clock_timestamp());
    update public.orders set handover_attempts = v_count, handover_window_started_at = v_window where id = o.id;
    if v_count >= v_max then
      perform private.alert('handover_locked', o.id, jsonb_build_object('attempts', v_count, 'window_started_at', v_window));
      return jsonb_build_object('result', 'locked', 'retry_at', v_window + interval '1 hour');
    end if;
    return jsonb_build_object('result', 'wrong_code', 'tries_left', v_max - v_count);
  end if;

  update public.orders set status = 'handed_over', handed_over_at = clock_timestamp() where id = o.id;
  insert into public.payouts (order_id, seller_id, amount)
  values (o.id, o.seller_id, o.payout_amount)
  on conflict (order_id) do nothing;

  select title into v_title from public.auctions where id = o.auction_id;
  perform private.notify(o.seller_id, 'handed_over', jsonb_build_object(
    'order_id', o.id, 'auction_id', o.auction_id, 'title', v_title, 'payout_amount', o.payout_amount));
  perform private.call_edge_function('payout', '{}'::jsonb);
  return jsonb_build_object('result', 'ok');
end;
$$;
grant execute on function public.confirm_handover(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- get_lot: seller trust signals, my suspension and my order for this lot.
-- -----------------------------------------------------------------------------
create or replace function public.get_lot(p_auction_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  a           public.auctions;
  d           public.drops;
  s           public.profiles;
  v_my_no     int;
  v_leader_no int;
  v_order     jsonb;
  v_suspended boolean := false;
begin
  if not private.can_view_auction(p_auction_id) then
    return null;
  end if;
  select * into a from public.auctions where id = p_auction_id;
  select * into d from public.drops where id = a.drop_id;
  select * into s from public.profiles where id = a.seller_id;
  v_leader_no := private.leader_no(a.id);
  if v_uid is not null then
    select bidder_no into v_my_no from public.auction_bidders
     where auction_id = a.id and bidder_id = v_uid;
    select coalesce(p.bidding_suspended, false) into v_suspended from public.profiles p where p.id = v_uid;
    select jsonb_build_object('id', o.id, 'status', o.status, 'pay_by', o.pay_by,
                              'offer_round', o.offer_round, 'amount', o.amount)
      into v_order
      from public.orders o
     where o.auction_id = a.id and o.buyer_id = v_uid
     order by o.offer_round desc
     limit 1;
  end if;

  return jsonb_build_object(
    'id', a.id, 'drop_id', a.drop_id, 'drop_title', d.title,
    'title', a.title, 'description', a.description, 'condition', a.condition,
    'category', a.category, 'area', a.area,
    'start_price', a.start_price, 'step', a.step,
    'current_bid', a.current_bid, 'bid_count', a.bid_count,
    'min_next', coalesce(a.current_bid + a.step, a.start_price),
    'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'closed_at', a.closed_at, 'outcome', a.outcome,
    'leader_no', v_leader_no,
    'seller_name', coalesce(s.display_name, 'Seller'),
    'seller_verified', private.is_phone_verified(a.seller_id),
    'seller_since', s.created_at,
    'is_seller', a.seller_id = v_uid,
    'my_bidder_no', v_my_no,
    'my_suspended', v_suspended,
    'my_verified', v_uid is not null and private.is_phone_verified(v_uid),
    'my_order', v_order,
    'you_are_leading', v_uid is not null and a.leader_id = v_uid,
    'my_max_bid', (select max(b.amount) from public.bids b where b.auction_id = a.id and b.bidder_id = v_uid),
    'photos', coalesce((select jsonb_agg(p.storage_path order by p.position)
                          from public.auction_photos p where p.auction_id = a.id), '[]'::jsonb),
    'server_now', clock_timestamp()
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- "Remind me" for a drop: a notification (and push) when it goes live.
-- -----------------------------------------------------------------------------
create table public.drop_reminders (
  drop_id     uuid not null references public.drops (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (drop_id, user_id)
);
alter table public.drop_reminders enable row level security;
grant select on public.drop_reminders to authenticated;
create policy drop_reminders_select_own on public.drop_reminders
  for select to authenticated using (user_id = (select auth.uid()));

create function public.set_drop_reminder(p_drop_id uuid, p_on boolean default true)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.raise_app('not_authenticated'); end if;
  if p_on then
    if not exists (select 1 from public.drops where id = p_drop_id and status = 'published'
                    and opens_at > clock_timestamp()) then
      perform private.raise_app('drop_not_found');
    end if;
    insert into public.drop_reminders (drop_id, user_id) values (p_drop_id, v_uid)
    on conflict do nothing;
  else
    delete from public.drop_reminders where drop_id = p_drop_id and user_id = v_uid;
  end if;
end;
$$;
grant execute on function public.set_drop_reminder(uuid, boolean) to authenticated;

-- Cron, every minute. Idempotent via notified_at.
create function public.send_drop_reminders()
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_count int;
begin
  with due as (
    update public.drop_reminders r
       set notified_at = clock_timestamp()
      from public.drops d
     where d.id = r.drop_id and r.notified_at is null and d.status = 'published'
       and d.opens_at <= clock_timestamp() and d.opens_at > clock_timestamp() - interval '30 minutes'
    returning r.user_id, d.id as drop_id, d.title, d.first_close_at
  )
  select count(*) into v_count from (
    select private.notify(user_id, 'drop_live', jsonb_build_object(
             'drop_id', drop_id, 'title', title, 'first_close_at', first_close_at))
      from due) x;
  return v_count;
end;
$$;
select cron.schedule('send-drop-reminders', '* * * * *', $$select public.send_drop_reminders()$$);

-- current_drops + whether the caller asked to be reminded.
drop function public.current_drops(int);
create function public.current_drops(p_limit int default 5)
returns table (id uuid, title text, opens_at timestamptz, first_close_at timestamptz,
               close_interval_seconds int, lot_count int, last_close_at timestamptz,
               accepting_listings boolean, reminded boolean, server_now timestamptz)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.title, d.opens_at, d.first_close_at,
         extract(epoch from d.close_interval)::int,
         count(a.id) filter (where a.outcome is distinct from 'cancelled')::int,
         coalesce(max(a.ends_at), d.first_close_at),
         clock_timestamp() < d.opens_at
           and count(a.id) filter (where a.outcome is distinct from 'cancelled') < d.max_lots,
         exists (select 1 from public.drop_reminders r where r.drop_id = d.id and r.user_id = auth.uid()),
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
-- Admin: drops calendar + lots per drop.
-- -----------------------------------------------------------------------------
create function public.admin_drops_calendar(p_days int default 14)
returns table (id uuid, title text, opens_at timestamptz, first_close_at timestamptz, status text,
               max_lots int, lots int, live_bids int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select d.id, d.title, d.opens_at, d.first_close_at, d.status, d.max_lots,
         (count(a.id) filter (where a.outcome is distinct from 'cancelled'))::int,
         coalesce(sum(a.bid_count), 0)::int
    from public.drops d
    left join public.auctions a on a.drop_id = d.id
   where d.opens_at >= date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos' - interval '1 day'
     and d.opens_at < now() + make_interval(days => least(greatest(p_days, 1), 60))
   group by d.id
   order by d.opens_at;
end;
$$;
grant execute on function public.admin_drops_calendar(int) to authenticated;

create function public.admin_drop_lots(p_drop_id uuid)
returns table (id uuid, title text, area text, seller_name text, start_price bigint, current_bid bigint,
               bid_count int, ends_at timestamptz, closed_at timestamptz, outcome text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select a.id, a.title, a.area, p.display_name, a.start_price, a.current_bid, a.bid_count,
         a.ends_at, a.closed_at, a.outcome
    from public.auctions a join public.profiles p on p.id = a.seller_id
   where a.drop_id = p_drop_id
   order by a.slot;
end;
$$;
grant execute on function public.admin_drop_lots(uuid) to authenticated;

-- Drops that are still taking listings (sell flow, relist). Not limited by how
-- many live drops exist.
create function public.listable_drops(p_limit int default 10)
returns table (id uuid, title text, opens_at timestamptz, lot_count int)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.title, d.opens_at,
         (select count(*) from public.auctions a where a.drop_id = d.id and a.outcome is distinct from 'cancelled')::int
  from public.drops d
  where d.status = 'published' and d.opens_at > clock_timestamp()
    and (select count(*) from public.auctions a where a.drop_id = d.id and a.outcome is distinct from 'cancelled') < d.max_lots
  order by d.opens_at
  limit least(greatest(p_limit, 1), 30)
$$;
grant execute on function public.listable_drops(int) to authenticated;
