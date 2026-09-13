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
  cover_alt: 'The NB Tools ribbon in AutoCAD',
  is_price_public: true,
};

function mediaPatch() {
  return request.mock.calls.find(([path]) => String(path).startsWith('/admin/media/'));
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: {} });
});

describe('ProductEditor', () => {
  it('edits the Markdown source, never the rendered HTML', () => {
    render(<ProductEditor initial={product} />);

    const body = screen.getByLabelText(/Description/) as HTMLTextAreaElement;

    // Loading description_html here would save the rendering back over its own
    // source, and the next edit would render the rendering.
    expect(body.value).toBe('## A heading\n\nSome prose.');
    expect(body.value).not.toContain('<h2');
  });

  it('shows the stored Bengali copy rather than a translated reading', () => {
    render(<ProductEditor initial={product} />);

    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('অটোক্যাড টুলস');
    expect((screen.getByLabelText(/Tagline/) as HTMLInputElement).value).toBe('বাংলা ট্যাগলাইন');
  });

  it('sends every edited field to the product endpoint', async () => {
    render(<ProductEditor initial={product} />);

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'New name' } });
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

  it('no longer offers a media-library dropdown', () => {
    render(<ProductEditor initial={product} />);

    expect(screen.queryByText(/media library/i)).not.toBeInTheDocument();
    // The only select left in the form is the product type.
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('shows the current featured image with its upload control', () => {
    render(<ProductEditor initial={product} />);

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/cover.webp');
    expect(screen.getByRole('button', { name: 'Upload from computer' })).toBeInTheDocument();
  });

  it('removes the featured image', async () => {
    render(<ProductEditor initial={product} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();

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

  it('writes a changed description to the image itself', async () => {
    render(<ProductEditor initial={product} />);

    fireEvent.change(screen.getByLabelText(/Image description/), {
      target: { value: 'NB Tools ribbon with the footing design panel open' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/4', {
        method: 'PATCH',
        body: { alt_text: 'NB Tools ribbon with the footing design panel open' },
      }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/products/12', expect.anything()),
    );
  });

  it('leaves the image alone when its description was not touched', async () => {
    render(<ProductEditor initial={product} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(mediaPatch()).toBeUndefined();
  });

  it('flags an undescribed image and fills it from the field on save', async () => {
    render(<ProductEditor initial={{ ...product, cover_alt: null }} />);

    expect(screen.getByText(/no alt text/i)).toBeInTheDocument();
    // The field offers the product's name, so saving is enough to fix it.
    expect((screen.getByLabelText(/Image description/) as HTMLInputElement).value).toBe(
      'অটোক্যাড টুলস',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/4', {
        method: 'PATCH',
        body: { alt_text: 'অটোক্যাড টুলস' },
      }),
    );
    await waitFor(() => expect(screen.queryByText(/no alt text/i)).not.toBeInTheDocument());
  });

  it('puts a rejected field next to its input rather than in a banner', async () => {
    render(<ProductEditor initial={product} />);

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

    request.mockRejectedValueOnce(new Error('Could not reach the API.'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the API.');
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument();
  });
});
