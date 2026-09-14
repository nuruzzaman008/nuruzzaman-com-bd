import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseOutline } from '@nuruzzaman/contracts';

import { CourseOutlineNav } from '@/features/learn/course-outline';

const request = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

type OutlineLesson = CourseOutline['sections'][number]['lessons'][number];

function lesson(slug: string, title: string, extra: Partial<OutlineLesson> = {}): OutlineLesson {
  return {
    slug,
    title,
    type: 'text',
    duration_seconds: null,
    has_video: false,
    assets_count: 0,
    has_quiz: false,
    has_assignment: false,
    is_completed: false,
    is_unlocked: true,
    ...extra,
  };
}

function outline(extra: Partial<CourseOutline> = {}): CourseOutline {
  return {
    course: {
      slug: 'plumbing',
      title: 'Plumbing design',
      sequential: true,
      issues_certificate: true,
    },
    certificate: null,
    review: null,
    enrollment: { status: 'active', progress_percent: 87, expires_at: null, last_lesson_id: null },
    sections: [
      {
        id: 1,
        title: 'Introduction to Plumbing',
        lessons: [
          lesson('intro', 'Introduction', { type: 'video', has_video: true, is_completed: true }),
        ],
      },
      {
        id: 2,
        title: 'Drainage System Design',
        lessons: [
          lesson('documents', 'Documents', { type: 'download', assets_count: 2 }),
          lesson('basics', 'Basic principles', {
            type: 'video',
            has_video: true,
            is_completed: true,
          }),
          lesson('final-quiz', 'Final quiz', { type: 'quiz', has_quiz: true, is_unlocked: false }),
        ],
      },
    ],
    ...extra,
  } as CourseOutline;
}

const detailsOf = (title: string) => screen.getByText(title).closest('details');

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: {} });
});

describe('CourseOutlineNav', () => {
  it('numbers each class and opens only the one being studied', () => {
    render(<CourseOutlineNav outline={outline()} currentSlug="basics" locale="en" />);

    expect(screen.getByText('Class-01:')).toBeInTheDocument();
    expect(screen.getByText('Class-02:')).toBeInTheDocument();
    expect(detailsOf('Drainage System Design')).toHaveAttribute('open');
    expect(detailsOf('Introduction to Plumbing')).not.toHaveAttribute('open');
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument();
  });

  it('shows the course progress at the top', () => {
    render(<CourseOutlineNav outline={outline()} currentSlug="basics" locale="en" />);

    expect(screen.getByRole('progressbar', { name: 'Course progress' })).toHaveAttribute(
      'aria-valuenow',
      '87',
    );
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('ticks finished lessons, marks the current one and never links a locked lesson', () => {
    render(<CourseOutlineNav outline={outline()} currentSlug="basics" locale="en" />);

    const current = screen.getByRole('link', { name: /Basic principles/ });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAccessibleName(/\(complete\)/);
    expect(screen.getByRole('link', { name: /Documents/ })).toHaveAttribute(
      'href',
      '/learn/plumbing/documents',
    );

    expect(screen.queryByRole('link', { name: /Final quiz/ })).not.toBeInTheDocument();
    expect(screen.getByText('Final quiz')).toBeInTheDocument();
  });

  it('keeps each lesson to its title, adding only a file count or length when there is one', () => {
    render(<CourseOutlineNav outline={outline()} currentSlug="basics" locale="en" />);

    const documents = screen.getByRole('link', { name: /Documents/ });
    expect(within(documents).getByText('2 files')).toBeInTheDocument();
    expect(within(documents).queryByText(/Document ·/)).not.toBeInTheDocument();

    // A plain video lesson: the tick and the title - no "Video" label, no icon.
    const video = screen.getByRole('link', { name: /Basic principles/ });
    expect(within(video).queryByText('Video')).not.toBeInTheDocument();
    expect(video.querySelectorAll('svg')).toHaveLength(1);
  });

  it('keeps a locked lesson to its lock and title, and explains the lock once under the list', () => {
    const { unmount } = render(
      <CourseOutlineNav outline={outline()} currentSlug="basics" locale="en" />,
    );

    // No "Opens once…" line or lesson-type icon on the row - only the lock.
    const row = screen.getByText('Final quiz').closest('p')!;
    expect(row.querySelectorAll('svg')).toHaveLength(1);
    expect(within(row).getByText('Opens once the previous lesson is complete')).toHaveClass(
      'sr-only',
    );

    // Said once, under all the classes.
    expect(
      screen.getAllByText('Locked lessons open once the previous lesson is complete'),
    ).toHaveLength(1);
    unmount();

    const open = outline();
    open.sections[1].lessons[2] = { ...open.sections[1].lessons[2], is_unlocked: true };
    render(<CourseOutlineNav outline={open} currentSlug="basics" locale="en" />);

    expect(
      screen.queryByText('Locked lessons open once the previous lesson is complete'),
    ).not.toBeInTheDocument();
  });

  it('offers the exam once a quiz lesson is open, and explains why not before', () => {
    const { unmount } = render(
      <CourseOutlineNav outline={outline()} currentSlug="basics" locale="en" />,
    );

    expect(screen.getByRole('button', { name: 'Take the exam now' })).toBeDisabled();
    expect(
      screen.getByText('The exam opens once the earlier lessons are complete.'),
    ).toBeInTheDocument();
    unmount();

    const open = outline();
    open.sections[1].lessons[2] = { ...open.sections[1].lessons[2], is_unlocked: true };
    render(<CourseOutlineNav outline={open} currentSlug="basics" locale="en" />);

    expect(screen.getByRole('link', { name: 'Take the exam now' })).toHaveAttribute(
      'href',
      '/learn/plumbing/final-quiz',
    );
  });

  it('links the certificate once it is issued', () => {
    const { unmount } = render(
      <CourseOutlineNav outline={outline()} currentSlug="basics" locale="en" />,
    );

    expect(screen.getByRole('button', { name: 'Get your certificate' })).toBeDisabled();
    unmount();

    render(
      <CourseOutlineNav
        outline={outline({
          certificate: { verification_id: 'NB-2026-0001', issued_at: '2026-09-13T00:00:00Z' },
        })}
        currentSlug="basics"
        locale="en"
      />,
    );

    expect(screen.getByRole('link', { name: 'Get your certificate' })).toHaveAttribute(
      'href',
      '/verify/NB-2026-0001',
    );
  });

  it('leaves the certificate out of a course that issues none', () => {
    const plain = outline();
    plain.course = { ...plain.course, issues_certificate: false };
    render(<CourseOutlineNav outline={plain} currentSlug="basics" locale="en" />);

    expect(screen.queryByText('Get your certificate')).not.toBeInTheDocument();
  });

  it('takes a review with a rating, held for approval', async () => {
    render(<CourseOutlineNav outline={outline()} currentSlug="basics" locale="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Write a review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a rating.');
    expect(request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('4 stars'));
    fireEvent.change(screen.getByLabelText('Title (optional)'), {
      target: { value: 'Clear and practical' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    });

    expect(request).toHaveBeenCalledWith('/learn/plumbing/reviews', {
      method: 'POST',
      body: { rating: 4, title: 'Clear and practical', body: null },
    });
    expect(screen.getByRole('status')).toHaveTextContent(/once approved/);
  });

  it('opens an earlier review for editing, with its status', () => {
    render(
      <CourseOutlineNav
        outline={outline({
          review: { rating: 5, title: 'Great', body: null, status: 'in_review' },
        })}
        currentSlug="basics"
        locale="en"
      />,
    );

    expect(screen.getByText('Your review is awaiting approval.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit your review' }));
    expect(screen.getByLabelText('5 stars')).toBeChecked();
    expect(screen.getByLabelText('Title (optional)')).toHaveValue('Great');
  });
});
