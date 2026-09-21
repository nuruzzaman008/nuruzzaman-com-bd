import type { Metadata } from 'next';
import Link from 'next/link';
import type { CourseQuestion } from '@nuruzzaman/contracts';

import { QuestionInbox } from '@/features/dashboard/question-inbox';
import { sessionApi } from '@/lib/api/server';
import { cn } from '@/lib/cn';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.questions.title);
}

const TABS = ['unanswered', 'answered', 'all'] as const;
type Tab = (typeof TABS)[number];

/** What each tab asks the API for; hidden (spam) questions are never listed. */
const QUERY: Record<Tab, string> = {
  unanswered: 'status=all&answered=no',
  answered: 'status=all&answered=yes',
  all: 'status=all',
};

/**
 * Dashboard -> Student questions. Questions students ask under a lesson
 * ("Ask the teacher") arrive here, waiting ones first and oldest first; the
 * answer goes back under the lesson and to the student by email.
 */
export default async function StudentQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { t } = await adminDictionary();
  const { show } = await searchParams;
  const tab: Tab = TABS.includes(show as Tab) ? (show as Tab) : 'unanswered';
  const { data } = await sessionApi<{ data: CourseQuestion[] }>(
    `/admin/course-questions?${QUERY[tab]}`,
  );
  const copy = t.admin.questions;
  const labels: Record<Tab, string> = {
    unanswered: copy.tabUnanswered,
    answered: copy.tabAnswered,
    all: copy.tabAll,
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.intro}</p>

      <nav aria-label={copy.title} className="mt-5 flex flex-wrap gap-2">
        {TABS.map((name) => (
          <Link
            key={name}
            href={
              name === 'unanswered' ? '/dashboard/questions' : `/dashboard/questions?show=${name}`
            }
            aria-current={name === tab ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-semibold',
              name === tab
                ? 'border-navy bg-navy text-white'
                : 'border-line bg-white text-navy hover:border-blue',
            )}
          >
            {labels[name]}
          </Link>
        ))}
      </nav>

      {/* Keyed by tab, so switching tabs starts each card from the server's copy. */}
      <QuestionInbox key={tab} initial={data} />
    </div>
  );
}
