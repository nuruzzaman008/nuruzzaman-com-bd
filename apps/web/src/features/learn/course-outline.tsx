import Link from 'next/link';
import type { CourseOutline } from '@nuruzzaman/contracts';

import { CourseReview } from '@/features/learn/course-review';
import { COURSE_ACTION, COURSE_ACTION_OFF, COURSE_ACTION_ON } from '@/features/learn/styles';
import { cn } from '@/lib/cn';
import { duration, number } from '@/lib/format';
import { getDictionary } from '@/lib/i18n/dictionary';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { classLabel } from '@/lib/learn/class-label';

type OutlineLesson = CourseOutline['sections'][number]['lessons'][number];
type Kind = 'video' | 'text' | 'file' | 'quiz' | 'assignment';
type Words = ReturnType<typeof getDictionary>['learn'];

const KIND_ICONS: Record<Kind, string> = {
  video:
    'M3.5 5.5h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM13.5 9l4-2.5v7l-4-2.5',
  text: 'M5 3.5h10v13H5zM7.5 7h5M7.5 10h5M7.5 13h3',
  file: 'M11.5 2.5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6zM11.5 2.5V6H15M10 9v5M7.5 11.5 10 14l2.5-2.5',
  quiz: 'M4 4.5h12v11H4zM7 8l1.2 1.2L10.5 7M12 8.5h2M7 12l1.2 1.2 2.3-2.2M12 12.5h2',
  assignment: 'M12.5 3.5l4 4-8 8H4.5v-4zM10.5 5.5l4 4',
};

const LOCK = 'M6 9V6.5a4 4 0 0 1 8 0V9M5 9h10v8H5z';

/** What a lesson mainly is, for its icon and label in the list. */
function kindOf(lesson: OutlineLesson): Kind {
  if (lesson.type === 'quiz' || lesson.has_quiz) return 'quiz';
  if (lesson.type === 'assignment' || lesson.has_assignment) return 'assignment';
  if (lesson.type === 'video' || lesson.has_video) return 'video';
  if (lesson.type === 'download') return 'file';

  return 'text';
}

function Svg({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
    >
      <path d={path} />
    </svg>
  );
}

/** A checkbox-looking mark: ticked when complete, a lock while the lesson is closed. */
function Mark({ lesson }: { lesson: OutlineLesson }) {
  if (!lesson.is_unlocked) {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-muted"
      >
        <Svg path={LOCK} className="size-4" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2',
        lesson.is_completed ? 'border-blue bg-blue text-white' : 'border-muted/50 bg-white',
      )}
    >
      {lesson.is_completed ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="size-3.5"
        >
          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

function LessonRow({
  lesson,
  courseSlug,
  isCurrent,
  locale,
  words,
}: {
  lesson: OutlineLesson;
  courseSlug: string;
  isCurrent: boolean;
  locale: Locale;
  words: Words;
}) {
  const kind = kindOf(lesson);
  const files = lesson.assets_count
    ? (lesson.assets_count === 1 ? words.fileCountOne : words.fileCount).replace(
        '{count}',
        number(lesson.assets_count, locale),
      )
    : null;
  const meta = [
    words.lessonKinds[kind],
    files,
    lesson.duration_seconds ? duration(lesson.duration_seconds, locale) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const content = (
    <>
      <Mark lesson={lesson} />
      <span className="min-w-0">
        <span className="block leading-snug" data-authored="true">
          {lesson.title}
        </span>
        {lesson.is_unlocked ? (
          <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted">
            <Svg path={KIND_ICONS[kind]} className="size-3.5" />
            {meta}
          </span>
        ) : (
          // Shown once under the whole list rather than on every locked row;
          // a screen reader still hears it on the row itself.
          <span className="sr-only">{words.lockedLesson}</span>
        )}
      </span>
    </>
  );

  if (!lesson.is_unlocked) {
    return (
      <li>
        <p className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm text-muted">{content}</p>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/learn/${courseSlug}/${lesson.slug}`}
        aria-current={isCurrent ? 'page' : undefined}
        className={cn(
          'flex items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-blue-soft',
          isCurrent ? 'bg-blue-soft font-semibold text-blue' : 'text-navy',
        )}
      >
        {content}
        {lesson.is_completed ? <span className="sr-only">{words.completedSuffix}</span> : null}
      </Link>
    </li>
  );
}

/**
 * The player sidebar: course progress, then each class as a collapsible
 * section - only the one being studied open, so a long course stays compact -
 * and under it the exam, the certificate and a review.
 *
 * Native <details>, so the sections open and close without any script and a
 * keyboard or screen-reader user gets the expected behaviour for free. Locked
 * lessons render as plain text rather than links, so nobody lands on a
 * control that will only refuse them.
 */
export function CourseOutlineNav({
  outline,
  currentSlug,
  locale = DEFAULT_LOCALE,
}: {
  outline: CourseOutline;
  currentSlug: string;
  locale?: Locale;
}) {
  const words = getDictionary(locale).learn;
  const progress = outline.enrollment.progress_percent;
  const slug = outline.course.slug;
  const quizzes = outline.sections
    .flatMap((section) => section.lessons)
    .filter((lesson) => lesson.type === 'quiz' || lesson.has_quiz);
  const exam = quizzes.find((lesson) => lesson.is_unlocked) ?? null;
  const hasLocked = outline.sections.some((section) =>
    section.lessons.some((lesson) => !lesson.is_unlocked),
  );

  return (
    <div className="space-y-3">
      <nav
        aria-label={words.curriculum}
        className="overflow-hidden rounded-[--radius-card] border border-line bg-white"
      >
        <div className="bg-teal-soft px-4 py-3">
          <div className="flex items-center justify-between gap-3 font-semibold text-navy">
            <span>{words.progress}</span>
            <span>{number(progress, locale)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={words.progress}
            className="mt-2 h-2 overflow-hidden rounded-full bg-white"
          >
            <div className="h-full rounded-full bg-teal" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <ol className="divide-y divide-line">
          {outline.sections.map((section, index) => {
            const done = section.lessons.filter((lesson) => lesson.is_completed).length;

            return (
              <li key={section.id}>
                <details
                  open={section.lessons.some((lesson) => lesson.slug === currentSlug)}
                  className="group"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 hover:bg-surface [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block font-semibold leading-snug text-navy">
                        <span className="font-latin">{classLabel(index)}:</span>{' '}
                        <span data-authored="true">{section.title}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {words.sectionProgress
                          .replace('{done}', number(done, locale))
                          .replace('{total}', number(section.lessons.length, locale))}
                      </span>
                    </span>
                    <Svg
                      path="m5 7.5 5 5 5-5"
                      className="mt-1 size-4 text-muted transition-transform group-open:rotate-180"
                    />
                  </summary>

                  <ul className="space-y-0.5 px-2 pb-3">
                    {section.lessons.map((lesson) => (
                      <LessonRow
                        key={lesson.slug}
                        lesson={lesson}
                        courseSlug={slug}
                        isCurrent={lesson.slug === currentSlug}
                        locale={locale}
                        words={words}
                      />
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ol>

        {hasLocked ? (
          <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs text-muted">
            <Svg path={LOCK} className="size-3.5" />
            {words.lockedNote}
          </p>
        ) : null}
      </nav>

      <div className="space-y-2">
        {exam ? (
          <Link
            href={`/learn/${slug}/${exam.slug}`}
            className={cn(COURSE_ACTION, COURSE_ACTION_ON)}
          >
            {words.takeExam}
          </Link>
        ) : (
          <div>
            <button type="button" disabled className={cn(COURSE_ACTION, COURSE_ACTION_OFF)}>
              {words.takeExam}
            </button>
            <p className="mt-1 text-center text-xs text-muted">
              {quizzes.length ? words.examLocked : words.examNone}
            </p>
          </div>
        )}

        {outline.course.issues_certificate ? (
          outline.certificate ? (
            <Link
              href={`/verify/${outline.certificate.verification_id}`}
              className={cn(COURSE_ACTION, COURSE_ACTION_ON)}
            >
              {words.getCertificate}
            </Link>
          ) : (
            <div>
              <button type="button" disabled className={cn(COURSE_ACTION, COURSE_ACTION_OFF)}>
                {words.getCertificate}
              </button>
              <p className="mt-1 text-center text-xs text-muted">{words.certificateAfter}</p>
            </div>
          )
        ) : null}

        <CourseReview courseSlug={slug} review={outline.review} />
      </div>
    </div>
  );
}
