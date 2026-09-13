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

function course(overrides: Partial<Curriculum> = {}): Curriculum {
  return {
    id: 12,
    title: 'Basic bullet 01',
    slug: 'autocad-structural-drawing-productivity1',
    status: 'draft',
    sequential: true,
    issues_certificate: false,
    description_markdown: null,
    subtitle: null,
    track: null,
    cover_media_id: null,
    cover_url: null,
    cover_alt: null,
    price_minor: 100000,
    pricing: { type: 'paid', regular_minor: 100000, offer_minor: null, offer_ends_at: null },
    seo: null,
    sections: [
      {
        id: 1,
        title: 'IPA',
        position: 0,
        drip_days: null,
        lessons: [
          {
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
          },
        ],
      },
    ],
    ...overrides,
  };
}

const courseSlugField = () => screen.getAllByLabelText(/^URL slug/)[0] as HTMLInputElement;

function callIndex(path: string, method: string) {
  return request.mock.calls.findIndex(([p, options]) => p === path && options?.method === method);
}

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/admin/courses/12/curriculum'
        ? { data: course({ status: 'published', slug: 'basic-english-sound' }) }
        : { data: { id: 12 } },
    ),
  );
});

describe('CourseEditor slug and publishing', () => {
  it('turns whatever was typed into a URL slug when the field is left', () => {
    render(<CourseEditor initial={course()} />);

    fireEvent.change(courseSlugField(), { target: { value: 'Basic English Sound' } });
    fireEvent.blur(courseSlugField());

    expect(courseSlugField()).toHaveValue('basic-english-sound');
  });

  it('fills an empty slug from the title', () => {
    render(<CourseEditor initial={course()} />);

    fireEvent.change(courseSlugField(), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Course title'), {
      target: { value: 'Basic English Sound' },
    });
    fireEvent.blur(screen.getByLabelText('Course title'));

    expect(courseSlugField()).toHaveValue('basic-english-sound');
  });

  it('saves and publishes in one click, with the slug tidied even if the field was never left', async () => {
    render(<CourseEditor initial={course()} />);

    fireEvent.change(courseSlugField(), { target: { value: 'Basic English Sound' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }));

    await waitFor(() =>
      expect(callIndex('/admin/courses/12/transition', 'POST')).toBeGreaterThan(-1),
    );

    const save = request.mock.calls[callIndex('/admin/courses/12', 'PATCH')];
    expect(save[1].body.slug).toBe('basic-english-sound');
    expect(request.mock.calls[callIndex('/admin/courses/12/transition', 'POST')][1].body).toEqual({
      status: 'published',
    });
    // Saved first, so the course goes live with what was just typed.
    expect(callIndex('/admin/courses/12', 'PATCH')).toBeLessThan(
      callIndex('/admin/courses/12/transition', 'POST'),
    );

    expect(await screen.findByRole('link', { name: /view on the site/ })).toHaveAttribute(
      'href',
      '/courses/basic-english-sound',
    );
  });

  it('a plain save does not publish', async () => {
    render(<CourseEditor initial={course()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save course' }));

    await waitFor(() => expect(callIndex('/admin/courses/12', 'PATCH')).toBeGreaterThan(-1));
    await waitFor(() =>
      expect(callIndex('/admin/courses/12/curriculum', undefined as never)).toBeGreaterThan(-1),
    );
    expect(callIndex('/admin/courses/12/transition', 'POST')).toBe(-1);
  });

  it('offers no publish button for a course without lessons', () => {
    render(<CourseEditor initial={course({ sections: [] })} />);

    expect(screen.queryByRole('button', { name: 'Save and publish' })).not.toBeInTheDocument();
  });

  it('refuses a slug with no English letters before sending anything', async () => {
    render(<CourseEditor initial={course()} />);

    fireEvent.change(courseSlugField(), { target: { value: 'বাংলা' } });
    fireEvent.change(screen.getByLabelText('Course title'), { target: { value: 'বেসিক কোর্স' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save course' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/English letters/);
    expect(callIndex('/admin/courses/12', 'PATCH')).toBe(-1);
  });
});
