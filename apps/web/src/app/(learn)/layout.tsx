import Link from 'next/link';

import { adminDictionary } from '@/lib/i18n/admin-page';
import { brand } from '@/lib/site';

/**
 * The course player shell: deliberately chrome-light so the lesson itself gets
 * the screen. Every route inside is noindex and no-store.
 */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const { t } = await adminDictionary();

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/account/courses" className="text-sm font-semibold text-navy hover:text-blue">
            &larr; {t.learn.backToMyCourses}
          </Link>
          <span className="font-latin hidden text-xs text-muted sm:block">{brand.owner}</span>
        </div>
      </header>

      <main id="main" className="flex-1 bg-surface">
        {children}
      </main>
    </>
  );
}
