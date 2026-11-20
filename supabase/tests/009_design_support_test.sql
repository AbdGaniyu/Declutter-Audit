-- Handover 5-per-hour window, get_lot trust/state fields, drop reminders.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000901', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', '2348000000902', now(), 'authenticated', 'authenticated');
update public.profiles set display_name = 'Sade' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Past drop', now() - interval '2 hours', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000d002', 'Next drop', now() + interval '1 hour', now() + interval '90 minutes');
insert into public.auctions (id, drop_id, seller_id, slot, title, condition, category, area, start_price, step,
                             current_bid, leader_id, bid_count, starts_at, ends_at, closed_at, outcome) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   0, 'Fan', 'good', 'Home', 'Yaba', 2500000, 100000, 2500000, '00000000-0000-0000-0000-0000000000b1', 1,
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', 'sold');
insert into public.orders (id, auction_id, buyer_id, seller_id, amount, commission, payout_amount, pay_by) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000a1', 2500000, 200000, 2300000, now() + interval '20 minutes');

-- get_lot fields for the winner.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((public.get_lot('00000000-0000-0000-0000-0000000a0001') -> 'my_order' ->> 'status'), 'awaiting_payment',
          'winner sees their order on the lot');
select is((public.get_lot('00000000-0000-0000-0000-0000000a0001') ->> 'seller_verified')::boolean, true, 'seller verified flag');
select isnt(public.get_lot('00000000-0000-0000-0000-0000000a0001') ->> 'seller_since', null, 'seller member-since date');
select is((public.get_lot('00000000-0000-0000-0000-0000000a0001') ->> 'my_suspended')::boolean, false, 'my suspension flag');
reset role;

-- 5 tries per hour.
set local role service_role;
select is(public.mark_order_paid('00000000-0000-0000-0000-00000000e001', 2500000, 'NGN'), 'paid', 'paid');
reset role;
create temp table t_wrong on commit drop as
  select case when private.handover_code('00000000-0000-0000-0000-00000000e001') = '000000' then '111111' else '000000' end as code,
         private.handover_code('00000000-0000-0000-0000-00000000e001') as right_code;
grant select on t_wrong to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.confirm_handover('00000000-0000-0000-0000-00000000e001', (select code from t_wrong)) ->> 'tries_left', '4',
          'first wrong try leaves 4');
select public.confirm_handover('00000000-0000-0000-0000-00000000e001', (select code from t_wrong)) from generate_series(1, 3);
select is(public.confirm_handover('00000000-0000-0000-0000-00000000e001', (select code from t_wrong)) ->> 'result', 'locked',
          'fifth wrong try locks');
select is(public.confirm_handover('00000000-0000-0000-0000-00000000e001', (select right_code from t_wrong)) ->> 'result', 'locked',
          'even the right code is refused while locked');
reset role;
update public.orders set handover_window_started_at = now() - interval '61 minutes' where id = '00000000-0000-0000-0000-00000000e001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.confirm_handover('00000000-0000-0000-0000-00000000e001', (select right_code from t_wrong)) ->> 'result', 'ok',
          'after an hour the right code works');

-- Drop reminders.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select lives_ok($$ select public.set_drop_reminder('00000000-0000-0000-0000-00000000d002') $$, 'set a reminder');
reset role;
update public.drops set opens_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-00000000d002';
select is(public.send_drop_reminders(), 1, 'reminder sent when the drop opens');
select is(public.send_drop_reminders(), 0, 'and only once');

select * from finish();
rollback;
