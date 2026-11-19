-- =============================================================================
-- Drops + listing flow.
-- A lot's schedule is fixed at listing time: starts_at = drop.opens_at,
-- ends_at = drop.first_close_at + slot * close_interval (lots close 1 min apart).
-- =============================================================================

insert into private.settings (key, value) values
  ('drop_hour_lagos', '19'),          -- daily drop opens 7pm Lagos time
  ('drop_live_minutes', '30'),        -- first lot closes 30 min after opening
  ('max_lots_per_seller_per_drop', '10'),
  ('max_photos_per_lot', '6')
on conflict (key) do nothing;

create function private.raise_app(p_code text)
returns void
language plpgsql
as $$ begin raise exception using errcode = 'P0001', message = p_code; end; $$;

create function private.require_verified_user()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.raise_app('not_authenticated'); end if;
  if not private.is_phone_verified(v_uid) then perform private.raise_app('not_verified'); end if;
  return v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Drops
-- -----------------------------------------------------------------------------

-- Upcoming and live drops (a drop is over once its last lot has closed).
create function public.current_drops(p_limit int default 5)
returns table (id uuid, title text, opens_at timestamptz, first_close_at timestamptz,
               close_interval_seconds int, lot_count int, last_close_at timestamptz,
               accepting_listings boolean, server_now timestamptz)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.title, d.opens_at, d.first_close_at,
         extract(epoch from d.close_interval)::int,
         count(a.id) filter (where a.outcome is distinct from 'cancelled')::int,
         coalesce(max(a.ends_at), d.first_close_at),
         clock_timestamp() < d.opens_at
           and count(a.id) filter (where a.outcome is distinct from 'cancelled') < d.max_lots,
         clock_timestamp()
  from public.drops d
  left join public.auctions a on a.drop_id = d.id
  where d.status = 'published'
  group by d.id
  having coalesce(max(a.ends_at), d.first_close_at) > clock_timestamp() - interval '10 minutes'
  order by d.opens_at
  limit least(greatest(p_limit, 1), 20)
$$;
grant execute on function public.current_drops(int) to anon, authenticated;

create function public.admin_create_drop(p_title text, p_opens_at timestamptz,
                                         p_first_close_at timestamptz,
                                         p_close_interval_seconds int default 60,
                                         p_max_lots int default 60)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not private.is_admin() then perform private.raise_app('forbidden'); end if;
  insert into public.drops (title, opens_at, first_close_at, close_interval, max_lots)
  values (p_title, p_opens_at, p_first_close_at, make_interval(secs => p_close_interval_seconds), p_max_lots)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_create_drop(text, timestamptz, timestamptz, int, int) to authenticated;

-- Cancelling a drop is only possible before it opens; its lots are cancelled too.
create function public.admin_cancel_drop(p_drop_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare d public.drops;
begin
  if not private.is_admin() then perform private.raise_app('forbidden'); end if;
  select * into d from public.drops where id = p_drop_id for update;
  if not found then perform private.raise_app('not_found'); end if;
  if clock_timestamp() >= d.opens_at then perform private.raise_app('drop_already_open'); end if;
  update public.drops set status = 'cancelled' where id = p_drop_id;
  update public.auctions set outcome = 'cancelled', closed_at = clock_timestamp()
   where drop_id = p_drop_id and closed_at is null;
end;
$$;
grant execute on function public.admin_cancel_drop(uuid) to authenticated;

-- Creates the daily 7pm (Lagos) drop for the next p_days days if missing. Cron calls this.
create function public.ensure_upcoming_drops(p_days int default 7)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_hour int := private.setting('drop_hour_lagos')::int;
  v_live int := private.setting('drop_live_minutes')::int;
  v_day date;
  v_open timestamptz;
  v_created int := 0;
begin
  for i in 0 .. greatest(p_days, 1) - 1 loop
    v_day := (now() at time zone 'Africa/Lagos')::date + i;
    v_open := (v_day + make_time(v_hour, 0, 0)) at time zone 'Africa/Lagos';
    continue when v_open <= now();
    if not exists (select 1 from public.drops
                    where opens_at >= v_open - interval '12 hours'
                      and opens_at <  v_open + interval '12 hours'
                      and status <> 'cancelled') then
      insert into public.drops (title, opens_at, first_close_at)
      values ('Evening drop · ' || to_char(v_day, 'Dy DD Mon'), v_open,
              v_open + make_interval(mins => v_live));
      v_created := v_created + 1;
    end if;
  end loop;
  return v_created;
end;
$$;

-- -----------------------------------------------------------------------------
-- Listing
-- -----------------------------------------------------------------------------
create function public.create_listing(p_drop_id uuid, p_title text, p_description text,
                                      p_condition text, p_category text, p_area text,
                                      p_start_price bigint)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := private.require_verified_user();
  d      public.drops;
  v_slot int;
  v_live int;
  v_mine int;
  v_id   uuid;
begin
  -- Lock the drop so concurrent listings get distinct slots.
  select * into d from public.drops where id = p_drop_id for update;
  if not found or d.status <> 'published' then perform private.raise_app('drop_not_found'); end if;
  if clock_timestamp() >= d.opens_at then perform private.raise_app('drop_closed_for_listing'); end if;

  select count(*) filter (where outcome is distinct from 'cancelled'),
         count(*) filter (where outcome is distinct from 'cancelled' and seller_id = v_uid),
         coalesce(max(slot) + 1, 0)
    into v_live, v_mine, v_slot
    from public.auctions where drop_id = d.id;
  if v_live >= d.max_lots then perform private.raise_app('drop_full'); end if;
  if v_mine >= private.setting('max_lots_per_seller_per_drop')::int then
    perform private.raise_app('seller_limit_reached');
  end if;
  if p_start_price is null or p_start_price < 50000 or p_start_price % 100 <> 0
     or p_start_price > 5000000000 then
    perform private.raise_app('invalid_price');
  end if;

  insert into public.auctions (drop_id, seller_id, slot, title, description, condition, category,
                               area, start_price, step, starts_at, ends_at)
  values (d.id, v_uid, v_slot, btrim(p_title), coalesce(btrim(p_description), ''), p_condition,
          btrim(p_category), btrim(p_area), p_start_price, public.step_for(p_start_price),
          d.opens_at, d.first_close_at + v_slot * d.close_interval)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.create_listing(uuid, text, text, text, text, text, bigint) to authenticated;

-- Edit before the lot opens (and before any bid).
create function public.update_listing(p_auction_id uuid, p_title text, p_description text,
                                      p_condition text, p_category text, p_area text,
                                      p_start_price bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := private.require_verified_user();
begin
  if p_start_price is null or p_start_price < 50000 or p_start_price % 100 <> 0
     or p_start_price > 5000000000 then
    perform private.raise_app('invalid_price');
  end if;
  update public.auctions
     set title = btrim(p_title), description = coalesce(btrim(p_description), ''),
         condition = p_condition, category = btrim(p_category), area = btrim(p_area),
         start_price = p_start_price, step = public.step_for(p_start_price)
   where id = p_auction_id and seller_id = v_uid
     and closed_at is null and bid_count = 0 and clock_timestamp() < starts_at;
  if not found then perform private.raise_app('not_editable'); end if;
end;
$$;
grant execute on function public.update_listing(uuid, text, text, text, text, text, bigint) to authenticated;

-- Seller may withdraw a lot that has no bids.
create function public.cancel_listing(p_auction_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := private.require_verified_user();
begin
  update public.auctions
     set outcome = 'cancelled', closed_at = clock_timestamp()
   where id = p_auction_id and seller_id = v_uid and closed_at is null and bid_count = 0;
  if not found then perform private.raise_app('not_cancellable'); end if;
end;
$$;
grant execute on function public.cancel_listing(uuid) to authenticated;

-- Relist an unsold (or defaulted) lot into a later drop. Photos are reused.
create function public.relist_auction(p_auction_id uuid, p_drop_id uuid, p_start_price bigint default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_verified_user();
  a     public.auctions;
  v_new uuid;
begin
  select * into a from public.auctions where id = p_auction_id and seller_id = v_uid;
  if not found then perform private.raise_app('not_found'); end if;
  if a.outcome not in ('unsold', 'defaulted') then perform private.raise_app('not_relistable'); end if;
  if exists (select 1 from public.auctions where relisted_from = a.id and outcome is distinct from 'cancelled') then
    perform private.raise_app('already_relisted');
  end if;

  v_new := public.create_listing(p_drop_id, a.title, a.description, a.condition, a.category,
                                 a.area, coalesce(p_start_price, a.start_price));
  update public.auctions set relisted_from = a.id where id = v_new;
  insert into public.auction_photos (auction_id, storage_path, position)
  select v_new, storage_path, position from public.auction_photos where auction_id = a.id;
  return v_new;
end;
$$;
grant execute on function public.relist_auction(uuid, uuid, bigint) to authenticated;

-- -----------------------------------------------------------------------------
-- Photos: bucket lot-photos, path <auction_id>/<file>.webp
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lot-photos', 'lot-photos', true, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Can the current user upload photos for the auction named by this folder?
create function private.can_upload_lot_photo(p_folder text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  return exists (
    select 1 from public.auctions a
    where a.id = p_folder::uuid
      and a.seller_id = auth.uid()
      and a.closed_at is null
      and clock_timestamp() < a.starts_at
  );
exception when invalid_text_representation then
  return false;
end;
$$;
grant execute on function private.can_upload_lot_photo(text) to authenticated;

create policy lot_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lot-photos'
    and private.can_upload_lot_photo((storage.foldername(name))[1])
  );

create policy lot_photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'lot-photos' and owner_id = (select auth.uid())::text
         and private.can_upload_lot_photo((storage.foldername(name))[1]));

create function public.add_auction_photo(p_auction_id uuid, p_storage_path text, p_position int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := private.require_verified_user();
begin
  if not private.can_upload_lot_photo(p_auction_id::text) then
    perform private.raise_app('not_editable');
  end if;
  if p_position < 0 or p_position >= private.setting('max_photos_per_lot')::int then
    perform private.raise_app('too_many_photos');
  end if;
  if split_part(p_storage_path, '/', 1) <> p_auction_id::text
     or not exists (select 1 from storage.objects o
                     where o.bucket_id = 'lot-photos' and o.name = p_storage_path
                       and o.owner_id = v_uid::text) then
    perform private.raise_app('photo_not_found');
  end if;
  insert into public.auction_photos (auction_id, storage_path, position)
  values (p_auction_id, p_storage_path, p_position)
  on conflict (auction_id, position) do update set storage_path = excluded.storage_path;
end;
$$;
grant execute on function public.add_auction_photo(uuid, text, int) to authenticated;

create function public.remove_auction_photo(p_auction_id uuid, p_position int)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_verified_user();
  if not private.can_upload_lot_photo(p_auction_id::text) then
    perform private.raise_app('not_editable');
  end if;
  delete from public.auction_photos where auction_id = p_auction_id and position = p_position;
end;
$$;
grant execute on function public.remove_auction_photo(uuid, int) to authenticated;

-- The seller's own lots, newest first.
create function public.my_listings()
returns table (id uuid, title text, area text, start_price bigint, current_bid bigint, bid_count int,
               starts_at timestamptz, ends_at timestamptz, closed_at timestamptz, outcome text,
               drop_title text, photo text, relisted boolean)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, a.area, a.start_price, a.current_bid, a.bid_count, a.starts_at, a.ends_at,
         a.closed_at, a.outcome, d.title,
         (select p.storage_path from public.auction_photos p where p.auction_id = a.id
           order by p.position limit 1),
         exists (select 1 from public.auctions r where r.relisted_from = a.id
                  and r.outcome is distinct from 'cancelled')
  from public.auctions a
  join public.drops d on d.id = a.drop_id
  where a.seller_id = auth.uid()
  order by a.created_at desc
  limit 100
$$;
grant execute on function public.my_listings() to authenticated;
