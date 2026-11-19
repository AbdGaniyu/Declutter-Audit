import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PushToggle } from '@/components/PushToggle';
import { SignOutButton } from '@/components/SignOutButton';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/me');
  const [{ data: profile }, { count: toPay }] = await Promise.all([
    supabase.from('profiles').select('display_name, phone, area, strikes, bidding_suspended').eq('id', auth.user.id).maybeSingle(),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('buyer_id', auth.user.id).eq('status', 'awaiting_payment'),
  ]);

  const links = [
    { href: '/me/orders', label: 'My wins & orders', note: toPay ? `${toPay} to pay` : null },
    { href: '/me/bids', label: 'My bids' },
    { href: '/me/sales', label: 'My lots & sales' },
    { href: '/me/bank', label: 'Payout bank account' },
    { href: '/me/notifications', label: 'Notifications' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title">Hi {profile?.display_name ?? 'there'}</h1>
        <p className="text-small text-muted">
          {profile?.phone ? `+${profile.phone}` : ''} {profile?.area ? `· ${profile.area}` : ''}
        </p>
      </div>

      {profile?.bidding_suspended ? (
        <p className="rounded-card bg-danger p-3 text-small text-brand-ink">
          Bidding is paused on your account after {profile.strikes} unpaid wins. Our team will review it.
        </p>
      ) : profile && profile.strikes > 0 ? (
        <p className="rounded-card border border-line bg-surface p-3 text-small text-warn">
          You have {profile.strikes} strike. One more unpaid win pauses bidding.
        </p>
      ) : null}

      {toPay ? (
        <Link href="/me/orders" className="block rounded-card bg-live p-3 font-semibold text-brand-ink">
          You have {toPay} win{toPay === 1 ? '' : 's'} waiting for payment →
        </Link>
      ) : null}

      <nav className="divide-y divide-line rounded-card border border-line bg-surface">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-12 items-center justify-between px-4">
            <span>{l.label}</span>
            <span className="text-small text-muted">{l.note ?? '›'}</span>
          </Link>
        ))}
      </nav>

      <section className="space-y-2">
        <h2 className="text-small font-semibold">Alerts</h2>
        <PushToggle />
      </section>

      <SignOutButton />
    </div>
  );
}
