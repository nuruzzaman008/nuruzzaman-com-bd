import type { Metadata } from 'next';
import Link from 'next/link';
import type { SearchResults } from '@nuruzzaman/contracts';

import { Container } from '@/components/ui/container';
import { EmptyState } from '@/components/ui/states';
import { tryPublicApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

// Internal search results are never indexed: they are thin, query-shaped
// duplicates of content that is already indexed on its own page.
export const metadata: Metadata = privateMetadata(
  'সার্চ',
  'সাইটের প্রকাশিত কনটেন্টের মধ্যে খুঁজুন।',
);

const GROUPS: { key: keyof Omit<SearchResults, 'query'>; label: string; base: string }[] = [
  { key: 'posts', label: 'আর্টিকেল', base: '/blog' },
  { key: 'courses', label: 'কোর্স', base: '/courses' },
  { key: 'products', label: 'প্রোডাক্ট', base: '/shop' },
];

export default async function SearchPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await props.searchParams;
  const term = (q ?? '').trim();

  const results =
    term.length >= 2
      ? await tryPublicApi<{ data: SearchResults }>('/search', {
          query: { q: term },
          revalidate: 60,
        })
      : null;

  const total = results
    ? GROUPS.reduce((sum, group) => sum + (results.data[group.key]?.length ?? 0), 0)
    : 0;

  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">সার্চ</h1>

      <form method="get" action="/search" role="search" className="mt-6">
        <label htmlFor="search-input" className="block text-sm font-semibold text-navy">
          কী খুঁজছেন?
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="search-input"
            type="search"
            name="q"
            defaultValue={term}
            minLength={2}
            maxLength={120}
            required
            placeholder="যেমন: ফুটিং, ল্যাপ লেংথ, লেয়ার স্ট্যান্ডার্ড"
            className="block min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-blue"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-lg bg-blue px-5 text-sm font-semibold text-white hover:bg-navy"
          >
            খুঁজুন
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-8">
        {term.length < 2 ? (
          <p className="text-sm text-muted">অন্তত দুইটি অক্ষর লিখে খুঁজুন।</p>
        ) : total === 0 ? (
          <EmptyState
            title={`"${term}" — কিছু পাওয়া যায়নি`}
            description="অন্য শব্দ দিয়ে চেষ্টা করুন, অথবা ব্লগের বিষয়ভিত্তিক তালিকা দেখুন।"
          />
        ) : (
          <div className="space-y-10">
            {GROUPS.map((group) => {
              const items = results?.data[group.key] ?? [];

              if (items.length === 0) {
                return null;
              }

              return (
                <section key={group.key} aria-labelledby={`search-${group.key}`}>
                  <h2 id={`search-${group.key}`} className="font-semibold text-navy">
                    {group.label}
                  </h2>
                  <ul className="mt-3 divide-y divide-line rounded-[--radius-card] border border-line bg-white">
                    {items.map((item) => (
                      <li key={item.slug} className="p-4">
                        <Link
                          href={`${group.base}/${item.slug}`}
                          className="font-semibold text-navy hover:text-blue hover:underline"
                        >
                          {item.title}
                        </Link>
                        {item.excerpt ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted">{item.excerpt}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Container>
  );
}
