-- =============================================================================
-- Row Level Security + grants.
-- Golden rule: clients never write auctions/bids/orders directly. All writes go
-- through security-definer RPCs that use auth.uid().
-- =============================================================================

alter table public.profiles           enable row level security;
alter table public.drops              enable row level security;
alter table public.auctions           enable row level security;
alter table public.auction_photos     enable row level security;
alter table public.bids               enable row level security;
alter table public.auction_bidders    enable row level security;
alter table public.orders             enable row level security;
alter table public.payouts            enable row level security;
alter table public.seller_bank        enable row level security;
alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;

-- Policies call this helper as the client role. Only this one private function is
-- executable by clients; the private schema is not exposed through the API.
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

-- Start from nothing, then grant exactly what the client needs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- profiles --------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (display_name, area) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- drops -----------------------------------------------------------------------
grant select on public.drops to anon, authenticated;

create policy drops_select on public.drops
  for select to anon, authenticated
  using (status = 'published' or (select private.is_admin()));

-- auctions: readable, but leader_id is never exposed (masked as bidder_no) -----
grant select (id, drop_id, seller_id, slot, title, description, condition, category, area,
              start_price, step, current_bid, bid_count, starts_at, ends_at, closed_at,
              outcome, relisted_from, created_at)
  on public.auctions to anon, authenticated;

create policy auctions_select on public.auctions
  for select to anon, authenticated
  using (
    exists (select 1 from public.drops d where d.id = drop_id and d.status = 'published')
    or seller_id = (select auth.uid())
    or (select private.is_admin())
  );

-- auction_photos --------------------------------------------------------------
grant select on public.auction_photos to anon, authenticated;
create policy auction_photos_select on public.auction_photos
  for select to anon, authenticated using (true);

-- bids: a user sees only their own bids ---------------------------------------
grant select on public.bids to authenticated;
create policy bids_select_own on public.bids
  for select to authenticated
  using (bidder_id = (select auth.uid()) or (select private.is_admin()));

-- auction_bidders: a user sees only their own pseudonym -----------------------
grant select on public.auction_bidders to authenticated;
create policy auction_bidders_select_own on public.auction_bidders
  for select to authenticated
  using (bidder_id = (select auth.uid()) or (select private.is_admin()));

-- orders: buyer and seller only; the handover hash is never readable ----------
grant select (id, auction_id, offer_round, buyer_id, seller_id, amount, commission,
              payout_amount, status, pay_by, paystack_reference, handover_attempts,
              dispute_reason, paid_at, handed_over_at, paid_out_at, created_at)
  on public.orders to authenticated;

create policy orders_select_party on public.orders
  for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
         or (select private.is_admin()));

-- payouts ---------------------------------------------------------------------
grant select on public.payouts to authenticated;
create policy payouts_select_own on public.payouts
  for select to authenticated
  using (seller_id = (select auth.uid()) or (select private.is_admin()));

-- seller_bank: read own (writes happen in the bank Edge Function) --------------
grant select (seller_id, bank_code, bank_name, account_number, account_name, updated_at)
  on public.seller_bank to authenticated;
create policy seller_bank_select_own on public.seller_bank
  for select to authenticated
  using (seller_id = (select auth.uid()) or (select private.is_admin()));

-- notifications ---------------------------------------------------------------
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- push_subscriptions ----------------------------------------------------------
grant select, insert, delete on public.push_subscriptions to authenticated;
create policy push_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Tables created by later migrations must also opt in explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
