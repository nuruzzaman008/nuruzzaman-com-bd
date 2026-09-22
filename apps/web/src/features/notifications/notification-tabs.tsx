import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { Dictionary } from '@/lib/i18n/dictionary';

/** Notifications · Settings · Email log (the log for administrators only). */
export function NotificationTabs({
  t,
  current,
  showEmailLog,
}: {
  t: Dictionary['notifications'];
  current: 'inbox' | 'settings' | 'emails';
  showEmailLog: boolean;
}) {
  const tabs = [
    { key: 'inbox', href: '/dashboard/notifications', label: t.title },
    { key: 'settings', href: '/dashboard/notifications/settings', label: t.settings },
    ...(showEmailLog
      ? [{ key: 'emails', href: '/dashboard/notifications/emails', label: t.emailLog }]
      : []),
  ];

  return (
    <nav aria-label={t.title} className="mt-4 flex gap-1 border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-semibold',
            tab.key === current
              ? 'border-navy text-navy'
              : 'border-transparent text-muted hover:text-navy',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
