import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PostEditor, type EditablePost } from '@/features/dashboard/post-editor';

const request = vi.hoisted(() => vi.fn());
const prepare = vi.hoisted(() => vi.fn());

/** A stand-in for the real ApiError, hoisted so vi.mock can reach it. */
const FakeApiError = vi.hoisted(
  () =>
    class extends Error {
      constructor(
        readonly status: number,
        message: string,
        readonly fields: Record<string, string[]> = {},
      ) {
        super(message);
      }

      get isValidation() {
        return this.status === 422;
      }
    },
);

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});
vi.mock('@/lib/media/prepare-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/prepare-upload')>()),
  prepareImageForUpload: prepare,
}));

/** Only what the editor reads; the full Post contract is much larger. */
function postWith(overrides: Partial<EditablePost> = {}): EditablePost {
  return {
    id: 19,
    slug: 'steel-connection-bolt-shear-bangla',
    title: 'Steel connection bolt shear',
    excerpt: 'How a bolted connection carries shear.',
    body_markdown: '## Bolt shear\n\nSome prose.',
    status: 'draft',
    reviewed_at: null,
    funnel_stage: null,
    categories: [{ slug: 'steel-design', name: 'Steel design' }],
    seo: null,
    cover_media_id: null,
    cover_url: null,
    cover_alt: null,
    ...overrides,
  } as unknown as EditablePost;
}

const uploaded = {
  id: 42,
  url: 'https://api.example.test/storage/uploads/2026/09/bolt.webp',
  alt_text: 'Steel connection bolt shear',
};

function postPatch() {
  return request.mock.calls.find(
    ([path, options]) => path === '/admin/posts/19' && options?.method === 'PATCH',
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
  request.mockImplementation((path: string, options?: { method?: string }) =>
    path === '/admin/media' && options?.method === 'POST'
      ? Promise.resolve({ data: uploaded })
      : Promise.resolve({ data: {} }),
  );
});

describe('PostEditor featured image', () => {
  it('puts the featured image first, above the title', () => {
    render(<PostEditor post={postWith()} />);

    const image = screen.getByRole('heading', { name: 'Featured image' });
    const title = screen.getByLabelText(/^Title/);

    expect(image.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('previews the generated cover the site already shows, while nothing is uploaded', () => {
    render(<PostEditor post={postWith()} />);

    expect(screen.getByText(/Generated cover/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Nothing to remove: the generated cover is not an upload.
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();
  });

  it('keeps an uploaded image when only the words are saved', async () => {
    render(
      <PostEditor
        post={postWith({
          cover_media_id: 7,
          cover_url: 'https://example.test/existing.webp',
          cover_alt: 'Existing cover',
        })}
      />,
    );

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/existing.webp');

    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'A new title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(postPatch()).toBeDefined());
    const body = postPatch()![1].body;

    expect(body.title).toBe('A new title');
    // Not sent at all, so the API leaves the image as it is.
    expect('cover_media_id' in body).toBe(false);
  });

  it('keeps the generated cover when a post without an upload is saved', async () => {
    render(<PostEditor post={postWith()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(postPatch()).toBeDefined());
    expect('cover_media_id' in postPatch()![1].body).toBe(false);
  });

  it('uploads an image and saves it as the featured image', async () => {
    const file = new File(['x'], 'bolt.jpg', { type: 'image/jpeg' });
    prepare.mockResolvedValue({ ok: true, file, resized: false });

    render(<PostEditor post={postWith()} />);
    await choose(file);

    expect(await screen.findByText(/Image uploaded and selected/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', uploaded.url);
    expect(screen.queryByText(/Generated cover/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(postPatch()).toBeDefined());
    expect(postPatch()![1].body.cover_media_id).toBe(42);
  });

  it('removing an upload brings the generated cover back and clears it on save', async () => {
    render(
      <PostEditor
        post={postWith({
          cover_media_id: 7,
          cover_url: 'https://example.test/existing.webp',
          cover_alt: 'Existing cover',
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));

    expect(screen.getByText(/Generated cover/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(postPatch()).toBeDefined());
    // null, not left out: this time the change is the point.
    expect(postPatch()![1].body.cover_media_id).toBeNull();
  });

  it('tells the SEO analysis about the image', async () => {
    render(<PostEditor post={postWith()} />);

    expect(await screen.findByText(/generated cover art/)).toBeInTheDocument();
  });
});

describe('PostEditor publishing', () => {
  it('saves a draft and publishes it from one Publish button', async () => {
    render(<PostEditor post={postWith()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/posts/19/transition', {
        method: 'POST',
        body: { status: 'published' },
      }),
    );

    const order = request.mock.calls.map(
      ([path, options]) => `${options?.method ?? 'GET'} ${path}`,
    );
    // The words are saved first, so what goes live is what was typed.
    expect(order.indexOf('PATCH /admin/posts/19')).toBeLessThan(
      order.indexOf('POST /admin/posts/19/transition'),
    );
    expect(await screen.findByText('Published.')).toBeInTheDocument();
  });

  it('offers Update and a link to the live article once published, not Publish', async () => {
    render(<PostEditor post={postWith({ status: 'published' })} />);

    expect(screen.getAllByRole('button', { name: 'Update' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View post' })).toHaveAttribute(
      'href',
      '/blog/steel-connection-bolt-shear-bangla',
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Update' })[0]);

    await waitFor(() => expect(postPatch()).toBeDefined());
    expect(request.mock.calls.some(([path]) => String(path).endsWith('/transition'))).toBe(false);
    expect(
      await screen.findByText(/Updated — the site shows it within a minute/),
    ).toBeInTheDocument();
  });
});
