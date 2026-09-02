'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { CourseQuestion } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ApiError, api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';

/**
 * Asks a question on a course.
 *
 * The form says up front that the question is moderated before the rest of the
 * class sees it, so a learner is not left wondering why their post did not
 * appear.
 */
export function AskQuestion({
  courseSlug,
  lessonSlug,
  className,
}: {
  courseSlug: string;
  lessonSlug?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await api<{ data: CourseQuestion }>(
        `/learn/${encodeURIComponent(courseSlug)}/questions`,
        { method: 'POST', body: { title, body, lesson: lessonSlug } },
      );

      setSubmitted(true);
      setTitle('');
      setBody('');
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'প্রশ্নটি পাঠানো যায়নি। আবার চেষ্টা করুন।',
      );
    }
  }

  if (!open) {
    return (
      <div className={className}>
        {submitted ? (
          <Callout tone="success" className="mb-3">
            প্রশ্ন জমা হয়েছে। মডারেশনের পর এটি ক্লাসের সবার কাছে দেখা যাবে।
          </Callout>
        ) : null}
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          প্রশ্ন করুন
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn('rounded-[--radius-card] border border-line p-5', className)}>
      <label htmlFor="question-title" className="block text-sm font-medium text-navy">
        প্রশ্নের শিরোনাম
      </label>
      <input
        id="question-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        maxLength={255}
        className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm"
      />

      <label htmlFor="question-body" className="mt-4 block text-sm font-medium text-navy">
        বিস্তারিত
      </label>
      <textarea
        id="question-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        required
        maxLength={5000}
        rows={4}
        className="mt-1.5 w-full rounded-md border border-line px-3 py-2 text-sm"
      />

      <p className="mt-2 text-xs text-muted">
        প্রশ্ন মডারেশনের পর প্রকাশিত হয়। ততক্ষণ শুধু আপনি ও ইনস্ট্রাক্টর দেখতে পাবেন।
      </p>

      {error ? (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      ) : null}

      <div className="mt-4 flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'পাঠানো হচ্ছে…' : 'পাঠান'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          বাতিল
        </Button>
      </div>
    </form>
  );
}
