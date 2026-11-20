-- Drops + listing flow.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000301', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', '2348000000302', null,  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000ad', '2348000000303', now(), 'authenticated', 'authenticated');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';

-- Admin creates a drop ---------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok($$ select public.admin_create_drop('Nope', now() + interval '1 hour', now() + interval '2 hours') $$,
                 'P0001', 'forbidden', 'non-admin cannot create drops');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';
create temp table t_ids (k text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;
insert into t_ids values ('drop', public.admin_create_drop('Friday drop',
  date_trunc('minute', now()) + interval '1 hour', date_trunc('minute', now()) + interval '90 minutes', 60, 3));
select isnt((select id from t_ids where k = 'drop'), null, 'admin creates a drop');

-- Seller lists into it ----------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into t_ids values ('lot0', public.create_listing((select id from t_ids where k = 'drop'),
  'Office chair', 'Barely used', 'like_new', 'Furniture', 'Lekki', 2500000));
insert into t_ids values ('lot1', public.create_listing((select id from t_ids where k = 'drop'),
  'Rice cooker', '', 'good', 'Kitchen', 'Lekki', 800000));

reset role;
select is((select slot from public.auctions where id = (select id from t_ids where k = 'lot1')), 1,
          'second lot gets slot 1');
select is((select ends_at - (select first_close_at from public.drops where id = (select id from t_ids where k = 'drop'))
             from public.auctions where id = (select id from t_ids where k = 'lot1')),
          interval '1 minute', 'lots close one minute apart');
select is((select starts_at = (select opens_at from public.drops where id = (select id from t_ids where k = 'drop'))
             from public.auctions where id = (select id from t_ids where k = 'lot0')),
          true, 'lot opens with the drop');
select is((select step from public.auctions where id = (select id from t_ids where k = 'lot0')), 100000::bigint,
          '₦25,000 asking price → ₦1,000 step');
select is((select step from public.auctions where id = (select id from t_ids where k = 'lot1')), 50000::bigint,
          '₦8,000 asking price → ₦500 step');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(format($$ select public.create_listing(%L, 'Cheap thing', '', 'good', 'Misc', 'Yaba', 40000) $$,
                        (select id from t_ids where k = 'drop')),
                 'P0001', 'invalid_price', 'asking price under ₦500 is rejected');

insert into t_ids values ('lot2', public.create_listing((select id from t_ids where k = 'drop'),
  'Standing mirror', '', 'good', 'Home', 'Yaba', 1200000));
select throws_ok(format($$ select public.create_listing(%L, 'One too many', '', 'good', 'Misc', 'Yaba', 100000) $$,
                        (select id from t_ids where k = 'drop')),
                 'P0001', 'drop_full', 'drop rejects listings past max_lots');

-- Cancel a lot frees capacity (but not its slot number) --------------------------------
select lives_ok(format($$ select public.cancel_listing(%L) $$, (select id from t_ids where k = 'lot2')),
                'seller can cancel a lot with no bids');
insert into t_ids values ('lot3', public.create_listing((select id from t_ids where k = 'drop'),
  'Bookshelf', '', 'fair', 'Furniture', 'Yaba', 1500000));
reset role;
select is((select slot from public.auctions where id = (select id from t_ids where k = 'lot3')), 3,
          'new lot after a cancellation takes the next slot');

-- Unverified user cannot list -----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(format($$ select public.create_listing(%L, 'Laptop', '', 'good', 'Electronics', 'Ikeja', 9000000) $$,
                        (select id from t_ids where k = 'drop')),
                 'P0001', 'not_verified', 'unverified user cannot list');

-- Listing closes when the drop opens -----------------------------------------------------
reset role;
update public.drops set opens_at = now() - interval '1 minute' where id = (select id from t_ids where k = 'drop');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(format($$ select public.create_listing(%L, 'Late lot', '', 'good', 'Misc', 'Yaba', 100000) $$,
                        (select id from t_ids where k = 'drop')),
                 'P0001', 'drop_closed_for_listing', 'cannot list once the drop is open');

-- Relist an unsold lot -------------------------------------------------------------------
reset role;
update public.auctions set outcome = 'unsold', closed_at = now() where id = (select id from t_ids where k = 'lot1');
insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d002', 'Next drop', now() + interval '1 day', now() + interval '1 day 30 minutes');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into t_ids values ('relist', public.relist_auction((select id from t_ids where k = 'lot1'),
  '00000000-0000-0000-0000-00000000d002'));
reset role;
select is((select relisted_from from public.auctions where id = (select id from t_ids where k = 'relist')),
          (select id from t_ids where k = 'lot1'), 'relisted lot points to the original');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(format($$ select public.relist_auction(%L, '00000000-0000-0000-0000-00000000d002') $$,
                        (select id from t_ids where k = 'lot1')),
                 'P0001', 'already_relisted', 'a lot can only be relisted once');

-- Daily drops ---------------------------------------------------------------------------
reset role;
delete from public.drops d where d.opens_at > now()
   and not exists (select 1 from public.auctions a where a.drop_id = d.id);
select ok(public.ensure_upcoming_drops(6) >= 2, 'ensure_upcoming_drops creates daily drops');
select is(public.ensure_upcoming_drops(6), 0, 'ensure_upcoming_drops is idempotent');

select * from finish();
rollback;
