'use client';
import { Ban, CalendarDays, Package, TriangleAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { iconProps } from '@/components/icons';

const ITEMS = [
  { href: '/admin', label: 'Drops', icon: CalendarDays },
  { href: '/admin/lots', label: 'Lots', icon: Package },
  { href: '/admin/disputes', label: 'Disputes', icon: TriangleAlert },
  { href: '/admin/strikes', label: 'Strikes', icon: Ban },
  { href: '/admin/users', label: 'Users', icon: Users },
] as const;

/** DESIGN.md › Navigation › Admin: left sidebar on a plain surface (no glass). Scrolls sideways on phones. */
export function AdminSidebar({ openDisputes }: { openDisputes: number }) {
  const path = usePathname() ?? '/admin';
  return (
    <nav aria-label="Admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-col md:px-0">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const on = href === '/admin' ? path === '/admin' : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? 'page' : undefined}
            className={`pressable flex min-h-11 shrink-0 items-center gap-3 rounded-control px-3 text-subhead
              ${on ? 'bg-label font-semibold text-on-label' : 'text-label hover:bg-fill'}`}>
            <Icon {...iconProps} size={18} />
            {label}
            {label === 'Disputes' && openDisputes > 0 && (
              <span className={`tnum ml-auto min-w-5 rounded-pill px-1.5 text-center text-footnote font-semibold
                ${on ? 'bg-on-label text-label' : 'bg-label text-on-label'}`}>
                {openDisputes}<span className="sr-only"> open</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
