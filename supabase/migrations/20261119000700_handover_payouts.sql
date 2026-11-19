-- =============================================================================
-- Handover + payouts. The seller enters the buyer's 6-digit code at pickup;
-- that marks the order handed_over and queues a Paystack transfer.
-- =============================================================================

-- Seller only. Returns: ok | already_confirmed | wrong_code | locked
-- (Wrong codes return instead of raising so the attempt counter persists.)
create function public.confirm_handover(p_order_id uuid, p_code text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := private.require_verified_user();
  v_max  int := private.setting('handover_max_attempts')::int;
  o      public.orders;
  v_title text;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.seller_id <> v_uid then
    perform private.raise_app('not_found');
  end if;
  if o.status in ('handed_over', 'paid_out') then
    return 'already_confirmed';
  end if;
  if o.status <> 'paid' or o.handover_code_hash is null then
    perform private.raise_app('not_confirmable');
  end if;
  if o.handover_attempts >= v_max then
    return 'locked';
  end if;

  if extensions.crypt(btrim(coalesce(p_code, '')), o.handover_code_hash) <> o.handover_code_hash then
    update public.orders set handover_attempts = handover_attempts + 1 where id = o.id;
    if o.handover_attempts + 1 >= v_max then
      perform private.alert('handover_locked', o.id, jsonb_build_object('attempts', o.handover_attempts + 1));
      return 'locked';
    end if;
    return 'wrong_code';
  end if;

  update public.orders set status = 'handed_over', handed_over_at = clock_timestamp() where id = o.id;
  insert into public.payouts (order_id, seller_id, amount)
  values (o.id, o.seller_id, o.payout_amount)
  on conflict (order_id) do nothing;

  select title into v_title from public.auctions where id = o.auction_id;
  perform private.notify(o.seller_id, 'handed_over', jsonb_build_object(
    'order_id', o.id, 'auction_id', o.auction_id, 'title', v_title, 'payout_amount', o.payout_amount));
  perform private.call_edge_function('payout', '{}'::jsonb);
  return 'ok';
end;
$$;
grant execute on function public.confirm_handover(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Payout processing (service role, used by the payout Edge Function).
-- -----------------------------------------------------------------------------

-- Atomically claim pending payouts whose seller has a Paystack recipient.
create function public.claim_payouts(p_limit int default 20)
returns table (payout_id uuid, order_id uuid, amount bigint, recipient_code text, title text)
language sql security definer set search_path = ''
as $$
  with picked as (
    select p.id from public.payouts p
     where (p.status = 'pending'
            -- Crashed between claim and transfer: safe to retry, the transfer
            -- reference is the payout id and Paystack dedupes on it.
            or (p.status = 'processing' and p.paystack_transfer_code is null
                and p.updated_at < now() - interval '15 minutes'))
       and exists (select 1 from public.seller_bank b
                    where b.seller_id = p.seller_id and b.paystack_recipient_code is not null)
     order by p.created_at
     limit p_limit
     for update skip locked
  )
  update public.payouts p
     set status = 'processing', attempts = p.attempts + 1, updated_at = clock_timestamp()
    from picked, public.seller_bank b, public.orders o, public.auctions a
   where p.id = picked.id and b.seller_id = p.seller_id and o.id = p.order_id and a.id = o.auction_id
  returning p.id, p.order_id, p.amount, b.paystack_recipient_code, a.title
$$;

create function public.payout_transfer_started(p_payout_id uuid, p_transfer_code text)
returns void
language sql security definer set search_path = ''
as $$
  update public.payouts set paystack_transfer_code = p_transfer_code, updated_at = clock_timestamp()
   where id = p_payout_id
$$;

-- Final transfer result from the webhook (or the API response). Idempotent.
create function public.payout_transfer_result(p_payout_id text, p_result text, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p       public.payouts;
  v_id    uuid;
  v_title text;
begin
  begin
    v_id := p_payout_id::uuid;
  exception when invalid_text_representation then
    return;  -- not one of our transfer references
  end;

  if p_result = 'success' then
    update public.payouts set status = 'success', failure_reason = null, updated_at = clock_timestamp()
     where id = v_id and status in ('pending', 'processing', 'failed')
    returning * into p;
    if not found then return; end if;
    update public.orders set status = 'paid_out', paid_out_at = clock_timestamp()
     where id = p.order_id and status = 'handed_over';
    select a.title into v_title from public.orders o join public.auctions a on a.id = o.auction_id where o.id = p.order_id;
    perform private.notify(p.seller_id, 'payout_sent', jsonb_build_object(
      'payout_id', p.id, 'order_id', p.order_id, 'title', v_title, 'amount', p.amount));
  elsif p_result in ('failed', 'reversed') then
    update public.payouts set status = p_result, failure_reason = p_reason, updated_at = clock_timestamp()
     where id = v_id and status in ('pending', 'processing', 'success')
       and status <> p_result
    returning * into p;
    if not found then return; end if;
    -- A reversed transfer means the money came back: the order is no longer paid out.
    update public.orders set status = 'handed_over', paid_out_at = null
     where id = p.order_id and status = 'paid_out';
    select a.title into v_title from public.orders o join public.auctions a on a.id = o.auction_id where o.id = p.order_id;
    perform private.alert('payout_' || p_result, p.order_id, jsonb_build_object('payout_id', p.id, 'reason', p_reason));
    perform private.notify(p.seller_id, 'payout_failed', jsonb_build_object(
      'payout_id', p.id, 'order_id', p.order_id, 'title', v_title, 'amount', p.amount));
  end if;
end;
$$;

revoke execute on function public.claim_payouts(int) from public, anon, authenticated;
revoke execute on function public.payout_transfer_started(uuid, text) from public, anon, authenticated;
revoke execute on function public.payout_transfer_result(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_payouts(int) to service_role;
grant execute on function public.payout_transfer_started(uuid, text) to service_role;
grant execute on function public.payout_transfer_result(text, text, text) to service_role;

-- Bank details are written by the seller-bank Edge Function after Paystack
-- resolves the account and creates a transfer recipient.
create function public.save_seller_bank(p_seller_id uuid, p_bank_code text, p_bank_name text,
                                        p_account_number text, p_account_name text, p_recipient_code text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.seller_bank (seller_id, bank_code, bank_name, account_number, account_name,
                                  paystack_recipient_code, updated_at)
  values (p_seller_id, p_bank_code, p_bank_name, p_account_number, p_account_name, p_recipient_code, clock_timestamp())
  on conflict (seller_id) do update
     set bank_code = excluded.bank_code, bank_name = excluded.bank_name,
         account_number = excluded.account_number, account_name = excluded.account_name,
         paystack_recipient_code = excluded.paystack_recipient_code, updated_at = excluded.updated_at;
  -- Release anything that was waiting for bank details.
  if exists (select 1 from public.payouts where seller_id = p_seller_id and status = 'pending') then
    perform private.call_edge_function('payout', '{}'::jsonb);
  end if;
end;
$$;
revoke execute on function public.save_seller_bank(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_seller_bank(uuid, text, text, text, text, text) to service_role;

-- Sweep: pick up pending payouts (e.g. after a failed pg_net call).
select cron.schedule('payout-sweep', '*/2 * * * *',
  $$select private.call_edge_function('payout', '{}'::jsonb)
     where exists (select 1 from public.payouts where status = 'pending')$$);
