-- =============================================================================
-- Payments (Paystack). Edge Functions hold the secret key and call these
-- service-role-only functions. Everything here is safe to call twice.
-- =============================================================================

alter table public.orders add column refunded_at timestamptz;

-- Ops alerts for the admin panel (amount mismatches, failed payouts, ...).
create table public.ops_alerts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  order_id    uuid references public.orders (id),
  detail      jsonb not null default '{}',
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.ops_alerts enable row level security;
grant select, update (resolved_at) on public.ops_alerts to authenticated;
create policy ops_alerts_admin on public.ops_alerts
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create function private.alert(p_kind text, p_order uuid, p_detail jsonb)
returns void
language sql security definer set search_path = ''
as $$ insert into public.ops_alerts (kind, order_id, detail) values (p_kind, p_order, p_detail) $$;

-- -----------------------------------------------------------------------------
-- Handover code: 6 digits derived from HMAC(secret, order_id). Nothing in
-- plaintext is stored; the bcrypt hash on the order is what the seller's entry
-- is checked against.
-- -----------------------------------------------------------------------------
create function private.handover_code(p_order_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select lpad(
    ((('x' || substr(encode(extensions.hmac(p_order_id::text, private.setting('handover_secret'), 'sha256'), 'hex'), 1, 7))::bit(28)::int)
      % 1000000)::text,
    6, '0')
$$;

-- Buyer-only: show the code for a paid order.
create function public.get_handover_code(p_order_id uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.orders o
                  where o.id = p_order_id and o.buyer_id = auth.uid() and o.status = 'paid') then
    return null;
  end if;
  return private.handover_code(p_order_id);
end;
$$;
grant execute on function public.get_handover_code(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Checkout bookkeeping (service role).
-- -----------------------------------------------------------------------------

-- What paystack-init needs, checked against the caller.
create function public.order_for_checkout(p_order_id uuid, p_buyer_id uuid)
returns table (id uuid, amount bigint, status text, pay_by timestamptz, title text,
               paystack_access_code text, paystack_authorization_url text)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.amount, o.status, o.pay_by, a.title, o.paystack_access_code, o.paystack_authorization_url
  from public.orders o join public.auctions a on a.id = o.auction_id
  where o.id = p_order_id and o.buyer_id = p_buyer_id
$$;

create function public.set_order_checkout(p_order_id uuid, p_access_code text, p_authorization_url text)
returns void
language sql security definer set search_path = ''
as $$
  update public.orders
     set paystack_reference = p_order_id::text,
         paystack_access_code = coalesce(paystack_access_code, p_access_code),
         paystack_authorization_url = coalesce(paystack_authorization_url, p_authorization_url)
   where id = p_order_id and status = 'awaiting_payment'
$$;

-- -----------------------------------------------------------------------------
-- mark_order_paid: called after the Edge Function has verified the transaction
-- with Paystack's API. reference = order id. Returns one of:
--   paid | duplicate | late | amount_mismatch | not_found
-- A payment that lands while the order is still awaiting_payment is accepted,
-- even a little after pay_by: expiry and payment serialize on the row lock.
-- -----------------------------------------------------------------------------
create function public.mark_order_paid(p_reference text, p_amount bigint, p_currency text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  o       public.orders;
  v_id    uuid;
  v_title text;
begin
  begin
    v_id := p_reference::uuid;
  exception when invalid_text_representation then
    return 'not_found';
  end;

  select * into o from public.orders where id = v_id for update;
  if not found then
    return 'not_found';
  end if;
  if o.status in ('paid', 'handed_over', 'paid_out', 'disputed', 'refunded')
     or (o.status = 'expired' and o.refunded_at is not null) then
    return 'duplicate';
  end if;
  if p_currency <> 'NGN' or p_amount <> o.amount then
    perform private.alert('amount_mismatch', o.id,
      jsonb_build_object('expected', o.amount, 'received', p_amount, 'currency', p_currency));
    return 'amount_mismatch';
  end if;
  if o.status <> 'awaiting_payment' then
    return 'late';   -- expired or declined: the Edge Function refunds it
  end if;

  update public.orders
     set status = 'paid',
         paid_at = clock_timestamp(),
         paystack_reference = o.id::text,
         handover_code_hash = extensions.crypt(private.handover_code(o.id), extensions.gen_salt('bf', 8))
   where id = o.id;

  select title into v_title from public.auctions where id = o.auction_id;
  perform private.notify(o.buyer_id, 'payment_confirmed', jsonb_build_object(
    'order_id', o.id, 'auction_id', o.auction_id, 'title', v_title, 'amount', o.amount));
  perform private.notify(o.seller_id, 'buyer_paid', jsonb_build_object(
    'order_id', o.id, 'auction_id', o.auction_id, 'title', v_title, 'amount', o.amount,
    'payout_amount', o.payout_amount));
  return 'paid';
end;
$$;

-- A late payment was refunded through Paystack.
create function public.record_late_payment_refund(p_reference text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders; v_title text;
begin
  update public.orders set refunded_at = clock_timestamp()
   where id = p_reference::uuid and status in ('expired', 'declined') and refunded_at is null
  returning * into o;
  if found then
    select title into v_title from public.auctions where id = o.auction_id;
    perform private.notify(o.buyer_id, 'payment_late_refunded', jsonb_build_object(
      'order_id', o.id, 'auction_id', o.auction_id, 'title', v_title, 'amount', o.amount));
  end if;
end;
$$;

-- Webhook audit log (dedup by Paystack event + data id).
create function public.log_paystack_event(p_event text, p_data_id text, p_reference text, p_payload jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.paystack_events (event, data_id, reference, payload)
  values (p_event, p_data_id, p_reference, p_payload);
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- Only the service role (Edge Functions) may call these.
revoke execute on function public.order_for_checkout(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.set_order_checkout(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(text, bigint, text) from public, anon, authenticated;
revoke execute on function public.record_late_payment_refund(text) from public, anon, authenticated;
revoke execute on function public.log_paystack_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.order_for_checkout(uuid, uuid) to service_role;
grant execute on function public.set_order_checkout(uuid, text, text) to service_role;
grant execute on function public.mark_order_paid(text, bigint, text) to service_role;
grant execute on function public.record_late_payment_refund(text) to service_role;
grant execute on function public.log_paystack_event(text, text, text, jsonb) to service_role;

-- Orders with lot info for the buyer/seller pages.
create function public.my_orders(p_role text default 'buyer')
returns table (id uuid, auction_id uuid, title text, area text, photo text, offer_round smallint,
               amount bigint, commission bigint, payout_amount bigint, status text, pay_by timestamptz,
               paid_at timestamptz, handed_over_at timestamptz, paid_out_at timestamptz,
               refunded_at timestamptz, created_at timestamptz, counterpart_name text,
               counterpart_phone text)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.auction_id, a.title, a.area,
         (select p.storage_path from public.auction_photos p where p.auction_id = a.id order by p.position limit 1),
         o.offer_round, o.amount, o.commission, o.payout_amount, o.status, o.pay_by, o.paid_at,
         o.handed_over_at, o.paid_out_at, o.refunded_at, o.created_at,
         cp.display_name,
         -- Phone numbers are only shared once the buyer has paid, to arrange pickup.
         case when o.status in ('paid', 'handed_over', 'paid_out', 'disputed') then cp.phone end
  from public.orders o
  join public.auctions a on a.id = o.auction_id
  join public.profiles cp on cp.id = case when p_role = 'seller' then o.buyer_id else o.seller_id end
  where (p_role = 'seller' and o.seller_id = auth.uid())
     or (p_role <> 'seller' and o.buyer_id = auth.uid())
  order by o.created_at desc
  limit 100
$$;
grant execute on function public.my_orders(text) to authenticated;
