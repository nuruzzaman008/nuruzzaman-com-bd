'use client';

import { useState } from 'react';
import type { CourseQuestion } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ApiError, api } from '@/lib/api/browser';
import { dateTime } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

const TEACHING_ROLES = ['super_admin', 'admin', 'instructor'];

/**
 * Dashboard -> Student questions: the questions students asked under their
 * lessons, with the answer box.
 *
 * Answering is for whoever may edit the course (super admins, admins,
 * instructors - CoursePolicy::update); editors and support see the list
 * without the box. The API refuses the rest regardless.
 */
export function QuestionInbox({ initial }: { initial: CourseQuestion[] }) {
  const { t } = useLocale();

  if (initial.length === 0) {
    return <p className="mt-6 text-sm text-muted">{t.admin.questions.empty}</p>;
  }

  return (
    <ul className="mt-6 space-y-4">
      {initial.map((question) => (
        <QuestionCard key={question.id} initial={question} />
      ))}
    </ul>
  );
}

function QuestionCard({ initial }: { initial: CourseQuestion }) {
  const { t, locale } = useLocale();
  const { user: viewer } = useSession();
  const [question, setQuestion] = useState(initial);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = t.admin.questions;
  const canAnswer = Boolean(
    viewer?.roles.some((role) => TEACHING_ROLES.includes(role)) ||
    viewer?.permissions?.includes('courses.manage'),
  );
  const shared = question.status === 'published';

  function explain(caught: unknown) {
    if (caught instanceof ApiError && caught.status === 403) {
      setError(copy.notTeacher);
    } else if (caught instanceof ApiError && caught.isValidation) {
      setError(caught.fields.body?.[0] ?? copy.failed);
    } else {
      setError(caught instanceof Error && caught.message ? caught.message : copy.failed);
    }
  }

  async function answer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);

    try {
      const response = await api<{ data: CourseQuestion }>(
        `/admin/course-questions/${question.id}/replies`,
        { method: 'POST', body: { body: reply } },
      );

      setQuestion(response.data);
      setReply('');
      setSent(true);
    } catch (caught) {
      explain(caught);
    } finally {
      setBusy(false);
    }
  }

  async function moderate(status: 'published' | 'in_review' | 'archived') {
    if (status === 'archived' && !window.confirm(copy.hideConfirm)) return;

    setBusy(true);
    setError(null);

    try {
      const response = await api<{ data: CourseQuestion }>(
        `/admin/course-questions/${question.id}/moderate`,
        { method: 'POST', body: { status } },
      );

      if (status === 'archived') {
        setRemoved(true);
      } else {
        setQuestion(response.data);
      }
    } catch (caught) {
      explain(caught);
    } finally {
      setBusy(false);
    }
  }

  if (removed) return null;

  return (
    <li className="rounded-[--radius-card] border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {copy.askedBy} <span className="font-semibold text-navy">{question.author_name}</span>
            {' · '}
            {dateTime(question.created_at, locale)}
          </p>
          <p className="mt-0.5 text-sm text-ink">
            {question.course?.title}
            {question.lesson ? ` → ${question.lesson.title}` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <span
            className={
              shared
                ? 'rounded-full bg-teal-soft px-2 py-0.5 text-teal'
                : 'rounded-full bg-surface px-2 py-0.5 text-navy'
            }
          >
            {shared ? copy.shared : copy.private}
          </span>
          {question.answered_at ? (
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-success">
              {copy.answered}
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-base whitespace-pre-line text-navy" data-authored="true">
        {question.body}
      </p>

      {question.replies?.length ? (
        <ul className="mt-4 space-y-3 border-s-2 border-blue/40 ps-4">
          {question.replies.map((row) => (
            <li key={row.id}>
              <p className="text-xs font-semibold text-navy">
                {row.author_name}
                <span className="ms-1.5 font-normal text-muted">
                  {row.from_instructor ? copy.teacher : copy.student} ·{' '}
                  {dateTime(row.created_at, locale)}
                </span>
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-line text-ink" data-authored="true">
                {row.body}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {sent ? (
        <Callout tone="success" role="status" className="mt-4">
          {copy.sent}
        </Callout>
      ) : null}
      {error ? (
        <Callout tone="danger" role="alert" className="mt-4">
          {error}
        </Callout>
      ) : null}

      {canAnswer ? (
        <form onSubmit={answer} className="mt-4">
          <label htmlFor={`answer-${question.id}`} className="block text-sm font-medium text-navy">
            {copy.replyLabel}
          </label>
          <textarea
            id={`answer-${question.id}`}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            required
            maxLength={5000}
            rows={3}
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || reply.trim() === ''}>
              {busy ? copy.sending : copy.send}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void moderate(shared ? 'in_review' : 'published')}
            >
              {shared ? copy.unshare : copy.share}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void moderate('archived')}
            >
              {copy.hide}
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
