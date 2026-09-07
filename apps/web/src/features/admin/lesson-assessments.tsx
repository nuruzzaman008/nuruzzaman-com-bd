'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { Button } from '@/components/ui/button';

type Question = { prompt: string; options: { label: string; is_correct: boolean }[] };
type Submission = { id: number; user_id: number; notes: string | null; original_filename: string | null; score_percent: number | null; feedback: string | null; status: string };
type Assessments = { quiz: { title: string; pass_percentage: number; max_attempts: number; questions: Question[] } | null; assignment: { title: string; brief_markdown: string; pass_percentage: number; max_file_size_kb: number; submissions: Submission[] } | null };
const field = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2';
const blankQuestion = (): Question => ({ prompt: '', options: [{ label: '', is_correct: true }, { label: '', is_correct: false }, { label: '', is_correct: false }, { label: '', is_correct: false }] });

export function LessonAssessments({ courseId, lessonId }: { courseId: number; lessonId: number }) {
  const { locale } = useLocale(); const bn = locale === 'bn';
  const base = `/admin/courses/${courseId}/lessons/${lessonId}`;
  const [data, setData] = useState<Assessments | null>(null);
  const [questions, setQuestions] = useState<Question[]>([blankQuestion()]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { let cancelled = false; void api<{ data: Assessments }>(`${base}/assessments`).then((result) => { if (!cancelled) { setData(result.data); setQuestions(result.data.quiz?.questions ?? [blankQuestion()]); } }).catch(() => { if (!cancelled) setError(bn ? 'তথ্য লোড হয়নি।' : 'Could not load assessments.'); }); return () => { cancelled = true; }; }, [base, bn]);
  async function save(path: string, body: unknown, method: 'PUT' | 'PATCH' = 'PUT') {
    setBusy(true); setError(''); setMessage('');
    try { await api(`${base}/${path}`, { method, body }); const result = await api<{ data: Assessments }>(`${base}/assessments`); setData(result.data); setMessage(bn ? 'সংরক্ষিত হয়েছে।' : 'Saved.'); }
    catch (caught) { setError(caught instanceof ApiError ? [caught.message, ...Object.values(caught.fields).flat()].join(' ') : 'Could not save.'); }
    finally { setBusy(false); }
  }
  if (!data) return <p role="status" className="mt-3 text-sm">{error || (bn ? 'লোড হচ্ছে…' : 'Loading…')}</p>;
  return <div className="mt-5 space-y-5 border-t border-line pt-5">
    {error ? <p role="alert" className="text-danger">{error}</p> : null}{message ? <p role="status" className="text-success">{message}</p> : null}
    <details><summary className="cursor-pointer font-semibold text-blue">{bn ? 'কুইজ তৈরি / সম্পাদনা' : 'Create / edit quiz'}</summary>
      <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save('quiz', { title: form.get('title'), pass_percentage: Number(form.get('pass_percentage')), max_attempts: Number(form.get('max_attempts')), questions }); }}>
        <label className="block">{bn ? 'কুইজের নাম' : 'Quiz title'}<input required name="title" defaultValue={data.quiz?.title} className={field} /></label>
        <div className="grid grid-cols-2 gap-3"><label>{bn ? 'পাস নম্বর (%)' : 'Pass (%)'}<input required type="number" min="1" max="100" name="pass_percentage" defaultValue={data.quiz?.pass_percentage ?? 70} className={field} /></label><label>{bn ? 'সর্বোচ্চ প্রচেষ্টা' : 'Maximum attempts'}<input required type="number" min="1" max="100" name="max_attempts" defaultValue={data.quiz?.max_attempts ?? 3} className={field} /></label></div>
        {questions.map((question, index) => <fieldset key={index} className="rounded-lg border border-line p-3"><legend>{bn ? 'প্রশ্ন' : 'Question'} {index + 1}</legend><label className="block">{bn ? 'প্রশ্নের লেখা' : 'Question text'}<textarea required value={question.prompt} className={field} onChange={(event) => setQuestions(questions.map((q, i) => i === index ? { ...q, prompt: event.target.value } : q))} /></label><p className="my-2 text-xs text-muted">{bn ? 'সঠিক উত্তরের পাশে চিহ্ন দিন' : 'Select the correct answer'}</p>{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2"><input type="radio" name={`correct-${index}`} aria-label={`Correct answer ${optionIndex + 1}`} checked={option.is_correct} onChange={() => setQuestions(questions.map((q, i) => i === index ? { ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === optionIndex })) } : q))} /><input required aria-label={`Answer ${optionIndex + 1}`} value={option.label} className={field} onChange={(event) => setQuestions(questions.map((q, i) => i === index ? { ...q, options: q.options.map((o, j) => j === optionIndex ? { ...o, label: event.target.value } : o) } : q))} /></div>)}{questions.length > 1 ? <button className="mt-2 text-xs text-danger" type="button" onClick={() => setQuestions(questions.filter((_, i) => i !== index))}>{bn ? 'প্রশ্ন মুছুন' : 'Remove question'}</button> : null}</fieldset>)}
        <button type="button" className="me-4 text-sm font-semibold text-blue" onClick={() => setQuestions([...questions, blankQuestion()])}>{bn ? '+ প্রশ্ন যোগ করুন' : '+ Add question'}</button><Button type="submit" disabled={busy}>{bn ? 'কুইজ সংরক্ষণ' : 'Save quiz'}</Button>
      </form>
    </details>
    <details><summary className="cursor-pointer font-semibold text-blue">{bn ? 'অ্যাসাইনমেন্ট ও মূল্যায়ন' : 'Assignment & grading'}</summary>
      <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save('assignment', { title: form.get('title'), brief_markdown: form.get('brief_markdown'), pass_percentage: Number(form.get('pass_percentage')), max_file_size_kb: Number(form.get('max_file_size_kb')) }); }}>
        <label className="block">{bn ? 'অ্যাসাইনমেন্টের নাম' : 'Assignment title'}<input required name="title" defaultValue={data.assignment?.title} className={field} /></label><label className="block">{bn ? 'কাজের নির্দেশনা (Markdown)' : 'Instructions (Markdown)'}<textarea required rows={4} name="brief_markdown" defaultValue={data.assignment?.brief_markdown} className={field} /></label>
        <div className="grid grid-cols-2 gap-3"><label>{bn ? 'পাস নম্বর (%)' : 'Pass (%)'}<input required type="number" min="1" max="100" name="pass_percentage" defaultValue={data.assignment?.pass_percentage ?? 60} className={field} /></label><label>{bn ? 'ফাইল সীমা (KB)' : 'File limit (KB)'}<input required type="number" min="1" max="102400" name="max_file_size_kb" defaultValue={data.assignment?.max_file_size_kb ?? 10240} className={field} /></label></div><Button type="submit" disabled={busy}>{bn ? 'অ্যাসাইনমেন্ট সংরক্ষণ' : 'Save assignment'}</Button>
      </form>
      <h4 className="mt-5 font-semibold">{bn ? 'জমা দেওয়া কাজ' : 'Student submissions'}</h4>
      {data.assignment?.submissions.map((submission) => <form key={submission.id} className="mt-3 space-y-3 rounded-lg border border-line p-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save(`submissions/${submission.id}`, { score_percent: Number(form.get('score_percent')), feedback: form.get('feedback') }, 'PATCH'); }}><p>#{submission.id} · Student #{submission.user_id} · {submission.status}</p><p className="whitespace-pre-wrap text-sm">{submission.notes}</p>{submission.original_filename ? <a className="text-sm text-blue" href={`/api/v1${base}/submissions/${submission.id}/file`}>{submission.original_filename} ↓</a> : null}<label className="block">{bn ? 'নম্বর (%)' : 'Score (%)'}<input required type="number" min="0" max="100" name="score_percent" defaultValue={submission.score_percent ?? ''} className={field} /></label><label className="block">{bn ? 'মতামত' : 'Feedback'}<textarea name="feedback" defaultValue={submission.feedback ?? ''} className={field} /></label><Button type="submit" disabled={busy}>{bn ? 'মূল্যায়ন সংরক্ষণ' : 'Save grade'}</Button></form>)}
    </details>
  </div>;
}
