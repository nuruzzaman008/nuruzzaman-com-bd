'use client';

import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { MarkdownTextarea } from '@/components/ui/markdown-editor';
import { MediaFileInput } from '@/components/ui/media-file-input';
import { documentProvider, PROVIDER_NAMES } from '@/lib/document-link';
import { fileSize, number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { slugify } from '@/lib/slug';

const INPUT = 'mt-1 min-h-10 w-full rounded-lg border border-line bg-white px-3 py-1.5 text-navy';
const FIELD = 'min-h-9 rounded-md border border-line bg-white px-3 text-sm text-navy';
const LABEL = 'text-sm font-medium text-navy';
const PANEL = 'rounded-lg border border-line px-3 py-2';

export type EditableLesson = {
  id: number;
  title: string;
  slug: string;
  type: string;
  course_section_id: number;
  body_markdown: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  drip_days: number | null;
  is_free_preview: boolean;
  assets: { id: number }[];
};

export type DocumentLinkDraft = { url: string; title: string };

/** What the form hands back: the lesson, and the documents to attach to it once saved. */
export type LessonDraft = {
  values: {
    title: string;
    slug: string;
    type: string;
    course_section_id: number;
    body_markdown: string | null;
    video_url: string | null;
    duration_seconds: number | null;
    drip_days: number | null;
    is_free_preview: boolean;
  };
  files: File[];
  links: DocumentLinkDraft[];
};

/**
 * A lesson slug nobody has to type: what was typed, else the title's, else -
 * for a title with no English letters - `lesson-NN`; made unique among the
 * course's other lessons, which the API requires.
 */
export function lessonSlug(
  typed: string,
  title: string,
  taken: string[],
  position: number,
): string {
  const base = slugify(typed) || slugify(title) || `lesson-${String(position).padStart(2, '0')}`;
  let slug = base;

  for (let n = 2; taken.includes(slug); n++) {
    slug = `${base.slice(0, 170)}-${n}`;
  }

  return slug;
}

/**
 * A Google Drive, Dropbox or other https:// link with an optional name, on one
 * line, added with the button or with Enter - which never submits the form
 * around it.
 */
export function DocumentLinkAdder({
  onAdd,
  disabled,
}: {
  onAdd: (link: DocumentLinkDraft) => void | Promise<void>;
  disabled?: boolean;
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const urlId = useId();
  const titleId = useId();

  async function add() {
    if (!documentProvider(url)) {
      setError(
        bn
          ? 'পুরো লিংকটি দিন — https:// দিয়ে শুরু, যেমন Google Drive বা Dropbox এর share link।'
          : 'Paste the full link, starting with https:// — for example a Google Drive or Dropbox share link.',
      );

      return;
    }

    setError(null);
    await onAdd({ url: url.trim(), title: title.trim() });
    setUrl('');
    setTitle('');
  }

  function onEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void add();
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={urlId} className="sr-only">
          {bn
            ? 'ডকুমেন্টের লিংক (Google Drive, Dropbox, OneDrive…)'
            : 'Document link (Google Drive, Dropbox, OneDrive…)'}
        </label>
        {/* Text, not type="url": a half-typed address must not block saving the lesson. */}
        <input
          id={urlId}
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder={
            bn
              ? 'Google Drive / Dropbox লিংক — https://…'
              : 'Google Drive / Dropbox link — https://…'
          }
          value={url}
          disabled={disabled}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={onEnter}
          className={`${FIELD} min-w-0 flex-[2_1_14rem] font-latin`}
        />
        <label htmlFor={titleId} className="sr-only">
          {bn ? 'নাম (ঐচ্ছিক)' : 'Name (optional)'}
        </label>
        <input
          id={titleId}
          type="text"
          maxLength={200}
          placeholder={bn ? 'নাম (ঐচ্ছিক)' : 'Name (optional)'}
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={onEnter}
          className={`${FIELD} min-w-0 flex-[1_1_8rem]`}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || !url.trim()}
          onClick={() => void add()}
        >
          {bn ? 'লিংক যোগ করুন' : 'Add link'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted">
        {bn
          ? 'Google Drive-এ ফাইলের Share থেকে "Anyone with the link" করে দিন, নাহলে শিক্ষার্থী খুলতে পারবে না।'
          : 'In Google Drive, share the file as "Anyone with the link", or students cannot open it.'}
      </p>
    </div>
  );
}

/**
 * Adding or editing a lesson, kept short: title, section and type on one row,
 * the video link, and small buttons for files and links. The lesson's text and
 * the settings most lessons leave alone are folded away until opened.
 *
 * The slug is made for the author: a new lesson's follows its title as it is
 * typed, until the slug itself is typed into; an existing lesson's never
 * changes by itself, since that would break links to it. Documents - files
 * and Google Drive or Dropbox links - are gathered here and attached by the
 * editor as soon as the lesson is saved.
 */
export function LessonForm({
  courseId,
  sections,
  lesson,
  courseLessonSlugs,
  lessonCount,
  busy,
  onSave,
  onCancel,
}: {
  courseId?: number;
  sections: { id: number; title: string }[];
  lesson: EditableLesson | null;
  /** Every lesson slug in the course, so a new one can be made unique. */
  courseLessonSlugs: string[];
  lessonCount: number;
  busy: boolean;
  onSave: (draft: LessonDraft) => void;
  onCancel: () => void;
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [slug, setSlug] = useState(lesson?.slug ?? '');
  const [slugTyped, setSlugTyped] = useState(lesson !== null);
  const [type, setType] = useState(lesson?.type ?? 'video');
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<DocumentLinkDraft[]>([]);
  const [addingLink, setAddingLink] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(
    Boolean(lesson?.body_markdown) || lesson?.type === 'text',
  );
  const fileInputId = useId();
  const taken = courseLessonSlugs.filter((row) => row !== lesson?.slug);

  function changeTitle(value: string) {
    setTitle(value);

    if (!slugTyped) {
      setSlug(slugify(value));
    }
  }

  function changeType(value: string) {
    setType(value);

    // A text lesson is its text, so the place to write it opens.
    if (value === 'text') {
      setBodyOpen(true);
    }
  }

  function addFiles(chosen: File[]) {
    setFiles((current) => [
      ...current,
      ...chosen.filter(
        (file) => !current.some((row) => row.name === file.name && row.size === file.size),
      ),
    ]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const whole = (name: string) => (data.get(name) ? Number(data.get(name)) : null);

    onSave({
      values: {
        title: title.trim(),
        slug: lessonSlug(slug, title, taken, lessonCount + 1),
        type,
        course_section_id: Number(data.get('course_section_id')),
        body_markdown: String(data.get('body_markdown') ?? '') || null,
        // Only a video lesson keeps a video link.
        video_url: type === 'video' ? String(data.get('video_url') ?? '').trim() || null : null,
        duration_seconds: whole('duration_seconds'),
        drip_days: whole('drip_days'),
        is_free_preview: data.get('is_free_preview') === 'on',
      },
      files,
      links,
    });
  }

  return (
    <form
      id="lesson-editor"
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-line bg-white p-4"
    >
      <h2 className="text-lg font-bold text-navy">
        {lesson ? (bn ? 'পাঠ সম্পাদনা' : 'Edit lesson') : bn ? 'নতুন পাঠ যোগ করুন' : 'Add lesson'}
      </h2>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className={LABEL}>
          {bn ? 'পাঠের নাম' : 'Lesson title'}
          <input
            required
            name="title"
            value={title}
            onChange={(event) => changeTitle(event.target.value)}
            className={INPUT}
          />
        </label>
        <label className={LABEL}>
          {bn ? 'অধ্যায়' : 'Section'}
          <select
            name="course_section_id"
            defaultValue={lesson?.course_section_id ?? sections[0]?.id}
            className={INPUT}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          {bn ? 'পাঠের ধরন' : 'Lesson type'}
          <select
            name="type"
            value={type}
            onChange={(event) => changeType(event.target.value)}
            className={INPUT}
          >
            <option value="video">{bn ? 'ভিডিও + ফাইল' : 'Video + files'}</option>
            <option value="text">{bn ? 'লেখা + ফাইল' : 'Text + files'}</option>
            <option value="download">{bn ? 'ফাইল / রিসোর্স' : 'Download / resources'}</option>
            {lesson && ['quiz', 'assignment'].includes(lesson.type) ? (
              <option value={lesson.type}>{lesson.type}</option>
            ) : null}
          </select>
        </label>
      </div>

      {type === 'video' ? (
        <label className={`block ${LABEL}`}>
          {bn
            ? 'ভিডিও লিংক (ঐচ্ছিক) — YouTube, Facebook, Vimeo'
            : 'Video URL (optional) — YouTube, Facebook, Vimeo'}
          <input
            name="video_url"
            type="url"
            pattern="https://.*"
            defaultValue={lesson?.video_url ?? ''}
            placeholder="https://www.youtube.com/watch?v=…"
            className={`${INPUT} font-latin`}
          />
        </label>
      ) : lesson?.video_url ? (
        <p className="text-sm text-danger">
          {bn
            ? 'এই পাঠের ভিডিও লিংকটি সংরক্ষণ করলে সরিয়ে দেওয়া হবে।'
            : 'Saving will remove this lesson’s video link.'}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={LABEL}>{bn ? 'ফাইল ও ডকুমেন্ট:' : 'Files & documents:'}</span>
          <label htmlFor={fileInputId} className="sr-only">
            {bn ? 'ফাইল বাছুন (একাধিক)' : 'Choose files (several at once)'}
          </label>
          <MediaFileInput
            scope="course"
            courseId={courseId}
            id={fileInputId}
            type="file"
            multiple
            disabled={busy}
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
            className="block"
            triggerLabel={
              bn
                ? 'ফাইল বাছুন — Media থেকে বা নতুন আপলোড'
                : 'Choose files — from Media or upload new'
            }
            aria-describedby={`${fileInputId}-help`}
          />
          <Button
            type="button"
            variant="secondary"
            aria-expanded={addingLink}
            disabled={busy}
            onClick={() => setAddingLink((open) => !open)}
          >
            {bn ? '+ লিংক' : '+ Link'}
          </Button>
        </div>
        <p id={`${fileInputId}-help`} className="text-xs text-muted">
          {bn
            ? 'Media থেকে আগের ফাইল বাছুন বা নতুন আপলোড দিন · PDF, DOCX, XLSX, DWG বা যেকোনো ফাইল, প্রতিটি সর্বোচ্চ ১০০ MB · পাঠ সংরক্ষণ করলে যুক্ত হবে।'
            : 'Pick earlier uploads from Media or upload new · PDF, DOCX, XLSX, DWG or any file, up to 100 MB each · attached when the lesson is saved.'}
          {lesson && lesson.assets.length > 0
            ? bn
              ? ` এই পাঠে আগে থেকে ${number(lesson.assets.length, locale)}টি আছে — উপরের তালিকায় সাজান বা মুছুন।`
              : ` This lesson already has ${lesson.assets.length} — reorder or delete them in the list above.`
            : null}
        </p>

        {addingLink ? (
          <div className="rounded-md bg-surface p-3">
            <DocumentLinkAdder
              disabled={busy}
              onAdd={(link) => setLinks((current) => [...current, link])}
            />
          </div>
        ) : null}

        {files.length > 0 || links.length > 0 ? (
          <ul
            aria-label={bn ? 'সংরক্ষণের সময় যুক্ত হবে' : 'Attached when saved'}
            className="divide-y divide-line rounded-md border border-line text-sm"
          >
            {files.map((file, index) => (
              <li
                key={`file-${file.name}-${file.size}`}
                className="flex min-w-0 items-center gap-2 px-3 py-1.5"
              >
                <span className="shrink-0 font-semibold text-navy">{bn ? 'ফাইল:' : 'File:'}</span>
                <span className="min-w-0 truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-muted">{fileSize(file.size) ?? '0 B'}</span>
                <button
                  type="button"
                  className="ms-auto shrink-0 rounded px-1.5 text-danger hover:bg-danger-soft"
                  aria-label={`${bn ? 'বাদ দিন' : 'Remove'}: ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, row) => row !== index))}
                >
                  ×
                </button>
              </li>
            ))}
            {links.map((link, index) => (
              <li key={`link-${index}`} className="flex min-w-0 items-center gap-2 px-3 py-1.5">
                <span className="shrink-0 font-semibold text-navy">{bn ? 'লিংক:' : 'Link:'}</span>
                <span className="min-w-0 truncate">{link.title || link.url}</span>
                <span className="shrink-0 text-xs text-muted">
                  {PROVIDER_NAMES[documentProvider(link.url) ?? 'other']}
                </span>
                <button
                  type="button"
                  className="ms-auto shrink-0 rounded px-1.5 text-danger hover:bg-danger-soft"
                  aria-label={`${bn ? 'বাদ দিন' : 'Remove'}: ${link.title || link.url}`}
                  onClick={() => setLinks((current) => current.filter((_, row) => row !== index))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <details
        className={PANEL}
        open={bodyOpen}
        onToggle={(event) => setBodyOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-semibold text-navy">
          {bn ? 'পাঠের লেখা / নির্দেশনা (ঐচ্ছিক)' : 'Lesson content / instructions (optional)'}
        </summary>
        <label htmlFor="lesson-body" className="sr-only">
          {bn ? 'পাঠের লেখা / নির্দেশনা (Markdown)' : 'Lesson content / instructions (Markdown)'}
        </label>
        <MarkdownTextarea
          id="lesson-body"
          rows={6}
          name="body_markdown"
          defaultValue={lesson?.body_markdown ?? ''}
          className="mt-2 min-h-40 text-navy"
        />
      </details>

      <details className={PANEL}>
        <summary className="cursor-pointer text-sm font-semibold text-navy">
          {bn
            ? 'আরও সেটিংস — URL slug, সময়, কবে খুলবে, ফ্রি প্রিভিউ'
            : 'More settings — URL slug, duration, unlock days, free preview'}
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className={LABEL}>
            URL slug
            <input
              name="slug"
              maxLength={180}
              value={slug}
              placeholder={slugify(title) || 'lesson-01'}
              title={
                bn
                  ? 'নাম লিখলেই নিজে থেকে তৈরি হয়; চাইলে বদলাতে পারেন।'
                  : 'Made from the title as you type it; change it if you like.'
              }
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTyped(true);
              }}
              onBlur={() => setSlug(slugify(slug))}
              className={`${INPUT} font-latin`}
            />
          </label>
          <label className={LABEL}>
            {bn ? 'সময় (সেকেন্ড)' : 'Duration (seconds)'}
            <input
              type="number"
              name="duration_seconds"
              min="1"
              max="86400"
              defaultValue={lesson?.duration_seconds ?? ''}
              className={INPUT}
            />
          </label>
          <label className={LABEL}>
            {bn ? 'ভর্তির কত দিন পরে খুলবে' : 'Unlock days after enrollment'}
            <input
              type="number"
              name="drip_days"
              min="0"
              max="3650"
              defaultValue={lesson?.drip_days ?? ''}
              className={INPUT}
            />
          </label>
        </div>
        <label className="mt-2 block text-sm">
          <input type="checkbox" name="is_free_preview" defaultChecked={lesson?.is_free_preview} />{' '}
          {bn
            ? 'ভিডিও ও লেখা বিনামূল্যে প্রিভিউ করা যাবে (ফাইল শুধু ভর্তিকৃতদের জন্য)'
            : 'Allow free video/text preview (files require enrollment)'}
        </label>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {bn ? 'পাঠ সংরক্ষণ' : 'Save lesson'}
        </Button>
        {lesson ? (
          <button type="button" className="text-sm text-blue" onClick={onCancel}>
            {bn ? 'বাতিল' : 'Cancel'}
          </button>
        ) : null}
      </div>
    </form>
  );
}
