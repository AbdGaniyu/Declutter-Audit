-- RLS / grants: clients cannot write auctions or bids directly, and cannot read
-- masked or secret columns.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000201', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', '2348000000202', now(), 'authenticated', 'authenticated');
insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Test drop', now() - interval '1 hour', now() + interval '1 hour');
insert into public.auctions (id, drop_id, seller_id, slot, title, condition, category, area,
                             start_price, step, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001',
   '00000000-0000-0000-0000-0000000000a1', 0, 'Blender', 'good', 'Kitchen', 'Ikeja',
   1000000, public.step_for(1000000), now() - interval '10 minutes', now() + interval '10 minutes');

-- anon ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$ update public.auctions set current_bid = 99999900 $$, '42501', null,
                 'anon cannot update auctions');
select throws_ok($$ insert into public.bids (auction_id, bidder_id, amount)
                    values ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000000b1', 1) $$,
                 '42501', null, 'anon cannot insert bids');
select throws_ok($$ select leader_id from public.auctions $$, '42501', null,
                 'anon cannot read auctions.leader_id');
select is((select count(*)::int from public.auctions where id = '00000000-0000-0000-0000-0000000a0001'), 1,
          'anon can read lots in published drops');

-- authenticated ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select throws_ok($$ update public.auctions set current_bid = 99999900, leader_id = auth.uid() $$, '42501', null,
                 'authenticated cannot update auctions');
select throws_ok($$ update public.auctions set ends_at = now() + interval '1 day' $$, '42501', null,
                 'authenticated cannot move ends_at');
select throws_ok($$ insert into public.auctions (drop_id, seller_id, slot, title, condition, category, area,
                                                 start_price, step, starts_at, ends_at)
                    values ('00000000-0000-0000-0000-00000000d001', auth.uid(), 9, 'Sneaky', 'good', 'x', 'y',
                            100000, 50000, now(), now() + interval '1 hour') $$, '42501', null,
                 'authenticated cannot insert auctions directly');
select throws_ok($$ insert into public.bids (auction_id, bidder_id, amount)
                    values ('00000000-0000-0000-0000-0000000a0001', auth.uid(), 99999900) $$, '42501', null,
                 'authenticated cannot insert bids directly');
select throws_ok($$ delete from public.bids $$, '42501', null, 'authenticated cannot delete bids');
select throws_ok($$ select handover_code_hash from public.orders $$, '42501', null,
                 'authenticated cannot read handover_code_hash');
select throws_ok($$ update public.profiles set strikes = 0, bidding_suspended = false $$, '42501', null,
                 'authenticated cannot clear own strikes');
select throws_ok($$ select public.close_due_auctions() $$, '42883', null,
                 'close_due_auctions is not callable by clients')
  where to_regprocedure('public.close_due_auctions()') is null
union all
select throws_ok($$ select public.close_due_auctions() $$, '42501', null,
                 'close_due_auctions is not callable by clients')
  where to_regprocedure('public.close_due_auctions()') is not null;

-- bids are append-only even for the owner role -------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((public.place_bid('00000000-0000-0000-0000-0000000a0001', 1000000) ->> 'ok')::boolean, true,
          'bid through RPC works');
reset role;
select throws_ok($$ delete from public.bids $$, 'P0001', 'bids are append-only',
                 'even postgres cannot delete bids');

select * from finish();
rollback;
