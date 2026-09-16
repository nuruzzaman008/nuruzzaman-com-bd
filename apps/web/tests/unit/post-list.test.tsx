import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostList, type PostRow } from '@/features/dashboard/post-list';

const request = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const confirm = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const row = (id: number, overrides: Partial<PostRow> = {}): PostRow => ({
  id,
  slug: `article-${id}`,
  title: `Article ${id}`,
  statusLabel: 'Published',
  statusTone: 'success',
  note: '11 September 2026',
  seoScore: 72,
  live: true,
  ...overrides,
});

const rows = [
  row(1),
  row(2, { statusLabel: 'Draft', statusTone: 'neutral', live: false, seoScore: null }),
  row(3, { seoScore: 41 }),
];

beforeEach(() => {
  request.mockReset();
  refresh.mockReset();
  confirm.mockReset();
  vi.stubGlobal('confirm', confirm);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the articles list', () => {
  it('shows the score, the live page and no checkboxes until asked', () => {
    render(<PostList rows={rows} emptyTitle="No articles yet" />);

    expect(screen.getByRole('link', { name: 'SEO analysis: 72' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Article 1/ })).toHaveAttribute(
      'href',
      '/dashboard/posts/1',
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('deletes the chosen articles, once, after saying how many are live', async () => {
    request.mockResolvedValue({ message: 'Post moved to trash.' });
    confirm.mockReturnValue(true);
    render(<PostList rows={rows} emptyTitle="No articles yet" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 2' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 selected');

    fireEvent.change(screen.getByLabelText('Bulk actions'), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Delete 2 articles?'));
    // One of the two is published, and that is a different decision.
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 of them are live'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('cannot be brought back'));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenCalledWith('/admin/posts/1', { method: 'DELETE' });
    expect(request).toHaveBeenCalledWith('/admin/posts/2', { method: 'DELETE' });
    expect(refresh).toHaveBeenCalled();
    // Selecting ends with the deletion, so nothing stays half-ticked.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('moves the chosen articles to another status without asking twice', async () => {
    request.mockResolvedValue({ data: {} });
    render(<PostList rows={rows} emptyTitle="No articles yet" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 2' }));
    fireEvent.change(screen.getByLabelText('Bulk actions'), { target: { value: 'archived' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/posts/1/transition', {
        method: 'POST',
        body: { status: 'archived' },
      }),
    );
    expect(request).toHaveBeenCalledWith('/admin/posts/2/transition', {
      method: 'POST',
      body: { status: 'archived' },
    });
    // Changing a status is not deleting; it does not stop to ask.
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByText('2 changed.')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('says which ones the API would not move, and why', async () => {
    request
      .mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(
        new Error('This is published, so it cannot become in_review. From published it can go to: draft, archived.'),
      );
    render(<PostList rows={rows} emptyTitle="No articles yet" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 3' }));
    fireEvent.change(screen.getByLabelText('Bulk actions'), { target: { value: 'in_review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const problem = await screen.findByRole('alert');
    expect(problem).toHaveTextContent('Article 3');
    expect(problem).toHaveTextContent('From published it can go to: draft, archived.');
    // The one that worked still counts.
    expect(await screen.findByText('1 changed.')).toBeInTheDocument();
  });

  it('deletes nothing when the question is answered no', () => {
    confirm.mockReturnValue(false);
    render(<PostList rows={rows} emptyTitle="No articles yet" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 1' }));
    fireEvent.change(screen.getByLabelText('Bulk actions'), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(request).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('names the ones it could not delete', async () => {
    confirm.mockReturnValue(true);
    request
      .mockResolvedValueOnce({ message: 'Post moved to trash.' })
      .mockRejectedValueOnce(new Error('Not allowed.'));
    render(<PostList rows={rows} emptyTitle="No articles yet" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Article 3' }));
    fireEvent.change(screen.getByLabelText('Bulk actions'), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Article 3: Not allowed.');
    // The one that worked still counts, so the list is reloaded.
    expect(refresh).toHaveBeenCalled();
  });
});
