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
  slug: 'documents',
  title: 'Class documents',
  type: 'download',
  body_html: '',
  duration_seconds: null,
  is_free_preview: false,
  position: 1,
  course: { slug: 'plumbing', title: 'Plumbing design' },
  assets: [
    {
      id: 3,
      title: 'Septic tank design',
      size_bytes: null,
      checksum_sha256: null,
      download_url: '/api/v1/learn/plumbing/lessons/documents/assets/3',
      kind: 'link',
      provider: 'google_drive',
    },
    {
      id: 4,
      title: 'Loads.xlsx',
      size_bytes: 20480,
      checksum_sha256: null,
      download_url: '/api/v1/learn/plumbing/lessons/documents/assets/4',
      kind: 'file',
      provider: null,
    },
  ],
  playback: null,
  quiz_id: null,
  assignment_id: null,
} as unknown as Lesson;

describe('LessonPlayer documents', () => {
  it('opens a linked document in a new tab, named by the service it is on', () => {
    render(<LessonPlayer courseSlug="plumbing" lesson={lesson} isCompleted={false} />);

    const open = screen.getByRole('link', { name: 'Open: Septic tank design' });
    expect(open).toHaveAttribute('href', '/api/v1/learn/plumbing/lessons/documents/assets/3');
    expect(open).toHaveAttribute('target', '_blank');
    expect(open.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText('Google Drive')).toBeInTheDocument();
  });

  it('still downloads a stored file in place', () => {
    render(<LessonPlayer courseSlug="plumbing" lesson={lesson} isCompleted={false} />);

    const download = screen.getByRole('link', { name: 'Download: Loads.xlsx' });
    expect(download).not.toHaveAttribute('target');
    expect(screen.getByText('20 KB')).toBeInTheDocument();
  });
});
