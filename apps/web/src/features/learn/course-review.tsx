'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import type { CourseOutline } from '@nuruzzaman/contracts';

import { COURSE_ACTION, COURSE_ACTION_ON } from '@/features/learn/styles';
import { ApiError, api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * "Give a review" under the course list. Opens a small form in place, filled
 * with the learner's earlier review if there is one; a review is held for
 * moderation before it appears on the course page, and the form says so.
 */
export function CourseReview({
  courseSlug,
  review,
}: {
  courseSlug: string;
  review: CourseOutline['review'];
}) {
  const { locale, t } = useLocale();
  const words = t.learn;
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [title, setTitle] = useState(review?.title ?? '');
  const [body, setBody] = useState(review?.body ?? '');
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rating) {
      setError(words.reviewRatingRequired);

      return;
    }

    setSending(true);
    setError(null);

    try {
      await api(`/learn/${encodeURIComponent(courseSlug)}/reviews`, {
        method: 'POST',
        body: { rating, title: title.trim() || null, body: body.trim() || null },
      });
      setSaved(true);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : words.reviewFailed);
    } finally {
      setSending(false);
    }
  }

  const stars = (count: number) =>
    (count === 1 ? words.reviewStarsOne : words.reviewStars).replace(
      '{count}',
      number(count, locale),
    );

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((current) => !current)}
        className={cn(COURSE_ACTION, COURSE_ACTION_ON)}
      >
        {review ? words.editReview : words.giveReview}
      </button>

      {saved ? (
        <p role="status" className="mt-2 text-center text-xs text-success">
          {words.reviewSaved}
        </p>
      ) : review ? (
        <p className="mt-1 text-center text-xs text-muted">
          {review.status === 'published' ? words.reviewPublished : words.reviewPending}
        </p>
      ) : null}

      {open ? (
        <form
          id={formId}
          onSubmit={submit}
          className="mt-3 space-y-3 rounded-[--radius-card] border border-line bg-white p-4"
        >
          <fieldset>
            <legend className="text-sm font-semibold text-navy">{words.reviewRating}</legend>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((count) => (
                <label key={count} className="cursor-pointer">
                  {/* Named directly: the star beside it is decoration. */}
                  <input
                    type="radio"
                    name="rating"
                    value={count}
                    aria-label={stars(count)}
                    checked={rating === count}
                    onChange={() => setRating(count)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'block rounded px-0.5 text-2xl leading-none peer-focus-visible:outline-2 peer-focus-visible:outline-blue',
                      count <= rating ? 'text-amber' : 'text-line',
                    )}
                  >
                    ★
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-semibold text-navy">
            {words.reviewTitle}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              className="mt-1 block min-h-10 w-full rounded-lg border border-line px-3 text-sm font-normal text-ink"
            />
          </label>

          <label className="block text-sm font-semibold text-navy">
            {words.reviewBody}
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={3000}
              rows={4}
              className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-sm font-normal text-ink"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={sending}
            className="min-h-10 rounded-lg bg-blue px-4 text-sm font-semibold text-white hover:bg-navy disabled:opacity-60"
          >
            {sending ? words.reviewSending : words.reviewSend}
          </button>
        </form>
      ) : null}
    </div>
  );
}
