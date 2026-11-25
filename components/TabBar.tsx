'use client';
import { CirclePlus, Gavel, House, Package } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/components/TopBarNav';
import { iconProps } from '@/components/icons';

const ICONS = { '/': House, '/me/bids': Gavel, '/sell': CirclePlus, '/me/orders': Package } as const;

/** Hidden where something else owns the bottom: the lot page (bid dock), the sell flow, admin, sign-in. */
function hidden(path: string): boolean {
  return ['/lot/', '/sell', '/admin', '/login'].some((p) => path.startsWith(p));
}

/** DESIGN.md › Navigation: mobile glass tab bar, icon above label. */
export function TabBar() {
  const path = usePathname() ?? '/';
  if (hidden(path)) return null;
  return (
    <nav aria-label="Tabs" className="fixed inset-x-2 bottom-2 z-30 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="glass-nav grid grid-cols-4 rounded-dock px-1 py-1">
        {NAV.map((n) => {
          const on = n.match(path);
          const Icon = ICONS[n.href];
          return (
            <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined}
              className={`pressable flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-group text-[11px] leading-[13px]
                ${on ? 'font-semibold text-label' : 'text-secondary'}`}>
              <Icon {...iconProps} size={22} strokeWidth={on ? 2.1 : 1.75} />
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
