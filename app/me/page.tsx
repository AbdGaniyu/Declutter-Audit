import { ChevronRight, CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { iconProps } from '@/components/icons';
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
    { href: '/me/sales', label: 'My sales & lots' },
    { href: '/me/bank', label: 'Payout bank account' },
    { href: '/me/notifications', label: 'Notifications' },
  ];

  return (
    <div className="mx-auto max-w-lot space-y-6">
      <div>
        <h1 className="text-title-sm md:text-title">Hi {profile?.display_name ?? 'there'}</h1>
        <p className="text-body text-secondary">
          {profile?.phone ? `+${profile.phone}` : ''}{profile?.area ? ` · ${profile.area}` : ''}
        </p>
      </div>

      {profile?.bidding_suspended ? (
        <p className="flex gap-2 rounded-card bg-fill p-3 text-label">
          <CircleAlert {...iconProps} size={20} className="shrink-0 text-label" />
          Bidding is paused after <span className="tnum">{profile.strikes}</span> unpaid wins. Our team will review it.
        </p>
      ) : profile && profile.strikes > 0 ? (
        <p className="flex gap-2 rounded-card bg-fill p-3 text-label">
          <CircleAlert {...iconProps} size={20} className="shrink-0 text-label" />
          You have 1 strike. One more unpaid win pauses bidding.
        </p>
      ) : null}

      {toPay ? (
        <Link href="/me/orders" className="flex min-h-14 items-center justify-between rounded-card bg-label px-4 font-semibold text-white">
          <span>You have <span className="tnum">{toPay}</span> win{toPay === 1 ? '' : 's'} to pay for</span>
          <ChevronRight {...iconProps} size={20} />
        </Link>
      ) : null}

      <nav className="[&>*:not(:last-child)]:hairline-b overflow-hidden squircle rounded-group bg-surface">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-14 items-center justify-between px-4">
            <span className="font-semibold">{l.label}</span>
            <span className="flex items-center gap-1 text-secondary">{l.note}<ChevronRight {...iconProps} size={18} /></span>
          </Link>
        ))}
      </nav>

      <section className="space-y-2">
        <h2 className="text-eyebrow uppercase text-secondary">Alerts on this phone</h2>
        <PushToggle />
      </section>

      <SignOutButton />
    </div>
  );
}
