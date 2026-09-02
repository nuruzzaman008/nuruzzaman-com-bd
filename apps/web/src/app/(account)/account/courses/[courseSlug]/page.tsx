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
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('কোর্সের অগ্রগতি');

const STATUS_LABELS: Record<string, string> = {
  not_submitted: 'জমা দেওয়া হয়নি',
  submitted: 'জমা হয়েছে, যাচাই বাকি',
  in_review: 'যাচাই চলছে',
  approved: 'গৃহীত',
  rejected: 'ফেরত পাঠানো হয়েছে',
};

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
            আমার কোর্স
          </Link>
        </p>
        <h1 className="mt-1 text-[length:var(--step-h1)] font-bold text-navy">
          {outline.course.title}
        </h1>

        <div className="mt-4 flex items-center gap-4">
          <div
            role="progressbar"
            aria-valuenow={outline.enrollment.progress_percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="কোর্সের অগ্রগতি"
            className="h-2 flex-1 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${outline.enrollment.progress_percent}%` }}
            />
          </div>
          <span className="font-latin text-sm font-semibold text-navy">
            {outline.enrollment.progress_percent}%
          </span>
        </div>

        {next ? (
          <ButtonLink href={`/learn/${courseSlug}/${next.slug}`} className="mt-5">
            {outline.enrollment.progress_percent > 0 ? 'যেখানে ছিলেন সেখান থেকে' : 'শুরু করুন'}
          </ButtonLink>
        ) : null}
      </header>

      {announcements?.data.length ? (
        <section>
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">ঘোষণা</h2>
          <ul className="mt-4 space-y-3">
            {announcements.data.map((announcement) => (
              <li key={announcement.id}>
                <Card className="p-5">
                  <h3 className="font-bold text-navy">{announcement.title}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {announcement.author_name ? `${announcement.author_name} · ` : ''}
                    {announcement.published_at ? date(announcement.published_at) : ''}
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
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">মার্কস</h2>

          <Card className="mt-4 p-5">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted">লেসন শেষ</dt>
                <dd className="font-latin mt-1 text-2xl font-bold text-navy">
                  {number(marks.lessons.completed)}
                  <span className="text-base font-normal text-muted">
                    {' / '}
                    {number(marks.lessons.total)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">গড় নম্বর</dt>
                <dd className="font-latin mt-1 text-2xl font-bold text-navy">
                  {/* Null until something has been graded — an ungraded
                      submission is not a zero. */}
                  {marks.average_percent === null ? (
                    <span className="text-base font-normal text-muted">এখনো মূল্যায়ন হয়নি</span>
                  ) : (
                    `${marks.average_percent}%`
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">পাস মার্ক</dt>
                <dd className="font-latin mt-1 text-2xl font-bold text-navy">
                  {marks.pass_percentage}%
                </dd>
              </div>
            </dl>
          </Card>

          {marks.quizzes.length > 0 ? (
            <div className="mt-5">
              <h3 className="font-bold text-navy">কুইজ</h3>
              <ul className="mt-3 divide-y divide-line rounded-[--radius-card] border border-line">
                {marks.quizzes.map((quiz) => (
                  <li
                    key={quiz.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-navy">{quiz.title}</p>
                      <p className="font-latin text-xs text-muted">
                        চেষ্টা {number(quiz.attempts_used)} / {number(quiz.attempts_allowed)} ·
                        পাস {quiz.pass_percentage}%
                      </p>
                    </div>
                    {quiz.score_percent === null ? (
                      <Badge>দেওয়া হয়নি</Badge>
                    ) : (
                      <Badge tone={quiz.passed ? 'success' : 'danger'}>
                        {quiz.score_percent}%
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {marks.assignments.length > 0 ? (
            <div className="mt-5">
              <h3 className="font-bold text-navy">অ্যাসাইনমেন্ট</h3>
              <ul className="mt-3 divide-y divide-line rounded-[--radius-card] border border-line">
                {marks.assignments.map((assignment) => (
                  <li key={assignment.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-navy">{assignment.title}</p>
                      {assignment.score_percent === null ? (
                        <Badge>{STATUS_LABELS[assignment.status] ?? assignment.status}</Badge>
                      ) : (
                        <Badge
                          tone={
                            assignment.score_percent >= assignment.pass_percentage
                              ? 'success'
                              : 'danger'
                          }
                        >
                          {assignment.score_percent}%
                        </Badge>
                      )}
                    </div>
                    {assignment.feedback ? (
                      <p className="mt-2 text-sm text-muted">{assignment.feedback}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="text-[length:var(--step-h2)] font-bold text-navy">প্রশ্ন ও উত্তর</h2>
        <p className="mt-2 text-sm text-muted">
          প্রশ্ন মডারেশনের পর ক্লাসের সবার কাছে দেখা যায়। আপনার নিজের প্রশ্ন সেই সময়েও
          আপনি দেখতে পাবেন।
        </p>

        <AskQuestion courseSlug={courseSlug} className="mt-4" />

        {questions?.data.length ? (
          <ul className="mt-6 space-y-4">
            {questions.data.map((question) => (
              <li key={question.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-bold text-navy">{question.title}</h3>
                    <div className="flex gap-2">
                      {question.is_pinned ? <Badge tone="info">পিন করা</Badge> : null}
                      {question.status !== 'published' && question.is_mine ? (
                        <Badge tone="warning">মডারেশনে</Badge>
                      ) : null}
                      {question.resolved_at ? <Badge tone="success">সমাধান হয়েছে</Badge> : null}
                    </div>
                  </div>

                  <p className="mt-2 text-sm">{question.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    {question.author_name ?? 'শিক্ষার্থী'}
                    {question.lesson?.title ? ` · ${question.lesson.title}` : ''}
                    {question.created_at ? ` · ${date(question.created_at)}` : ''}
                  </p>

                  {question.replies?.length ? (
                    <ul className="mt-4 space-y-3 border-t border-line pt-4">
                      {question.replies.map((reply) => (
                        <li key={reply.id} className="text-sm">
                          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="font-medium text-navy">
                              {reply.author_name ?? 'অংশগ্রহণকারী'}
                            </span>
                            {reply.from_instructor ? (
                              <Badge tone="teal">ইনস্ট্রাক্টর</Badge>
                            ) : null}
                            {reply.created_at ? <span>{date(reply.created_at)}</span> : null}
                          </p>
                          <p className="mt-1">{reply.body}</p>
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
            এই কোর্সে এখনো কোনো প্রশ্ন নেই। আটকে গেলে প্রথম প্রশ্নটি আপনিই করুন।
          </Callout>
        )}
      </section>

      <section>
        <h2 className="text-[length:var(--step-h2)] font-bold text-navy">আমার নোট</h2>
        <p className="mt-2 text-sm text-muted">
          নোট শুধু আপনি দেখতে পান। লেসন পড়ার সময় নোট যোগ করা যায়।
        </p>

        {notes?.data.length ? (
          <ul className="mt-4 space-y-3">
            {notes.data.map((note) => (
              <li key={note.id}>
                <Card className="p-4">
                  <p className="text-sm">{note.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    {note.lesson?.title ?? 'লেসন'}
                    {note.created_at ? ` · ${date(note.created_at)}` : ''}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Callout tone="info" className="mt-4">
            এখনো কোনো নোট নেই।
          </Callout>
        )}
      </section>
    </div>
  );
}
