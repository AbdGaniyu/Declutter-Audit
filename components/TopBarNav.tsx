'use client';
import { ChevronLeft, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/Glass';
import { NotificationBell } from '@/components/NotificationBell';
import { SearchButton } from '@/components/SearchOverlay';
import { useTopBarBack } from '@/components/TopBarContext';
import { iconProps } from '@/components/icons';

export const NAV = [
  { href: '/', label: 'Drops', match: (p: string) => p === '/' || p.startsWith('/lot') },
  { href: '/me/bids', label: 'My bids', match: (p: string) => p.startsWith('/me/bids') },
  { href: '/sell', label: 'Sell', match: (p: string) => p.startsWith('/sell') },
  { href: '/me/orders', label: 'Orders', match: (p: string) => p.startsWith('/me/orders') || p.startsWith('/me/sales') },
] as const;

function sectionTitle(path: string): string {
  if (path === '/') return 'Tonight';
  if (path.startsWith('/admin')) return 'Admin';
  if (path.startsWith('/login')) return 'Sign in';
  if (path.startsWith('/me/notifications')) return 'Notifications';
  if (path === '/me' || path.startsWith('/me/bank')) return 'Me';
  return NAV.find((n) => n.match(path))?.label ?? 'Tonight';
}

/**
 * DESIGN.md › Navigation: a floating glass capsule. Left: logo + section, or a
 * back pill on detail pages. Desktop centre: Drops · My bids · Sell · Orders.
 * Right: notifications and the avatar (or Sign in).
 */
export function TopBarNav({ userId, isAdmin }: { userId: string | null; isAdmin: boolean }) {
  const path = usePathname() ?? '/';
  const back = useTopBarBack();

  return (
    <>
      {/* Scroll edge: content softens under the floating bar instead of a divider. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-20 h-16 backdrop-blur-sm [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <header className="sticky top-2 z-30 mx-auto w-full max-w-content px-2 md:top-4 md:px-6">
        <div className="glass-nav flex h-14 items-center gap-2 rounded-pill pl-2 pr-2 md:pl-3">
          {back ? (
            <Link href={back.href} className="glass-chip pressable inline-flex h-11 min-w-0 max-w-[60vw] items-center gap-1 rounded-pill pl-2 pr-4 text-headline md:max-w-xs">
              <ChevronLeft {...iconProps} size={20} className="shrink-0" />
              <span className="truncate">{back.label}</span>
            </Link>
          ) : (
            <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-pill pl-1 pr-3 text-headline">
              <LogoMark size={28} />
              <span>{sectionTitle(path)}</span>
            </Link>
          )}

          <nav aria-label="Main" className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const on = n.match(path);
              return (
                <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined}
                  className={`inline-flex h-11 items-center rounded-pill px-3 text-subhead ${on ? 'font-semibold text-label' : 'text-secondary hover:text-label'}`}>
                  {n.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link href="/admin" aria-current={path.startsWith('/admin') ? 'page' : undefined}
                className={`inline-flex h-11 items-center rounded-pill px-3 text-subhead ${path.startsWith('/admin') ? 'font-semibold text-label' : 'text-secondary hover:text-label'}`}>
                Admin
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <SearchButton />
            {userId ? (
              <>
                <NotificationBell userId={userId} />
                <Link href="/me" aria-label="Me" className="pressable inline-flex h-11 w-11 items-center justify-center rounded-pill">
                  <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-fill"><User {...iconProps} size={18} /></span>
                </Link>
              </>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(path)}`} className="pressable inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-pill bg-label px-4 text-subhead font-semibold text-on-label">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
