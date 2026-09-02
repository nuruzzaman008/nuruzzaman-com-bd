import Link from 'next/link';
import type { CourseOutline } from '@nuruzzaman/contracts';

import { cn } from '@/lib/cn';
import { duration, number } from '@/lib/format';

/**
 * The player sidebar. Locked lessons render as plain text rather than links, so
 * a keyboard user never lands on a control that will only refuse them.
 */
export function CourseOutlineNav({
  outline,
  currentSlug,
}: {
  outline: CourseOutline;
  currentSlug: string;
}) {
  return (
    <nav aria-label="কোর্স কারিকুলাম">
      <div className="rounded-[--radius-card] border border-line bg-white p-4">
        <p className="text-sm font-bold text-navy">{outline.course.title}</p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">অগ্রগতি</span>
            <span className="font-latin font-semibold text-navy">
              {outline.enrollment.progress_percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={outline.enrollment.progress_percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="কোর্সের অগ্রগতি"
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${outline.enrollment.progress_percent}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="mt-4 space-y-5">
        {outline.sections.map((section, index) => (
          <li key={section.id}>
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              মডিউল {number(index + 1)}
            </p>
            <p className="mt-0.5 text-sm font-bold text-navy">{section.title}</p>

            <ul className="mt-2 space-y-1">
              {section.lessons.map((lesson) => {
                const isCurrent = lesson.slug === currentSlug;

                if (!lesson.is_unlocked) {
                  return (
                    <li key={lesson.slug}>
                      <p className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm text-muted">
                        <span aria-hidden="true" className="mt-0.5">
                          &#128274;
                        </span>
                        <span>
                          {lesson.title}
                          <span className="block text-xs">আগের লেসন সম্পূর্ণ করলে খুলবে</span>
                        </span>
                      </p>
                    </li>
                  );
                }

                return (
                  <li key={lesson.slug}>
                    <Link
                      href={`/learn/${outline.course.slug}/${lesson.slug}`}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={cn(
                        'flex items-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-blue-soft',
                        isCurrent ? 'bg-blue-soft font-semibold text-blue' : 'text-navy',
                      )}
                    >
                      <span aria-hidden="true" className="mt-0.5">
                        {lesson.is_completed ? '\u2713' : '\u25CB'}
                      </span>
                      <span>
                        {lesson.title}
                        {lesson.is_completed ? <span className="sr-only"> (সম্পূর্ণ)</span> : null}
                        {lesson.duration_seconds ? (
                          <span className="block text-xs font-normal text-muted">
                            {duration(lesson.duration_seconds)}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </nav>
  );
}
