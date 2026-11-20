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
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-grid items-center justify-between gap-3 px-4">
        {/* Wordmark is "not decided yet" in DESIGN.md: plain display type for now. */}
        <Link href="/" className="font-display text-heading text-ink">
          Declutter
        </Link>
        <nav className="flex items-center gap-1 text-body font-semibold">
          {isAdmin && (
            <Link href="/admin" className="inline-flex min-h-11 items-center rounded-pill px-3 text-ink-muted">Admin</Link>
          )}
          <Link href="/sell" className="inline-flex min-h-11 items-center rounded-pill px-3 text-ink">Sell</Link>
          {user ? (
            <>
              <NotificationBell userId={user.id} />
              <Link href="/me" className="inline-flex min-h-11 items-center rounded-pill bg-ink px-4 text-white">Me</Link>
            </>
          ) : (
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-pill bg-ink px-4 text-white">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
