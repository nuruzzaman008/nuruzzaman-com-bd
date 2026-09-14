import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CourseEditor, type Curriculum } from '@/features/admin/course-editor';

const request = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});
vi.mock('@/features/admin/lesson-assessments', () => ({ LessonAssessments: () => null }));

type CourseLesson = Curriculum['sections'][number]['lessons'][number];

function lesson(overrides: Partial<CourseLesson> = {}): CourseLesson {
  return {
    id: 5,
    title: 'Video 01',
    slug: 'video01',
    type: 'video',
    course_section_id: 1,
    body_markdown: null,
    video_url: null,
    video_provider: null,
    video_asset_id: null,
    duration_seconds: null,
    position: 0,
    drip_days: null,
    is_free_preview: false,
    assets: [],
    ...overrides,
  };
}

function course(lessons: CourseLesson[] = [lesson()]): Curriculum {
  return {
    id: 12,
    title: 'Basic English Sound',
    slug: 'basic-english-sound',
    status: 'draft',
    sequential: true,
    issues_certificate: false,
    description_markdown: null,
    price_minor: 100000,
    pricing: { type: 'paid', regular_minor: 100000, offer_minor: null, offer_ends_at: null },
    seo: null,
    sections: [{ id: 1, title: 'IPA', position: 0, drip_days: null, lessons }],
  };
}

function call(path: string, method?: string) {
  return request.mock.calls.findIndex(([p, options]) => p === path && options?.method === method);
}

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === '/admin/courses/12/lessons' && options?.method === 'POST') {
      return Promise.resolve({ data: { id: 9 } });
    }

    return Promise.resolve(
      path === '/admin/courses/12/curriculum' ? { data: course() } : { data: { id: 1 } },
    );
  });
});

describe('CourseEditor lesson documents', () => {
  it('saves a new lesson and then attaches its Google Drive link, with the slug made from the title', async () => {
    render(<CourseEditor initial={course()} />);

    fireEvent.change(screen.getByLabelText('Lesson title'), {
      target: { value: 'Septic Tank Notes' },
    });
    fireEvent.change(screen.getByLabelText('Lesson type'), { target: { value: 'download' } });

    // The first link box belongs to the existing lesson's card; the last to the new lesson's form.
    const url = 'https://drive.google.com/file/d/1AbC/view?usp=sharing';
    fireEvent.change(screen.getAllByLabelText(/^Document link/).at(-1)!, {
      target: { value: url },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add link' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Save lesson' }));

    await waitFor(() =>
      expect(call('/admin/courses/12/lessons/9/links', 'POST')).toBeGreaterThan(-1),
    );

    const created = request.mock.calls[call('/admin/courses/12/lessons', 'POST')][1].body;
    expect(created).toMatchObject({
      title: 'Septic Tank Notes',
      slug: 'septic-tank-notes',
      type: 'download',
      video_url: null,
    });
    expect(request.mock.calls[call('/admin/courses/12/lessons/9/links', 'POST')][1].body).toEqual({
      url,
      title: null,
    });
    expect(call('/admin/courses/12/lessons', 'POST')).toBeLessThan(
      call('/admin/courses/12/lessons/9/links', 'POST'),
    );
  });

  it('attaches a Dropbox link to a lesson that already exists', async () => {
    render(<CourseEditor initial={course()} />);

    const url = 'https://www.dropbox.com/scl/fi/abc/Notes.pdf?rlkey=x&dl=0';
    // The lesson's link box stays closed until "+ Link" asks for it.
    fireEvent.click(screen.getByRole('button', { name: '+ Link' }));
    fireEvent.change(screen.getAllByLabelText(/^Document link/)[0], { target: { value: url } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add link' })[0]);

    await waitFor(() =>
      expect(call('/admin/courses/12/lessons/5/links', 'POST')).toBeGreaterThan(-1),
    );
    expect(request.mock.calls[call('/admin/courses/12/lessons/5/links', 'POST')][1].body).toEqual({
      url,
      title: null,
    });
  });

  it('lists a linked document with a link to where it lives', () => {
    render(
      <CourseEditor
        initial={course([
          lesson({
            assets: [
              {
                id: 3,
                title: 'Class notes',
                size_bytes: null,
                kind: 'link',
                link_url: 'https://www.dropbox.com/s/abc/Notes.pdf?dl=1',
              },
            ],
          }),
        ])}
      />,
    );

    expect(screen.getByRole('link', { name: 'Dropbox ↗' })).toHaveAttribute(
      'href',
      'https://www.dropbox.com/s/abc/Notes.pdf?dl=1',
    );
  });
});
