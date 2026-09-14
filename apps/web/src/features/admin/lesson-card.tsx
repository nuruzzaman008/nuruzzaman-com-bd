'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { MediaFileInput } from '@/components/ui/media-file-input';
import { SortableList } from '@/components/ui/sortable-list';
import { LessonAssessments } from '@/features/admin/lesson-assessments';
import { DocumentLinkAdder } from '@/features/admin/lesson-form';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { documentProvider, PROVIDER_NAMES } from '@/lib/document-link';
import { fileSize } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { MAX_FILE_BYTES, uploadInParts } from '@/lib/uploads/chunked-upload';

export type CardAsset = {
  id: number;
  title: string;
  size_bytes: number | null;
  kind?: 'file' | 'link';
  link_url?: string | null;
};

export type CardLesson = {
  id: number;
  title: string;
  type: string;
  video_url: string | null;
  video_provider: string | null;
  assets: CardAsset[];
};

type Adding = 'video' | 'file' | 'link' | null;

const SMALL =
  'inline-flex min-h-8 items-center rounded-md px-2 text-sm font-semibold text-blue hover:bg-blue-soft ' +
  'aria-expanded:bg-blue-soft disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-blue';

const INPUT = 'min-h-9 rounded-md border border-line bg-white px-3 text-sm text-navy';

/**
 * One lesson in the course editor's list, kept to a few lines: its title, then
 * one line for each thing it holds - "Video: …", "File: …", "Link: …" - and
 * small buttons that open a place to add more only when asked. Files and links
 * are put in order by dragging them.
 */
export function LessonCard({
  lesson,
  courseId,
  base,
  busy,
  run,
  reload,
  onProgress,
  onEdit,
  onMove,
  onDelete,
  assessmentOpen,
  onToggleAssessment,
}: {
  lesson: CardLesson;
  courseId: number;
  /** The course's admin API path, e.g. /admin/courses/12. */
  base: string;
  busy: boolean;
  /** The editor's action runner: shows errors and the saved message. */
  run: (work: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
  onProgress: (progress: { name: string; fraction: number } | null) => void;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  /** Deletes the whole lesson; the editor asks first. */
  onDelete: () => void;
  assessmentOpen: boolean;
  onToggleAssessment: () => void;
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const [adding, setAdding] = useState<Adding>(null);
  const [videoLink, setVideoLink] = useState('');
  const videoLinkId = useId();
  const lessonPath = `${base}/lessons/${lesson.id}`;
  const hasVideo = Boolean(lesson.video_url) || lesson.video_provider === 'uploaded';

  const typeLabel =
    (
      {
        video: bn ? 'ভিডিও পাঠ' : 'Video lesson',
        text: bn ? 'লেখা' : 'Text',
        download: bn ? 'ফাইল / রিসোর্স' : 'Resources',
        quiz: bn ? 'কুইজ' : 'Quiz',
        assignment: bn ? 'অ্যাসাইনমেন্ট' : 'Assignment',
      } as Record<string, string>
    )[lesson.type] ?? lesson.type;

  const addLabels = {
    video: bn ? '+ ভিডিও' : '+ Video',
    file: bn ? '+ ফাইল' : '+ File',
    link: bn ? '+ লিংক' : '+ Link',
  };

  function uploadFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    void run(async () => {
      try {
        for (const file of files) {
          if (file.size > MAX_FILE_BYTES) {
            throw new Error(
              bn
                ? `${file.name}: প্রতি ফাইল সর্বোচ্চ ১০০ MB।`
                : `${file.name}: files can be up to 100 MB.`,
            );
          }

          // Sent in 1 MB parts: the host refuses any single upload over 2 MB.
          const parts = await uploadInParts(file, (fraction) =>
            onProgress({ name: file.name, fraction }),
          );
          await api(`${lessonPath}/assets`, {
            method: 'POST',
            body: { ...parts, title: file.name.slice(0, 200) },
          });
        }

        setAdding(null);
      } finally {
        onProgress(null);
        await reload();
      }
    });
  }

  function uploadVideo(file: File | undefined) {
    if (!file) {
      return;
    }

    void run(async () => {
      try {
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(
            bn ? 'ভিডিও ১০০ MB-এর বেশি হতে পারবে না।' : 'Video must be 100 MB or smaller.',
          );
        }

        const parts = await uploadInParts(file, (fraction) =>
          onProgress({ name: file.name, fraction }),
        );
        await api(`${lessonPath}/video`, { method: 'POST', body: parts });
        setAdding(null);
      } finally {
        onProgress(null);
        await reload();
      }
    });
  }

  function saveVideoLink() {
    const url = videoLink.trim();

    if (!url) {
      return;
    }

    void run(async () => {
      await api(lessonPath, { method: 'PATCH', body: { video_url: url } });
      setVideoLink('');
      setAdding(null);
      await reload();
    });
  }

  function removeVideoLink() {
    if (
      !window.confirm(bn ? 'এই পাঠের ভিডিও লিংক সরিয়ে দেবেন?' : 'Remove this lesson’s video link?')
    ) {
      return;
    }

    void run(async () => {
      await api(lessonPath, { method: 'PATCH', body: { video_url: null } });
      await reload();
    });
  }

  function reorder(ids: number[]) {
    void run(async () => {
      await api(`${lessonPath}/assets/reorder`, { method: 'PUT', body: { ids } });
      await reload();
    });
  }

  function remove(asset: CardAsset) {
    if (!window.confirm(bn ? `“${asset.title}” মুছে ফেলবেন?` : `Delete “${asset.title}”?`)) {
      return;
    }

    void run(async () => {
      await api(`${lessonPath}/assets/${asset.id}`, { method: 'DELETE' });
      await reload();
    });
  }

  return (
    <li className="rounded-lg border border-line px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-navy">{lesson.title}</span>{' '}
          <span className="text-xs text-muted">· {typeLabel}</span>
        </p>
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            className="me-1 inline-flex min-h-8 items-center rounded-md bg-danger px-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            disabled={busy}
            aria-label={`${bn ? 'পাঠ মুছুন' : 'Delete lesson'}: ${lesson.title}`}
            onClick={onDelete}
          >
            {bn ? 'মুছুন' : 'Delete'}
          </button>
          {(['video', 'file', 'link'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={SMALL}
              aria-expanded={adding === kind}
              disabled={busy}
              onClick={() => setAdding((current) => (current === kind ? null : kind))}
            >
              {addLabels[kind]}
            </button>
          ))}
          <button
            type="button"
            className={SMALL}
            aria-expanded={assessmentOpen}
            onClick={onToggleAssessment}
          >
            {bn ? 'কুইজ / অ্যাসাইনমেন্ট' : 'Quiz / assignment'}
          </button>
          <button
            type="button"
            className={SMALL}
            aria-label={`${bn ? 'পাঠ সম্পাদনা' : 'Edit lesson'}: ${lesson.title}`}
            onClick={onEdit}
          >
            {bn ? 'সম্পাদনা' : 'Edit'}
          </button>
          <button
            type="button"
            className={cn(SMALL, 'text-muted')}
            disabled={busy}
            aria-label={`${bn ? 'পাঠ উপরে নিন' : 'Move lesson up'}: ${lesson.title}`}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className={cn(SMALL, 'text-muted')}
            disabled={busy}
            aria-label={`${bn ? 'পাঠ নিচে নিন' : 'Move lesson down'}: ${lesson.title}`}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
        </div>
      </div>

      {hasVideo ? (
        <div className="flex min-w-0 items-center gap-2 py-0.5 text-sm">
          <span aria-hidden="true" className="size-7 shrink-0" />
          <span className="shrink-0 font-semibold text-navy">{bn ? 'ভিডিও:' : 'Video:'}</span>
          {lesson.video_url ? (
            <a
              href={lesson.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate font-latin text-blue hover:underline"
            >
              {lesson.video_url}
            </a>
          ) : (
            <span className="min-w-0 truncate text-muted">
              {bn ? 'আপলোড করা ভিডিও ফাইল' : 'Uploaded video file'}
            </span>
          )}
          {lesson.video_url ? (
            <button
              type="button"
              className="ms-auto shrink-0 rounded px-1.5 text-danger hover:bg-danger-soft"
              disabled={busy}
              aria-label={`${bn ? 'ভিডিও লিংক সরান' : 'Remove video link'}: ${lesson.title}`}
              title={bn ? 'সরান' : 'Remove'}
              onClick={removeVideoLink}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      {lesson.assets.length > 0 ? (
        <SortableList
          items={lesson.assets}
          getKey={(asset) => asset.id}
          getLabel={(asset) => asset.title}
          label={bn ? `${lesson.title} — ফাইল ও লিংক` : `${lesson.title} — files and links`}
          handleLabel={
            bn
              ? '{name} সরান — টেনে ধরুন, অথবা ↑ ↓ চাপুন'
              : 'Move {name} — drag, or press the up and down arrows'
          }
          disabled={busy}
          onReorder={(ids) => reorder(ids.map(Number))}
          renderItem={(asset, handle) => (
            <div className="flex min-w-0 items-center gap-2 text-sm">
              {handle}
              <span className="shrink-0 font-semibold text-navy">
                {asset.kind === 'link' ? (bn ? 'লিংক:' : 'Link:') : bn ? 'ফাইল:' : 'File:'}
              </span>
              <span className="min-w-0 truncate" title={asset.title}>
                {asset.title}
              </span>
              {asset.kind === 'link' ? (
                <a
                  href={asset.link_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold text-blue hover:underline"
                >
                  {PROVIDER_NAMES[documentProvider(asset.link_url ?? '') ?? 'other']} ↗
                </a>
              ) : asset.size_bytes ? (
                <span className="shrink-0 text-xs text-muted">{fileSize(asset.size_bytes)}</span>
              ) : null}
              <button
                type="button"
                className="ms-auto shrink-0 rounded px-1.5 text-danger hover:bg-danger-soft"
                disabled={busy}
                aria-label={`${bn ? 'মুছুন' : 'Delete'}: ${asset.title}`}
                title={bn ? 'মুছুন' : 'Delete'}
                onClick={() => remove(asset)}
              >
                ×
              </button>
            </div>
          )}
        />
      ) : null}

      {!hasVideo && lesson.assets.length === 0 && adding === null ? (
        <p className="mt-0.5 text-xs text-muted">
          {bn
            ? 'এখনো ভিডিও বা ফাইল নেই — উপরের + বাটন দিয়ে যোগ করুন।'
            : 'No video or files yet — add them with the + buttons.'}
        </p>
      ) : null}

      {adding === 'video' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-surface p-3">
          <label htmlFor={videoLinkId} className="sr-only">
            {bn ? 'ভিডিও লিংক (YouTube, Facebook, Vimeo)' : 'Video link (YouTube, Facebook, Vimeo)'}
          </label>
          <input
            id={videoLinkId}
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.youtube.com/watch?v=…"
            value={videoLink}
            disabled={busy}
            onChange={(event) => setVideoLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveVideoLink();
              }
            }}
            className={cn(INPUT, 'min-w-0 flex-1 font-latin')}
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !videoLink.trim()}
            onClick={saveVideoLink}
          >
            {bn ? 'লিংক রাখুন' : 'Save link'}
          </Button>
          <span className="text-xs text-muted">{bn ? 'অথবা' : 'or'}</span>
          <MediaFileInput
            scope="course"
            courseId={courseId}
            type="file"
            accept=".mp4,.webm"
            disabled={busy}
            className="block"
            aria-label={bn ? 'ভিডিও ফাইল' : 'Video file'}
            triggerLabel={bn ? 'ভিডিও ফাইল (MP4/WebM)' : 'Video file (MP4/WebM)'}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              uploadVideo(file);
            }}
          />
        </div>
      ) : null}

      {adding === 'file' ? (
        <div className="mt-2 rounded-md bg-surface p-3">
          <MediaFileInput
            scope="course"
            courseId={courseId}
            type="file"
            multiple
            disabled={busy}
            className="block"
            aria-label={bn ? 'পাঠের ফাইল' : 'Lesson files'}
            triggerLabel={
              bn
                ? 'ফাইল বাছুন — Media থেকে বা নতুন আপলোড'
                : 'Choose files — from Media or upload new'
            }
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              uploadFiles(files);
            }}
          />
          <p className="mt-1 text-xs text-muted">
            {bn
              ? 'PDF, DOCX, XLSX, DWG, ZIP বা যেকোনো ফাইল · প্রতি ফাইল সর্বোচ্চ ১০০ MB'
              : 'PDF, DOCX, XLSX, DWG, ZIP or any file · up to 100 MB each'}
          </p>
        </div>
      ) : null}

      {adding === 'link' ? (
        <div className="mt-2 rounded-md bg-surface p-3">
          <DocumentLinkAdder
            disabled={busy}
            onAdd={(link) =>
              run(async () => {
                await api(`${lessonPath}/links`, {
                  method: 'POST',
                  body: { url: link.url, title: link.title || null },
                });
                setAdding(null);
                await reload();
              })
            }
          />
        </div>
      ) : null}

      {assessmentOpen ? (
        <div className="mt-2">
          <LessonAssessments courseId={courseId} lessonId={lesson.id} />
        </div>
      ) : null}
    </li>
  );
}
