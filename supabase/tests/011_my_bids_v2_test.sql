-- my_bids v2: next minimum bid and cover photo for the My bids rows.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000001101', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', '2348000001102', now(), 'authenticated', 'authenticated');
insert into public.drops (id, title, opens_at, first_close_at) values
  ('00000000-0000-0000-0000-00000000d001', 'Live', now() - interval '5 minutes', now() + interval '20 minutes');
insert into public.auctions (id, drop_id, seller_id, slot, title, condition, category, area, start_price, step,
                             current_bid, leader_id, bid_count, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a1',
   0, 'Guitar', 'good', 'Leisure', 'Ikeja', 2500000, 100000, null, null, 0, now() - interval '5 minutes', now() + interval '20 minutes');
insert into public.auction_photos (auction_id, storage_path, position) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000a0001/1.webp', 1),
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000a0001/0.webp', 0);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((public.place_bid('00000000-0000-0000-0000-0000000a0001', 2500000) ->> 'ok')::boolean, true, 'bid placed');
select is((select min_next from public.my_bids()), 2600000::bigint, 'my_bids returns the next minimum bid');
select is((select photo from public.my_bids()), '00000000-0000-0000-0000-0000000a0001/0.webp', 'my_bids returns the cover photo');
reset role;

select * from finish();
rollback;
