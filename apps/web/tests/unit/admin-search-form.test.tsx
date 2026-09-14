import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminSearchForm } from '@/features/admin/admin-search-form';

function setup(props: Partial<Parameters<typeof AdminSearchForm>[0]> = {}) {
  render(
    <AdminSearchForm
      id="post-search"
      basePath="/dashboard/posts"
      label="Search blog posts"
      placeholder="Post title or URL slug…"
      searchLabel="Search"
      locale="en"
      {...props}
    />,
  );
}

describe('AdminSearchForm', () => {
  it('is a plain search form for q, empty and without a result line before searching', () => {
    setup();

    const field = screen.getByRole('searchbox', { name: 'Search blog posts' });
    expect(field).toHaveAttribute('name', 'q');
    expect(field).toHaveValue('');
    expect(field.closest('form')).toHaveAttribute('method', 'get');
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Show all' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the search, how many matched, and a way back to the whole list that keeps the other filters', () => {
    setup({ value: 'septic', total: 2, keep: { status: 'draft', page: undefined } });

    expect(screen.getByRole('searchbox')).toHaveValue('septic');
    expect(screen.getByRole('status')).toHaveTextContent('“septic” — 2 results');

    const form = screen.getByRole('search');
    const hidden = form.querySelectorAll('input[type="hidden"]');
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toHaveAttribute('name', 'status');
    expect(hidden[0]).toHaveAttribute('value', 'draft');

    expect(screen.getByRole('link', { name: 'Show all' })).toHaveAttribute(
      'href',
      '/dashboard/posts?status=draft',
    );
  });

  it('speaks Bengali on a Bengali dashboard', () => {
    setup({ value: 'কোর্স', total: 12, locale: 'bn' });

    expect(screen.getByRole('status')).toHaveTextContent('“কোর্স” — ১২টি ফলাফল');
    expect(screen.getByRole('link', { name: 'সব দেখুন' })).toHaveAttribute(
      'href',
      '/dashboard/posts',
    );
  });
});
