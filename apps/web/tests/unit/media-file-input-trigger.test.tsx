import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaFileInput } from '@/components/ui/media-file-input';
import { LessonForm } from '@/features/admin/lesson-form';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: [], last_page: 1 });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

describe('MediaFileInput trigger', () => {
  it('keeps the default button when nothing else is asked for', () => {
    render(<MediaFileInput aria-label="Photo" name="photo" />);

    expect(screen.getByRole('button', { name: 'Choose from Media / Upload' })).toBeInTheDocument();
  });

  it('takes its own words and a larger size, and still opens Media first', async () => {
    render(
      <MediaFileInput
        aria-label="Files"
        name="files"
        multiple
        triggerLabel="Choose files"
        triggerClassName="w-full"
      />,
    );

    const button = screen.getByRole('button', { name: 'Choose files' });
    expect(button.className).toContain('w-full');
    expect(button.className).toContain('min-h-12');

    fireEvent.click(button);

    expect(await screen.findByText('Media — previously uploaded files')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      '/uploads/library',
      expect.objectContaining({ query: expect.objectContaining({ scope: 'personal' }) }),
    );
  });

  it('gives the lesson form its large blue upload button, opening the course’s Media', async () => {
    render(
      <LessonForm
        courseId={12}
        sections={[{ id: 1, title: 'IPA' }]}
        lesson={null}
        courseLessonSlugs={[]}
        lessonCount={0}
        busy={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Choose files — from Media or upload new' }),
    );

    expect(await screen.findByText('Media — previously uploaded files')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      '/uploads/library',
      expect.objectContaining({
        query: expect.objectContaining({ scope: 'course', course_id: 12 }),
      }),
    );
  });
});
