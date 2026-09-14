'use client';

import { MediaFileInput } from '@/components/ui/media-file-input';

import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { MarkdownTextarea } from '@/components/ui/markdown-editor';
import { documentProvider, PROVIDER_NAMES } from '@/lib/document-link';
import { fileSize, number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { slugify } from '@/lib/slug';

const INPUT = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy';

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
 * A Google Drive, Dropbox or other https:// link with an optional name, added
 * with the button or with Enter - which never submits the form around it.
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
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label htmlFor={urlId} className="text-sm font-medium text-navy">
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
            placeholder="https://drive.google.com/file/d/…"
            value={url}
            disabled={disabled}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={onEnter}
            className={`${INPUT} font-latin`}
          />
        </div>
        <div>
          <label htmlFor={titleId} className="text-sm font-medium text-navy">
            {bn ? 'নাম (ঐচ্ছিক)' : 'Name (optional)'}
          </label>
          <input
            id={titleId}
            type="text"
            maxLength={200}
            value={title}
            disabled={disabled}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={onEnter}
            className={INPUT}
          />
        </div>
        <Button
          type="button"
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
          ? 'Google Drive এ ফাইলের Share থেকে "Anyone with the link" করে দিন, নাহলে শিক্ষার্থী খুলতে পারবে না।'
          : 'In Google Drive, set the file to "Anyone with the link" under Share, or students will not be able to open it.'}
      </p>
    </div>
  );
}

/**
 * Adding or editing a lesson.
 *
 * The slug is made for the author: a new lesson's follows its title as it is
 * typed, until the slug itself is typed into; an existing lesson's never
 * changes by itself, since that would break links to it. Documents - files
 * from the computer and Google Drive or Dropbox links - are gathered here and
 * attached by the editor as soon as the lesson is saved.
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
  const fileInputId = useId();
  const taken = courseLessonSlugs.filter((row) => row !== lesson?.slug);

  function changeTitle(value: string) {
    setTitle(value);

    if (!slugTyped) {
      setSlug(slugify(value));
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
      className="space-y-4 rounded-xl border border-line bg-white p-5"
    >
      <h2 className="text-xl font-bold text-navy">
        {lesson ? (bn ? 'পাঠ সম্পাদনা' : 'Edit lesson') : bn ? 'নতুন পাঠ যোগ করুন' : 'Add lesson'}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          {bn ? 'পাঠের নাম' : 'Lesson title'}
          <input
            required
            name="title"
            value={title}
            onChange={(event) => changeTitle(event.target.value)}
            className={INPUT}
          />
        </label>
        <label>
          URL slug
          <input
            name="slug"
            maxLength={180}
            value={slug}
            placeholder="lesson-01"
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugTyped(true);
            }}
            onBlur={() => setSlug(slugify(slug))}
            className={`${INPUT} font-latin`}
          />
          <span className="text-xs text-muted">
            {bn
              ? 'নাম লিখলেই নিজে থেকে তৈরি হয়; চাইলে বদলাতে পারেন।'
              : 'Made from the title as you type it; change it if you like.'}
          </span>
        </label>
        <label>
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
        <label>
          {bn ? 'পাঠের ধরন' : 'Lesson type'}
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value)}
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

      <fieldset className="space-y-3 rounded-lg border border-line p-4">
        <legend className="px-2 font-bold text-navy">
          {bn ? 'ডকুমেন্ট ও ফাইল' : 'Documents & files'}
        </legend>
        <p className="text-sm text-muted">
          {bn
            ? 'PDF, DOCX, XLSX, DWG বা যেকোনো ফাইল কম্পিউটার থেকে দিন, অথবা Google Drive / Dropbox লিংক দিন। পাঠ সংরক্ষণ করলেই সব যুক্ত হবে।'
            : 'Add PDF, DOCX, XLSX, DWG or any other file from the computer, or a Google Drive / Dropbox link. Everything is attached when the lesson is saved.'}
        </p>
        {lesson && lesson.assets.length > 0 ? (
          <p className="text-xs text-muted">
            {bn
              ? `এই পাঠে আগে থেকে ${number(lesson.assets.length, locale)}টি ডকুমেন্ট আছে — উপরের তালিকা থেকে সাজান বা মুছুন।`
              : `This lesson already has ${lesson.assets.length} document(s) — reorder or delete them in the list above.`}
          </p>
        ) : null}

        <div className="rounded-lg border-2 border-blue/30 bg-blue/5 p-4">
          <h3 className="mb-2 text-base font-bold text-navy">
            {bn ? 'হোস্টিংয়ে সরাসরি ফাইল আপলোড' : 'Upload files to hosting'}
          </h3>
          <label htmlFor={fileInputId} className="text-sm font-medium text-navy">
            {bn
              ? 'কম্পিউটার থেকে ফাইল বেছে নিন (একাধিক)'
              : 'Choose files from the computer (several at once)'}
          </label>
          <MediaFileInput scope="course" courseId={courseId}
            id={fileInputId}
            type="file"
            multiple
            disabled={busy}
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
            className="mt-3 block w-full cursor-pointer text-sm text-navy file:me-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue file:px-5 file:py-3 file:font-semibold file:text-white disabled:opacity-50"
            aria-describedby={`${fileInputId}-help`}
          />
          <p id={`${fileInputId}-help`} className="mt-3 text-sm text-muted">
            {bn
              ? 'Choose Files চাপুন, কম্পিউটার বা মোবাইল থেকে ফাইল বাছুন, তারপর Save lesson চাপুন। ফাইল সরাসরি আমাদের হোস্টিংয়ে সংরক্ষিত হবে। প্রতি ফাইল সর্বোচ্চ ১০০ MB।'
              : 'Click Choose Files, select files from your computer or phone, then click Save lesson. Files are stored directly on our hosting. Up to 100 MB per file.'}
          </p>
        </div>

        <DocumentLinkAdder
          disabled={busy}
          onAdd={(link) => setLinks((current) => [...current, link])}
        />

        {files.length > 0 || links.length > 0 ? (
          <ul
            aria-label={bn ? 'সংরক্ষণের সময় যুক্ত হবে' : 'Attached when saved'}
            className="space-y-1.5 text-sm"
          >
            {files.map((file, index) => (
              <li
                key={`file-${file.name}-${file.size}`}
                className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2"
              >
                <span className="min-w-0 truncate">
                  <span className="me-2 rounded bg-white px-1.5 py-0.5 text-xs text-muted">
                    {bn ? 'ফাইল' : 'File'}
                  </span>
                  {file.name}{' '}
                  <span className="text-xs text-muted">· {fileSize(file.size) ?? '0 B'}</span>
                </span>
                <button
                  type="button"
                  className="text-danger"
                  aria-label={`${bn ? 'বাদ দিন' : 'Remove'}: ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, row) => row !== index))}
                >
                  ×
                </button>
              </li>
            ))}
            {links.map((link, index) => {
              const provider = PROVIDER_NAMES[documentProvider(link.url) ?? 'other'];

              return (
                <li
                  key={`link-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2"
                >
                  <span className="min-w-0 truncate">
                    <span className="me-2 rounded bg-white px-1.5 py-0.5 text-xs text-muted">
                      {provider}
                    </span>
                    {link.title || link.url}
                  </span>
                  <button
                    type="button"
                    className="text-danger"
                    aria-label={`${bn ? 'বাদ দিন' : 'Remove'}: ${link.title || link.url}`}
                    onClick={() => setLinks((current) => current.filter((_, row) => row !== index))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </fieldset>

      {type === 'video' ? (
        <label className="block">
          {bn ? 'ভিডিও লিংক (ঐচ্ছিক)' : 'Video URL (optional)'}
          <input
            name="video_url"
            type="url"
            pattern="https://.*"
            defaultValue={lesson?.video_url ?? ''}
            placeholder="https://www.youtube.com/watch?v=… · https://www.facebook.com/…/videos/… · https://vimeo.com/…"
            className={INPUT}
          />
          <span className="mt-1 block text-xs text-muted">
            {bn
              ? 'YouTube, Facebook বা Vimeo ভিডিওর লিংক দিন — ভিডিও পাতার ভেতরেই চলবে (Facebook ভিডিও Public হতে হবে)। MP4/WebM লিংকও চলবে; অন্য সাইটের লিংক নতুন ট্যাবে খুলবে।'
              : 'Paste a YouTube, Facebook or Vimeo video link — it plays inside the lesson (a Facebook video must be public). MP4/WebM links play too; other websites open in a new tab.'}
          </span>
        </label>
      ) : lesson?.video_url ? (
        <p className="text-sm text-danger">
          {bn
            ? 'এই পাঠের ভিডিও লিংকটি সংরক্ষণ করলে সরিয়ে দেওয়া হবে।'
            : 'Saving will remove this lesson’s video link.'}
        </p>
      ) : null}

      <div>
        <label htmlFor="lesson-body" className="block">
          {bn ? 'পাঠের লেখা / নির্দেশনা (Markdown)' : 'Lesson content / instructions (Markdown)'}
        </label>
        <MarkdownTextarea
          id="lesson-body"
          rows={7}
          name="body_markdown"
          defaultValue={lesson?.body_markdown ?? ''}
          className="min-h-48 text-navy"
        />
      </div>



      <div className="grid gap-4 sm:grid-cols-2">
        <label>
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
        <label>
          {bn ? 'ভর্তির কত দিন পরে খুলবে (ঐচ্ছিক)' : 'Unlock days after enrollment (optional)'}
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
      <label className="block">
        <input type="checkbox" name="is_free_preview" defaultChecked={lesson?.is_free_preview} />{' '}
        {bn
          ? 'ভিডিও ও লেখা বিনামূল্যে প্রিভিউ করা যাবে (ফাইল শুধু ভর্তিকৃতদের জন্য)'
          : 'Allow free video/text preview (files require enrollment)'}
      </label>

      <div className="flex flex-wrap items-center gap-4">
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
