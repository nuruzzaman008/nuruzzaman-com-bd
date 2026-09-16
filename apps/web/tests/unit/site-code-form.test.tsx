import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Setting } from '@nuruzzaman/contracts';

import { SiteCodeForm } from '@/features/dashboard/site-code-form';

const request = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const saved: Setting[] = [
  {
    key: 'code.head',
    group: 'code',
    value: '<meta name="google-site-verification" content="abc" />',
    is_public: true,
  } as Setting,
];

beforeEach(() => {
  request.mockReset();
  refresh.mockReset();
  request.mockResolvedValue({ data: [] });
});

describe('Site code', () => {
  it('opens with what is already saved and writes all four boxes back', async () => {
    render(<SiteCodeForm settings={saved} />);

    expect(screen.getByLabelText(/Code in <head>/)).toHaveValue(
      '<meta name="google-site-verification" content="abc" />',
    );

    fireEvent.change(screen.getByLabelText('ads.txt'), {
      target: { value: 'google.com, pub-1, DIRECT, f08c47fec0942fa0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/settings', {
        method: 'PUT',
        body: {
          settings: [
            {
              key: 'code.head',
              group: 'code',
              value: '<meta name="google-site-verification" content="abc" />',
              is_public: true,
            },
            { key: 'code.body_start', group: 'code', value: '', is_public: true },
            { key: 'code.body_end', group: 'code', value: '', is_public: true },
            {
              key: 'code.ads_txt',
              group: 'code',
              value: 'google.com, pub-1, DIRECT, f08c47fec0942fa0',
              is_public: true,
            },
          ],
        },
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(refresh).toHaveBeenCalled();
  });

  it('warns that this code runs on every page, and says when saving failed', async () => {
    request.mockRejectedValueOnce(new Error('nope'));
    render(<SiteCodeForm settings={[]} />);

    expect(screen.getByText(/a broken snippet can break the page/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The code could not be saved.');
  });
});
