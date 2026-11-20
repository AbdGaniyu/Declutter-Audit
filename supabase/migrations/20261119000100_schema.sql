-- =============================================================================
-- Declutter Auction: core schema (v1)
-- Money is integer kobo (bigint). Times are timestamptz (UTC in storage).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Internal schema: never exposed through PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- New functions in public are NOT executable by clients unless granted explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
-- PUBLIC's default EXECUTE can only be removed globally, not per schema.
alter default privileges for role postgres
  revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Settings (commission, secrets). Private.
-- -----------------------------------------------------------------------------
create table private.settings (
  key   text primary key,
  value text not null
);

insert into private.settings (key, value) values
  ('commission_bps', '800'),                       -- 8.00%
  ('pay_window_minutes', '30'),
  ('payment_grace_minutes', '2'),                  -- in-flight checkout grace after pay_by
  ('max_strikes', '2'),
  ('handover_max_attempts', '5'),
  ('handover_secret', encode(extensions.gen_random_bytes(32), 'hex'));

create function private.setting(p_key text)
returns text
language sql stable security definer set search_path = ''
as $$ select value from private.settings where key = p_key $$;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text check (char_length(display_name) between 1 and 40),
  phone             text,
  area              text check (char_length(area) <= 40),
  strikes           int not null default 0 check (strikes >= 0),
  bidding_suspended boolean not null default false,
  is_admin          boolean not null default false,
  created_at        timestamptz not null default now()
);

-- Create / sync profile rows from auth.users.
create function private.handle_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do update set phone = excluded.phone;
  return new;
end;
$$;

create trigger on_auth_user_changed
  after insert or update of phone on auth.users
  for each row execute function private.handle_auth_user();

-- Phone-verified = auth.users.phone_confirmed_at is set.
create function private.is_phone_verified(p_uid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select u.phone_confirmed_at is not null
                   from auth.users u where u.id = p_uid), false)
$$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

-- -----------------------------------------------------------------------------
-- Drops: scheduled batches of lots. "Live" is derived from time, not status.
-- -----------------------------------------------------------------------------
create table public.drops (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 80),
  opens_at       timestamptz not null,
  first_close_at timestamptz not null,
  close_interval interval not null default interval '1 minute',
  max_lots       int not null default 60 check (max_lots between 1 and 500),
  status         text not null default 'published'
                 check (status in ('draft', 'published', 'cancelled')),
  created_at     timestamptz not null default now(),
  check (first_close_at > opens_at),
  check (close_interval >= interval '10 seconds')
);
create index drops_opens_at_idx on public.drops (opens_at);

-- -----------------------------------------------------------------------------
-- Auctions (lots)
-- -----------------------------------------------------------------------------
create table public.auctions (
  id          uuid primary key default gen_random_uuid(),
  drop_id     uuid not null references public.drops (id),
  seller_id   uuid not null references public.profiles (id),
  slot        int not null check (slot >= 0),
  title       text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  condition   text not null check (condition in ('new', 'like_new', 'good', 'fair', 'for_parts')),
  category    text not null check (char_length(category) between 1 and 40),
  area        text not null check (char_length(area) between 1 and 40),
  start_price bigint not null check (start_price >= 50000 and start_price % 100 = 0),  -- >= ₦500, whole naira
  step        bigint not null check (step > 0),
  current_bid bigint,
  leader_id   uuid references public.profiles (id),
  bid_count   int not null default 0,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  closed_at   timestamptz,
  outcome     text check (outcome in ('sold', 'unsold', 'defaulted', 'cancelled')),
  relisted_from uuid references public.auctions (id),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((current_bid is null) = (leader_id is null)),
  unique (drop_id, slot)
);
create index auctions_drop_idx on public.auctions (drop_id, ends_at);
create index auctions_seller_idx on public.auctions (seller_id, created_at desc);
create index auctions_due_idx on public.auctions (ends_at) where closed_at is null;

create table public.auction_photos (
  id           uuid primary key default gen_random_uuid(),
  auction_id   uuid not null references public.auctions (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) <= 300),
  position     int not null default 0 check (position between 0 and 9),
  unique (auction_id, position)
);

-- -----------------------------------------------------------------------------
-- Bids: append-only history. Never deleted.
-- -----------------------------------------------------------------------------
create table public.bids (
  id         uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id),
  bidder_id  uuid not null references public.profiles (id),
  amount     bigint not null check (amount > 0),
  created_at timestamptz not null default clock_timestamp()
);
create index bids_auction_idx on public.bids (auction_id, amount desc);
create index bids_bidder_idx on public.bids (bidder_id, created_at desc);

create function private.forbid_bid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'bids are append-only';
end;
$$;
create trigger bids_append_only
  before update or delete on public.bids
  for each row execute function private.forbid_bid_mutation();

-- Per-auction pseudonyms ("Bidder 4") so public payloads never carry user ids.
create table public.auction_bidders (
  auction_id uuid not null references public.auctions (id),
  bidder_id  uuid not null references public.profiles (id),
  bidder_no  int not null,
  primary key (auction_id, bidder_id),
  unique (auction_id, bidder_no)
);

-- -----------------------------------------------------------------------------
-- Orders, payouts, bank details
-- -----------------------------------------------------------------------------
create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  auction_id         uuid not null references public.auctions (id),
  offer_round        smallint not null default 1 check (offer_round in (1, 2)),
  buyer_id           uuid not null references public.profiles (id),
  seller_id          uuid not null references public.profiles (id),
  amount             bigint not null check (amount > 0),
  commission         bigint not null check (commission >= 0),
  payout_amount      bigint not null check (payout_amount >= 0),
  status             text not null default 'awaiting_payment'
                     check (status in ('awaiting_payment', 'paid', 'handed_over', 'paid_out',
                                       'expired', 'refunded', 'disputed', 'declined')),
  pay_by             timestamptz not null,
  paystack_reference text unique,
  paystack_access_code text,
  paystack_authorization_url text,
  handover_code_hash text,
  handover_attempts  int not null default 0,
  dispute_reason     text,
  paid_at            timestamptz,
  handed_over_at     timestamptz,
  paid_out_at        timestamptz,
  created_at         timestamptz not null default now(),
  check (commission + payout_amount = amount),
  unique (auction_id, offer_round)
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_due_idx on public.orders (pay_by) where status = 'awaiting_payment';

create table public.payouts (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null unique references public.orders (id),
  seller_id              uuid not null references public.profiles (id),
  amount                 bigint not null check (amount > 0),
  paystack_transfer_code text,
  status                 text not null default 'pending'
                         check (status in ('pending', 'processing', 'success', 'failed', 'reversed')),
  failure_reason         text,
  attempts               int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.seller_bank (
  seller_id               uuid primary key references public.profiles (id) on delete cascade,
  bank_code               text not null,
  bank_name               text,
  account_number          text not null check (account_number ~ '^[0-9]{10}$'),
  account_name            text not null,
  paystack_recipient_code text,
  updated_at              timestamptz not null default now()
);

-- Raw Paystack webhook log (dedup + audit). Service role only.
create table private.paystack_events (
  id          bigserial primary key,
  event       text not null,
  data_id     text not null,
  reference   text,
  payload     jsonb not null,
  received_at timestamptz not null default now(),
  unique (event, data_id)
);

-- -----------------------------------------------------------------------------
-- Notifications & push
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  pushed_at  timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

create function private.notify(p_user uuid, p_type text, p_payload jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, type, payload) values (p_user, p_type, p_payload)
$$;

-- -----------------------------------------------------------------------------
-- Money helpers
-- -----------------------------------------------------------------------------
-- Minimum step from asking price (kobo).
create function public.step_for(p_start_price bigint)
returns bigint
language sql immutable
as $$
  select case
    when p_start_price < 2000000  then 50000    -- < ₦20,000   → ₦500
    when p_start_price < 10000000 then 100000   -- < ₦100,000  → ₦1,000
    else 250000                                 -- ≥ ₦100,000  → ₦2,500
  end::bigint
$$;
grant execute on function public.step_for(bigint) to anon, authenticated;

-- Commission in kobo, rounded half-up.
create function private.commission_for(p_amount bigint)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select ((p_amount * private.setting('commission_bps')::bigint) + 5000) / 10000
$$;
