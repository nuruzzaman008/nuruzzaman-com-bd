import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, type Post, type PostSummary } from '@nuruzzaman/contracts';

import { AuthorBio } from '@/features/content/author-bio';
import { PostCard } from '@/features/content/post-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Callout } from '@/components/ui/callout';
import { Container } from '@/components/ui/container';
import { CoverArt } from '@/components/ui/cover-art';
import { Prose } from '@/components/ui/prose';
import { TableOfContents } from '@/components/ui/table-of-contents';
import { publicApi, tryPublicApi } from '@/lib/api/server';
import { date, isoDate, minutes } from '@/lib/format';
import { articleSchema, buildMetadata, jsonLd } from '@/lib/seo';

async function loadPost(slug: string): Promise<Post> {
  try {
    const response = await publicApi<{ data: Post }>(`/posts/${encodeURIComponent(slug)}`, {
      tags: ['posts', `post:${slug}`],
    });

    return response.data;
  } catch (error) {
    // A draft or a deleted article is a 404 to the public, never a 500.
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await loadPost(slug);

  return buildMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.cover_url,
    seo: post.seo,
    type: 'article',
    publishedAt: post.published_at,
    modifiedAt: post.updated_at,
    authorName: post.author?.name,
  });
}

export default async function BlogPostPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const post = await loadPost(slug);

  const related = await tryPublicApi<{ data: PostSummary[] }>(
    `/posts/${encodeURIComponent(slug)}/related`,
    { tags: ['posts'] },
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            articleSchema({
              title: post.title,
              excerpt: post.excerpt,
              slug: post.slug,
              cover_url: post.cover_url,
              published_at: post.published_at,
              updated_at: post.updated_at,
              author: post.author,
              reviewer: post.reviewer,
            }),
          ),
        }}
      />

      <Container className="py-10 sm:py-14">
        <Breadcrumbs
          trail={[
            { name: 'হোম', path: '/' },
            { name: 'ব্লগ', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]}
        />

        <article className="mt-6">
          <header className="max-w-3xl">
            {post.categories?.length ? (
              <p className="text-sm font-semibold text-teal">
                <Link href={`/topics/${post.categories[0].slug}`} className="hover:underline">
                  {post.categories[0].name}
                </Link>
              </p>
            ) : null}

            <h1 className="mt-2 text-[length:var(--step-h1)] leading-tight font-bold text-navy">
              {post.title}
            </h1>

            {post.excerpt ? <p className="mt-4 text-lg text-muted">{post.excerpt}</p> : null}

            <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {post.author?.name ? (
                <span className="font-medium text-navy">{post.author.name}</span>
              ) : null}
              {post.published_at ? (
                <time dateTime={isoDate(post.published_at)}>প্রকাশ: {date(post.published_at)}</time>
              ) : null}
              {post.updated_at && post.updated_at !== post.published_at ? (
                <time dateTime={isoDate(post.updated_at)}>হালনাগাদ: {date(post.updated_at)}</time>
              ) : null}
              {post.reading_minutes ? <span>{minutes(post.reading_minutes)} পড়া</span> : null}
            </p>

            {post.reviewer?.name ? (
              <p className="mt-2 text-sm text-success">
                টেকনিক্যাল রিভিউ: {post.reviewer.name}
                {post.reviewer.credentials ? ` ${post.reviewer.credentials}` : ''}
              </p>
            ) : (
              // Said plainly rather than left blank: a reader cannot tell an
              // unreviewed article from a reviewed one by looking at it.
              <p className="mt-2 text-sm font-medium text-warning">
                টেকনিক্যাল রিভিউ এখনো বাকি — হিসাব নিজে যাচাই করে ব্যবহার করুন।
              </p>
            )}
          </header>

          {post.cover_url ? (
            <Image
              src={post.cover_url}
              alt={post.cover_alt ?? ''}
              width={1200}
              height={630}
              sizes="(min-width: 1024px) 900px, 100vw"
              priority
              className="mt-8 aspect-[1200/630] w-full rounded-[--radius-card] border border-line object-cover"
            />
          ) : (
            <CoverArt
              topic={post.categories?.[0]?.slug}
              label={post.categories?.[0]?.name}
              className="mt-8 rounded-[--radius-card] border border-line"
            />
          )}

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div>
              <Prose html={post.body_html} />

              {post.tags?.length ? (
                <ul className="mt-10 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <li key={tag.slug}>
                      <span className="inline-flex rounded-full border border-line bg-white px-3 py-1 text-xs text-muted">
                        {tag.name}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <Callout tone="warning" className="mt-8">
                এই লেখাটি শিক্ষামূলক। কোনো নির্দিষ্ট প্রকল্পে প্রয়োগের আগে সেই প্রকল্পের
                জিওটেকনিক্যাল রিপোর্ট, লোড এবং প্রযোজ্য কোড অনুযায়ী স্বাধীনভাবে যাচাই করুন।
                বিস্তারিত: <Link href="/engineering-disclaimer" className="underline">ইঞ্জিনিয়ারিং দাবিত্যাগ</Link>।
              </Callout>

              <div className="mt-8">
                <AuthorBio author={post.author} reviewer={post.reviewer} />
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <TableOfContents entries={post.toc ?? []} />
            </aside>
          </div>
        </article>

        {related && related.data.length > 0 ? (
          <section aria-labelledby="related-heading" className="mt-16">
            <h2 id="related-heading" className="text-[length:var(--step-h2)] font-bold text-navy">
              আরও পড়ুন
            </h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.data.map((item) => (
                <li key={item.slug} className="contents">
                  <PostCard post={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </>
  );
}
