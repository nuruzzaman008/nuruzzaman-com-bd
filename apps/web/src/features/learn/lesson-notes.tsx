'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { LessonNote } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ApiError, api } from '@/lib/api/browser';

/**
 * Private note-taking on a lesson.
 *
 * Notes are scoped to the learner's own enrolment on the server, so nothing
 * here needs to guard against reading someone else's; the panel only has to be
 * clear that they are private.
 */
export function LessonNotes({
  courseSlug,
  lessonSlug,
  notes,
}: {
  courseSlug: string;
  lessonSlug: string;
  notes: LessonNote[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await api<{ data: LessonNote }>(
        `/learn/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}/notes`,
        { method: 'POST', body: { body } },
      );

      setBody('');
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'নোটটি সংরক্ষণ করা যায়নি।',
      );
    }
  }

  async function remove(id: number) {
    try {
      await api(`/learn/${encodeURIComponent(courseSlug)}/notes/${id}`, { method: 'DELETE' });
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'নোটটি মুছে ফেলা যায়নি।');
    }
  }

  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="font-bold text-navy">আমার নোট</h2>
      <p className="mt-1 text-sm text-muted">নোট শুধু আপনি দেখতে পান।</p>

      <form onSubmit={save} className="mt-4">
        <label htmlFor="lesson-note" className="sr-only">
          নতুন নোট
        </label>
        <textarea
          id="lesson-note"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={5000}
          rows={3}
          placeholder="এই লেসনের গুরুত্বপূর্ণ কথা লিখে রাখুন…"
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending ? 'সংরক্ষণ হচ্ছে…' : 'নোট সংরক্ষণ করুন'}
        </Button>
      </form>

      {error ? (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      ) : null}

      {notes.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-3 rounded-md border border-line p-3"
            >
              <p className="text-sm">{note.body}</p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => remove(note.id)}
                aria-label="এই নোটটি মুছুন"
              >
                মুছুন
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
