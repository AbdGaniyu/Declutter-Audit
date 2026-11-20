-- =============================================================================
-- Hardening.
-- =============================================================================

-- Push endpoints are user-supplied and our push function POSTs to them, so only
-- accept HTTPS URLs on the browser push services (also enforced in the function).
alter table public.push_subscriptions
  add constraint push_endpoint_https check (
    endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)(/|$)'
    and char_length(endpoint) <= 1000
  );

-- At most 5 devices per user.
create function private.limit_push_subscriptions()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.push_subscriptions where user_id = new.user_id) >= 5 then
    delete from public.push_subscriptions
     where id in (select id from public.push_subscriptions where user_id = new.user_id
                   order by created_at limit 1);
  end if;
  return new;
end;
$$;
create trigger push_subscriptions_limit
  before insert on public.push_subscriptions
  for each row execute function private.limit_push_subscriptions();
