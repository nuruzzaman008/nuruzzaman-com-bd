import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ListFilters, StatusLinks, listHref } from '@/features/admin/list-filters';

const push = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

beforeEach(() => {
  push.mockReset();
});

describe('keeping filters in the address', () => {
  it('changes one and keeps the rest, and starts again at the first page', () => {
    expect(
      listHref(
        '/dashboard/posts',
        { q: 'footing', category: 'rcc', page: '3' },
        { status: 'draft' },
      ),
    ).toBe('/dashboard/posts?q=footing&category=rcc&status=draft');

    // Choosing "All" clears that one filter rather than adding an empty one.
    expect(listHref('/dashboard/posts', { status: 'draft' }, { status: undefined })).toBe(
      '/dashboard/posts',
    );
  });
});

describe('the status links', () => {
  it('counts each status and marks the one being shown', () => {
    render(
      <StatusLinks
        basePath="/dashboard/posts"
        current={{ status: 'draft', q: 'footing' }}
        counts={{ all: 20, draft: 3, in_review: 1, scheduled: 0, published: 14, archived: 2 }}
      />,
    );

    const all = screen.getByRole('link', { name: /All/ });
    expect(all).toHaveTextContent('(20)');
    // The search is kept when the status changes.
    expect(all).toHaveAttribute('href', '/dashboard/posts?q=footing');

    const draft = screen.getByRole('link', { name: /Draft/ });
    expect(draft).toHaveTextContent('(3)');
    expect(draft).toHaveAttribute('aria-current', 'page');

    expect(screen.getByRole('link', { name: /Scheduled/ })).toHaveTextContent('(0)');
    expect(screen.getByRole('link', { name: /Published/ })).toHaveAttribute(
      'href',
      '/dashboard/posts?status=published&q=footing',
    );
  });
});

describe('the filter dropdowns', () => {
  const categories = [
    { value: 'rcc-design-detailing', label: 'RCC design' },
    { value: 'foundation', label: 'Foundation' },
  ];

  it('filters by month and category together', () => {
    render(
      <ListFilters
        basePath="/dashboard/posts"
        current={{ status: 'published' }}
        months={['2026-09', '2026-08']}
        selects={[
          {
            name: 'category',
            label: 'Category',
            anyLabel: 'All categories',
            options: categories,
          },
        ]}
      />,
    );

    expect(within(screen.getByLabelText('Date')).getByText('September 2026')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'foundation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(push).toHaveBeenCalledWith(
      '/dashboard/posts?status=published&month=2026-08&category=foundation',
    );
  });

  it('offers a way back out, and hides itself when there is nothing to filter by', () => {
    const { rerender } = render(
      <ListFilters basePath="/dashboard/posts" current={{ month: '2026-09' }} months={['2026-09']} />,
    );

    // Clearing keeps the search and the status, which are their own controls.
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/dashboard/posts',
    );

    rerender(<ListFilters basePath="/dashboard/posts" current={{}} months={[]} />);
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
  });
});
