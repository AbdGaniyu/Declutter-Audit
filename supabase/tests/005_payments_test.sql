-- mark_order_paid: idempotent, amount-checked, late payments flagged; handover code buyer-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000501', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', '2348000000502', now(), 'authenticated', 'authenticated');
insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Test drop', now() - interval '2 hours', now() - interval '1 hour');
insert into public.auctions (id, drop_id, seller_id, slot, title, condition, category, area, start_price, step,
                             current_bid, leader_id, bid_count, starts_at, ends_at, closed_at, outcome) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   0, 'Fan', 'good', 'Home', 'Yaba', 2500000, 100000, 2500000, '00000000-0000-0000-0000-0000000000b1', 1,
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', 'sold'),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   1, 'Chair', 'good', 'Home', 'Yaba', 2500000, 100000, 2500000, '00000000-0000-0000-0000-0000000000b1', 1,
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', 'sold');
insert into public.orders (id, auction_id, buyer_id, seller_id, amount, commission, payout_amount, pay_by, status) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1', 2500000, 200000, 2300000, now() + interval '20 minutes', 'awaiting_payment'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1', 2500000, 200000, 2300000, now() - interval '5 minutes', 'expired');

set local role service_role;
select is(public.mark_order_paid('00000000-0000-0000-0000-00000000e001', 2499900, 'NGN'), 'amount_mismatch',
          'wrong amount is not accepted');
select is(public.mark_order_paid('00000000-0000-0000-0000-00000000e001', 2500000, 'NGN'), 'paid', 'first webhook pays');
select is(public.mark_order_paid('00000000-0000-0000-0000-00000000e001', 2500000, 'NGN'), 'duplicate', 'replay is a no-op');
select is(public.mark_order_paid('00000000-0000-0000-0000-00000000e002', 2500000, 'NGN'), 'late', 'payment after expiry is late');
select is(public.mark_order_paid('not-a-uuid', 2500000, 'NGN'), 'not_found', 'unknown reference');
select lives_ok($$ select public.record_late_payment_refund('00000000-0000-0000-0000-00000000e002') $$, 'record late refund');
select is(public.mark_order_paid('00000000-0000-0000-0000-00000000e002', 2500000, 'NGN'), 'duplicate',
          'late payment replay after refund is a no-op');
reset role;

select is((select count(*)::int from public.notifications where type = 'buyer_paid'
            and payload ->> 'order_id' = '00000000-0000-0000-0000-00000000e001'), 1, 'seller notified once');
select is((select count(*)::int from public.ops_alerts where kind = 'amount_mismatch'
            and order_id = '00000000-0000-0000-0000-00000000e001'), 1, 'mismatch raised an ops alert');
select isnt((select handover_code_hash from public.orders where id = '00000000-0000-0000-0000-00000000e001'), null,
            'handover hash stored on payment');

-- Handover code: buyer sees it, seller does not.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select matches(public.get_handover_code('00000000-0000-0000-0000-00000000e001'), '^\d{6}$', 'buyer gets a 6-digit code');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.get_handover_code('00000000-0000-0000-0000-00000000e001'), null, 'seller cannot see the code');
select throws_ok($$ select public.mark_order_paid('00000000-0000-0000-0000-00000000e001', 2500000, 'NGN') $$,
                 '42501', null, 'clients cannot mark orders paid');
reset role;
select is((select extensions.crypt(private.handover_code('00000000-0000-0000-0000-00000000e001'), handover_code_hash) = handover_code_hash
             from public.orders where id = '00000000-0000-0000-0000-00000000e001'), true, 'hash matches the derived code');

select * from finish();
rollback;
