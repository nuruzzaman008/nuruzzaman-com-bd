'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Enrollment, Lesson } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Prose } from '@/components/ui/prose';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Lesson body, video and completion control.
 *
 * The heartbeat only reports how far into this lesson the learner has reached;
 * the course percentage is derived on the server from completed lessons, so a
 * tampered client cannot award itself progress or a certificate.
 */
const HEARTBEAT_MS = 20000;

export function LessonPlayer({
  courseSlug,
  lesson,
  isCompleted,
}: {
  courseSlug: string;
  lesson: Lesson;
  isCompleted: boolean;
}) {
  const { t } = useLocale();
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
      setError(t.learn.markFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article>
      <h1 data-authored="true" className="text-[length:var(--step-h1)] font-bold text-navy">
        {lesson.title}
      </h1>

      {lesson.playback ? (
        lesson.playback.available && lesson.playback.url ? (
          <div className="mt-6 aspect-video w-full overflow-hidden rounded-[--radius-card] border border-line bg-navy">
            <iframe
              src={lesson.playback.url}
              title={lesson.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="size-full"
            />
          </div>
        ) : lesson.type === 'video' ? (
          <Callout tone="info" className="mt-6">
            {lesson.playback.message ?? t.learn.noVideo}
          </Callout>
        ) : null
      ) : null}

      {lesson.body_html ? <Prose html={lesson.body_html} className="mt-8" /> : null}

      {lesson.assets?.length ? (
        <section className="mt-8">
          <h2 className="font-bold text-navy">{t.learn.lessonFiles}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lesson.assets.map((asset) => (
              <li key={asset.id} className="rounded-lg border border-line bg-white px-4 py-3">
                <span className="font-medium text-navy" data-authored="true">
                  {asset.title}
                </span>
                {asset.checksum_sha256 ? (
                  <span className="font-latin mt-1 block text-xs break-all text-muted">
                    SHA-256: {asset.checksum_sha256}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-6">
        {completed ? (
          <p className="font-semibold text-success">{t.learn.lessonComplete}</p>
        ) : (
          <Button type="button" size="lg" onClick={markComplete} disabled={busy}>
            {busy ? t.learn.marking : t.learn.markComplete}
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
