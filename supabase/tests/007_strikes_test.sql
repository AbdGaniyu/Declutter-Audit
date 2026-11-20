-- expire_unpaid_orders: strikes, suspension, second-chance offers, idempotency.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000701', now(), 'authenticated', 'authenticated'),  -- seller
  ('00000000-0000-0000-0000-0000000000b1', '2348000000702', now(), 'authenticated', 'authenticated'),  -- winner
  ('00000000-0000-0000-0000-0000000000b2', '2348000000703', now(), 'authenticated', 'authenticated'),  -- runner-up
  ('00000000-0000-0000-0000-0000000000ad', '2348000000704', now(), 'authenticated', 'authenticated');  -- admin
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
update public.profiles set strikes = 1 where id = '00000000-0000-0000-0000-0000000000b1';

insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Test drop', now() - interval '2 hours', now() + interval '1 hour');
insert into public.auctions (id, drop_id, seller_id, slot, title, condition, category, area, start_price, step,
                             starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   0, 'Fan', 'good', 'Home', 'Yaba', 2500000, 100000, now() - interval '1 hour', clock_timestamp() + interval '5 minutes');

-- Runner-up bids 25,000, winner 26,000.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is((public.place_bid('00000000-0000-0000-0000-0000000a0001', 2500000) ->> 'ok')::boolean, true, 'runner-up bids');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((public.place_bid('00000000-0000-0000-0000-0000000a0001', 2600000) ->> 'ok')::boolean, true, 'winner bids');
reset role;

update public.auctions set closed_at = now(), outcome = 'cancelled'
 where closed_at is null and id <> '00000000-0000-0000-0000-0000000a0001';
update public.auctions set ends_at = clock_timestamp() - interval '1 second' where id = '00000000-0000-0000-0000-0000000a0001';
select is(public.close_due_auctions(), 1, 'lot closes');

-- Not yet expired (inside pay window) → nothing happens.
update public.orders set status = 'expired' where status = 'awaiting_payment'
   and auction_id <> '00000000-0000-0000-0000-0000000a0001';
select is(public.expire_unpaid_orders(), 0, 'nothing to expire inside the pay window');

-- Push past pay_by + grace.
update public.orders set pay_by = now() - interval '10 minutes' where auction_id = '00000000-0000-0000-0000-0000000a0001';
select is(public.expire_unpaid_orders(), 1, 'winner order expires');
select is(public.expire_unpaid_orders(), 0, 'second run expires nothing (idempotent)');

select results_eq($$ select strikes, bidding_suspended from public.profiles where id = '00000000-0000-0000-0000-0000000000b1' $$,
                  $$ values (2, true) $$, 'defaulter gets a strike and is suspended at 2');
select results_eq($$ select buyer_id, amount, status, offer_round from public.orders
                      where auction_id = '00000000-0000-0000-0000-0000000a0001' and offer_round = 2 $$,
                  $$ values ('00000000-0000-0000-0000-0000000000b2'::uuid, 2500000::bigint, 'awaiting_payment'::text, 2::smallint) $$,
                  'runner-up offered the lot at their highest bid');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1'
            and type in ('order_expired', 'suspended')), 2, 'defaulter told about the strike and suspension');

-- Suspended user can't bid.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is(public.place_bid('00000000-0000-0000-0000-0000000a0001', 9000000) ->> 'reason', 'suspended', 'suspended defaulter cannot bid');
reset role;

-- Runner-up lets it lapse: no strike, lot defaulted.
update public.orders set pay_by = now() - interval '10 minutes'
 where auction_id = '00000000-0000-0000-0000-0000000a0001' and offer_round = 2;
select is(public.expire_unpaid_orders(), 1, 'second-chance order expires');
select is((select strikes from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'), 0,
          'no strike for letting a second-chance offer lapse');
select is((select outcome from public.auctions where id = '00000000-0000-0000-0000-0000000a0001'), 'defaulted',
          'lot is defaulted (seller can relist)');

-- Admin review restores bidding.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select throws_ok($$ select public.admin_review_user('00000000-0000-0000-0000-0000000000b1') $$, 'P0001', 'forbidden',
                 'non-admin cannot clear strikes');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';
select public.admin_review_user('00000000-0000-0000-0000-0000000000b1');
reset role;
select results_eq($$ select strikes, bidding_suspended from public.profiles where id = '00000000-0000-0000-0000-0000000000b1' $$,
                  $$ values (0, false) $$, 'admin review clears strikes and suspension');

select * from finish();
rollback;
