-- confirm_handover + payout lifecycle.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000601', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', '2348000000602', now(), 'authenticated', 'authenticated');
insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Test drop', now() - interval '2 hours', now() - interval '1 hour');
insert into public.auctions (id, drop_id, seller_id, slot, title, condition, category, area, start_price, step,
                             current_bid, leader_id, bid_count, starts_at, ends_at, closed_at, outcome) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   0, 'Fan', 'good', 'Home', 'Yaba', 2500000, 100000, 2500000, '00000000-0000-0000-0000-0000000000b1', 1,
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', 'sold');
insert into public.orders (id, auction_id, buyer_id, seller_id, amount, commission, payout_amount, pay_by) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1', 2500000, 200000, 2300000, now() + interval '20 minutes');
set local role service_role;
select is(public.mark_order_paid('00000000-0000-0000-0000-00000000e001', 2500000, 'NGN'), 'paid', 'order paid');
reset role;

create temp table t_code on commit drop as
  select private.handover_code('00000000-0000-0000-0000-00000000e001') as code;
grant select on t_code to authenticated;

-- Buyer cannot confirm their own handover.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select throws_ok(format($$ select public.confirm_handover('00000000-0000-0000-0000-00000000e001', %L) $$, (select code from t_code)),
                 'P0001', 'not_found', 'only the seller can confirm handover');

-- Seller: wrong code counts an attempt, right code confirms.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.confirm_handover('00000000-0000-0000-0000-00000000e001',
          case when (select code from t_code) = '000000' then '111111' else '000000' end), 'wrong_code', 'wrong code rejected');
select is((select handover_attempts from public.orders where id = '00000000-0000-0000-0000-00000000e001'), 1,
          'wrong attempt is recorded');
select is(public.confirm_handover('00000000-0000-0000-0000-00000000e001', (select code from t_code)), 'ok', 'right code confirms');
select is(public.confirm_handover('00000000-0000-0000-0000-00000000e001', (select code from t_code)), 'already_confirmed',
          'confirming twice is a no-op');
reset role;

select is((select status from public.orders where id = '00000000-0000-0000-0000-00000000e001'), 'handed_over', 'order handed over');
select results_eq($$ select amount, status from public.payouts where order_id = '00000000-0000-0000-0000-00000000e001' $$,
                  $$ values (2300000::bigint, 'pending'::text) $$, 'one pending payout for amount minus commission');

-- No recipient yet → nothing to claim. Add bank details → claimable.
set local role service_role;
select is((select count(*)::int from public.claim_payouts()), 0, 'no claim without bank details');
select lives_ok($$ select public.save_seller_bank('00000000-0000-0000-0000-0000000000a1', '058', 'GTBank',
                                                 '0123456789', 'ADA OBI', 'RCP_test') $$, 'save bank details');
select is((select count(*)::int from public.claim_payouts()), 1, 'payout claimed once');
select is((select count(*)::int from public.claim_payouts()), 0, 'not claimed twice');

create temp table t_payout on commit drop as
  select id from public.payouts where order_id = '00000000-0000-0000-0000-00000000e001';
select lives_ok($$ select public.payout_transfer_result((select id::text from t_payout), 'success', null) $$, 'transfer success');
select lives_ok($$ select public.payout_transfer_result((select id::text from t_payout), 'success', null) $$,
                'replayed transfer.success is harmless');
reset role;
select results_eq($$ select o.status, p.status from public.orders o join public.payouts p on p.order_id = o.id
                      where o.id = '00000000-0000-0000-0000-00000000e001' $$,
                  $$ values ('paid_out'::text, 'success'::text) $$, 'order paid out, payout success');

select * from finish();
rollback;
