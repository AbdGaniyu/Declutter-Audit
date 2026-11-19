-- =============================================================================
-- Strikes, second-chance offers, disputes and admin tools.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- expire_unpaid_orders: cron every ~30s. Idempotent: each order transitions
-- out of awaiting_payment exactly once (row lock + status guard).
--  * Winner (round 1) didn't pay → strike; 2 strikes suspends bidding.
--    The lot is offered to the runner-up at their highest bid (round 2).
--  * Second-chance (round 2) not paid → no strike, the sale falls through.
-- A short grace period lets an in-flight Paystack checkout land first.
-- -----------------------------------------------------------------------------
create function public.expire_unpaid_orders(p_limit int default 200)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  r           record;
  o           public.orders;
  p           public.profiles;
  v_grace     interval := make_interval(mins => private.setting('payment_grace_minutes')::int);
  v_max       int := private.setting('max_strikes')::int;
  v_title     text;
  v_runner    record;
  v_new       uuid;
  v_comm      bigint;
  v_pay_by    timestamptz;
  v_count     int := 0;
begin
  for r in
    select x.id from public.orders x
     where x.status = 'awaiting_payment' and x.pay_by + v_grace < clock_timestamp()
     order by x.pay_by
     limit p_limit
     for update skip locked
  loop
    update public.orders set status = 'expired'
     where id = r.id and status = 'awaiting_payment'
    returning * into o;
    continue when not found;
    v_count := v_count + 1;
    select title into v_title from public.auctions where id = o.auction_id;

    if o.offer_round = 1 then
      update public.profiles
         set strikes = strikes + 1,
             bidding_suspended = bidding_suspended or strikes + 1 >= v_max
       where id = o.buyer_id
      returning * into p;
      perform private.notify(o.buyer_id, 'order_expired', jsonb_build_object(
        'order_id', o.id, 'auction_id', o.auction_id, 'title', v_title, 'strikes', p.strikes));
      if p.strikes = v_max then
        perform private.notify(o.buyer_id, 'suspended', jsonb_build_object('strikes', p.strikes));
      end if;

      -- Runner-up: the highest bid from anyone else who is still allowed to bid.
      select b.bidder_id, max(b.amount) as amount into v_runner
        from public.bids b
        join public.profiles bp on bp.id = b.bidder_id
       where b.auction_id = o.auction_id
         and b.bidder_id <> o.buyer_id
         and not bp.bidding_suspended
       group by b.bidder_id
       order by max(b.amount) desc, min(b.created_at)
       limit 1;

      if found then
        v_comm := private.commission_for(v_runner.amount);
        v_pay_by := clock_timestamp() + make_interval(mins => private.setting('pay_window_minutes')::int);
        v_new := null;
        insert into public.orders (auction_id, offer_round, buyer_id, seller_id, amount, commission,
                                   payout_amount, pay_by)
        values (o.auction_id, 2, v_runner.bidder_id, o.seller_id, v_runner.amount, v_comm,
                v_runner.amount - v_comm, v_pay_by)
        on conflict (auction_id, offer_round) do nothing
        returning id into v_new;
        if v_new is not null then
          perform private.notify(v_runner.bidder_id, 'second_chance', jsonb_build_object(
            'order_id', v_new, 'auction_id', o.auction_id, 'title', v_title,
            'amount', v_runner.amount, 'pay_by', v_pay_by));
          perform private.notify(o.seller_id, 'buyer_defaulted', jsonb_build_object(
            'auction_id', o.auction_id, 'title', v_title, 'amount', v_runner.amount));
        end if;
      else
        update public.auctions set outcome = 'defaulted' where id = o.auction_id;
        perform private.notify(o.seller_id, 'sale_fell_through', jsonb_build_object(
          'auction_id', o.auction_id, 'title', v_title));
      end if;
    else
      update public.auctions set outcome = 'defaulted' where id = o.auction_id;
      perform private.notify(o.seller_id, 'sale_fell_through', jsonb_build_object(
        'auction_id', o.auction_id, 'title', v_title));
    end if;
  end loop;
  return v_count;
end;
$$;

select cron.schedule('expire-unpaid-orders', '30 seconds', $$select public.expire_unpaid_orders()$$);

-- The runner-up may turn a second-chance offer down (no strike).
create function public.decline_second_chance(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders; v_title text;
begin
  update public.orders set status = 'declined'
   where id = p_order_id and buyer_id = auth.uid() and offer_round = 2 and status = 'awaiting_payment'
  returning * into o;
  if not found then perform private.raise_app('not_payable'); end if;
  update public.auctions set outcome = 'defaulted' where id = o.auction_id;
  select title into v_title from public.auctions where id = o.auction_id;
  perform private.notify(o.seller_id, 'sale_fell_through', jsonb_build_object(
    'auction_id', o.auction_id, 'title', v_title));
end;
$$;
grant execute on function public.decline_second_chance(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Disputes: handled manually by admins in v1.
-- -----------------------------------------------------------------------------
create function public.open_dispute(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_verified_user();
  o     public.orders;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then perform private.raise_app('reason_required'); end if;
  update public.orders
     set status = 'disputed', dispute_reason = left(btrim(p_reason), 500)
   where id = p_order_id and status = 'paid' and v_uid in (buyer_id, seller_id)
  returning * into o;
  if not found then perform private.raise_app('not_disputable'); end if;
  perform private.alert('dispute', o.id, jsonb_build_object(
    'opened_by', case when v_uid = o.buyer_id then 'buyer' else 'seller' end, 'reason', o.dispute_reason));
  perform private.notify(case when v_uid = o.buyer_id then o.seller_id else o.buyer_id end,
    'dispute_opened', jsonb_build_object('order_id', o.id, 'auction_id', o.auction_id));
end;
$$;
grant execute on function public.open_dispute(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Admin
-- -----------------------------------------------------------------------------
create function private.require_admin()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then perform private.raise_app('forbidden'); end if;
  return auth.uid();
end;
$$;

-- Release a disputed order to the seller (as if the handover code was entered).
create function public.admin_release_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  perform private.require_admin();
  update public.orders set status = 'handed_over', handed_over_at = clock_timestamp()
   where id = p_order_id and status in ('disputed', 'paid')
  returning * into o;
  if not found then perform private.raise_app('not_found'); end if;
  insert into public.payouts (order_id, seller_id, amount) values (o.id, o.seller_id, o.payout_amount)
  on conflict (order_id) do nothing;
  update public.ops_alerts set resolved_at = clock_timestamp()
   where order_id = o.id and kind in ('dispute', 'handover_locked') and resolved_at is null;
  perform private.notify(o.buyer_id, 'dispute_resolved', jsonb_build_object('order_id', o.id, 'resolution', 'released'));
  perform private.notify(o.seller_id, 'dispute_resolved', jsonb_build_object('order_id', o.id, 'resolution', 'released'));
  perform private.call_edge_function('payout', '{}'::jsonb);
end;
$$;
grant execute on function public.admin_release_order(uuid) to authenticated;

-- Called by the admin-refund Edge Function after Paystack accepted the refund.
create function public.mark_order_refunded(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  update public.orders set status = 'refunded', refunded_at = clock_timestamp()
   where id = p_order_id and status in ('disputed', 'paid')
  returning * into o;
  if not found then return; end if;
  update public.auctions set outcome = 'defaulted' where id = o.auction_id;
  update public.ops_alerts set resolved_at = clock_timestamp()
   where order_id = o.id and kind in ('dispute', 'handover_locked') and resolved_at is null;
  perform private.notify(o.buyer_id, 'dispute_resolved', jsonb_build_object('order_id', o.id, 'resolution', 'refunded'));
  perform private.notify(o.seller_id, 'dispute_resolved', jsonb_build_object('order_id', o.id, 'resolution', 'refunded'));
end;
$$;
revoke execute on function public.mark_order_refunded(uuid) from public, anon, authenticated;
grant execute on function public.mark_order_refunded(uuid) to service_role;

create function public.admin_review_user(p_user_id uuid, p_reset_strikes boolean default true)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.profiles
     set bidding_suspended = false,
         strikes = case when p_reset_strikes then 0 else strikes end
   where id = p_user_id;
  if not found then perform private.raise_app('not_found'); end if;
  perform private.notify(p_user_id, 'unsuspended', '{}'::jsonb);
end;
$$;
grant execute on function public.admin_review_user(uuid, boolean) to authenticated;

create function public.admin_suspend_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.profiles set bidding_suspended = true where id = p_user_id;
end;
$$;
grant execute on function public.admin_suspend_user(uuid) to authenticated;

-- Pull a lot (e.g. prohibited item), even while live. Bids stay in history.
create function public.admin_cancel_auction(p_auction_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.auctions set outcome = 'cancelled', closed_at = clock_timestamp()
   where id = p_auction_id and closed_at is null;
  if not found then perform private.raise_app('not_cancellable'); end if;
end;
$$;
grant execute on function public.admin_cancel_auction(uuid) to authenticated;

create function public.admin_retry_payout(p_payout_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.payouts set status = 'pending', updated_at = clock_timestamp()
   where id = p_payout_id and status in ('failed', 'reversed');
  if not found then perform private.raise_app('not_found'); end if;
  perform private.call_edge_function('payout', '{}'::jsonb);
end;
$$;
grant execute on function public.admin_retry_payout(uuid) to authenticated;

-- Admin dashboard data in one round trip.
create function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'drops', coalesce((select jsonb_agg(d order by d.opens_at) from (
        select dr.id, dr.title, dr.opens_at, dr.first_close_at, dr.status, dr.max_lots,
               (select count(*) from public.auctions a where a.drop_id = dr.id and a.outcome is distinct from 'cancelled') as lots
          from public.drops dr
         where dr.opens_at > now() - interval '1 day'
         order by dr.opens_at limit 20) d), '[]'::jsonb),
    'disputes', coalesce((select jsonb_agg(x order by x.created_at) from (
        select o.id, o.amount, o.status, o.dispute_reason, o.created_at, a.title,
               b.display_name as buyer_name, b.phone as buyer_phone,
               s.display_name as seller_name, s.phone as seller_phone
          from public.orders o
          join public.auctions a on a.id = o.auction_id
          join public.profiles b on b.id = o.buyer_id
          join public.profiles s on s.id = o.seller_id
         where o.status = 'disputed') x), '[]'::jsonb),
    'alerts', coalesce((select jsonb_agg(al order by al.created_at desc) from (
        select id, kind, order_id, detail, created_at from public.ops_alerts
         where resolved_at is null order by created_at desc limit 50) al), '[]'::jsonb),
    'struck_users', coalesce((select jsonb_agg(u order by u.strikes desc) from (
        select id, display_name, phone, strikes, bidding_suspended from public.profiles
         where strikes > 0 or bidding_suspended order by strikes desc limit 100) u), '[]'::jsonb),
    'failed_payouts', coalesce((select jsonb_agg(p) from (
        select p.id, p.order_id, p.amount, p.status, p.failure_reason, p.attempts, p.updated_at
          from public.payouts p where p.status in ('failed', 'reversed')) p), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.admin_overview() to authenticated;
