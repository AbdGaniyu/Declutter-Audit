-- My bids v2 (DESIGN.md › My bids): rows show a thumbnail, and outbid rows offer
-- "Bid ₦X" at the next minimum. Display only: place_bid re-validates.
drop function public.my_bids();
create function public.my_bids()
returns table (auction_id uuid, title text, area text, starts_at timestamptz, ends_at timestamptz,
               closed_at timestamptz, outcome text, current_bid bigint, min_next bigint, my_max_bid bigint,
               is_leading boolean, photo text)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, a.area, a.starts_at, a.ends_at, a.closed_at, a.outcome, a.current_bid,
         coalesce(a.current_bid + a.step, a.start_price),
         max(b.amount), a.leader_id = auth.uid(),
         (select p.storage_path from public.auction_photos p where p.auction_id = a.id order by p.position limit 1)
  from public.bids b
  join public.auctions a on a.id = b.auction_id
  where b.bidder_id = auth.uid()
  group by a.id
  order by a.ends_at desc
  limit 100
$$;
grant execute on function public.my_bids() to authenticated;
