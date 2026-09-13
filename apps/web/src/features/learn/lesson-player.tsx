'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Enrollment, Lesson } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Prose } from '@/components/ui/prose';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { number } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locale';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Lesson video, title, text, files and completion control.
 *
 * Laid out for watching first: the video at the top, the title under it with
 * the previous and next lessons beside it, then the article and the files.
 *
 * The heartbeat only reports how far into this lesson the learner has reached;
 * the course percentage is derived on the server from completed lessons, so a
 * tampered client cannot award itself progress or a certificate.
 */
const HEARTBEAT_MS = 20000;

const PILL =
  'inline-flex min-h-10 items-center rounded-full border border-blue px-5 text-sm font-semibold text-blue ' +
  'hover:bg-blue-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue';

export type LessonLink = { slug: string; title: string; is_unlocked: boolean };

function fileSize(bytes: number, locale: Locale): string {
  if (bytes >= 1024 * 1024) {
    return `${number(Math.round((bytes / 1024 / 1024) * 10) / 10, locale)} MB`;
  }

  return `${number(Math.max(1, Math.round(bytes / 1024)), locale)} KB`;
}

export function LessonPlayer({
  courseSlug,
  lesson,
  isCompleted,
  previous = null,
  next = null,
}: {
  courseSlug: string;
  lesson: Lesson;
  isCompleted: boolean;
  previous?: LessonLink | null;
  next?: LessonLink | null;
}) {
  const { t, locale } = useLocale();
  const words = t.learn;
  const router = useRouter();
  const [completed, setCompleted] = useState(isCompleted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watched = useRef(0);

  const sendHeartbeat = useCallback(async () => {
    if (watched.current <= 0) {
      return;
    }

    try {
      await api<{ data: Enrollment }>(
        `/learn/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lesson.slug)}/heartbeat`,
        { method: 'POST', body: { watched_seconds: Math.round(watched.current) } },
      );
    } catch {
      // A dropped heartbeat is not worth interrupting the lesson for; the next
      // one carries the same monotonic value.
    }
  }, [courseSlug, lesson.slug]);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      watched.current = (Date.now() - started) / 1000;
      void sendHeartbeat();
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(timer);
      watched.current = (Date.now() - started) / 1000;
      void sendHeartbeat();
    };
  }, [sendHeartbeat]);

  async function markComplete() {
    setBusy(true);
    setError(null);

    try {
      await api<{ data: Enrollment }>(
        `/learn/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lesson.slug)}/complete`,
        { method: 'POST' },
      );

      setCompleted(true);
      router.refresh();
    } catch {
      setError(words.markFailed);
    } finally {
      setBusy(false);
    }
  }

  const playback = lesson.playback;
  const video = !playback ? null : playback.available && playback.url ? (
    <div className="aspect-video w-full overflow-hidden rounded-[--radius-card] bg-navy">
      {playback.kind === 'video' ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={playback.url}
          className="size-full"
          aria-label={lesson.title}
        />
      ) : playback.kind === 'link' ? (
        <div className="flex h-full items-center justify-center p-6">
          <a
            href={playback.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white px-5 py-3 font-semibold text-navy"
          >
            {words.videoWebsite} ↗
          </a>
        </div>
      ) : (
        <iframe
          src={playback.url}
          title={lesson.title}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
          allowFullScreen
          className="size-full"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  ) : lesson.type === 'video' ? (
    <Callout tone="info">{playback.message ?? words.noVideo}</Callout>
  ) : null;

  return (
    <article>
      {video}

      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-x-6 gap-y-3',
          video ? 'mt-5' : null,
        )}
      >
        <h1 data-authored="true" className="min-w-0 flex-1 text-xl font-bold text-navy sm:text-2xl">
          {lesson.title}
        </h1>

        {previous || next ? (
          <nav aria-label={words.lessonNavigation} className="flex shrink-0 gap-2">
            {previous ? (
              <Link
                href={`/learn/${courseSlug}/${previous.slug}`}
                className={PILL}
                aria-label={`${words.previous}: ${previous.title}`}
                title={previous.title}
              >
                {words.previous}
              </Link>
            ) : null}
            {next ? (
              next.is_unlocked ? (
                <Link
                  href={`/learn/${courseSlug}/${next.slug}`}
                  className={PILL}
                  aria-label={`${words.next}: ${next.title}`}
                  title={next.title}
                >
                  {words.next}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title={words.lockedLesson}
                  className={cn(PILL, 'cursor-not-allowed opacity-50 hover:bg-transparent')}
                >
                  {words.next}
                </span>
              )
            ) : null}
          </nav>
        ) : null}
      </div>

      {lesson.body_html ? <Prose html={lesson.body_html} className="mt-6" /> : null}

      {lesson.assets?.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-navy">{words.lessonFiles}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {lesson.assets.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-white p-3"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  className="size-8 shrink-0 text-blue"
                >
                  <path d="M11.5 2.5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6zM11.5 2.5V6H15" />
                </svg>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-medium text-navy"
                    data-authored="true"
                    title={asset.title}
                  >
                    {asset.title}
                  </span>
                  {asset.size_bytes ? (
                    <span
                      className="block text-xs text-muted"
                      title={
                        asset.checksum_sha256 ? `SHA-256: ${asset.checksum_sha256}` : undefined
                      }
                    >
                      {fileSize(asset.size_bytes, locale)}
                    </span>
                  ) : null}
                </span>
                {asset.download_url ? (
                  <a
                    href={asset.download_url}
                    aria-label={`${words.download}: ${asset.title}`}
                    className="shrink-0 rounded-full bg-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy"
                  >
                    {words.download}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-5">
        {completed ? (
          <p className="font-semibold text-success">{words.lessonComplete}</p>
        ) : (
          <Button type="button" onClick={markComplete} disabled={busy}>
            {busy ? words.marking : words.markComplete}
          </Button>
        )}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
