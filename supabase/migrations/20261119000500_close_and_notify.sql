-- =============================================================================
-- Closing (bookkeeping after ends_at) + notifications + push dispatch + cron.
-- Bidding never depends on this running: place_bid checks ends_at itself.
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- Calling Edge Functions from Postgres (push, payouts).
-- Needs two Vault secrets; if either is missing this is a no-op:
--   edge_functions_url  e.g. https://<ref>.supabase.co/functions/v1
--   internal_fn_secret  shared secret, also set as INTERNAL_FN_SECRET on functions
-- -----------------------------------------------------------------------------
create function private.call_edge_function(p_name text, p_body jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'internal_fn_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/' || p_name,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    timeout_milliseconds := 10000
  );
exception when others then
  -- Never let a notification side effect break a bid or a close.
  raise warning 'call_edge_function(%) failed: %', p_name, sqlerrm;
end;
$$;

-- Push only for users who have subscribed a device.
create function private.on_notification_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    perform private.call_edge_function('push', jsonb_build_object('notification_id', new.id));
  end if;
  return null;
end;
$$;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function private.on_notification_push();

-- The push function claims notifications atomically so each is pushed once.
create function public.claim_push_notifications(p_notification_id uuid default null, p_limit int default 100)
returns table (id uuid, user_id uuid, type text, payload jsonb)
language sql security definer set search_path = ''
as $$
  update public.notifications n
     set pushed_at = clock_timestamp()
   where n.id in (
     select x.id from public.notifications x
      where x.pushed_at is null
        and (p_notification_id is null or x.id = p_notification_id)
        and x.created_at > now() - interval '1 hour'
        and exists (select 1 from public.push_subscriptions s where s.user_id = x.user_id)
      order by x.created_at
      limit p_limit
      for update skip locked)
  returning n.id, n.user_id, n.type, n.payload
$$;
grant execute on function public.claim_push_notifications(uuid, int) to service_role;

create function public.mark_notifications_read()
returns void
language sql security definer set search_path = ''
as $$
  update public.notifications set read_at = clock_timestamp()
   where user_id = auth.uid() and read_at is null
$$;
grant execute on function public.mark_notifications_read() to authenticated;

-- -----------------------------------------------------------------------------
-- close_due_auctions: called by cron every ~5s. Idempotent: guarded by
-- closed_at is null, and orders are unique per (auction, offer_round).
-- -----------------------------------------------------------------------------
create function public.close_due_auctions(p_limit int default 500)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  r        record;
  a        public.auctions;
  v_count  int := 0;
  v_order  uuid;
  v_comm   bigint;
  v_pay_by timestamptz;
begin
  for r in
    select x.id from public.auctions x
     where x.closed_at is null and x.ends_at <= clock_timestamp()
     order by x.ends_at
     limit p_limit
     for update skip locked      -- a bid in flight holds the lock: we'll get it next run
  loop
    -- Re-check under the lock: a last-second bid may have extended ends_at.
    update public.auctions
       set closed_at = clock_timestamp(),
           outcome = case when leader_id is null then 'unsold' else 'sold' end
     where id = r.id and closed_at is null and ends_at <= clock_timestamp()
    returning * into a;
    continue when not found;
    v_count := v_count + 1;

    if a.outcome = 'sold' then
      v_comm := private.commission_for(a.current_bid);
      v_pay_by := clock_timestamp() + make_interval(mins => private.setting('pay_window_minutes')::int);
      v_order := null;
      insert into public.orders (auction_id, offer_round, buyer_id, seller_id, amount, commission,
                                 payout_amount, pay_by)
      values (a.id, 1, a.leader_id, a.seller_id, a.current_bid, v_comm, a.current_bid - v_comm, v_pay_by)
      on conflict (auction_id, offer_round) do nothing
      returning id into v_order;

      if v_order is not null then
        perform private.notify(a.leader_id, 'won', jsonb_build_object(
          'auction_id', a.id, 'order_id', v_order, 'title', a.title,
          'amount', a.current_bid, 'pay_by', v_pay_by));
        perform private.notify(a.seller_id, 'sold', jsonb_build_object(
          'auction_id', a.id, 'order_id', v_order, 'title', a.title, 'amount', a.current_bid));
      end if;
    else
      perform private.notify(a.seller_id, 'unsold', jsonb_build_object('auction_id', a.id, 'title', a.title));
    end if;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cron (Supabase Cron = pg_cron). Sub-minute schedules need pg_cron >= 1.5.
-- -----------------------------------------------------------------------------
select cron.schedule('close-due-auctions', '5 seconds', $$select public.close_due_auctions()$$);
-- 00:05 Lagos = 23:05 UTC: keep a week of daily 7pm drops scheduled.
select cron.schedule('ensure-upcoming-drops', '5 23 * * *', $$select public.ensure_upcoming_drops(7)$$);
-- Push fallback: drain anything the per-insert trigger missed.
select cron.schedule('push-drain', '* * * * *',
  $$select private.call_edge_function('push', '{}'::jsonb)
     where exists (select 1 from public.notifications n
                    where n.pushed_at is null and n.created_at < now() - interval '30 seconds'
                      and n.created_at > now() - interval '1 hour'
                      and exists (select 1 from public.push_subscriptions s where s.user_id = n.user_id))$$);
-- 5-second jobs log ~17k rows/day: keep two days of run history.
select cron.schedule('cron-history-cleanup', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '2 days'$$);
