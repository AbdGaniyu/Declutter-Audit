-- Bidding rules: opening bid, step, own lot, soft close, suspension, verification.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Fixtures (as postgres) --------------------------------------------------------
insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000101', now(), 'authenticated', 'authenticated'),  -- seller
  ('00000000-0000-0000-0000-0000000000b1', '2348000000102', now(), 'authenticated', 'authenticated'),  -- bidder 1
  ('00000000-0000-0000-0000-0000000000b2', '2348000000103', now(), 'authenticated', 'authenticated'),  -- bidder 2
  ('00000000-0000-0000-0000-0000000000c1', '2348000000104', null,  'authenticated', 'authenticated');  -- unverified

insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Test drop', now() - interval '1 hour', now() + interval '1 hour');

insert into public.auctions (id, drop_id, seller_id, slot, title, condition, category, area,
                             start_price, step, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', 0, 'Standing fan', 'good', 'Home', 'Yaba',
   1500000, public.step_for(1500000), now() - interval '10 minutes', clock_timestamp() + interval '60 seconds'),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', 1, 'Not started', 'good', 'Home', 'Yaba',
   1500000, public.step_for(1500000), now() + interval '10 minutes', now() + interval '20 minutes');

-- Step table ---------------------------------------------------------------------
select is(public.step_for(1999900), 50000::bigint, 'under ₦20,000 → ₦500 step');
select is(public.step_for(2000000), 100000::bigint, '₦20,000 → ₦1,000 step');
select is(public.step_for(9999900), 100000::bigint, '₦99,999 → ₦1,000 step');
select is(public.step_for(10000000), 250000::bigint, '₦100,000 → ₦2,500 step');

-- Act as bidder 1 ------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select is(public.place_bid('00000000-0000-0000-0000-0000000a0001', 1400000) ->> 'reason', 'too_low',
          'first bid below asking price is rejected');
select is((public.place_bid('00000000-0000-0000-0000-0000000a0001', 1500000) ->> 'ok')::boolean, true,
          'first bid at asking price is accepted');
select is(public.place_bid('00000000-0000-0000-0000-0000000a0001', 1600000) ->> 'reason', 'already_leading',
          'leader cannot outbid themselves');
select is(public.place_bid('00000000-0000-0000-0000-0000000a0002', 1500000) ->> 'reason', 'not_started',
          'bid before starts_at is rejected');

-- Soft close: bid at T-60s leaves ends_at unchanged -----------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is(public.place_bid('00000000-0000-0000-0000-0000000a0001', 1549900) ->> 'reason', 'too_low',
          'bid below current + step is rejected');
select is(public.place_bid('00000000-0000-0000-0000-0000000a0001', 1550050) ->> 'reason', 'invalid_amount',
          'amount that is not whole naira is rejected');
select is((public.place_bid('00000000-0000-0000-0000-0000000a0001', 1550000) ->> 'ok')::boolean, true,
          'bid at current + step is accepted');

reset role;
select ok((select ends_at from public.auctions where id = '00000000-0000-0000-0000-0000000a0001')
            > clock_timestamp() + interval '50 seconds',
          'bid at T-60s leaves ends_at unchanged (still ~60s away)');

-- Soft close: bid at T-10s moves ends_at to about T+20s ---------------------------------
update public.auctions set ends_at = clock_timestamp() + interval '10 seconds'
 where id = '00000000-0000-0000-0000-0000000a0001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((public.place_bid('00000000-0000-0000-0000-0000000a0001', 1600000) ->> 'ok')::boolean, true,
          'bid at T-10s accepted');
reset role;
select ok((select ends_at between clock_timestamp() + interval '29 seconds'
                              and clock_timestamp() + interval '31 seconds'
             from public.auctions where id = '00000000-0000-0000-0000-0000000a0001'),
          'bid at T-10s moves ends_at to now + 30s (≈ T+20s)');

select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000b2' and type = 'outbid'), 1,
          'previous leader gets an outbid notification');

-- Seller cannot bid on own lot ----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.place_bid('00000000-0000-0000-0000-0000000a0001', 2000000) ->> 'reason', 'own_lot',
          'seller cannot bid on own lot');

-- Unverified phone cannot bid -------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is(public.place_bid('00000000-0000-0000-0000-0000000a0001', 2000000) ->> 'reason', 'not_verified',
          'unverified user cannot bid');

-- Suspended user cannot bid -----------------------------------------------------------------
reset role;
update public.profiles set bidding_suspended = true where id = '00000000-0000-0000-0000-0000000000b2';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is(public.place_bid('00000000-0000-0000-0000-0000000a0001', 2000000) ->> 'reason', 'suspended',
          'suspended user cannot bid');

-- Anonymous cannot bid --------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.place_bid('00000000-0000-0000-0000-0000000a0001', 2000000) $$,
                 '42501', null, 'anon cannot execute place_bid');

-- Masking: get_lot never returns a leader id --------------------------------------------
select ok(not (public.get_lot('00000000-0000-0000-0000-0000000a0001') ? 'leader_id'),
          'get_lot does not expose leader_id');

reset role;
select * from finish();
rollback;
