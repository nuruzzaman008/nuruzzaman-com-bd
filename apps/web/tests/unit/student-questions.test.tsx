import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseQuestion } from '@nuruzzaman/contracts';

import { QuestionInbox } from '@/features/dashboard/question-inbox';
import { LessonQuestions } from '@/features/learn/lesson-questions';

const request = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
const session = vi.hoisted(() => ({ current: { user: null as unknown } }));

const FakeApiError = vi.hoisted(
  () =>
    class extends Error {
      fields: Record<string, string[]> = {};
      isValidation = false;
      isNetworkError = false;
      status = 0;
    },
);

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/session/session-provider', () => ({
  useSession: () => ({ ...session.current, isLoading: false, refresh: vi.fn() }),
}));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const question: CourseQuestion = {
  id: 7,
  title: 'hello sir',
  body: 'hello sir, i did not understand few alphabet sound',
  status: 'in_review',
  is_pinned: false,
  is_mine: true,
  reply_count: 0,
  author_name: 'Rahim',
  course: { slug: 'basic-english-sound-ipa', title: 'Basic English Sound' },
  lesson: { slug: '1-1', title: '1.1 Phonetic alphabet' },
  answered_at: null,
  resolved_at: null,
  created_at: '2026-09-21T09:00:00Z',
  replies: [],
};

const answer = {
  id: 1,
  body: 'Listen from 0:45 again.',
  from_instructor: true,
  author_name: 'Md Nuruzzaman',
  created_at: '2026-09-21T10:00:00Z',
};

beforeEach(() => {
  request.mockReset();
  router.refresh.mockReset();
  session.current = { user: { id: 1, roles: ['super_admin'], permissions: [] } };
});

describe('LessonQuestions (under a lesson)', () => {
  it('sends the question with the lesson, and says where it goes', async () => {
    request.mockResolvedValueOnce({ data: question });

    render(
      <LessonQuestions courseSlug="basic-english-sound-ipa" lessonSlug="1-1" questions={[]} />,
    );

    expect(screen.getByRole('heading', { name: 'Ask the teacher' })).toBeTruthy();
    expect(screen.getByText(/Your question goes straight to the teacher/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'hello sir, i did not understand few alphabet sound' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

    expect(await screen.findByText(/Question sent/)).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/learn/basic-english-sound-ipa/questions', {
      method: 'POST',
      body: { body: 'hello sir, i did not understand few alphabet sound', lesson: '1-1' },
    });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it('shows a waiting question as private, and the teacher’s answer when it comes', () => {
    const { rerender } = render(
      <LessonQuestions courseSlug="c" lessonSlug="1-1" questions={[question]} />,
    );

    expect(screen.getByText(/Only you and the teacher see this/)).toBeTruthy();
    expect(screen.getByText('Waiting for an answer')).toBeTruthy();

    rerender(
      <LessonQuestions
        courseSlug="c"
        lessonSlug="1-1"
        questions={[
          { ...question, reply_count: 1, answered_at: answer.created_at, replies: [answer] },
        ]}
      />,
    );

    expect(screen.getByText('Listen from 0:45 again.')).toBeTruthy();
    expect(screen.getByText('Teacher')).toBeTruthy();
    expect(screen.queryByText('Waiting for an answer')).toBeNull();
  });
});

describe('QuestionInbox (dashboard)', () => {
  it('shows who asked, where, and sends the answer', async () => {
    request.mockResolvedValueOnce({
      data: { ...question, answered_at: answer.created_at, replies: [answer] },
    });

    render(<QuestionInbox initial={[question]} />);

    expect(screen.getByText('Rahim')).toBeTruthy();
    expect(screen.getByText('Basic English Sound → 1.1 Phonetic alphabet')).toBeTruthy();
    expect(screen.getByText(/Private — only the student/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Your answer'), {
      target: { value: 'Listen from 0:45 again.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send answer' }));

    expect(await screen.findByText('Answer sent; the student has been emailed.')).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/admin/course-questions/7/replies', {
      method: 'POST',
      body: { body: 'Listen from 0:45 again.' },
    });
    expect(screen.getByText('Listen from 0:45 again.')).toBeTruthy();
    expect(screen.getByText('Answered')).toBeTruthy();
  });

  it('shows it to the whole class, and makes it private again', async () => {
    request.mockResolvedValueOnce({ data: { ...question, status: 'published' } });
    request.mockResolvedValueOnce({ data: { ...question, status: 'in_review' } });

    render(<QuestionInbox initial={[question]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show to the whole class' }));
    expect(await screen.findByText('Shown to the whole class')).toBeTruthy();
    expect(request).toHaveBeenLastCalledWith('/admin/course-questions/7/moderate', {
      method: 'POST',
      body: { status: 'published' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Make private again' }));
    expect(await screen.findByText(/Private — only the student/)).toBeTruthy();
  });

  it('shows staff who cannot answer the list without the answer box', () => {
    session.current = { user: { id: 2, roles: ['support'], permissions: ['courses.view'] } };

    render(<QuestionInbox initial={[question]} />);

    expect(screen.getByText('Rahim')).toBeTruthy();
    expect(screen.queryByLabelText('Your answer')).toBeNull();
  });

  it('says so when there is nothing waiting', () => {
    render(<QuestionInbox initial={[]} />);

    expect(screen.getByText('No questions here right now.')).toBeTruthy();
  });
});
