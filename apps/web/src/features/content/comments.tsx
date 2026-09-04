'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PostComment } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { ErrorSummary, Field, Textarea } from '@/components/ui/form';
import { StarDisplay, StarInput } from '@/features/content/star-rating';
import { ApiError, api } from '@/lib/api/browser';
import { date } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';

/**
 * Reader comments and ratings at the foot of an article.
 *
 * Writing needs a session, and what is written is held for moderation. Both are
 * said plainly in the form rather than discovered afterwards: a reader who
 * types three paragraphs and then finds it will not appear today has been
 * treated badly.
 */
export function Comments({
  slug,
  comments,
  rating,
}: {
  slug: string;
  comments: PostComment[];
  rating: { average: number; count: number } | null;
}) {
  const { locale, t } = useLocale();
  const { user, isLoading } = useSession();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const rated = form.get('rating');

    try {
      await api(`/posts/${encodeURIComponent(slug)}/comments`, {
        method: 'POST',
        body: {
          body: form.get('body'),
          rating: rated ? Number(rated) : null,
          website: form.get('website'),
        },
      });

      setSubmitted(true);
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fields);
        setMessage(
          caught.status === 409
            ? t.comments.alreadyCommented
            : caught.isValidation
              ? null
              : caught.message,
        );
      } else {
        setMessage(t.comments.failed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="comments-heading"
          className="text-[length:var(--step-h2)] font-bold text-navy"
        >
          {t.comments.heading}
          {comments.length > 0 ? (
            <span className="font-latin ms-2 text-base font-medium text-muted">
              ({comments.length})
            </span>
          ) : null}
        </h2>

        {/* Only ever from real, approved ratings - never a placeholder. */}
        {rating ? <StarDisplay value={rating.average} count={rating.count} /> : null}
      </div>

      {comments.length === 0 ? (
        <p className="mt-4 text-muted">{t.comments.empty}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {comments.map((comment) => (
            <li key={comment.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy" data-authored="true">
                    {comment.author_name}
                  </p>
                  {comment.rating ? <StarDisplay value={comment.rating} /> : null}
                </div>

                <p className="mt-2 text-sm whitespace-pre-line text-ink" data-authored="true">
                  {comment.body}
                </p>

                {comment.created_at ? (
                  <p className="mt-3 text-xs text-muted">{date(comment.created_at, locale)}</p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <h3 className="font-bold text-navy">{t.comments.formHeading}</h3>

        {isLoading ? null : user ? (
          submitted ? (
            <Callout tone="success" className="mt-3" role="status">
              {t.comments.held}
            </Callout>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-3 space-y-4">
              <ErrorSummary errors={errors} />

              {message ? (
                <Callout tone="danger" role="alert">
                  {message}
                </Callout>
              ) : null}

              <StarInput />

              <Field label={t.comments.bodyLabel} required error={errors.body?.[0]}>
                {(props) => (
                  <Textarea name="body" placeholder={t.comments.bodyPlaceholder} {...props} />
                )}
              </Field>

              {/* Honeypot: hidden from people, tempting to bots. */}
              <div aria-hidden="true" className="hidden">
                <label htmlFor="comment-website">Website</label>
                <input
                  id="comment-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <p className="text-xs text-muted">{t.comments.moderationNote}</p>

              <Button type="submit" disabled={busy}>
                {busy ? t.comments.sending : t.comments.send}
              </Button>
            </form>
          )
        ) : (
          <Callout tone="info" className="mt-3">
            {t.comments.signInPrompt}
          </Callout>
        )}
      </div>
    </section>
  );
}
