import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductEditor, type EditableProduct } from '@/features/dashboard/product-editor';

const request = vi.hoisted(() => vi.fn());

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
    },
);

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const product: EditableProduct = {
  id: 12,
  slug: 'autocad-tools',
  type: 'software_license',
  name: 'AutoCAD Tools',
  name_raw: 'অটোক্যাড টুলস',
  tagline: 'Rendered tagline',
  tagline_raw: 'বাংলা ট্যাগলাইন',
  description_markdown: '## A heading\n\nSome prose.',
  cover_media_id: 4,
  cover_url: 'https://example.test/cover.webp',
  is_price_public: true,
};

/** The admin media index answers with a paginator, not a nested envelope. */
function withMedia(list: unknown[] = []) {
  request.mockImplementation((path: string, options?: { method?: string }) =>
    options?.method ? Promise.resolve({ data: {} }) : Promise.resolve({ data: list }),
  );
}

beforeEach(() => {
  request.mockReset();
  withMedia();
});

describe('ProductEditor', () => {
  it('edits the Markdown source, never the rendered HTML', async () => {
    render(<ProductEditor initial={product} />);

    const body = (await screen.findByLabelText(/Description/)) as HTMLTextAreaElement;

    // Loading description_html here would save the rendering back over its own
    // source, and the next edit would render the rendering.
    expect(body.value).toBe('## A heading\n\nSome prose.');
    expect(body.value).not.toContain('<h2');
  });

  it('shows the stored Bengali copy rather than a translated reading', async () => {
    render(<ProductEditor initial={product} />);

    expect(((await screen.findByLabelText(/Name/)) as HTMLInputElement).value).toBe(
      'অটোক্যাড টুলস',
    );
    expect((screen.getByLabelText(/Tagline/) as HTMLInputElement).value).toBe('বাংলা ট্যাগলাইন');
  });

  it('sends every edited field to the product endpoint', async () => {
    render(<ProductEditor initial={product} />);

    fireEvent.change(await screen.findByLabelText(/Name/), { target: { value: 'New name' } });
    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'new-slug' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'New body' } });
    fireEvent.click(screen.getByLabelText(/Publish the price/));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/products/12',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({
            name: 'New name',
            slug: 'new-slug',
            description_markdown: 'New body',
            cover_media_id: 4,
            is_price_public: false,
          }),
        }),
      ),
    );

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
  });

  it('keeps the featured image unless it is changed', async () => {
    withMedia([
      { id: 4, url: 'https://example.test/cover.webp', original_name: 'cover.webp', alt_text: 'A cover' },
      { id: 9, url: 'https://example.test/other.webp', original_name: 'other.webp', alt_text: 'Another' },
    ]);

    render(<ProductEditor initial={product} />);

    fireEvent.change(await screen.findByLabelText(/Choose from the media library/), {
      target: { value: '9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/products/12',
        expect.objectContaining({ body: expect.objectContaining({ cover_media_id: 9 }) }),
      ),
    );
  });

  it('can clear the featured image', async () => {
    render(<ProductEditor initial={product} />);

    fireEvent.change(await screen.findByLabelText(/Choose from the media library/), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/products/12',
        // null, not undefined: JSON.stringify drops undefined, and the field
        // would silently keep the image the owner just removed.
        expect.objectContaining({ body: expect.objectContaining({ cover_media_id: null }) }),
      ),
    );
  });

  it('warns when the chosen image has no alt text', async () => {
    withMedia([
      { id: 4, url: 'https://example.test/cover.webp', original_name: 'cover.webp', alt_text: null },
    ]);

    render(<ProductEditor initial={product} />);

    expect(await screen.findByText(/no alt text/i)).toBeInTheDocument();
  });

  it('puts a rejected field next to its input rather than in a banner', async () => {
    render(<ProductEditor initial={product} />);
    await screen.findByLabelText(/Name/);

    request.mockRejectedValueOnce(
      new FakeApiError(422, 'The given data was invalid.', {
        slug: ['The slug has already been taken.'],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The slug has already been taken.');
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument();
  });

  it('does not claim success when the save fails outright', async () => {
    render(<ProductEditor initial={product} />);
    await screen.findByLabelText(/Name/);

    request.mockRejectedValueOnce(new Error('Could not reach the API.'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the API.');
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument();
  });

  it('still renders when the media library is out of reach', async () => {
    request.mockImplementation((path: string, options?: { method?: string }) =>
      options?.method ? Promise.resolve({ data: {} }) : Promise.reject(new FakeApiError(403, 'Forbidden.')),
    );

    render(<ProductEditor initial={product} />);

    expect(await screen.findByText(/media.manage/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not blame permissions for a library that is merely empty', async () => {
    withMedia([]);

    render(<ProductEditor initial={product} />);

    // Telling an admin they lack a permission they hold sends them looking for
    // a problem that is not there.
    expect(await screen.findByText(/library is empty/)).toBeInTheDocument();
    expect(screen.queryByText(/media.manage/)).not.toBeInTheDocument();
  });
});
