import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeoEditor } from '@/features/dashboard/seo-editor';

const request = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const props = {
  kind: 'product' as const,
  endpoint: '/admin/products/7',
  recordId: 7,
  title: 'AutoCAD Tools',
  slug: 'autocad-tools',
  body: 'Some prose about the tools.',
  excerpt: 'A tagline.',
};

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: {} });
});

describe('SeoEditor indexing controls', () => {
  it('loads the stored canonical, noindex and nofollow', () => {
    render(
      <SeoEditor
        {...props}
        seo={{ canonical_url: 'https://example.org/original', noindex: true, nofollow: false }}
      />,
    );

    expect(screen.getByLabelText(/Canonical URL/)).toHaveValue('https://example.org/original');
    expect(screen.getByLabelText(/Keep out of search results/)).toBeChecked();
    expect(screen.getByLabelText(/Do not follow the links/)).not.toBeChecked();
  });

  it('sends all three alongside the text fields', async () => {
    render(<SeoEditor {...props} seo={null} />);

    fireEvent.change(screen.getByLabelText(/Focus keyword/), { target: { value: 'autocad tools' } });
    fireEvent.change(screen.getByLabelText(/Canonical URL/), {
      target: { value: 'https://example.org/original' },
    });
    fireEvent.click(screen.getByLabelText(/Keep out of search results/));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/products/7',
        expect.objectContaining({
          method: 'PATCH',
          body: {
            seo: expect.objectContaining({
              focus_keyword: 'autocad tools',
              canonical_url: 'https://example.org/original',
              noindex: true,
              nofollow: false,
            }),
          },
        }),
      ),
    );
  });

  it('sends an empty canonical as null rather than an empty string', async () => {
    // The API validates canonical_url with `url`, which an empty string fails;
    // a blank field has to clear the value, not be rejected.
    render(<SeoEditor {...props} seo={{ canonical_url: 'https://example.org/x' }} />);

    fireEvent.change(screen.getByLabelText(/Canonical URL/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/products/7',
        expect.objectContaining({
          body: { seo: expect.objectContaining({ canonical_url: null }) },
        }),
      ),
    );
  });

  it('turning noindex off sends false, not a missing key', async () => {
    render(<SeoEditor {...props} seo={{ noindex: true }} />);

    fireEvent.click(screen.getByLabelText(/Keep out of search results/));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/products/7',
        // An unchecked box submits nothing at all. Sending the key explicitly
        // is what lets a page be put back into the index.
        expect.objectContaining({ body: { seo: expect.objectContaining({ noindex: false }) } }),
      ),
    );
  });
});
