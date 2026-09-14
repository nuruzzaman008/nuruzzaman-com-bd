'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api/browser';
import { classLabel } from '@/lib/learn/class-label';
import { MAX_FILE_BYTES, uploadInParts } from '@/lib/uploads/chunked-upload';
import { slugify } from '@/lib/slug';
import { useLocale } from '@/lib/i18n/locale-provider';
import { taxonomyLabel } from '@/lib/i18n/labels';
import { Button } from '@/components/ui/button';
import { MarkdownTextarea } from '@/components/ui/markdown-editor';
import { CoverArt } from '@/components/ui/cover-art';
import { LessonCard } from '@/features/admin/lesson-card';
import { FeaturedImageCard, useFeaturedImage } from '@/features/dashboard/featured-image';
import { SeoAnalysisPanel } from '@/features/dashboard/seo-analysis-panel';
import { CoursePricingFields, pricingFromForm, type CoursePricing } from '@/features/admin/course-pricing-fields';
import { LessonForm, type LessonDraft } from '@/features/admin/lesson-form';

type Asset = { id: number; title: string; size_bytes: number | null; kind?: 'file' | 'link'; link_url?: string | null };
type Lesson = { id: number; title: string; slug: string; type: string; course_section_id: number; body_markdown: string | null; video_url: string | null; video_provider: string | null; video_asset_id: string | null; duration_seconds: number | null; position: number; drip_days: number | null; is_free_preview: boolean; assets: Asset[] };
type Section = { id: number; title: string; position: number; drip_days: number | null; lessons: Lesson[] };
type CourseSeo = { meta_title?: string | null; meta_title_en?: string | null; meta_description?: string | null; meta_description_en?: string | null; focus_keyword?: string | null; canonical_url?: string | null; noindex?: boolean; nofollow?: boolean };
export type Curriculum = { id: number; title: string; slug: string; status: string; sequential: boolean; issues_certificate: boolean; description_markdown: string | null; subtitle?: string | null; track?: string | null; cover_media_id?: number | null; cover_url?: string | null; cover_alt?: string | null; price_minor?: number | null; pricing?: CoursePricing | null; seo?: CourseSeo | null; sections: Section[] };
const input = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy';

/**
 * Where the SEO analysis finds each input in the course form. A constant, so
 * the panel reads the form once rather than on every render. The subtitle is
 * the course's summary, the counterpart of an article's excerpt.
 */
const COURSE_SEO_FIELDS = {
  title: 'title',
  slug: 'slug',
  content: 'description_markdown',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
  focusKeyword: 'focus_keyword',
  excerpt: 'subtitle',
};

export function CourseEditor({ initial }: { initial?: Curriculum }) {
  const { locale, t } = useLocale();
  const bn = locale === 'bn';
  const router = useRouter();
  const [course, setCourse] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [assessmentLesson, setAssessmentLesson] = useState<number | null>(null);
  // The file being sent in parts, and how much of it has arrived.
  const [progress, setProgress] = useState<{ name: string; fraction: number } | null>(null);
  // Set by "Save and publish" just before the form submits.
  const publishAfterSave = useRef(false);
  // Bumped after a new lesson is saved, so its form starts empty again.
  const [lessonFormVersion, setLessonFormVersion] = useState(0);

  /** Tidies a slug field when it is left: "Basic English Sound" → "basic-english-sound". */
  function tidySlug(event: React.FocusEvent<HTMLInputElement>) {
    event.currentTarget.value = slugify(event.currentTarget.value);
  }

  /** Leaving a title while the slug beside it is still empty fills the slug in. */
  function slugFromTitle(event: React.FocusEvent<HTMLInputElement>) {
    const slug = event.currentTarget.form?.elements.namedItem('slug');
    if (slug instanceof HTMLInputElement && !slug.value.trim()) slug.value = slugify(event.currentTarget.value);
  }
  /** On a new course the slug follows the title as it is typed, until the slug itself is typed into. */
  function slugFollowsTitle(event: React.ChangeEvent<HTMLInputElement>) {
    const slug = event.currentTarget.form?.elements.namedItem('slug');
    if (slug instanceof HTMLInputElement && slug.dataset.typed !== 'true') slug.value = slugify(event.currentTarget.value);
  }
  const base = `/admin/courses/${course?.id}`;

  // The featured image, shared with the product and article editors. Laid out
  // like the product editor: image first, the live SEO analysis beside the form.
  const image = useFeaturedImage({
    initialCover: course?.cover_media_id
      ? { id: course.cover_media_id, url: course.cover_url ?? null, alt: course.cover_alt ?? null }
      : null,
    fallbackAlt: course?.title ?? '',
  });

  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await work();
      setMessage(bn ? 'সংরক্ষিত হয়েছে।' : 'Saved successfully.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? [caught.message, ...Object.values(caught.fields).flat()].join(' ') : caught instanceof Error ? caught.message : (bn ? 'সংরক্ষণ হয়নি। আবার চেষ্টা করুন।' : 'Could not save. Please try again.'));
    } finally { setBusy(false); }
  }
  async function reload() {
    const response = await api<{ data: Curriculum }>(`${base}/curriculum`);
    setCourse(response.data);
  }
  function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const seo: CourseSeo = {
      ...Object.fromEntries(['meta_title', 'meta_title_en', 'meta_description', 'meta_description_en', 'focus_keyword', 'canonical_url'].map(key => [key, String(data.get(key) ?? '').trim() || null])),
      noindex: data.get('noindex') === 'on', nofollow: data.get('nofollow') === 'on',
    };
    const publish = publishAfterSave.current;
    publishAfterSave.current = false;
    // Whatever was typed becomes a URL slug; an empty slug takes the title's.
    const slug = slugify(String(data.get('slug') || data.get('title') || ''));
    void action(async () => {
      if (!slug) throw new Error(bn ? 'URL slug ইংরেজি অক্ষরে লিখুন, যেমন basic-english-sound।' : 'Write the URL slug in English letters, for example basic-english-sound.');
      await image.persistAlt();
      const response = await api<{ data: { id: number } }>(course ? base : '/admin/courses', { method: course ? 'PATCH' : 'POST', body: {
        title: data.get('title'), slug, subtitle: String(data.get('subtitle') ?? '').trim() || null,
        description_markdown: data.get('description_markdown'), pricing: pricingFromForm(data), sequential: data.get('sequential') === 'on', issues_certificate: data.get('issues_certificate') === 'on',
        // Sent only when the image was actually changed. Left out, the course
        // keeps exactly what it has, so saving the words can never lose it.
        ...(image.changed ? { cover_media_id: image.cover?.id ?? null } : {}),
        seo,
      } });
      if (!course) router.replace(`/dashboard/courses/${response.data.id}`);
      else {
        // "Save and publish": the course goes live with what was just saved.
        if (publish) await api(`${base}/transition`, { method: 'POST', body: { status: 'published' } });
        await reload();
      }
    });
  }
  function saveSection(event: React.FormEvent<HTMLFormElement>, section?: Section) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void action(async () => {
      await api(`${base}/sections${section ? `/${section.id}` : ''}`, { method: section ? 'PATCH' : 'POST', body: { title: data.get('title'), drip_days: data.get('drip_days') ? Number(data.get('drip_days')) : null } });
      if (!section) form.reset();
      await reload();
      if (section) setEditingSection(null);
    });
  }
  function deleteSection(section: Section) {
    const warning = bn
      ? `“${section.title}” অধ্যায় মুছে ফেলবেন? এর ${section.lessons.length}টি পাঠ, ভিডিও/ফাইলের সংযুক্তি ও সংশ্লিষ্ট শিক্ষার্থীদের পাঠের অগ্রগতিও মুছে যাবে। এটি ফিরিয়ে আনা যাবে না।`
      : `Delete section “${section.title}”? Its ${section.lessons.length} lessons, video/file attachments and associated lesson progress will also be removed. This cannot be undone.`;
    if (!window.confirm(warning)) return;
    void action(async () => {
      await api(`${base}/sections/${section.id}`, { method: 'DELETE' });
      if (editing?.course_section_id === section.id) setEditing(null);
      if (section.lessons.some(lesson => lesson.id === assessmentLesson)) setAssessmentLesson(null);
      if (editingSection === section.id) setEditingSection(null);
      await reload();
    });
  }
  /**
   * Saves the lesson, then attaches the documents gathered in its form: files
   * sent in parts, then links. A document that fails does not undo the
   * lesson - the message says which one to add again from the lesson list.
   */
  function saveLesson(draft: LessonDraft) {
    void action(async () => {
      const oversize = draft.files.find((file) => file.size > MAX_FILE_BYTES);
      if (oversize) throw new Error(bn ? `${oversize.name}: প্রতি ফাইল সর্বোচ্চ ১০০ MB।` : `${oversize.name}: files can be up to 100 MB.`);
      const saved = await api<{ data: { id: number } }>(`${base}/lessons${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: draft.values });
      const lessonId = editing?.id ?? saved.data.id;
      const reason = (caught: unknown) => caught instanceof ApiError ? [caught.message, ...Object.values(caught.fields).flat()].join(' ') : caught instanceof Error ? caught.message : '';
      let failed: string | null = null;
      for (const file of draft.files) {
        if (failed) break;
        try {
          const parts = await uploadInParts(file, (fraction) => setProgress({ name: file.name, fraction }));
          await api(`${base}/lessons/${lessonId}/assets`, { method: 'POST', body: { ...parts, title: file.name.slice(0, 200) } });
        } catch (caught) { failed = `${file.name} (${reason(caught)})`; }
      }
      for (const link of draft.links) {
        if (failed) break;
        try {
          await api(`${base}/lessons/${lessonId}/links`, { method: 'POST', body: { url: link.url, title: link.title || null } });
        } catch (caught) { failed = `${link.title || link.url} (${reason(caught)})`; }
      }
      setProgress(null);
      setEditing(null);
      setLessonFormVersion((version) => version + 1);
      await reload();
      if (failed) throw new Error(bn ? `পাঠ সংরক্ষিত হয়েছে, কিন্তু একটি ডকুমেন্ট যুক্ত করা যায়নি: ${failed}। পাঠের তালিকা থেকে আবার যোগ করুন।` : `The lesson was saved, but a document could not be attached: ${failed}. Add it again from the lesson list.`);
    });
  }
  /** The whole lesson: its row, video, files and links, quiz or assignment, and learners' progress in it. */
  function deleteLesson(lesson: Lesson) {
    const count = lesson.assets.length;
    const warning = bn
      ? `“${lesson.title}” পাঠটি পুরোপুরি মুছে ফেলবেন? এর ভিডিও, ${count}টি ফাইল/লিংক, কুইজ/অ্যাসাইনমেন্ট ও শিক্ষার্থীদের এই পাঠের অগ্রগতিও মুছে যাবে। এটি ফিরিয়ে আনা যাবে না।`
      : `Delete the lesson “${lesson.title}” completely? Its video, ${count} file(s)/link(s), quiz/assignment and learners’ progress in it will also be removed. This cannot be undone.`;
    if (!window.confirm(warning)) return;
    void action(async () => {
      await api(`${base}/lessons/${lesson.id}`, { method: 'DELETE' });
      if (editing?.id === lesson.id) { setEditing(null); setLessonFormVersion((version) => version + 1); }
      if (assessmentLesson === lesson.id) setAssessmentLesson(null);
      await reload();
    });
  }
  async function moveLesson(lesson: Lesson, direction: number) {
    const rows = course!.sections.flatMap((section) => section.lessons);
    const index = rows.findIndex((row) => row.id === lesson.id);
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const other = rows[target];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    if (other.course_section_id !== lesson.course_section_id) {
      rows[target] = { ...lesson, course_section_id: other.course_section_id };
    }
    await api(`${base}/reorder`, { method: 'PUT', body: { lessons: rows.map((row, position) => ({ id: row.id, course_section_id: row.course_section_id, position })) } });
    await reload();
  }

  return <div className="space-y-8">
    <header><Link className="text-sm text-blue" href="/dashboard/courses">← {bn ? 'সব কোর্স' : 'All courses'}</Link><h1 className="mt-3 text-3xl font-bold text-navy">{course ? (bn ? 'কোর্স ও পাঠ সম্পাদনা' : 'Course & curriculum editor') : (bn ? 'নতুন কোর্স' : 'New course')}</h1><p className="mt-2 text-muted">{bn ? 'অধ্যায় তৈরি করুন, ক্রমানুসারে পাঠ যোগ করুন। প্রতিটি পাঠে ভিডিও, লেখা ও একাধিক ফাইল রাখতে পারবেন।' : 'Create sections and ordered lessons. Combine video, text and multiple files in each lesson.'}</p></header>
    {error ? <p role="alert" className="rounded-lg bg-danger/10 p-4 text-danger">{error}</p> : null}
    {message ? <p role="status" className="rounded-lg bg-success/10 p-4 text-success">{message}</p> : null}
    {progress ? <p role="status" className="sticky top-2 z-10 rounded-lg bg-blue-soft p-4 text-navy shadow-sm">{bn ? 'আপলোড হচ্ছে' : 'Uploading'} “{progress.name}” — {Math.round(progress.fraction * 100)}%<span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white"><span className="block h-full bg-blue" style={{ width: `${Math.round(progress.fraction * 100)}%` }} /></span></p> : null}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <form id="course-details" onSubmit={saveCourse} className="min-w-0 space-y-4">
      <FeaturedImageCard
        image={image}
        hint={bn ? 'কোর্স পাতার উপরে, কোর্সের কার্ডে আর সোশ্যাল শেয়ার কার্ডে এই ছবিটি দেখায়।' : 'Shown at the top of the course page, on its card in listings and on the social share card.'}
        // What the site shows for a course with no upload: its track's
        // generated art, on the course's card. The course page itself has none.
        fallback={<figure>
          <CoverArt topic={course?.track} seed={course?.slug} label={course?.track ? taxonomyLabel(t, course.track, null, locale) : undefined} className="rounded-lg border border-line" />
          <figcaption className="mt-2 text-xs text-muted">{bn ? 'স্বয়ংক্রিয় কভার — ছবি আপলোড না করা পর্যন্ত কোর্সের কার্ডে এটি দেখায়; কোর্স পাতায় কোনো ছবি থাকে না।' : 'Generated cover — shown on course cards until an image is uploaded; the course page itself shows no image.'}</figcaption>
        </figure>}
      />
      <div className="space-y-4 rounded-xl border border-line bg-white p-5">
      <h2 className="text-lg font-bold text-navy">{bn ? 'কোর্সের তথ্য' : 'Course details'}</h2><CoursePricingFields initial={course?.pricing} fallbackMinor={course?.price_minor} />
      <div className="grid gap-4 sm:grid-cols-2"><label>{bn ? 'কোর্সের নাম' : 'Course title'}<input required name="title" defaultValue={course?.title} onChange={course ? undefined : slugFollowsTitle} onBlur={slugFromTitle} className={input} /></label><label>URL slug<input required name="slug" maxLength={180} defaultValue={course?.slug} onInput={(event) => { event.currentTarget.dataset.typed = 'true'; }} onBlur={tidySlug} placeholder="basic-english-sound" className={`${input} font-latin`} /><span className="text-xs text-muted">{bn ? 'যেভাবে খুশি লিখুন — "Basic English Sound" লিখলে নিজে থেকেই basic-english-sound হয়ে যাবে। প্রকাশের পরে বদলালে পুরনো লিংক কাজ করবে না।' : 'Type it any way — "Basic English Sound" becomes basic-english-sound by itself. Changing it after publishing breaks the old link.'}</span></label></div>
      <label className="block">{bn ? 'সাবটাইটেল' : 'Subtitle'}<input name="subtitle" maxLength={255} defaultValue={course?.subtitle ?? ''} className={input} /><span className="text-xs text-muted">{bn ? 'এক লাইনের সারসংক্ষেপ — কোর্সের কার্ডে দেখায়, আর meta description না থাকলে সার্চ ফলাফলেও।' : 'One line of summary — shown on the course card, and in search results when there is no meta description.'}</span></label>
      <div><label htmlFor="course-description" className="block">{bn ? 'বিস্তারিত (Markdown)' : 'Description (Markdown)'}</label><MarkdownTextarea id="course-description" name="description_markdown" rows={12} defaultValue={course?.description_markdown ?? ''} className="min-h-72 text-navy" /></div>
      <fieldset className="space-y-4 rounded-lg border border-line p-4">
        <legend className="px-2 text-lg font-bold">{bn ? 'SEO মেটাডেটা' : 'SEO metadata'}</legend>
        <p className="text-sm text-muted">{bn ? 'বাংলা ও ইংরেজি course page-এর জন্য আলাদা metadata দিন। খালি রাখলে course-এর নাম ও subtitle ব্যবহার হবে।' : 'Set separate metadata for Bengali and English course pages. Empty fields fall back to the course title and subtitle.'}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>Meta title (বাংলা)<input name="meta_title" maxLength={255} defaultValue={course?.seo?.meta_title ?? ''} className={input} /></label>
          <label>Meta title (English)<input name="meta_title_en" maxLength={255} defaultValue={course?.seo?.meta_title_en ?? ''} className={input} /></label>
          <label>Meta description (বাংলা)<textarea name="meta_description" rows={3} maxLength={320} defaultValue={course?.seo?.meta_description ?? ''} className={input} /></label>
          <label>Meta description (English)<textarea name="meta_description_en" rows={3} maxLength={320} defaultValue={course?.seo?.meta_description_en ?? ''} className={input} /></label>
        </div>
        <label className="block">Focus keyword<input name="focus_keyword" maxLength={160} defaultValue={course?.seo?.focus_keyword ?? ''} className={input} /><span className="text-xs text-muted">{bn ? 'Content পরিকল্পনার জন্য মূল keyword।' : 'Main keyword for content planning.'}</span></label>
        <details><summary className="cursor-pointer text-sm font-semibold">{bn ? 'Advanced SEO সেটিংস' : 'Advanced SEO settings'}</summary><div className="mt-3 space-y-3">
          <label className="block">Canonical URL<input name="canonical_url" type="url" maxLength={512} defaultValue={course?.seo?.canonical_url ?? ''} placeholder="https://nuruzzaman.com.bd/courses/…" className={input} /><span className="text-xs text-muted">{bn ? 'বাংলা পেজের canonical URL। খালি রাখলে নিজস্ব URL ব্যবহার হবে; ইংরেজি পেজে নিজের /en/ URL থাকে।' : 'Canonical for the Bengali page. Leave empty for its own URL; the English page keeps its /en/ URL.'}</span></label>
          <label className="block"><input name="noindex" type="checkbox" defaultChecked={course?.seo?.noindex ?? false} /> {bn ? 'Noindex — search results থেকে বাদ দেওয়ার নির্দেশ' : 'Noindex — request exclusion from search results'}</label>
          <label className="block"><input name="nofollow" type="checkbox" defaultChecked={course?.seo?.nofollow ?? false} /> {bn ? 'Nofollow — এই পেজের links অনুসরণ না করার নির্দেশ' : 'Nofollow — request that crawlers do not follow page links'}</label>
        </div></details>
      </fieldset>
      <label className="block"><input type="checkbox" name="sequential" defaultChecked={course?.sequential ?? true} /> {bn ? 'আগের পাঠ শেষ হলে পরের পাঠ খুলবে' : 'Require completing previous lessons in order'}</label>
      <label className="block"><input type="checkbox" name="issues_certificate" defaultChecked={course?.issues_certificate ?? false} /> {bn ? 'সফলভাবে শেষ করলে সার্টিফিকেট' : 'Issue certificate on successful completion'}</label>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy} type="submit" onClick={() => { publishAfterSave.current = false; }}>{bn ? 'কোর্স সংরক্ষণ' : 'Save course'}</Button>
        {/* One click from a finished draft to a live course. Publishing needs a
            lesson, so the button only appears once there is one. */}
        {course && course.status !== 'published' && course.sections.some((section) => section.lessons.length > 0) ? <Button disabled={busy} type="submit" variant="secondary" onClick={() => { publishAfterSave.current = true; }}>{bn ? 'সংরক্ষণ করে প্রকাশ করুন' : 'Save and publish'}</Button> : null}
        {course ? (course.status === 'published' ? <Link href={`/courses/${course.slug}`} className="text-sm font-semibold text-blue hover:underline">{bn ? 'প্রকাশিত — সাইটে দেখুন ↗' : 'Published — view on the site ↗'}</Link> : <span className="text-sm text-muted">{course.status}</span>) : null}
      </div>
      </div>
    </form>
    {/* Sticky and scrollable on its own, so the score stays in view while the
        description is written - the same arrangement as the product editor. */}
    <aside className="xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto">
      <SeoAnalysisPanel formId="course-details" kind="course" recordId={course?.id} featuredImage={image.analysisInput} fields={COURSE_SEO_FIELDS} />
    </aside>
    </div>
    {course ? <>
      <div className="flex flex-wrap gap-3">{(['draft', 'in_review', 'published', 'archived'] as const).filter((status) => course.status === 'archived' ? status === 'draft' : course.status === 'published' ? ['draft', 'archived'].includes(status) : status !== course.status).map((status) => <Button key={status} type="button" disabled={busy} onClick={() => void action(async () => { await api(`${base}/transition`, { method: 'POST', body: { status } }); await reload(); })}>{bn ? { draft: 'খসড়া', in_review: 'পর্যালোচনা', published: 'প্রকাশ করুন', archived: 'আর্কাইভ' }[status] : status.replace('_', ' ')}</Button>)}</div>
      <section className="space-y-4"><h2 className="text-xl font-bold text-navy">{bn ? 'কোর্সের অধ্যায় ও পাঠ' : 'Sections & lessons'}</h2>
        {course.sections.map((section, sectionIndex) => <div key={section.id} className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-navy"><span className="font-latin text-blue">{classLabel(sectionIndex)}:</span> {section.title}</h3><p className="text-sm text-muted">{section.lessons.length} {bn ? 'পাঠ' : 'lessons'} · {bn ? 'কত দিন পরে:' : 'Drip days:'} {section.drip_days ?? 0}</p></div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" disabled={busy} aria-label={`${bn ? 'অধ্যায় সম্পাদনা:' : 'Edit section:'} ${section.title}`} onClick={() => setEditingSection(section.id)}>{bn ? 'সম্পাদনা' : 'Edit'}</Button>
              <Button type="button" variant="secondary" className="text-danger" disabled={busy} aria-label={`${bn ? 'অধ্যায় মুছুন:' : 'Delete section:'} ${section.title}`} onClick={() => deleteSection(section)}>{bn ? 'মুছুন' : 'Delete'}</Button>
            </div>
          </div>
          {editingSection === section.id && <form aria-label={`Edit section ${section.title}`} onSubmit={(event) => saveSection(event, section)} className="mt-4 flex flex-wrap items-end gap-3"><label className="flex-1">{bn ? 'অধ্যায়ের নাম' : 'Section title'}<input required maxLength={255} name="title" defaultValue={section.title} className={input} /></label><label className="w-28">{bn ? 'কত দিন পরে' : 'Drip days'}<input name="drip_days" type="number" min="0" max="3650" defaultValue={section.drip_days ?? ''} className={input} /></label><Button type="submit" disabled={busy}>{bn ? 'সংরক্ষণ' : 'Save'}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setEditingSection(null)}>{bn ? 'বাতিল' : 'Cancel'}</Button></form>}
          {/* One compact row per lesson: its video, files and links one line
              each, with the places to add more opened only when asked for. */}
          <ol className="mt-4 space-y-2">{section.lessons.map((lesson) => <LessonCard
            key={lesson.id}
            lesson={lesson}
            courseId={course.id}
            base={base}
            busy={busy}
            run={action}
            reload={reload}
            onProgress={setProgress}
            onEdit={() => { setEditing(lesson); document.getElementById('lesson-editor')?.scrollIntoView({ behavior: 'smooth' }); }}
            onMove={(direction) => void action(() => moveLesson(lesson, direction))}
            onDelete={() => deleteLesson(lesson)}
            assessmentOpen={assessmentLesson === lesson.id}
            onToggleAssessment={() => setAssessmentLesson(assessmentLesson === lesson.id ? null : lesson.id)}
          />)}</ol>
        </div>)}
        <form onSubmit={(event) => saveSection(event)} className="flex items-end gap-3 rounded-xl border border-dashed border-line p-5"><label className="flex-1">{bn ? 'নতুন অধ্যায়' : 'New section'}<input name="title" required className={input} /></label><Button disabled={busy} type="submit">{bn ? 'অধ্যায় যোগ করুন' : 'Add section'}</Button></form>
      </section>
      <details className="rounded-xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold text-navy">{bn ? 'শিক্ষার্থী ভর্তি করুন' : 'Enroll a student'}</summary><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action(async () => { const email = String(data.get('email')).trim(); const users = await api<{ data: { id: number; email: string }[] }>('/admin/users', { query: { q: email } }); const user = users.data.find((row) => row.email.toLowerCase() === email.toLowerCase()); if (!user) throw new Error('User not found'); await api('/admin/enrollments', { method: 'POST', body: { user_id: user.id, course_slug: course.slug, reason: data.get('reason') } }); form.reset(); }); }}><label className="block">{bn ? 'নিবন্ধিত শিক্ষার্থীর ইমেইল' : 'Registered student email'}<input type="email" name="email" required className={input} /></label><label className="block">{bn ? 'ভর্তির কারণ' : 'Enrollment reason'}<input required name="reason" className={input} placeholder={bn ? 'অনুমোদিত ভর্তি / অফলাইন পেমেন্ট' : 'Approved enrollment / offline payment'} /></label><Button type="submit" disabled={busy}>{bn ? 'ভর্তি নিশ্চিত করুন' : 'Enroll student'}</Button></form></details>
      <details className="rounded-xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold text-navy">{bn ? 'কোর্সের ঘোষণা দিন' : 'Post course announcement'}</summary><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action(async () => { await api(`${base}/announcements`, { method: 'POST', body: { title: data.get('title'), body_markdown: data.get('body_markdown'), is_published: true } }); form.reset(); }); }}><label className="block">{bn ? 'শিরোনাম' : 'Title'}<input required name="title" className={input} /></label><div><label htmlFor="announcement-body" className="block">{bn ? 'ঘোষণা' : 'Announcement'}</label><MarkdownTextarea id="announcement-body" required name="body_markdown" rows={4} className="text-navy" /></div><Button type="submit" disabled={busy}>{bn ? 'ঘোষণা প্রকাশ করুন' : 'Publish announcement'}</Button></form></details>
      {course.sections.length ? <LessonForm courseId={course.id}
        key={editing ? `edit-${editing.id}` : `new-${lessonFormVersion}`}
        sections={course.sections}
        lesson={editing}
        courseLessonSlugs={course.sections.flatMap((section) => section.lessons.map((row) => row.slug))}
        lessonCount={course.sections.reduce((count, section) => count + section.lessons.length, 0)}
        busy={busy}
        onSave={saveLesson}
        onCancel={() => setEditing(null)}
      /> : null}
    </> : null}
  </div>;
}
