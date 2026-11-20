import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { env } from './env.ts';
import { safeEqual } from './http.ts';

/** Service-role client. Bypasses RLS: only use after authorising the caller. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The signed-in user from the request's Authorization header, or null. */
export async function getUser(req: Request): Promise<User | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/** Calls from Postgres (pg_net) or cron carry the shared internal secret. */
export function isInternal(req: Request): boolean {
  const got = req.headers.get('x-internal-secret') ?? '';
  const want = Deno.env.get('INTERNAL_FN_SECRET') ?? '';
  return want.length > 0 && safeEqual(got, want);
}
