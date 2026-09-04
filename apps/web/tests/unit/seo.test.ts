import { describe, expect, it } from 'vitest';

import {
  articleSchema,
  breadcrumbSchema,
  buildMetadata,
  courseSchema,
  jsonLd,
  privateMetadata,
  productSchema,
} from '@/lib/seo';

describe('buildMetadata', () => {
  it('uses the CMS SEO override when one is set', () => {
    const metadata = buildMetadata({
      title: 'Page title',
      description: 'Page description',
      path: '/blog/example',
      seo: { meta_title: 'Override title', meta_description: 'Override description' },
    });

    expect(metadata.title).toBe('Override title');
    expect(metadata.description).toBe('Override description');
  });

  it('falls back to the page title and marks the page indexable', () => {
    const metadata = buildMetadata({ title: 'Plain', path: '/about' });

    expect(metadata.title).toBe('Plain');
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toContain('/about');
  });

  it('honours a noindex flag from the CMS', () => {
    const metadata = buildMetadata({
      title: 'Hidden',
      path: '/hidden',
      seo: { noindex: true, nofollow: true },
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('privateMetadata', () => {
  it('keeps account and checkout pages out of the index', () => {
    const metadata = privateMetadata('Cart');

    expect(metadata.robots).toMatchObject({ index: false, follow: false, nocache: true });
  });
});

describe('structured data', () => {
  it('escapes a closing tag so JSON-LD cannot break out of its script', () => {
    expect(jsonLd({ name: '</script>' })).not.toContain('</script>');
  });

  it('numbers breadcrumb positions from one', () => {
    const schema = breadcrumbSchema([
      { name: 'হোম', path: '/' },
      { name: 'ব্লগ', path: '/blog' },
    ]);

    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[1].position).toBe(2);
  });

  it('omits the Offer entirely when no price is published', () => {
    const schema = productSchema({ name: 'Tools', slug: 'tools', price: null });

    // A product in a "contact for price" state must not advertise a price.
    expect(schema).not.toHaveProperty('offers');
  });

  it('includes an Offer that matches the published price', () => {
    const schema = productSchema({
      name: 'Tools',
      slug: 'tools',
      price: { currency: 'BDT', amount_minor: 500000 },
    });

    expect(schema.offers).toMatchObject({ price: '5000.00', priceCurrency: 'BDT' });
  });

  it('omits aggregateRating when a course has no published reviews', () => {
    const schema = courseSchema({ title: 'Course', slug: 'course', rating: null });

    expect(schema).not.toHaveProperty('aggregateRating');
  });

  it('includes aggregateRating only from real review counts', () => {
    const schema = courseSchema({
      title: 'Course',
      slug: 'course',
      rating: { average: 4.5, count: 8 },
    });

    expect(schema.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 8 });
  });

  it('records the reviewer on an article when one exists', () => {
    const schema = articleSchema({
      title: 'Footing',
      slug: 'footing',
      author: { name: 'Nuruzzaman' },
      reviewer: { name: 'Nuruzzaman' },
    });

    expect(schema.reviewedBy).toMatchObject({ name: 'Nuruzzaman' });
  });

  it('carries approved comments but never claims a star rating for an article', () => {
    const schema = articleSchema({
      title: 'Footing',
      slug: 'footing',
      comments: [
        { author_name: 'Rafiq', body: 'Useful.', rating: 5, created_at: '2026-01-01T00:00:00Z' },
        { author_name: 'Shirin', body: 'One question.', rating: null, created_at: null },
      ],
    });

    expect(schema.commentCount).toBe(2);
    expect(schema.comment?.[0]).toMatchObject({ '@type': 'Comment', text: 'Useful.' });
    // Google does not support review snippets on an Article, so a rating in
    // the markup could never be shown honestly and is not emitted.
    expect(schema).not.toHaveProperty('aggregateRating');
  });

  it('omits the comment fields entirely when there are none', () => {
    const schema = articleSchema({ title: 'Footing', slug: 'footing' });

    expect(schema).not.toHaveProperty('commentCount');
    expect(schema).not.toHaveProperty('comment');
  });

  it('declares the language the page is actually written in', () => {
    expect(articleSchema({ title: 'Footing', slug: 'footing' }).inLanguage).toBe('bn-BD');
    expect(
      articleSchema({ title: 'Footing', slug: 'footing', locale: 'en' }).inLanguage,
    ).toBe('en');
  });
});
