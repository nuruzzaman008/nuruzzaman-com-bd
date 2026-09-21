'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { CourseQuestion } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ApiError, api } from '@/lib/api/browser';
import { dateTime } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * "Ask the teacher", under a lesson.
 *
 * Unlike the notes below it, a question goes to the teaching team: it appears
 * in Dashboard -> Student questions, and the answer comes back here (and by
 * email). It is private to the student and the teachers unless a teacher
 * shows it to the class; the list here is what this student may see - their
 * own questions, and the ones shared with everyone.
 */
export function LessonQuestions({
  courseSlug,
  lessonSlug,
  questions,
}: {
  courseSlug: string;
  lessonSlug: string;
  questions: CourseQuestion[];
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);

    try {
      await api(`/learn/${encodeURIComponent(courseSlug)}/questions`, {
        method: 'POST',
        body: { body, lesson: lessonSlug },
      });

      setBody('');
      setSent(true);
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof ApiError && caught.message ? caught.message : t.learn.askFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 border-t border-line pt-6" aria-labelledby="lesson-questions-title">
      <h2 id="lesson-questions-title" className="font-bold text-navy">
        {t.learn.lessonAskTitle}
      </h2>
      <p className="mt-1 text-sm text-muted">{t.learn.lessonAskNote}</p>

      <form onSubmit={ask} className="mt-4">
        <label htmlFor="lesson-question" className="sr-only">
          {t.learn.lessonAskLabel}
        </label>
        <textarea
          id="lesson-question"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={5000}
          rows={3}
          placeholder={t.learn.lessonAskPlaceholder}
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy || isPending || body.trim() === ''} className="mt-2">
          {busy ? t.learn.lessonAskSending : t.learn.lessonAskSend}
        </Button>
      </form>

      {sent ? (
        <Callout tone="success" role="status" className="mt-3">
          {t.learn.lessonAskSent}
        </Callout>
      ) : null}

      {error ? (
        <Callout tone="danger" role="alert" className="mt-3">
          {error}
        </Callout>
      ) : null}

      {questions.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {questions.map((question) => (
            <li key={question.id} className="rounded-md border border-line p-3">
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className="font-semibold text-navy">
                  {question.is_mine ? t.learn.lessonAskYours : question.author_name}
                </span>
                <span>{dateTime(question.created_at, locale)}</span>
                <span>
                  ·{' '}
                  {question.status === 'published'
                    ? t.learn.lessonAskShared
                    : t.learn.lessonAskPrivate}
                </span>
              </p>
              <p className="mt-1.5 text-sm whitespace-pre-line text-ink" data-authored="true">
                {question.body}
              </p>

              {question.replies?.length ? (
                <ul className="mt-3 space-y-2 border-s-2 border-blue/40 ps-3">
                  {question.replies.map((reply) => (
                    <li key={reply.id}>
                      <p className="text-xs font-semibold text-navy">
                        {reply.author_name}
                        {reply.from_instructor ? (
                          <span className="ms-1.5 rounded bg-blue-soft px-1.5 py-0.5 font-normal text-blue">
                            {t.learn.lessonAskTeacher}
                          </span>
                        ) : null}
                      </p>
                      <p
                        className="mt-0.5 text-sm whitespace-pre-line text-ink"
                        data-authored="true"
                      >
                        {reply.body}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs font-semibold text-warning">
                  {t.learn.lessonAskWaiting}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
