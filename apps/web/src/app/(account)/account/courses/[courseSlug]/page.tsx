import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ApiError,
  type CourseAnnouncement,
  type CourseOutline,
  type CourseQuestion,
  type Gradebook,
  type LessonNote,
} from '@nuruzzaman/contracts';

import { AskQuestion } from '@/features/courses/ask-question';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Prose } from '@/components/ui/prose';
import { sessionApi } from '@/lib/api/server';
import { date, number } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.courses.progressTitle);
}

/** Fetches one endpoint, returning null when the learner simply has none of it. */
async function optional<T>(path: string): Promise<T | null> {
  try {
    return await sessionApi<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.isForbidden || error.status === 404)) {
      return null;
    }

    throw error;
  }
}

export default async function CourseProgressPage(props: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { locale, t } = await adminDictionary();
  const { courseSlug } = await props.params;
  const slug = encodeURIComponent(courseSlug);

  let outline: CourseOutline;

  try {
    outline = (await sessionApi<{ data: CourseOutline }>(`/learn/${slug}/outline`)).data;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) {
      redirect(`/login?next=/account/courses/${courseSlug}`);
    }

    if (error instanceof ApiError && (error.isForbidden || error.status === 404)) {
      notFound();
    }

    throw error;
  }

  const [gradebook, announcements, questions, notes] = await Promise.all([
    optional<{ data: Gradebook }>(`/learn/${slug}/gradebook`),
    optional<{ data: CourseAnnouncement[] }>(`/learn/${slug}/announcements`),
    optional<{ data: CourseQuestion[] }>(`/learn/${slug}/questions`),
    optional<{ data: LessonNote[] }>(`/learn/${slug}/notes`),
  ]);

  const marks = gradebook?.data ?? null;
  const lessons = outline.sections.flatMap((section) => section.lessons);
  const next = lessons.find((lesson) => lesson.is_unlocked && !lesson.is_completed) ?? lessons[0];

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm text-muted">
          <Link href="/account/courses" className="text-blue hover:underline">
            {t.customer.courses.title}
          </Link>
        </p>
        <h1
          data-authored="true"
          className="mt-1 text-[length:var(--step-h1)] font-bold text-navy"
        >
          {outline.course.title}
        </h1>

        <div className="mt-4 flex items-center gap-4">
          <div
            role="progressbar"
            aria-valuenow={outline.enrollment.progress_percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.customer.courses.progressLabel}
            className="h-2 flex-1 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${outline.enrollment.progress_percent}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-navy">
            {number(outline.enrollment.progress_percent, locale)}%
          </span>
        </div>

        {next ? (
          <ButtonLink href={`/learn/${courseSlug}/${next.slug}`} className="mt-5">
            {outline.enrollment.progress_percent > 0
              ? t.customer.courses.resume
              : t.customer.courses.start}
          </ButtonLink>
        ) : null}
      </header>

      {announcements?.data.length ? (
        <section>
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
            {t.customer.courses.announcements}
          </h2>
          <ul className="mt-4 space-y-3">
            {announcements.data.map((announcement) => (
              <li key={announcement.id}>
                <Card className="p-5">
                  <h3 className="font-bold text-navy" data-authored="true">
                    {announcement.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {announcement.author_name ? `${announcement.author_name} · ` : ''}
                    {announcement.published_at ? date(announcement.published_at, locale) : ''}
                  </p>
                  <Prose html={announcement.body_html} className="mt-3 text-sm" />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {marks ? (
        <section>
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
            {t.customer.courses.marks}
          </h2>

          <Card className="mt-4 p-5">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted">{t.customer.courses.lessonsDone}</dt>
                <dd className="mt-1 text-2xl font-bold text-navy">
                  {number(marks.lessons.completed, locale)}
                  <span className="text-base font-normal text-muted">
                    {' / '}
                    {number(marks.lessons.total, locale)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t.customer.courses.averageScore}</dt>
                <dd className="mt-1 text-2xl font-bold text-navy">
                  {/* Null until something has been graded — an ungraded
                      submission is not a zero. */}
                  {marks.average_percent === null ? (
                    <span className="text-base font-normal text-muted">
                      {t.customer.courses.notGradedYet}
                    </span>
                  ) : (
                    `${number(marks.average_percent, locale)}%`
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{t.customer.courses.passMark}</dt>
                <dd className="mt-1 text-2xl font-bold text-navy">
                  {number(marks.pass_percentage, locale)}%
                </dd>
              </div>
            </dl>
          </Card>

          {marks.quizzes.length > 0 ? (
            <div className="mt-5">
              <h3 className="font-bold text-navy">{t.customer.courses.quizzes}</h3>
              <ul className="mt-3 divide-y divide-line rounded-[--radius-card] border border-line">
                {marks.quizzes.map((quiz) => (
                  <li
                    key={quiz.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-navy" data-authored="true">
                        {quiz.title}
                      </p>
                      <p className="text-xs text-muted">
                        {t.customer.courses.attempts
                          .replace('{used}', number(quiz.attempts_used, locale))
                          .replace('{allowed}', number(quiz.attempts_allowed, locale))}
                        {' · '}
                        {t.customer.courses.passAt.replace(
                          '{percent}',
                          number(quiz.pass_percentage, locale),
                        )}
                      </p>
                    </div>
                    {quiz.score_percent === null ? (
                      <Badge>{t.customer.courses.notAttempted}</Badge>
                    ) : (
                      <Badge tone={quiz.passed ? 'success' : 'danger'}>
                        {number(quiz.score_percent, locale)}%
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {marks.assignments.length > 0 ? (
            <div className="mt-5">
              <h3 className="font-bold text-navy">{t.customer.courses.assignments}</h3>
              <ul className="mt-3 divide-y divide-line rounded-[--radius-card] border border-line">
                {marks.assignments.map((assignment) => (
                  <li key={assignment.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-navy" data-authored="true">
                        {assignment.title}
                      </p>
                      {assignment.score_percent === null ? (
                        <Badge>
                          {t.customer.assignment[
                            assignment.status as keyof typeof t.customer.assignment
                          ] ?? assignment.status}
                        </Badge>
                      ) : (
                        <Badge
                          tone={
                            assignment.score_percent >= assignment.pass_percentage
                              ? 'success'
                              : 'danger'
                          }
                        >
                          {number(assignment.score_percent, locale)}%
                        </Badge>
                      )}
                    </div>
                    {assignment.feedback ? (
                      <p className="mt-2 text-sm text-muted" data-authored="true">
                        {assignment.feedback}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
          {t.customer.courses.questions}
        </h2>
        <p className="mt-2 text-sm text-muted">{t.customer.courses.questionsNote}</p>

        <AskQuestion courseSlug={courseSlug} className="mt-4" />

        {questions?.data.length ? (
          <ul className="mt-6 space-y-4">
            {questions.data.map((question) => (
              <li key={question.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-bold text-navy" data-authored="true">
                      {question.title}
                    </h3>
                    <div className="flex gap-2">
                      {question.is_pinned ? (
                        <Badge tone="info">{t.customer.courses.pinned}</Badge>
                      ) : null}
                      {question.status !== 'published' && question.is_mine ? (
                        <Badge tone="warning">{t.customer.courses.inModeration}</Badge>
                      ) : null}
                      {question.resolved_at ? (
                        <Badge tone="success">{t.customer.courses.resolved}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 text-sm" data-authored="true">
                    {question.body}
                  </p>
                  <p className="mt-2 text-xs text-muted" data-authored="true">
                    {question.author_name ?? t.customer.courses.student}
                    {question.lesson?.title ? ` · ${question.lesson.title}` : ''}
                    {question.created_at ? ` · ${date(question.created_at, locale)}` : ''}
                  </p>

                  {question.replies?.length ? (
                    <ul className="mt-4 space-y-3 border-t border-line pt-4">
                      {question.replies.map((reply) => (
                        <li key={reply.id} className="text-sm">
                          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="font-medium text-navy" data-authored="true">
                              {reply.author_name ?? t.customer.courses.participant}
                            </span>
                            {reply.from_instructor ? (
                              <Badge tone="teal">{t.customer.courses.instructor}</Badge>
                            ) : null}
                            {reply.created_at ? (
                              <span>{date(reply.created_at, locale)}</span>
                            ) : null}
                          </p>
                          <p className="mt-1" data-authored="true">
                            {reply.body}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Callout tone="info" className="mt-4">
            {t.customer.courses.noQuestions}
          </Callout>
        )}
      </section>

      <section>
        <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
          {t.customer.courses.myNotes}
        </h2>
        <p className="mt-2 text-sm text-muted">{t.customer.courses.notesNote}</p>

        {notes?.data.length ? (
          <ul className="mt-4 space-y-3">
            {notes.data.map((note) => (
              <li key={note.id}>
                <Card className="p-4">
                  <p className="text-sm" data-authored="true">
                    {note.body}
                  </p>
                  <p className="mt-2 text-xs text-muted" data-authored="true">
                    {note.lesson?.title ?? t.customer.courses.lesson}
                    {note.created_at ? ` · ${date(note.created_at, locale)}` : ''}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Callout tone="info" className="mt-4">
            {t.customer.courses.noNotes}
          </Callout>
        )}
      </section>
    </div>
  );
}
