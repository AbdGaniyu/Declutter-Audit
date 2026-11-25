-- Design v2 backend: step tiers, drop numbers, drop/lot fields, search, admin views.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- Step tiers (CLAUDE.md › Auction rules) -----------------------------------------
select is(public.step_for(50000),    20000::bigint,  '₦500 → ₦200 step');
select is(public.step_for(999900),   20000::bigint,  '₦9,999 → ₦200 step');
select is(public.step_for(1000000),  50000::bigint,  '₦10,000 → ₦500 step');
select is(public.step_for(1999900),  50000::bigint,  '₦19,999 → ₦500 step');
select is(public.step_for(2000000),  100000::bigint, '₦20,000 → ₦1,000 step');
select is(public.step_for(10000000), 250000::bigint, '₦100,000 → ₦2,500 step');

-- Fixtures -----------------------------------------------------------------------
insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000001001', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', '2348000001002', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000ad', '2348000001003', now(), 'authenticated', 'authenticated');
update public.profiles set display_name = 'Tolu' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Chidi', strikes = 1 where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Live drop', now() - interval '10 minutes', now() + interval '20 minutes'),
  ('00000000-0000-0000-0000-00000000d002', 'Later drop', now() + interval '1 day', now() + interval '1 day 30 minutes'),
  ('00000000-0000-0000-0000-00000000d003', 'Old drop', now() - interval '3 hours', now() - interval '2 hours');

insert into public.auctions (id, drop_id, seller_id, slot, title, description, condition, category, area,
                             start_price, step, current_bid, leader_id, bid_count, starts_at, ends_at, closed_at, outcome) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   0, 'Brass table lamp', 'Linen shade, works well', 'good', 'Home', 'Yaba', 700000, 20000, 800000, '00000000-0000-0000-0000-0000000000b1', 3,
   now() - interval '10 minutes', now() + interval '20 minutes', null, null),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   1, 'Cancelled kettle', '', 'fair', 'Kitchen', 'Yaba', 500000, 20000, null, null, 0,
   now() - interval '10 minutes', now() + interval '21 minutes', null, 'cancelled'),
  ('00000000-0000-0000-0000-0000000a0003', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   2, 'Standing fan', 'Three speeds, lamp-like base', 'good', 'Home', 'Lekki', 1800000, 50000, 1850000, '00000000-0000-0000-0000-0000000000b1', 2,
   now() - interval '10 minutes', now() + interval '22 minutes', null, null),
  ('00000000-0000-0000-0000-0000000a0004', '00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-0000000000a1',
   0, 'Old lamp stand', '', 'good', 'Home', 'Ikeja', 700000, 20000, null, null, 0,
   now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours', 'unsold');

-- A strike this week: round-1 winner didn't pay.
insert into public.notifications (user_id, type, payload) values
  ('00000000-0000-0000-0000-0000000000b1', 'order_expired',
   jsonb_build_object('title', 'Brass table lamp', 'strikes', 1));

-- Drop numbers -----------------------------------------------------------------------
select ok((select bool_and(number is not null) from public.drops), 'every drop has a number');
select cmp_ok((select number from public.drops where id = '00000000-0000-0000-0000-00000000d002'), '>',
              (select number from public.drops where id = '00000000-0000-0000-0000-00000000d001'),
              'a later-created drop gets a higher number');
select throws_ok($$ update public.drops set number = (select number from public.drops where id = '00000000-0000-0000-0000-00000000d001')
                     where id = '00000000-0000-0000-0000-00000000d002' $$,
                 '23505', null, 'drop numbers are unique');

-- current_drops / get_lot fields (anonymous visitor) ---------------------------------
set local role anon;
select is((select number from public.current_drops(5) where id = '00000000-0000-0000-0000-00000000d001'),
          (select number from public.drops where id = '00000000-0000-0000-0000-00000000d001'),
          'current_drops returns the drop number');
select is((select areas from public.current_drops(5) where id = '00000000-0000-0000-0000-00000000d001'),
          array['Lekki', 'Yaba'], 'current_drops lists pickup areas of live lots');
select is((select total_bids from public.current_drops(5) where id = '00000000-0000-0000-0000-00000000d001'),
          5, 'current_drops sums bids');
select is((select lot_count from public.current_drops(5) where id = '00000000-0000-0000-0000-00000000d001'),
          2, 'cancelled lots are not counted');
select is((public.get_lot('00000000-0000-0000-0000-0000000a0003') ->> 'drop_number')::int,
          (select number from public.drops where id = '00000000-0000-0000-0000-00000000d001'), 'get_lot drop_number');
select is((public.get_lot('00000000-0000-0000-0000-0000000a0003') ->> 'lot_no')::int, 2,
          'lot number skips cancelled lots');
select is((public.get_lot('00000000-0000-0000-0000-0000000a0003') ->> 'drop_lot_count')::int, 2, 'lot count of drop');

-- Search ------------------------------------------------------------------------------
select is((select count(*)::int from public.search_lots('LAMP', 50) where drop_id in ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d003')), 2,
          'search matches title and description, case-insensitive');
select ok(not exists (select 1 from public.search_lots('lamp', 20) where id = '00000000-0000-0000-0000-0000000a0004'),
          'search skips ended lots');
select is((select count(*)::int from public.search_lots('kettle', 20)), 0, 'search skips cancelled lots');
select is((select count(*)::int from public.search_lots('%', 20)), 0, 'wildcards are matched literally');
select is((select count(*)::int from public.search_lots(' ', 20)), 0, 'blank query returns nothing');
reset role;

-- Admin views -------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok($$ select * from public.admin_lots(null, 'all', 0, 20) $$, 'P0001', 'forbidden', 'non-admin: admin_lots');
select throws_ok($$ select * from public.admin_users(null, 0, 20) $$, 'P0001', 'forbidden', 'non-admin: admin_users');
select throws_ok($$ select * from public.admin_drops_week(current_date) $$, 'P0001', 'forbidden', 'non-admin: admin_drops_week');
select throws_ok($$ select * from public.admin_strikes_week() $$, 'P0001', 'forbidden', 'non-admin: admin_strikes_week');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';
select is((select count(*)::int from public.admin_lots('lamp', 'all', 0, 200) where drop_id in ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d003')), 2, 'admin_lots searches titles');
select is((select count(*)::int from public.admin_lots(null, 'live', 0, 200) where drop_id = '00000000-0000-0000-0000-00000000d001')
           + (select (total_count = (select count(*) from public.admin_lots(null, 'live', 0, 200)))::int
                from public.admin_lots(null, 'live', 0, 1) limit 1), 3,
          'admin_lots live filter (2 fixture lots) with total across pages');
select is((select display_name from public.admin_users('1002', 0, 20)), 'Chidi', 'admin_users finds by phone');
select is((select state from public.admin_drops_week(((now() - interval '10 minutes') at time zone 'Africa/Lagos')::date)
            where drop_id = '00000000-0000-0000-0000-00000000d001'), 'live', 'week view marks the live drop');
select is((select display_name from public.admin_strikes_week()), 'Chidi', 'strikes this week');
reset role;

select * from finish();
rollback;
