import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeoScore, ViewLink } from '@/features/admin/seo-score';
import { getDictionary } from '@/lib/i18n/dictionary';
import type { SeoInput } from '@/lib/seo-analysis/analyze';

const t = getDictionary('en');

const article: SeoInput = {
  kind: 'post',
  title: 'Punching shear in an isolated footing',
  slug: 'punching-shear-isolated-footing',
  metaTitle: 'Punching shear in an isolated footing',
  metaDescription:
    'How to check punching shear in an isolated footing, with the critical perimeter worked through step by step for a real column load.',
  focusKeyword: 'punching shear',
  excerpt: 'Punching shear, checked on a real footing.',
  content: `# Punching shear\n\n${'Punching shear around the column is checked on the critical perimeter. '.repeat(90)}`,
  featuredImage: { alt: 'punching shear diagram' },
};

describe('the SEO score in a list', () => {
  it('shows the number, linked to the analysis it comes from', () => {
    render(
      <SeoScore input={article} href="/dashboard/posts/9" t={t} locale="en" />,
    );

    const link = screen.getByRole('link', { name: /SEO analysis: \d+/ });
    expect(link).toHaveAttribute('href', '/dashboard/posts/9');
    expect(Number(link.textContent)).toBeGreaterThan(0);
  });

  it('says there is no score until a focus keyword is set', () => {
    render(
      <SeoScore input={{ ...article, focusKeyword: '' }} href="/dashboard/posts/9" t={t} locale="en" />,
    );

    expect(screen.getByRole('link', { name: 'No score' })).toBeInTheDocument();
  });
});

describe('the View link', () => {
  it('opens the live page in a tab of its own', () => {
    render(<ViewLink href="/blog/footing" label="View" draftLabel="Unpublished" />);

    const link = screen.getByRole('link', { name: /View/ });
    expect(link).toHaveAttribute('href', '/blog/footing');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('says so instead when there is no live page yet', () => {
    render(<ViewLink href={null} label="View" draftLabel="Unpublished" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Unpublished')).toBeInTheDocument();
  });
});
