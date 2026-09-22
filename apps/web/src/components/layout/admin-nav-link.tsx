'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  Bell,
  CircleUserRound,
  Download,
  FileText,
  GraduationCap,
  Handshake,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  MessageCircleQuestionMark,
  MessageSquare,
  Newspaper,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Signpost,
  TicketPercent,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/cn';

import { useSidebarCollapsed } from './admin-sidebar';

/** One icon per menu entry, keyed like the dictionary's admin.nav labels. */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  notifications: Bell,
  posts: Newspaper,
  pages: FileText,
  media: ImageIcon,
  comments: MessageSquare,
  redirects: Signpost,
  products: Package,
  orders: ShoppingCart,
  coupons: TicketPercent,
  affiliates: Handshake,
  releases: Download,
  courses: GraduationCap,
  questions: MessageCircleQuestionMark,
  activationRequests: KeyRound,
  tickets: LifeBuoy,
  users: Users,
  settings: Settings,
  security: ShieldCheck,
  auditLog: ScrollText,
  account: CircleUserRound,
  payments: Banknote,
};

/** Whether this entry is the page being looked at, or a page under it. */
function isCurrent(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * An entry in the admin menu: an icon and its name, or - with the menu folded
 * to its rail - the icon alone, still a link, with the name on hover and for
 * screen readers.
 */
export function AdminNavLink({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: string;
  label: string;
  /** A count beside the name; on the rail it sits on the icon's corner. */
  badge?: React.ReactNode;
}) {
  const collapsed = useSidebarCollapsed();
  const pathname = usePathname() ?? '';
  const current = isCurrent(pathname, href);
  const Icon = ICONS[icon] ?? LayoutDashboard;

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/85',
        'hover:bg-white/10 hover:text-white',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
        collapsed && 'lg:justify-center lg:px-0 lg:py-2.5',
        current && 'bg-white/10 font-semibold text-white',
      )}
    >
      <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={2} />
      <span className={cn('min-w-0', collapsed && 'lg:sr-only')}>{label}</span>
      {badge ? (
        <span className={cn(collapsed && 'lg:absolute lg:-end-0.5 lg:-top-0.5 lg:[&>*]:ms-0')}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * A group of entries under its heading. Folded to the rail, the heading gives
 * way to a thin line, so the groups still read as groups.
 */
export function AdminNavGroup({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  const collapsed = useSidebarCollapsed();

  return (
    <div className={cn('mb-5', collapsed && 'lg:mb-2 lg:border-t lg:border-white/10 lg:pt-2')}>
      <p
        className={cn(
          'px-2 text-[0.65rem] font-semibold tracking-[0.15em] text-white/50 uppercase',
          collapsed && 'lg:sr-only',
        )}
      >
        {heading}
      </p>
      <ul className={cn('mt-1.5 space-y-0.5', collapsed && 'lg:mt-0')}>{children}</ul>
    </div>
  );
}
