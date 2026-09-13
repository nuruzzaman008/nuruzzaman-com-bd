import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductEditor, type EditableProduct } from '@/features/dashboard/product-editor';

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
    },
);

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});
// The resizing itself is covered in prepare-upload.test.ts; here it only has to
// say what it would send.
vi.mock('@/lib/media/prepare-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/prepare-upload')>()),
  prepareImageForUpload: prepare,
}));

const product: EditableProduct = {
  id: 12,
  slug: 'autocad-tools',
  type: 'software_license',
  name: 'AutoCAD Tools',
  name_raw: 'অটোক্যাড টুলস',
  description_markdown: 'Some prose.',
  cover_media_id: null,
  cover_url: null,
  is_price_public: true,
};

const uploaded = {
  id: 42,
  url: 'https://api.example.test/storage/uploads/2026/09/cover.webp',
  original_name: 'cover.webp',
  alt_text: 'অটোক্যাড টুলস',
};

function route({
  denied = false,
  uploadError,
}: { denied?: boolean; uploadError?: Error } = {}) {
  request.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === '/admin/media' && !options?.method) {
      return denied ? Promise.reject(new FakeApiError(403, 'Forbidden.')) : Promise.resolve({ data: [] });
    }

    if (path === '/admin/media' && options?.method === 'POST') {
      return uploadError ? Promise.reject(uploadError) : Promise.resolve({ data: uploaded });
    }

    return Promise.resolve({ data: {} });
  });
}

function uploadCall() {
  return request.mock.calls.find(
    ([path, options]) => path === '/admin/media' && options?.method === 'POST',
  );
}

async function choose(file: File) {
  // Waits for the library to load, which is when the control appears.
  const input = await screen.findByLabelText('Upload from computer');
  // Inside act, so the state set once the file has been prepared lands within
  // it - not in the gap before the next query starts waiting, which is where
  // an early refusal would otherwise put it.
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

beforeEach(() => {
  request.mockReset();
  prepare.mockReset();
  route();
});

describe('ProductEditor upload from computer', () => {
  it('uploads the chosen image with its description and selects it', async () => {
    const photo = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
    prepare.mockResolvedValue({ ok: true, file: photo, resized: false });

    render(<ProductEditor initial={product} />);
    await choose(photo);

    await waitFor(() => expect(uploadCall()).toBeDefined());
    const body = uploadCall()![1].body as FormData;

    expect((body.get('file') as File).name).toBe('cover.jpg');
    // An upload is never anonymous: the product's name stands in until the
    // admin describes the image better.
    expect(body.get('alt_text')).toBe('অটোক্যাড টুলস');

    expect(await screen.findByText(/Image uploaded and selected/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', uploaded.url);
  });

  it('saves the uploaded image as the featured image', async () => {
    const photo = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
    prepare.mockResolvedValue({ ok: true, file: photo, resized: false });

    render(<ProductEditor initial={product} />);
    await choose(photo);
    await screen.findByText(/Image uploaded and selected/);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/products/12',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({ cover_media_id: 42 }),
        }),
      ),
    );
  });

  it('sends the resized copy, not the original', async () => {
    const original = new File(['a large original'], 'IMG_2041.JPG', { type: 'image/jpeg' });
    const smaller = new File(['small'], 'IMG_2041.webp', { type: 'image/webp' });
    prepare.mockResolvedValue({ ok: true, file: smaller, resized: true });

    render(<ProductEditor initial={product} />);
    await choose(original);

    await waitFor(() => expect(uploadCall()).toBeDefined());
    expect(prepare).toHaveBeenCalledWith(original);
    expect((uploadCall()![1].body as FormData).get('file')).toMatchObject({ name: 'IMG_2041.webp' });
  });

  it('uses the description the admin wrote, and sends none when it is cleared', async () => {
    const photo = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
    prepare.mockResolvedValue({ ok: true, file: photo, resized: false });

    render(<ProductEditor initial={product} />);
    const alt = await screen.findByLabelText(/Image description/);

    fireEvent.change(alt, { target: { value: 'NB Tools ribbon inside AutoCAD 2026' } });
    await choose(photo);
    await waitFor(() => expect(uploadCall()).toBeDefined());
    expect((uploadCall()![1].body as FormData).get('alt_text')).toBe(
      'NB Tools ribbon inside AutoCAD 2026',
    );

    request.mockClear();
    fireEvent.change(alt, { target: { value: '   ' } });
    await choose(photo);
    await waitFor(() => expect(uploadCall()).toBeDefined());
    expect((uploadCall()![1].body as FormData).has('alt_text')).toBe(false);
  });

  it('turns away an unsupported file without calling the API', async () => {
    prepare.mockResolvedValue({ ok: false, reason: 'type' });

    render(<ProductEditor initial={product} />);
    await choose(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only JPG, PNG or WebP');
    expect(uploadCall()).toBeUndefined();
    // And the control is usable again for the next attempt.
    expect(await screen.findByRole('button', { name: 'Upload from computer' })).toBeEnabled();
  });

  it('explains an image that is still too large after resizing', async () => {
    prepare.mockResolvedValue({ ok: false, reason: 'too-large' });

    render(<ProductEditor initial={product} />);
    await choose(new File(['x'], 'poster.png', { type: 'image/png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('over 2 MB');
    expect(uploadCall()).toBeUndefined();
    expect(await screen.findByRole('button', { name: 'Upload from computer' })).toBeEnabled();
  });

  it('shows the server’s reason and selects nothing when the upload is refused', async () => {
    const photo = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
    prepare.mockResolvedValue({ ok: true, file: photo, resized: false });
    route({
      uploadError: new FakeApiError(422, 'The given data was invalid.', {
        file: ['The file failed to upload.'],
      }),
    });

    render(<ProductEditor initial={product} />);
    await choose(photo);

    expect(await screen.findByRole('alert')).toHaveTextContent('The file failed to upload.');
    expect(screen.queryByText(/Image uploaded and selected/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/products/12',
        expect.objectContaining({ body: expect.objectContaining({ cover_media_id: null }) }),
      ),
    );
  });

  it('does not offer uploading to someone the API would refuse', async () => {
    route({ denied: true });

    render(<ProductEditor initial={product} />);

    expect(await screen.findByText(/media.manage/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload from computer' })).not.toBeInTheDocument();
  });
});
