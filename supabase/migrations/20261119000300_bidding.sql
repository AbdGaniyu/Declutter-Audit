-- =============================================================================
-- Bidding: place_bid (the referee), realtime broadcast, read RPCs.
-- =============================================================================

-- Server clock for client offset calculation.
create function public.server_time()
returns timestamptz
language sql volatile
as $$ select clock_timestamp() $$;
grant execute on function public.server_time() to anon, authenticated;

-- Can the current user see this auction? (Mirrors the auctions RLS policy.)
create function private.can_view_auction(p_auction_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.auctions a
    join public.drops d on d.id = a.drop_id
    where a.id = p_auction_id
      and (d.status = 'published' or a.seller_id = auth.uid() or private.is_admin())
  )
$$;

create function private.leader_no(p_auction_id uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select ab.bidder_no
  from public.auctions a
  join public.auction_bidders ab on ab.auction_id = a.id and ab.bidder_id = a.leader_id
  where a.id = p_auction_id
$$;

-- Public, masked realtime payload for an auction.
create function private.auction_payload(a public.auctions)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id',          a.id,
    'current_bid', a.current_bid,
    'leader_no',   private.leader_no(a.id),
    'bid_count',   a.bid_count,
    'ends_at',     a.ends_at,
    'closed_at',   a.closed_at,
    'outcome',     a.outcome,
    'server_now',  clock_timestamp()
  )
$$;

-- -----------------------------------------------------------------------------
-- place_bid: one conditional UPDATE ... RETURNING decides the bid.
-- Row locking + READ COMMITTED re-evaluation of the WHERE clause guarantees
-- exactly one winner per price level under concurrency.
-- -----------------------------------------------------------------------------
create function public.place_bid(p_auction_id uuid, p_amount bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_profile     public.profiles;
  a             public.auctions;
  v_prev_leader uuid;
  v_bidder_no   int;
  v_now         timestamptz;
  v_reason      text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or not private.is_phone_verified(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'not_verified');
  end if;
  if v_profile.bidding_suspended then
    return jsonb_build_object('ok', false, 'reason', 'suspended');
  end if;
  if p_amount is null or p_amount <= 0 or p_amount % 100 <> 0 or p_amount > 5000000000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  -- The referee. clock_timestamp() is re-evaluated if we had to wait for the row lock.
  update public.auctions x
     set current_bid = p_amount,
         leader_id   = v_uid,
         bid_count   = x.bid_count + 1,
         ends_at     = greatest(x.ends_at, clock_timestamp() + interval '30 seconds')
   where x.id = p_auction_id
     and x.closed_at is null
     and x.outcome is null
     and x.starts_at <= clock_timestamp()
     and clock_timestamp() < x.ends_at
     and x.seller_id <> v_uid
     and x.leader_id is distinct from v_uid
     and p_amount >= coalesce(x.current_bid + x.step, x.start_price)
     and exists (select 1 from public.drops d where d.id = x.drop_id and d.status = 'published')
  returning * into a;

  if not found then
    v_now := clock_timestamp();
    select * into a from public.auctions where id = p_auction_id;
    if not found or not private.can_view_auction(p_auction_id) then
      v_reason := 'not_found';
    elsif a.outcome = 'cancelled' then
      v_reason := 'cancelled';
    elsif a.seller_id = v_uid then
      v_reason := 'own_lot';
    elsif v_now < a.starts_at then
      v_reason := 'not_started';
    elsif a.closed_at is not null or v_now >= a.ends_at then
      v_reason := 'ended';
    elsif a.leader_id = v_uid then
      v_reason := 'already_leading';
    else
      v_reason := 'too_low';
    end if;
    return jsonb_build_object(
      'ok', false,
      'reason', v_reason,
      'current_bid', a.current_bid,
      'min_next', coalesce(a.current_bid + a.step, a.start_price),
      'ends_at', a.ends_at,
      'server_now', v_now
    );
  end if;

  -- We hold the auction row lock: no other bid on this lot can interleave here.
  select b.bidder_id into v_prev_leader
    from public.bids b where b.auction_id = p_auction_id
    order by b.amount desc limit 1;

  insert into public.auction_bidders (auction_id, bidder_id, bidder_no)
  values (p_auction_id, v_uid,
          (select coalesce(max(bidder_no), 0) + 1 from public.auction_bidders
            where auction_id = p_auction_id))
  on conflict (auction_id, bidder_id) do nothing;

  select bidder_no into v_bidder_no from public.auction_bidders
   where auction_id = p_auction_id and bidder_id = v_uid;

  -- Fires the realtime broadcast trigger.
  insert into public.bids (auction_id, bidder_id, amount) values (p_auction_id, v_uid, p_amount);

  if v_prev_leader is not null and v_prev_leader <> v_uid then
    perform private.notify(v_prev_leader, 'outbid', jsonb_build_object(
      'auction_id', a.id, 'title', a.title, 'current_bid', a.current_bid, 'ends_at', a.ends_at));
  end if;

  return jsonb_build_object(
    'ok', true,
    'current_bid', a.current_bid,
    'min_next', a.current_bid + a.step,
    'bid_count', a.bid_count,
    'ends_at', a.ends_at,
    'bidder_no', v_bidder_no,
    'server_now', clock_timestamp()
  );
end;
$$;
grant execute on function public.place_bid(uuid, bigint) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: Broadcast from Database on private topic auction:<id>.
-- -----------------------------------------------------------------------------
create function private.broadcast_auction(p_auction_id uuid, p_event text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare a public.auctions;
begin
  select * into a from public.auctions where id = p_auction_id;
  if found then
    perform realtime.send(private.auction_payload(a), p_event, 'auction:' || a.id::text, true);
  end if;
end;
$$;

create function private.on_bid_inserted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.broadcast_auction(new.auction_id, 'bid');
  return null;
end;
$$;
create trigger bids_broadcast
  after insert on public.bids
  for each row execute function private.on_bid_inserted();

create function private.on_auction_closed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.broadcast_auction(new.id, 'closed');
  return null;
end;
$$;
create trigger auctions_closed_broadcast
  after update of closed_at on public.auctions
  for each row when (old.closed_at is null and new.closed_at is not null)
  execute function private.on_auction_closed();

-- Per-user in-app notifications on topic user:<uid>.
create function private.on_notification_inserted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'type', new.type, 'payload', new.payload,
                       'created_at', new.created_at),
    'notification', 'user:' || new.user_id::text, true);
  return null;
end;
$$;
create trigger notifications_broadcast
  after insert on public.notifications
  for each row execute function private.on_notification_inserted();

-- Clients may only RECEIVE: auction topics (anyone) and their own user topic.
-- No insert policy exists, so clients cannot send forged broadcasts.
create policy realtime_receive on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      realtime.topic() like 'auction:%'
      or realtime.topic() = 'user:' || (select auth.uid())::text
    )
  );

-- -----------------------------------------------------------------------------
-- Read RPCs
-- -----------------------------------------------------------------------------

-- Full lot view for the lot page. Also used to resync on reconnect/focus.
create function public.get_lot(p_auction_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a     public.auctions;
  d     public.drops;
  v_my_no int;
  v_leader_no int;
begin
  if not private.can_view_auction(p_auction_id) then
    return null;
  end if;
  select * into a from public.auctions where id = p_auction_id;
  select * into d from public.drops where id = a.drop_id;
  v_leader_no := private.leader_no(a.id);
  if v_uid is not null then
    select bidder_no into v_my_no from public.auction_bidders
     where auction_id = a.id and bidder_id = v_uid;
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
    'seller_name', (select coalesce(p.display_name, 'Seller') from public.profiles p where p.id = a.seller_id),
    'is_seller', a.seller_id = v_uid,
    'my_bidder_no', v_my_no,
    'you_are_leading', v_uid is not null and a.leader_id = v_uid,
    'my_max_bid', (select max(b.amount) from public.bids b where b.auction_id = a.id and b.bidder_id = v_uid),
    'photos', coalesce((select jsonb_agg(p.storage_path order by p.position)
                          from public.auction_photos p where p.auction_id = a.id), '[]'::jsonb),
    'server_now', clock_timestamp()
  );
end;
$$;
grant execute on function public.get_lot(uuid) to anon, authenticated;

-- Masked bid history (latest first).
create function public.get_bid_history(p_auction_id uuid, p_limit int default 20)
returns table (bidder_no int, amount bigint, created_at timestamptz, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  select ab.bidder_no, b.amount, b.created_at, b.bidder_id = auth.uid()
  from public.bids b
  join public.auction_bidders ab on ab.auction_id = b.auction_id and ab.bidder_id = b.bidder_id
  where b.auction_id = p_auction_id
    and private.can_view_auction(p_auction_id)
  order by b.amount desc
  limit least(greatest(p_limit, 1), 100)
$$;
grant execute on function public.get_bid_history(uuid, int) to anon, authenticated;

-- The current user's bidding activity.
create function public.my_bids()
returns table (auction_id uuid, title text, area text, ends_at timestamptz, closed_at timestamptz,
               outcome text, current_bid bigint, my_max_bid bigint, is_leading boolean)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, a.area, a.ends_at, a.closed_at, a.outcome, a.current_bid,
         max(b.amount), a.leader_id = auth.uid()
  from public.bids b
  join public.auctions a on a.id = b.auction_id
  where b.bidder_id = auth.uid()
  group by a.id
  order by a.ends_at desc
  limit 100
$$;
grant execute on function public.my_bids() to authenticated;
