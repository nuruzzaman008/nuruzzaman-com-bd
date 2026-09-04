'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { LessonNote } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

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
  const { t } = useLocale();
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
        caught instanceof ApiError ? caught.message : t.learn.noteSaveFailed,
      );
    }
  }

  async function remove(id: number) {
    try {
      await api(`/learn/${encodeURIComponent(courseSlug)}/notes/${id}`, { method: 'DELETE' });
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.learn.noteDeleteFailed);
    }
  }

  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="font-bold text-navy">{t.learn.myNotes}</h2>
      <p className="mt-1 text-sm text-muted">{t.learn.notesPrivate}</p>

      <form onSubmit={save} className="mt-4">
        <label htmlFor="lesson-note" className="sr-only">
          {t.learn.newNote}
        </label>
        <textarea
          id="lesson-note"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={5000}
          rows={3}
          placeholder={t.learn.notePlaceholder}
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={isPending} className="mt-2">
          {isPending ? t.learn.savingNote : t.learn.saveNote}
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
              <p className="text-sm" data-authored="true">
                {note.body}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => remove(note.id)}
                aria-label={t.learn.deleteNote}
              >
                {t.learn.deleteNoteAction}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
