import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { NotificationBell } from '@/components/NotificationBell';

export async function Header() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    isAdmin = Boolean(profile?.is_admin);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
        <Link href="/" className="text-title text-brand">
          Declutter
        </Link>
        <nav className="flex items-center gap-1 text-small font-semibold">
          {isAdmin && (
            <Link href="/admin" className="rounded-pill px-3 py-2 text-muted">
              Admin
            </Link>
          )}
          <Link href="/sell" className="rounded-pill px-3 py-2 text-ink">
            Sell
          </Link>
          {user ? (
            <>
              <NotificationBell userId={user.id} />
              <Link href="/me" className="rounded-pill bg-brand px-4 py-2 text-brand-ink">
                Me
              </Link>
            </>
          ) : (
            <Link href="/login" className="rounded-pill bg-brand px-4 py-2 text-brand-ink">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
