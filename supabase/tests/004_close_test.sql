-- close_due_auctions: outcomes, orders, commission, notifications, idempotency.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000401', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', '2348000000402', now(), 'authenticated', 'authenticated');
insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Test drop', now() - interval '1 hour', now() + interval '1 hour');
insert into public.auctions (id, drop_id, seller_id, slot, title, condition, category, area,
                             start_price, step, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', 0, 'With bids', 'good', 'Home', 'Yaba',
   2500000, public.step_for(2500000), now() - interval '10 minutes', clock_timestamp() + interval '5 minutes'),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', 1, 'No bids', 'good', 'Home', 'Yaba',
   2500000, public.step_for(2500000), now() - interval '10 minutes', clock_timestamp() - interval '1 second'),
  ('00000000-0000-0000-0000-0000000a0003', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', 2, 'Still live', 'good', 'Home', 'Yaba',
   2500000, public.step_for(2500000), now() - interval '10 minutes', clock_timestamp() + interval '10 minutes');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((public.place_bid('00000000-0000-0000-0000-0000000a0001', 2500000) ->> 'ok')::boolean, true, 'bid placed');
reset role;
update public.auctions set ends_at = clock_timestamp() - interval '1 second'
 where id = '00000000-0000-0000-0000-0000000a0001';

-- Only consider our fixtures (other test data may exist in the local DB).
update public.auctions set closed_at = now(), outcome = 'cancelled'
 where closed_at is null and drop_id <> '00000000-0000-0000-0000-00000000d001';

select is(public.close_due_auctions(), 2, 'closes the two ended lots');
select is(public.close_due_auctions(), 0, 'second run closes nothing (idempotent)');

select is((select outcome from public.auctions where id = '00000000-0000-0000-0000-0000000a0001'), 'sold', 'lot with bids is sold');
select is((select outcome from public.auctions where id = '00000000-0000-0000-0000-0000000a0002'), 'unsold', 'lot without bids is unsold');
select is((select closed_at from public.auctions where id = '00000000-0000-0000-0000-0000000a0003'), null, 'live lot is untouched');

select is((select count(*)::int from public.orders where auction_id = '00000000-0000-0000-0000-0000000a0001'), 1,
          'exactly one order for the sold lot');
select is((select count(*)::int from public.orders where auction_id = '00000000-0000-0000-0000-0000000a0002'), 0,
          'no order for the unsold lot');
select results_eq(
  $$ select buyer_id, amount, commission, payout_amount, status from public.orders
      where auction_id = '00000000-0000-0000-0000-0000000a0001' $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid, 2500000::bigint, 200000::bigint, 2300000::bigint,
             'awaiting_payment'::text) $$,
  'order: ₦25,000 with 8% commission (₦2,000), ₦23,000 payout');
select ok((select pay_by between now() + interval '29 minutes' and clock_timestamp() + interval '31 minutes'
             from public.orders where auction_id = '00000000-0000-0000-0000-0000000a0001'),
          'winner has 30 minutes to pay');

select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000b1' and type = 'won'), 1, 'winner notified once');
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000a1' and type in ('sold', 'unsold')), 2,
          'seller notified for both lots');

-- Re-running after manually clearing closed_at must not duplicate the order.
update public.auctions set closed_at = null, outcome = null where id = '00000000-0000-0000-0000-0000000a0001';
select is(public.close_due_auctions(), 1, 're-close after reset');
select is((select count(*)::int from public.orders where auction_id = '00000000-0000-0000-0000-0000000a0001'), 1,
          'still exactly one order (unique per auction + round)');

select * from finish();
rollback;
