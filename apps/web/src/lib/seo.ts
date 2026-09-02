import type { Metadata } from 'next';

import { absoluteUrl, publicEnv } from '@/lib/env';
import { brand } from '@/lib/site';

type SeoInput = {
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_image_url?: string | null;
  noindex?: boolean;
  nofollow?: boolean;
};

export type MetadataInput = {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
  seo?: SeoInput | null;
  type?: 'website' | 'article' | 'profile';
  publishedAt?: string | null;
  modifiedAt?: string | null;
  authorName?: string | null;
};

/**
 * Builds page metadata from CMS values, falling back to the page's own title
 * and description. SEO overrides always win, so an editor can correct a title
 * without a deploy.
 */
export function buildMetadata(input: MetadataInput): Metadata {
  const title = input.seo?.meta_title || input.title;
  const description = input.seo?.meta_description || input.description || brand.heroSupport;
  const canonical = input.seo?.canonical_url || absoluteUrl(input.path);
  const image = input.seo?.og_image_url || input.image || absoluteUrl('/opengraph-image');

  return {
    title,
    description,
    alternates: { canonical },
    robots: {
      index: !input.seo?.noindex,
      follow: !input.seo?.nofollow,
    },
    openGraph: {
      type: input.type === 'article' ? 'article' : 'website',
      title,
      description,
      url: canonical,
      siteName: brand.owner,
      locale: 'bn_BD',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      ...(input.type === 'article'
        ? {
            publishedTime: input.publishedAt ?? undefined,
            modifiedTime: input.modifiedAt ?? undefined,
            authors: input.authorName ? [input.authorName] : undefined,
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

/**
 * Metadata for anything that must never be indexed: cart, checkout, account,
 * the course player, internal search and payment results.
 */
export function privateMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    },
  };
}

/** Serialises JSON-LD for a <script type="application/ld+json"> tag. */
export function jsonLd(data: Record<string, unknown> | Record<string, unknown>[]): string {
  // Escapes `<` so a closing script tag inside any string cannot terminate the
  // block early. The payload comes from our own API, never from user input, but
  // this keeps the guarantee local and cheap.
  const ESCAPED_LT = String.fromCharCode(92) + 'u003c';

  return JSON.stringify(data).replace(/</g, ESCAPED_LT);
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function organizationSchema(settings: {
  name: string;
  support_email?: string | null;
  phone?: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.name,
    url: publicEnv.siteUrl,
    // Contact details only appear once the owner has configured them, so the
    // structured data can never claim something the page does not show.
    ...(settings.support_email || settings.phone
      ? {
          contactPoint: [
            {
              '@type': 'ContactPoint',
              contactType: 'customer support',
              ...(settings.support_email ? { email: settings.support_email } : {}),
              ...(settings.phone ? { telephone: settings.phone } : {}),
            },
          ],
        }
      : {}),
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand.owner,
    url: publicEnv.siteUrl,
    inLanguage: 'bn-BD',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${publicEnv.siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function personSchema(author: {
  name: string;
  credentials?: string | null;
  headline?: string | null;
  photo_url?: string | null;
  same_as?: string[];
  slug?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    ...(author.credentials ? { honorificSuffix: author.credentials } : {}),
    ...(author.headline ? { jobTitle: author.headline } : {}),
    ...(author.photo_url ? { image: author.photo_url } : {}),
    ...(author.same_as?.length ? { sameAs: author.same_as } : {}),
    url: absoluteUrl(author.slug ? `/authors/${author.slug}` : '/about'),
  };
}

export function articleSchema(post: {
  title: string;
  excerpt?: string | null;
  slug: string;
  cover_url?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  author?: { name?: string; credentials?: string | null } | null;
  reviewer?: { name?: string } | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    ...(post.cover_url ? { image: [post.cover_url] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    ...(post.updated_at ? { dateModified: post.updated_at } : {}),
    ...(post.author?.name
      ? { author: { '@type': 'Person', name: post.author.name } }
      : {}),
    ...(post.reviewer?.name
      ? { reviewedBy: { '@type': 'Person', name: post.reviewer.name } }
      : {}),
    publisher: { '@type': 'Organization', name: brand.owner, url: publicEnv.siteUrl },
    inLanguage: 'bn-BD',
  };
}

/**
 * Product schema is only emitted with an Offer when a real published price
 * exists. A product in a "contact for price" state gets no offer at all rather
 * than a zero price the page does not display.
 */
export function productSchema(product: {
  name: string;
  slug: string;
  tagline?: string | null;
  cover_url?: string | null;
  price?: { currency: string; amount_minor: number } | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.tagline ? { description: product.tagline } : {}),
    ...(product.cover_url ? { image: [product.cover_url] } : {}),
    brand: { '@type': 'Brand', name: 'NB Engineering Tools' },
    url: absoluteUrl(`/shop/${product.slug}`),
    ...(product.price
      ? {
          offers: {
            '@type': 'Offer',
            price: (product.price.amount_minor / 100).toFixed(2),
            priceCurrency: product.price.currency,
            availability: 'https://schema.org/InStock',
            url: absoluteUrl(`/shop/${product.slug}`),
          },
        }
      : {}),
  };
}

export function courseSchema(course: {
  title: string;
  slug: string;
  subtitle?: string | null;
  language?: string;
  cover_url?: string | null;
  rating?: { average: number; count: number } | null;
  instructors?: { name?: string | null }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    ...(course.subtitle ? { description: course.subtitle } : {}),
    url: absoluteUrl(`/courses/${course.slug}`),
    ...(course.cover_url ? { image: [course.cover_url] } : {}),
    inLanguage: course.language === 'Bangla' ? 'bn-BD' : course.language,
    provider: { '@type': 'Organization', name: brand.owner, url: publicEnv.siteUrl },
    ...(course.instructors?.length && course.instructors[0]?.name
      ? { author: { '@type': 'Person', name: course.instructors[0].name } }
      : {}),
    // Only emitted when real, published reviews exist.
    ...(course.rating && course.rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: course.rating.average,
            reviewCount: course.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export function itemListSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function profilePageSchema(author: Parameters<typeof personSchema>[0]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: { ...personSchema(author), '@context': undefined },
  };
}
