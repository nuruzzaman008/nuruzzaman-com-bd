import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Lesson } from '@nuruzzaman/contracts';

import { LessonPlayer } from '@/features/learn/lesson-player';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: vi.fn().mockResolvedValue({ data: {} }) }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const lesson = {
  slug: 'septic-tank',
  title: 'Septic tank capacity as per BNBC',
  type: 'video',
  body_html: '<p>Size the tank for 100 users.</p>',
  duration_seconds: 600,
  is_free_preview: false,
  position: 3,
  course: { slug: 'plumbing', title: 'Plumbing design' },
  assets: [
    {
      id: 7,
      title: 'Septic tank design.pdf',
      size_bytes: 2_500_000,
      checksum_sha256: null,
      download_url: '/api/v1/learn/plumbing/lessons/septic-tank/assets/7',
    },
  ],
  playback: {
    provider: 'facebook',
    kind: 'iframe',
    url: 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D1',
    available: true,
    token: null,
    expires_in: 0,
    message: null,
  },
  quiz_id: null,
  assignment_id: null,
} as unknown as Lesson;

const previous = { slug: 'soak-well', title: 'Soak well design', is_unlocked: true };
const next = { slug: 'drainage', title: 'Drainage basics', is_unlocked: true };

describe('LessonPlayer', () => {
  it('shows the video first, then the title with the previous and next lessons', () => {
    const { container } = render(
      <LessonPlayer
        courseSlug="plumbing"
        lesson={lesson}
        isCompleted={false}
        previous={previous}
        next={next}
      />,
    );

    const frame = container.querySelector('iframe');
    const title = screen.getByRole('heading', {
      level: 1,
      name: 'Septic tank capacity as per BNBC',
    });

    expect(frame).toHaveAttribute('src', lesson.playback!.url);
    expect(frame!.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Previous: Soak well design' })).toHaveAttribute(
      'href',
      '/learn/plumbing/soak-well',
    );
    expect(screen.getByRole('link', { name: 'Next: Drainage basics' })).toHaveAttribute(
      'href',
      '/learn/plumbing/drainage',
    );
  });

  it('does not link to a next lesson that is still locked', () => {
    render(
      <LessonPlayer
        courseSlug="plumbing"
        lesson={lesson}
        isCompleted={false}
        previous={null}
        next={{ ...next, is_unlocked: false }}
      />,
    );

    expect(screen.queryByRole('link', { name: /Next/ })).not.toBeInTheDocument();
    expect(screen.getByText('Next')).toHaveAttribute('aria-disabled', 'true');
  });

  it('lists the files as downloads with their size', () => {
    render(<LessonPlayer courseSlug="plumbing" lesson={lesson} isCompleted={false} />);

    expect(screen.getByRole('link', { name: 'Download: Septic tank design.pdf' })).toHaveAttribute(
      'href',
      '/api/v1/learn/plumbing/lessons/septic-tank/assets/7',
    );
    expect(screen.getByText('2.4 MB')).toBeInTheDocument();
  });

  it('starts with the title for an article without a video', () => {
    const { container } = render(
      <LessonPlayer
        courseSlug="plumbing"
        lesson={{ ...lesson, type: 'text', playback: null } as unknown as Lesson}
        isCompleted
      />,
    );

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Size the tank for 100 users.')).toBeInTheDocument();
    expect(screen.getByText('This lesson is complete.')).toBeInTheDocument();
  });
});
