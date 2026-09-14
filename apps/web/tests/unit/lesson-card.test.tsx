import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LessonCard, type CardLesson } from '@/features/admin/lesson-card';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});
vi.mock('@/features/admin/lesson-assessments', () => ({
  LessonAssessments: () => <p>Assessments</p>,
}));

const lesson: CardLesson = {
  id: 5,
  title: 'lesson title02',
  type: 'video',
  video_url: 'https://www.youtube.com/watch?v=3K61natG_FU',
  video_provider: null,
  assets: [
    { id: 1, title: 'notes.pdf', size_bytes: 20480, kind: 'file', link_url: null },
    {
      id: 2,
      title: 'Class notes',
      size_bytes: null,
      kind: 'link',
      link_url: 'https://drive.google.com/file/d/1/view',
    },
  ],
};

function setup(overrides: Partial<CardLesson> = {}) {
  const reload = vi.fn(async () => {});
  const onDelete = vi.fn();

  render(
    <ol>
      <LessonCard
        lesson={{ ...lesson, ...overrides }}
        courseId={12}
        base="/admin/courses/12"
        busy={false}
        run={(work) => work()}
        reload={reload}
        onProgress={vi.fn()}
        onEdit={vi.fn()}
        onMove={vi.fn()}
        onDelete={onDelete}
        assessmentOpen={false}
        onToggleAssessment={vi.fn()}
      />
    </ol>,
  );

  return { reload, onDelete };
}

function call(path: string, method: string) {
  return request.mock.calls.find(([p, options]) => p === path && options?.method === method);
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: {} });
});

describe('LessonCard', () => {
  it('shows only what the lesson holds, one line each', () => {
    setup();

    expect(screen.getByText('Video:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: lesson.video_url! })).toHaveAttribute(
      'href',
      lesson.video_url,
    );
    expect(screen.getByText('File:')).toBeInTheDocument();
    expect(screen.getByText('notes.pdf')).toBeInTheDocument();
    expect(screen.getByText('20 KB')).toBeInTheDocument();
    expect(screen.getByText('Link:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Google Drive ↗' })).toHaveAttribute(
      'href',
      'https://drive.google.com/file/d/1/view',
    );

    // Nothing to fill in until one of the + buttons is pressed.
    expect(screen.queryByLabelText(/^Document link/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Media/ })).not.toBeInTheDocument();
  });

  it('says so, briefly, when the lesson holds nothing yet', () => {
    setup({ video_url: null, assets: [] });

    expect(screen.queryByText('Video:')).not.toBeInTheDocument();
    expect(screen.getByText(/No video or files yet/)).toBeInTheDocument();
  });

  it('adds a Google Drive link from + Link, and closes the box once it is saved', async () => {
    const { reload } = setup();

    fireEvent.click(screen.getByRole('button', { name: '+ Link' }));
    const url = 'https://drive.google.com/file/d/2/view';
    fireEvent.change(screen.getByLabelText(/^Document link/), { target: { value: url } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));

    await waitFor(() => expect(call('/admin/courses/12/lessons/5/links', 'POST')).toBeDefined());
    expect(call('/admin/courses/12/lessons/5/links', 'POST')![1].body).toEqual({
      url,
      title: null,
    });
    await waitFor(() => expect(screen.queryByLabelText(/^Document link/)).not.toBeInTheDocument());
    expect(reload).toHaveBeenCalled();
  });

  it('saves a video link from + Video', async () => {
    setup({ video_url: null });

    fireEvent.click(screen.getByRole('button', { name: '+ Video' }));
    const url = 'https://www.youtube.com/watch?v=3K61natG_FU';
    fireEvent.change(screen.getByLabelText('Video link (YouTube, Facebook, Vimeo)'), {
      target: { value: url },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save link' }));

    await waitFor(() => expect(call('/admin/courses/12/lessons/5', 'PATCH')).toBeDefined());
    expect(call('/admin/courses/12/lessons/5', 'PATCH')![1].body).toEqual({ video_url: url });
  });

  it('opens the Media picker from + File', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: '+ File' }));

    expect(
      screen.getByRole('button', { name: 'Choose files — from Media or upload new' }),
    ).toBeInTheDocument();
  });

  it('moves a file down with the keyboard and saves the new order', async () => {
    setup();

    fireEvent.keyDown(
      screen.getByRole('button', {
        name: 'Move notes.pdf — drag, or press the up and down arrows',
      }),
      { key: 'ArrowDown' },
    );

    await waitFor(() =>
      expect(call('/admin/courses/12/lessons/5/assets/reorder', 'PUT')).toBeDefined(),
    );
    expect(call('/admin/courses/12/lessons/5/assets/reorder', 'PUT')![1].body).toEqual({
      ids: [2, 1],
    });
  });

  it('has a red Delete lesson button that hands the whole lesson to the editor', () => {
    const { onDelete } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Delete lesson: lesson title02' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('deletes a file once confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Delete: notes.pdf' }));

    await waitFor(() =>
      expect(call('/admin/courses/12/lessons/5/assets/1', 'DELETE')).toBeDefined(),
    );
  });
});
