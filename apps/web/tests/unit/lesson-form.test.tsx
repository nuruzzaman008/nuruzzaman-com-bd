import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LessonForm, lessonSlug, type EditableLesson } from '@/features/admin/lesson-form';

vi.mock('@/lib/api/browser', () => ({ api: vi.fn(), ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const onSave = vi.fn();

function setup(lesson: EditableLesson | null = null, taken: string[] = [], lessonCount = 0) {
  render(
    <LessonForm
      sections={[{ id: 1, title: 'IPA' }]}
      lesson={lesson}
      courseLessonSlugs={taken}
      lessonCount={lessonCount}
      busy={false}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
}

const existing: EditableLesson = {
  id: 5,
  title: 'Video 01',
  slug: 'video01',
  type: 'video',
  course_section_id: 1,
  body_markdown: null,
  video_url: 'https://youtu.be/dQw4w9WgXcQ',
  duration_seconds: null,
  drip_days: null,
  is_free_preview: false,
  assets: [],
};

const slugField = () => screen.getByLabelText(/^URL slug/) as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save lesson' }));
const draft = () => onSave.mock.calls.at(-1)![0];

beforeEach(() => {
  onSave.mockReset();
});

describe('lessonSlug', () => {
  it('uses what was typed, else the title, else a numbered slug, always unique', () => {
    expect(lessonSlug('', 'Septic Tank Design', [], 1)).toBe('septic-tank-design');
    expect(lessonSlug('My Slug', 'Anything', [], 1)).toBe('my-slug');
    expect(lessonSlug('', 'ভূমিকা', [], 3)).toBe('lesson-03');
    expect(lessonSlug('', 'Notes', ['notes', 'notes-2'], 1)).toBe('notes-3');
  });
});

describe('LessonForm', () => {
  it('fills the slug from the title as it is typed, until the slug is typed into', () => {
    setup();

    fireEvent.change(screen.getByLabelText('Lesson title'), {
      target: { value: 'Septic Tank Design' },
    });
    expect(slugField()).toHaveValue('septic-tank-design');

    fireEvent.change(slugField(), { target: { value: 'tank-notes' } });
    fireEvent.change(screen.getByLabelText('Lesson title'), {
      target: { value: 'Septic Tank Design 2' },
    });
    expect(slugField()).toHaveValue('tank-notes');
  });

  it('gives a lesson with a Bengali title a slug of its own, unique in the course', () => {
    setup(null, ['lesson-03'], 2);

    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'ভূমিকা' } });
    save();

    expect(draft().values.slug).toBe('lesson-03-2');
  });

  it('keeps an existing lesson’s slug when its title changes', () => {
    setup(existing, ['video01']);

    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'Introduction' } });
    save();

    expect(draft().values).toMatchObject({ title: 'Introduction', slug: 'video01' });
  });

  it('shows the video link only for a video lesson', () => {
    setup();

    expect(screen.getByLabelText(/Video URL/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lesson type'), { target: { value: 'download' } });
    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'Documents' } });
    save();

    expect(screen.queryByLabelText(/Video URL/)).not.toBeInTheDocument();
    expect(draft().values).toMatchObject({ type: 'download', video_url: null });
  });

  it('gathers files and Google Drive links, handed over with the lesson', () => {
    setup();

    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'Documents' } });
    fireEvent.change(screen.getByLabelText(/Choose files/), {
      target: {
        files: [
          new File(['a'], 'Septic tank design.pdf', { type: 'application/pdf' }),
          new File(['bb'], 'Loads.xlsx'),
        ],
      },
    });

    // The link box stays folded away until "+ Link" is pressed.
    expect(screen.queryByLabelText(/^Document link/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Link' }));
    fireEvent.change(screen.getByLabelText(/^Document link/), {
      target: { value: 'drive.google.com/file/d/1/view' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/https:\/\//);

    fireEvent.change(screen.getByLabelText(/^Document link/), {
      target: { value: 'https://drive.google.com/file/d/1AbC/view?usp=sharing' },
    });
    fireEvent.change(screen.getByLabelText('Name (optional)'), {
      target: { value: 'Class notes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));

    const queued = within(screen.getByRole('list', { name: 'Attached when saved' }));
    expect(queued.getByText('Google Drive')).toBeInTheDocument();
    expect(queued.getByText('Class notes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove: Loads.xlsx' }));
    save();

    expect(draft().files.map((file: File) => file.name)).toEqual(['Septic tank design.pdf']);
    expect(draft().links).toEqual([
      { url: 'https://drive.google.com/file/d/1AbC/view?usp=sharing', title: 'Class notes' },
    ]);
  });

  it('adds a link with Enter instead of saving the lesson', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: '+ Link' }));
    fireEvent.change(screen.getByLabelText(/^Document link/), {
      target: { value: 'https://www.dropbox.com/scl/fi/abc/Notes.pdf?dl=0' },
    });
    fireEvent.keyDown(screen.getByLabelText(/^Document link/), { key: 'Enter' });

    expect(onSave).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole('list', { name: 'Attached when saved' })).getByText('Dropbox'),
    ).toBeInTheDocument();
  });

  it('keeps the rarely changed settings folded away, still saved with the lesson, and the text under the video open', () => {
    setup();

    const settings = screen.getByText(/^More settings/).closest('details')!;
    expect(settings).not.toHaveAttribute('open');
    // A video lesson is video + text, so the place to write the text is open.
    expect(screen.getByText('Text under the video (optional)').closest('details')).toHaveAttribute(
      'open',
    );

    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'Loads' } });
    fireEvent.change(within(settings).getByLabelText('Unlock days after enrollment'), {
      target: { value: '7' },
    });
    save();

    expect(draft().values).toMatchObject({ slug: 'loads', drip_days: 7 });
  });

  it('opens the lesson text for a text lesson', () => {
    setup();

    fireEvent.change(screen.getByLabelText('Lesson type'), { target: { value: 'text' } });

    expect(
      screen.getByText('Lesson content / instructions (optional)').closest('details'),
    ).toHaveAttribute('open');
  });

  it('says what students will see for each type', () => {
    setup();

    expect(screen.getByText(/Students see: the video, with the text under it/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lesson type'), { target: { value: 'text' } });
    expect(
      screen.getByText(
        'Students see: the text, and a Download button for each file. No video plays.',
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lesson type'), { target: { value: 'download' } });
    expect(
      screen.getByText('Students see: only a Download button for each file. No text is shown.'),
    ).toBeInTheDocument();
  });

  it('hides the text box for a downloads-only lesson but still saves the text already written', () => {
    setup({ ...existing, body_markdown: 'Read this before the class.' }, ['video01']);

    fireEvent.change(screen.getByLabelText('Lesson type'), { target: { value: 'download' } });

    expect(
      screen.getByText('Lesson content / instructions (optional)').closest('details'),
    ).toHaveAttribute('hidden');
    save();

    expect(draft().values).toMatchObject({
      type: 'download',
      body_markdown: 'Read this before the class.',
    });
  });

  it('ends with Save and Cancel only - a lesson is deleted from its row in the list', () => {
    setup(existing, ['video01']);

    expect(screen.getByRole('button', { name: 'Save lesson' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
