import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CourseEditor, type Curriculum } from '@/features/admin/course-editor';

const request = vi.hoisted(() => vi.fn());
const prepare = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});
vi.mock('@/features/admin/lesson-assessments', () => ({ LessonAssessments: () => null }));
vi.mock('@/lib/media/prepare-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/prepare-upload')>()),
  prepareImageForUpload: prepare,
}));

function courseWith(overrides: Partial<Curriculum> = {}): Curriculum {
  return {
    id: 3,
    title: 'RCC footing design',
    slug: 'rcc-footing-design-detailing-bangla',
    status: 'published',
    sequential: true,
    issues_certificate: false,
    description_markdown: '## Footings\n\nSome prose.',
    subtitle: 'Isolated footings, step by step',
    track: 'foundation-geotechnical',
    cover_media_id: null,
    cover_url: null,
    cover_alt: null,
    price_minor: 150000,
    seo: null,
    sections: [],
    ...overrides,
  };
}

const uploaded = {
  id: 42,
  url: 'https://api.example.test/storage/uploads/2026/09/footing.webp',
  alt_text: 'RCC footing design',
};

function coursePatch() {
  return request.mock.calls.find(
    ([path, options]) => path === '/admin/courses/3' && options?.method === 'PATCH',
  );
}

async function choose(file: File) {
  const input = screen.getByLabelText('Upload from computer');
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

beforeEach(() => {
  request.mockReset();
  prepare.mockReset();
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === '/admin/media' && options?.method === 'POST') {
      return Promise.resolve({ data: uploaded });
    }
    if (path === '/admin/courses/3/curriculum') {
      return Promise.resolve({ data: courseWith() });
    }
    return Promise.resolve({ data: { id: 3 } });
  });
});

describe('CourseEditor, laid out like the product editor', () => {
  it('puts the featured image first, above the course details', () => {
    render(<CourseEditor initial={courseWith()} />);

    const image = screen.getByRole('heading', { name: 'Featured image' });
    const details = screen.getByRole('heading', { name: 'Course details' });

    expect(image.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('previews the generated cover the course cards show while nothing is uploaded', () => {
    render(<CourseEditor initial={courseWith()} />);

    expect(screen.getByText(/Generated cover/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the live SEO analysis beside the form, counting the missing image', async () => {
    render(<CourseEditor initial={courseWith()} />);

    expect(screen.getByRole('region', { name: 'SEO analysis' })).toBeInTheDocument();
    // A course page shows no image in that place, so this is a failure, not
    // the article's softer "generated art" warning.
    expect(await screen.findByText('No featured image is set.')).toBeInTheDocument();
  });

  it('loads the subtitle and saves it back', async () => {
    render(<CourseEditor initial={courseWith()} />);

    expect(screen.getByLabelText(/Subtitle/)).toHaveValue('Isolated footings, step by step');

    fireEvent.change(screen.getByLabelText(/Subtitle/), { target: { value: 'Footings made simple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save course' }));

    await waitFor(() => expect(coursePatch()).toBeDefined());
    expect(coursePatch()![1].body.subtitle).toBe('Footings made simple');
  });

  it('keeps the image when only the words are saved', async () => {
    render(
      <CourseEditor
        initial={courseWith({
          cover_media_id: 7,
          cover_url: 'https://example.test/existing.webp',
          cover_alt: 'Existing cover',
        })}
      />,
    );

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/existing.webp');

    fireEvent.click(screen.getByRole('button', { name: 'Save course' }));

    await waitFor(() => expect(coursePatch()).toBeDefined());
    expect('cover_media_id' in coursePatch()![1].body).toBe(false);
  });

  it('uploads an image and saves it as the featured image', async () => {
    const file = new File(['x'], 'footing.jpg', { type: 'image/jpeg' });
    prepare.mockResolvedValue({ ok: true, file, resized: false });

    render(<CourseEditor initial={courseWith()} />);
    await choose(file);

    expect(await screen.findByText(/Image uploaded and selected/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', uploaded.url);

    fireEvent.click(screen.getByRole('button', { name: 'Save course' }));

    await waitFor(() => expect(coursePatch()).toBeDefined());
    expect(coursePatch()![1].body.cover_media_id).toBe(42);
  });
});
