'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { LessonAssessments } from '@/features/admin/lesson-assessments';

type Asset = { id: number; title: string; size_bytes: number };
type Lesson = { id: number; title: string; slug: string; type: string; course_section_id: number; body_markdown: string | null; video_url: string | null; video_provider: string | null; video_asset_id: string | null; duration_seconds: number | null; position: number; drip_days: number | null; is_free_preview: boolean; assets: Asset[] };
type Section = { id: number; title: string; position: number; drip_days: number | null; lessons: Lesson[] };
type CourseSeo = { meta_title?: string | null; meta_title_en?: string | null; meta_description?: string | null; meta_description_en?: string | null; focus_keyword?: string | null; canonical_url?: string | null; noindex?: boolean; nofollow?: boolean };
export type Curriculum = { id: number; title: string; slug: string; status: string; sequential: boolean; issues_certificate: boolean; description_markdown: string | null; price_minor?: number | null; seo?: CourseSeo | null; sections: Section[] };
const input = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy';

export function CourseEditor({ initial }: { initial?: Curriculum }) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const router = useRouter();
  const [course, setCourse] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [assessmentLesson, setAssessmentLesson] = useState<number | null>(null);
  const base = `/admin/courses/${course?.id}`;

  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await work();
      setMessage(bn ? 'সংরক্ষিত হয়েছে।' : 'Saved successfully.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? [caught.message, ...Object.values(caught.fields).flat()].join(' ') : caught instanceof Error ? caught.message : (bn ? 'সংরক্ষণ হয়নি। আবার চেষ্টা করুন।' : 'Could not save. Please try again.'));
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
    void action(async () => {
      const response = await api<{ data: { id: number } }>(course ? base : '/admin/courses', { method: course ? 'PATCH' : 'POST', body: { title: data.get('title'), slug: data.get('slug'), description_markdown: data.get('description_markdown'), price_minor: Math.round(Number(data.get('price_bdt')) * 100), sequential: data.get('sequential') === 'on', issues_certificate: data.get('issues_certificate') === 'on', seo } });
      if (!course) router.replace(`/dashboard/courses/${response.data.id}`);
      else await reload();
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
      ? `“${section.title}” অধ্যায় মুছে ফেলবেন? এর ${section.lessons.length}টি পাঠ, ভিডিও/ফাইলের সংযুক্তি ও সংশ্লিষ্ট শিক্ষার্থীদের পাঠের অগ্রগতিও মুছে যাবে। এটি ফিরিয়ে আনা যাবে না।`
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
  function saveLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void action(async () => {
      await api(`${base}/lessons${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: {
        title: data.get('title'), slug: data.get('slug'), type: data.get('type'), course_section_id: Number(data.get('course_section_id')),
        body_markdown: data.get('body_markdown') || null, video_url: data.get('video_url') || null,
        duration_seconds: data.get('duration_seconds') ? Number(data.get('duration_seconds')) : null,
        drip_days: data.get('drip_days') ? Number(data.get('drip_days')) : null,
        is_free_preview: data.get('is_free_preview') === 'on',
      } });
      setEditing(null); form.reset(); await reload();
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

  async function moveAsset(lesson: Lesson, id: number, direction: number) {
    const ids = lesson.assets.map((asset) => asset.id);
    const index = ids.indexOf(id); const next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await api(`${base}/lessons/${lesson.id}/assets/reorder`, { method: 'PUT', body: { ids } });
    await reload();
  }
  return <div className="space-y-8">
    <header><Link className="text-sm text-blue" href="/dashboard/courses">← {bn ? 'সব কোর্স' : 'All courses'}</Link><h1 className="mt-3 text-3xl font-bold text-navy">{course ? (bn ? 'কোর্স ও পাঠ সম্পাদনা' : 'Course & curriculum editor') : (bn ? 'নতুন কোর্স' : 'New course')}</h1><p className="mt-2 text-muted">{bn ? 'অধ্যায় তৈরি করুন, ক্রমানুসারে পাঠ যোগ করুন। প্রতিটি পাঠে ভিডিও, লেখা ও একাধিক ফাইল রাখতে পারবেন।' : 'Create sections and ordered lessons. Combine video, text and multiple files in each lesson.'}</p></header>
    {error ? <p role="alert" className="rounded-lg bg-danger/10 p-4 text-danger">{error}</p> : null}
    {message ? <p role="status" className="rounded-lg bg-success/10 p-4 text-success">{message}</p> : null}
    <form onSubmit={saveCourse} className="space-y-4 rounded-xl border border-line bg-white p-5">
      <h2 className="text-lg font-bold text-navy">{bn ? 'কোর্সের তথ্য' : 'Course details'}</h2><label className="block">{bn ? 'কোর্সের দাম (৳)' : 'Course price (BDT)'}<input required name="price_bdt" type="number" min="1" max="1000000" step="0.01" defaultValue={(course?.price_minor ?? 150000) / 100} className={input} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label>{bn ? 'কোর্সের নাম' : 'Course title'}<input required name="title" defaultValue={course?.title} className={input} /></label><label>URL slug<input required name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={course?.slug} placeholder="autocad-basics" className={input} /></label></div>
      <label className="block">{bn ? 'বিস্তারিত (Markdown)' : 'Description (Markdown)'}<textarea name="description_markdown" rows={4} defaultValue={course?.description_markdown ?? ''} className={input} /></label>
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
          <label className="block"><input name="noindex" type="checkbox" defaultChecked={course?.seo?.noindex ?? false} /> {bn ? 'Noindex — search results থেকে বাদ দেওয়ার নির্দেশ' : 'Noindex — request exclusion from search results'}</label>
          <label className="block"><input name="nofollow" type="checkbox" defaultChecked={course?.seo?.nofollow ?? false} /> {bn ? 'Nofollow — এই পেজের links অনুসরণ না করার নির্দেশ' : 'Nofollow — request that crawlers do not follow page links'}</label>
        </div></details>
      </fieldset>
      <label className="block"><input type="checkbox" name="sequential" defaultChecked={course?.sequential ?? true} /> {bn ? 'আগের পাঠ শেষ হলে পরের পাঠ খুলবে' : 'Require completing previous lessons in order'}</label>
      <label className="block"><input type="checkbox" name="issues_certificate" defaultChecked={course?.issues_certificate ?? false} /> {bn ? 'সফলভাবে শেষ করলে সার্টিফিকেট' : 'Issue certificate on successful completion'}</label>
      <Button disabled={busy} type="submit">{bn ? 'কোর্স সংরক্ষণ' : 'Save course'}</Button>
      {course ? <span className="ms-4 text-sm text-muted">{course.status}</span> : null}
    </form>
    {course ? <>
      <div className="flex flex-wrap gap-3">{(['draft', 'in_review', 'published', 'archived'] as const).filter((status) => course.status === 'archived' ? status === 'draft' : course.status === 'published' ? ['draft', 'archived'].includes(status) : status !== course.status).map((status) => <Button key={status} type="button" disabled={busy} onClick={() => void action(async () => { await api(`${base}/transition`, { method: 'POST', body: { status } }); await reload(); })}>{bn ? { draft: 'খসড়া', in_review: 'পর্যালোচনা', published: 'প্রকাশ করুন', archived: 'আর্কাইভ' }[status] : status.replace('_', ' ')}</Button>)}</div>
      <section className="space-y-4"><h2 className="text-xl font-bold text-navy">{bn ? 'কোর্সের অধ্যায় ও পাঠ' : 'Sections & lessons'}</h2>
        {course.sections.map((section) => <div key={section.id} className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-navy">{section.title}</h3><p className="text-sm text-muted">{section.lessons.length} {bn ? 'পাঠ' : 'lessons'} · {bn ? 'কত দিন পরে:' : 'Drip days:'} {section.drip_days ?? 0}</p></div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" disabled={busy} aria-label={`${bn ? 'অধ্যায় সম্পাদনা:' : 'Edit section:'} ${section.title}`} onClick={() => setEditingSection(section.id)}>{bn ? 'সম্পাদনা' : 'Edit'}</Button>
              <Button type="button" variant="secondary" className="text-danger" disabled={busy} aria-label={`${bn ? 'অধ্যায় মুছুন:' : 'Delete section:'} ${section.title}`} onClick={() => deleteSection(section)}>{bn ? 'মুছুন' : 'Delete'}</Button>
            </div>
          </div>
          {editingSection === section.id && <form aria-label={`Edit section ${section.title}`} onSubmit={(event) => saveSection(event, section)} className="mt-4 flex flex-wrap items-end gap-3"><label className="flex-1">{bn ? 'অধ্যায়ের নাম' : 'Section title'}<input required maxLength={255} name="title" defaultValue={section.title} className={input} /></label><label className="w-28">{bn ? 'কত দিন পরে' : 'Drip days'}<input name="drip_days" type="number" min="0" max="3650" defaultValue={section.drip_days ?? ''} className={input} /></label><Button type="submit" disabled={busy}>{bn ? 'সংরক্ষণ' : 'Save'}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setEditingSection(null)}>{bn ? 'বাতিল' : 'Cancel'}</Button></form>}
          <ol className="mt-5 space-y-4">{section.lessons.map((lesson) => <li key={lesson.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-navy">{lesson.title}</h3><p className="text-xs text-muted">{lesson.type} · {lesson.assets.length} {bn ? 'ফাইল' : 'files'}</p></div><div className="flex gap-3 text-sm text-blue"><button type="button" disabled={busy} aria-label={`Move ${lesson.title} up`} onClick={() => void action(() => moveLesson(lesson, -1))}>↑</button><button type="button" disabled={busy} aria-label={`Move ${lesson.title} down`} onClick={() => void action(() => moveLesson(lesson, 1))}>↓</button><button type="button" onClick={() => { setEditing(lesson); document.getElementById('lesson-editor')?.scrollIntoView({ behavior: 'smooth' }); }}>{bn ? 'সম্পাদনা' : 'Edit'}</button></div></div>
            <label className="mt-3 block text-sm font-semibold text-blue">{bn ? 'ভিডিও আপলোড (MP4/WebM, সর্বোচ্চ 100 MB)' : 'Upload video (MP4/WebM, up to 100 MB)'}<input type="file" accept=".mp4,.webm" disabled={busy} className="mt-2 block w-full text-xs" onChange={(event) => {
              const file = event.target.files?.[0]; const control = event.target;
              if (!file) return;
              void action(async () => { if (file.size > 100 * 1024 * 1024) throw new Error('Video must be 100 MB or smaller.'); const body = new FormData(); body.set('video', file); await api(`${base}/lessons/${lesson.id}/video`, { method: 'POST', body }); control.value = ''; await reload(); });
            }} /></label>
            {lesson.video_provider === 'uploaded' ? <p className="mt-2 text-sm text-success">{bn ? 'আপলোড করা ভিডিও প্রস্তুত' : 'Uploaded video ready'}</p> : null}
            {lesson.video_url ? <p className="mt-2 break-all text-xs text-muted">{lesson.video_url}</p> : null}
            <ul className="mt-3 space-y-2">{lesson.assets.map((asset) => <li key={asset.id} className="flex items-center justify-between gap-3 text-sm"><span>{lesson.assets.indexOf(asset) + 1}. {asset.title} · {(asset.size_bytes / 1024).toFixed(0)} KB</span><span className="flex gap-3"><button type="button" disabled={busy || lesson.assets[0]?.id === asset.id} aria-label={`Move ${asset.title} up`} onClick={() => void action(() => moveAsset(lesson, asset.id, -1))}>↑</button><button type="button" disabled={busy || lesson.assets.at(-1)?.id === asset.id} aria-label={`Move ${asset.title} down`} onClick={() => void action(() => moveAsset(lesson, asset.id, 1))}>↓</button></span><button className="text-danger" disabled={busy} type="button" onClick={() => { if (window.confirm(bn ? 'এই ফাইল মুছে ফেলবেন?' : 'Delete this file?')) void action(async () => { await api(`${base}/lessons/${lesson.id}/assets/${asset.id}`, { method: 'DELETE' }); await reload(); }); }}>{bn ? 'মুছুন' : 'Delete'}</button></li>)}</ul>
            <label className="mt-4 block text-sm font-semibold text-blue">{bn ? 'পাঠে ফাইল যোগ করুন (একাধিক নির্বাচন করা যাবে)' : 'Attach lesson files (multiple allowed)'}<input type="file" multiple disabled={busy} className="mt-2 block w-full text-xs" accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.dwg,.dxf" onChange={(event) => {
              const files = Array.from(event.target.files ?? []); const control = event.target;
              void action(async () => { try { for (const file of files) { const body = new FormData(); body.set('file', file); body.set('title', file.name); await api(`${base}/lessons/${lesson.id}/assets`, { method: 'POST', body }); } } finally { control.value = ''; await reload(); } });
            }} /></label><p className="mt-1 text-xs text-muted">PDF, Office, ZIP, AutoCAD, images · {bn ? 'প্রতি ফাইল সর্বোচ্চ ১০০ MB' : 'Up to 100 MB per file'}</p>
            <button type="button" className="mt-4 text-sm font-semibold text-blue" aria-expanded={assessmentLesson === lesson.id} onClick={() => setAssessmentLesson(assessmentLesson === lesson.id ? null : lesson.id)}>{bn ? 'কুইজ / অ্যাসাইনমেন্ট' : 'Quiz / assignment'}</button>{assessmentLesson === lesson.id ? <LessonAssessments courseId={course.id} lessonId={lesson.id} /> : null}
          </li>)}</ol>
        </div>)}
        <form onSubmit={(event) => saveSection(event)} className="flex items-end gap-3 rounded-xl border border-dashed border-line p-5"><label className="flex-1">{bn ? 'নতুন অধ্যায়' : 'New section'}<input name="title" required className={input} /></label><Button disabled={busy} type="submit">{bn ? 'অধ্যায় যোগ করুন' : 'Add section'}</Button></form>
      </section>
      <details className="rounded-xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold text-navy">{bn ? 'শিক্ষার্থী ভর্তি করুন' : 'Enroll a student'}</summary><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action(async () => { const email = String(data.get('email')).trim(); const users = await api<{ data: { id: number; email: string }[] }>('/admin/users', { query: { q: email } }); const user = users.data.find((row) => row.email.toLowerCase() === email.toLowerCase()); if (!user) throw new Error('User not found'); await api('/admin/enrollments', { method: 'POST', body: { user_id: user.id, course_slug: course.slug, reason: data.get('reason') } }); form.reset(); }); }}><label className="block">{bn ? 'নিবন্ধিত শিক্ষার্থীর ইমেইল' : 'Registered student email'}<input type="email" name="email" required className={input} /></label><label className="block">{bn ? 'ভর্তির কারণ' : 'Enrollment reason'}<input required name="reason" className={input} placeholder={bn ? 'অনুমোদিত ভর্তি / অফলাইন পেমেন্ট' : 'Approved enrollment / offline payment'} /></label><Button type="submit" disabled={busy}>{bn ? 'ভর্তি নিশ্চিত করুন' : 'Enroll student'}</Button></form></details>
      <details className="rounded-xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold text-navy">{bn ? 'কোর্সের ঘোষণা দিন' : 'Post course announcement'}</summary><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void action(async () => { await api(`${base}/announcements`, { method: 'POST', body: { title: data.get('title'), body_markdown: data.get('body_markdown'), is_published: true } }); form.reset(); }); }}><label className="block">{bn ? 'শিরোনাম' : 'Title'}<input required name="title" className={input} /></label><label className="block">{bn ? 'ঘোষণা' : 'Announcement'}<textarea required name="body_markdown" rows={4} className={input} /></label><Button type="submit" disabled={busy}>{bn ? 'ঘোষণা প্রকাশ করুন' : 'Publish announcement'}</Button></form></details>
      {course.sections.length ? <form key={editing?.id ?? 'new'} id="lesson-editor" onSubmit={saveLesson} className="space-y-4 rounded-xl border border-line bg-white p-5">
        <h2 className="text-xl font-bold text-navy">{editing ? (bn ? 'পাঠ সম্পাদনা' : 'Edit lesson') : (bn ? 'নতুন পাঠ যোগ করুন' : 'Add lesson')}</h2>
        <div className="grid gap-4 sm:grid-cols-2"><label>{bn ? 'পাঠের নাম' : 'Lesson title'}<input required name="title" defaultValue={editing?.title} className={input} /></label><label>URL slug<input required name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={editing?.slug} placeholder="lesson-01" className={input} /></label>
          <label>{bn ? 'অধ্যায়' : 'Section'}<select name="course_section_id" defaultValue={editing?.course_section_id ?? course.sections[0].id} className={input}>{course.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label>
          <label>{bn ? 'পাঠের ধরন' : 'Lesson type'}<select name="type" defaultValue={editing?.type ?? 'video'} className={input}><option value="video">{bn ? 'ভিডিও + ফাইল' : 'Video + files'}</option><option value="text">{bn ? 'লেখা + ফাইল' : 'Text + files'}</option><option value="download">{bn ? 'ফাইল / রিসোর্স' : 'Download / resources'}</option>{editing && ['quiz', 'assignment'].includes(editing.type) ? <option value={editing.type}>{editing.type}</option> : null}</select></label>
        </div>
        <label className="block">{bn ? 'ভিডিও লিংক (ঐচ্ছিক)' : 'Video URL (optional)'}<input name="video_url" type="url" pattern="https://.*" defaultValue={editing?.video_url ?? ''} placeholder="https://www.youtube.com/watch?v=…" className={input} /><span className="mt-1 block text-xs text-muted">YouTube, Vimeo, MP4/WebM {bn ? 'বা অন্য HTTPS ভিডিও লিংক। অন্য সাইটে ভিডিও নতুন ট্যাবে খুলবে।' : 'or another HTTPS video link. Other websites open in a new tab.'}</span></label>
        <label className="block">{bn ? 'পাঠের লেখা / নির্দেশনা (Markdown)' : 'Lesson content / instructions (Markdown)'}<textarea rows={7} name="body_markdown" defaultValue={editing?.body_markdown ?? ''} className={input} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label>{bn ? 'সময় (সেকেন্ড)' : 'Duration (seconds)'}<input type="number" name="duration_seconds" min="1" max="86400" defaultValue={editing?.duration_seconds ?? ''} className={input} /></label><label>{bn ? 'ভর্তির কত দিন পরে খুলবে (ঐচ্ছিক)' : 'Unlock days after enrollment (optional)'}<input type="number" name="drip_days" min="0" max="3650" defaultValue={editing?.drip_days ?? ''} className={input} /></label></div>
        <label className="block"><input type="checkbox" name="is_free_preview" defaultChecked={editing?.is_free_preview} /> {bn ? 'ভিডিও ও লেখা বিনামূল্যে প্রিভিউ করা যাবে (ফাইল শুধু ভর্তিকৃতদের জন্য)' : 'Allow free video/text preview (files require enrollment)'}</label>
        <Button type="submit" disabled={busy}>{bn ? 'পাঠ সংরক্ষণ' : 'Save lesson'}</Button>{editing ? <button type="button" className="ms-4 text-sm text-blue" onClick={() => setEditing(null)}>{bn ? 'বাতিল' : 'Cancel'}</button> : null}
        <p className="text-xs text-muted">{bn ? 'পাঠ সংরক্ষণের পরে উপরের তালিকা থেকে ফাইল আপলোড করুন।' : 'After saving, upload files from the lesson list above.'}</p>
      </form> : null}
    </> : null}
  </div>;
}
