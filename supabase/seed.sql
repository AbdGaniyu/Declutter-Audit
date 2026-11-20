-- Local development seed (runs on `supabase db reset`).
-- Lets Postgres call local Edge Functions (push, payout) through Kong.
select vault.create_secret('http://supabase_kong_declutter-auction:8000/functions/v1', 'edge_functions_url');
select vault.create_secret('local-dev-internal-secret-not-for-prod', 'internal_fn_secret');

-- A week of daily 7pm drops.
select public.ensure_upcoming_drops(7);
