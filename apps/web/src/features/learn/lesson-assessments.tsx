'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { Prose } from '@/components/ui/prose';

type Quiz = { id: number; title: string; instructions: string | null; max_attempts: number; attempts_used: number; pass_percentage: number; time_limit_seconds: number | null; questions: { id: number; prompt: string; type: string; options: { id: number; label: string }[] }[] };
type Assignment = { id: number; title: string; brief_html: string; max_file_size_kb: number; allowed_mime_types: string[]; submission: { status: string; score_percent: number | null; feedback: string | null } | null };

export function LessonAssessments({ quizId, assignmentId }: { quizId?: number | null; assignmentId?: number | null }) {
  const { locale } = useLocale(); const bn = locale === 'bn'; const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null); const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [attempt, setAttempt] = useState<number | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { let cancelled = false; void Promise.all([
    quizId ? api<{ data: Quiz }>(`/quizzes/${quizId}`) : null,
    assignmentId ? api<{ data: Assignment }>(`/assignments/${assignmentId}`) : null,
  ]).then(([q, a]) => { if (!cancelled) { setQuiz(q?.data ?? null); setAssignment(a?.data ?? null); } }).catch(() => { if (!cancelled) setError(bn ? 'অনুশীলন লোড হয়নি। পাতা রিফ্রেশ করুন।' : 'Could not load activities. Refresh the page.'); }); return () => { cancelled = true; }; }, [quizId, assignmentId, bn]);
  async function action(work: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await work(); router.refresh(); } catch (caught) { setError(caught instanceof ApiError ? [caught.message, ...Object.values(caught.fields).flat()].join(' ') : (bn ? 'অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।' : 'Request failed. Please try again.')); } finally { setBusy(false); } }
  if (!quizId && !assignmentId) return null;
  return <section className="mt-8 space-y-6 border-t border-line pt-6">
    {error ? <p role="alert" className="text-danger">{error}</p> : null}{message ? <p role="status" className="rounded-lg bg-blue-soft p-4 text-navy">{message}</p> : null}
    {quiz ? <div className="rounded-xl border border-line p-5"><h2 className="text-xl font-bold text-navy">{quiz.title}</h2><p className="mt-2 text-sm text-muted">{bn ? 'পাস নম্বর' : 'Pass'}: {quiz.pass_percentage}% · {bn ? 'ব্যবহৃত প্রচেষ্টা' : 'Attempts used'}: {quiz.attempts_used}/{quiz.max_attempts || '∞'}</p>{quiz.instructions ? <p className="mt-3 whitespace-pre-wrap">{quiz.instructions}</p> : null}{quiz.time_limit_seconds ? <p className="mt-2 text-sm">{bn ? 'সময় সীমা' : 'Time limit'}: {quiz.time_limit_seconds} s</p> : null}
      {!attempt ? <Button className="mt-4" type="button" disabled={busy || (quiz.max_attempts > 0 && quiz.attempts_used >= quiz.max_attempts)} onClick={() => void action(async () => { const result = await api<{ data: { attempt_id: number } }>(`/quizzes/${quiz.id}/attempts`, { method: 'POST' }); setAttempt(result.data.attempt_id); setQuiz({ ...quiz, attempts_used: quiz.attempts_used + 1 }); })}>{bn ? 'কুইজ শুরু করুন' : 'Start quiz'}</Button> : <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action(async () => { const result = await api<{ data: { score_percent: number; passed: boolean } }>(`/quiz-attempts/${attempt}/submit`, { method: 'POST', body: { answers: quiz.questions.map((question) => ({ question_id: question.id, option_ids: data.getAll(`question-${question.id}`).map(Number), text: data.get(`text-${question.id}`) || null })) } }); setAttempt(null); setMessage(`${bn ? 'আপনার ফলাফল' : 'Your result'}: ${result.data.score_percent}% — ${result.data.passed ? (bn ? 'উত্তীর্ণ' : 'Passed') : (bn ? 'পাস নম্বর অর্জিত হয়নি' : 'Not passed')}`); }); }}>
        {quiz.questions.map((question, index) => <fieldset key={question.id}><legend className="mb-2 font-semibold">{index + 1}. {question.prompt}</legend>{question.type === 'short_text' ? <textarea required name={`text-${question.id}`} className="w-full rounded-lg border border-line p-3" /> : question.options.map((option) => <label key={option.id} className="mt-2 flex gap-3 rounded-lg border border-line p-3"><input required={question.type === 'single_choice'} type={question.type === 'multiple_choice' ? 'checkbox' : 'radio'} name={`question-${question.id}`} value={option.id} /><span>{option.label}</span></label>)}</fieldset>)}<Button type="submit" disabled={busy}>{bn ? 'উত্তর জমা দিন' : 'Submit answers'}</Button>
      </form>}
    </div> : null}
    {assignment ? <div className="rounded-xl border border-line p-5"><h2 className="text-xl font-bold text-navy">{assignment.title}</h2><Prose className="mt-3" html={assignment.brief_html} />{assignment.submission ? <div className="mt-4 rounded-lg bg-blue-soft p-3"><p>{bn ? 'জমার অবস্থা' : 'Submission'}: {assignment.submission.status}{assignment.submission.score_percent !== null ? ` · ${assignment.submission.score_percent}%` : ''}</p><p className="mt-1 whitespace-pre-wrap">{assignment.submission.feedback}</p></div> : null}
      <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const body = new FormData(form); const file = body.get('file'); if (file instanceof File && !file.size) body.delete('file'); void action(async () => { await api(`/assignments/${assignment.id}/submissions`, { method: 'POST', body }); const result = await api<{ data: Assignment }>(`/assignments/${assignment.id}`); setAssignment(result.data); form.reset(); setMessage(bn ? 'কাজ জমা হয়েছে। শিক্ষকের মূল্যায়নের জন্য অপেক্ষা করুন।' : 'Submitted. Awaiting instructor review.'); }); }}>
        <label className="block text-sm font-semibold">{bn ? 'আপনার উত্তর / নোট' : 'Your answer / notes'}<textarea name="notes" rows={4} maxLength={2000} className="mt-2 w-full rounded-lg border border-line p-3" /></label><label className="block text-sm font-semibold">{bn ? 'কাজের ফাইল (ঐচ্ছিক)' : 'Assignment file (optional)'}<input name="file" type="file" accept={assignment.allowed_mime_types.length ? assignment.allowed_mime_types.join(',') : '.pdf,.png,.jpg,.jpeg,.zip'} className="mt-2 block w-full" /></label><p className="text-xs text-muted">{bn ? 'সর্বোচ্চ ফাইলের আকার' : 'Maximum file size'}: {(assignment.max_file_size_kb / 1024).toFixed(0)} MB</p><Button type="submit" disabled={busy}>{bn ? 'কাজ জমা দিন' : 'Submit assignment'}</Button>
      </form>
    </div> : null}
  </section>;
}
