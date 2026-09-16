import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NewContentForm } from '@/features/dashboard/new-content-form';

const request = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

beforeEach(() => {
  request.mockReset();
  push.mockReset();
});

describe('New article', () => {
  it('makes the address from the title and opens the editor on the new draft', async () => {
    request.mockResolvedValue({ data: { id: 41 } });
    render(<NewContentForm kind="post" />);

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: 'Bolt connection: shear and bearing' },
    });
    expect(screen.getByLabelText(/Slug/)).toHaveValue('bolt-connection-shear-and-bearing');

    fireEvent.click(screen.getByRole('button', { name: 'Create and edit' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/posts', {
        method: 'POST',
        body: {
          title: 'Bolt connection: shear and bearing',
          slug: 'bolt-connection-shear-and-bearing',
          // Empty on purpose: the article is written in the editor.
          body_markdown: '',
        },
      }),
    );
    expect(push).toHaveBeenCalledWith('/dashboard/posts/41');
  });

  it('asks for an address when the title is Bengali, which makes none', async () => {
    render(<NewContentForm kind="post" />);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'বোল্ট কানেকশন' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create and edit' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Write an address in Latin letters');
    expect(request).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'bolt-connection' } });
    request.mockResolvedValue({ data: { id: 7 } });
    fireEvent.click(screen.getByRole('button', { name: 'Create and edit' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/posts/7'));
  });

  it('says why nothing was created when the API refuses', async () => {
    request.mockRejectedValue(new Error('That address is taken.'));
    render(<NewContentForm kind="post" />);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Footing notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create and edit' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That address is taken.');
    expect(push).not.toHaveBeenCalled();
  });
});

describe('New product', () => {
  it('also asks which kind of product it is', async () => {
    request.mockResolvedValue({ data: { id: 12 } });
    render(<NewContentForm kind="product" />);

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'NB Tools yearly' } });
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: 'bundle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create and edit' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/products', {
        method: 'POST',
        body: { name: 'NB Tools yearly', slug: 'nb-tools-yearly', type: 'bundle' },
      }),
    );
    expect(push).toHaveBeenCalledWith('/dashboard/products/12');
  });
});
