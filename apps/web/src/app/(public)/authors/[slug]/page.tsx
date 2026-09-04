import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Author, type PostSummary } from '@nuruzzaman/contracts';

import { AuthorBio } from '@/features/content/author-bio';
import { PostCard } from '@/features/content/post-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/container';
import { EmptyState } from '@/components/ui/states';
import { publicApi } from '@/lib/api/server';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { buildMetadata, jsonLd, profilePageSchema } from '@/lib/seo';

async function loadAuthor(slug: string): Promise<Author> {
  try {
    const response = await publicApi<{ data: Author }>(`/authors/${encodeURIComponent(slug)}`, {
      tags: ['authors'],
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const author = await loadAuthor(slug);

  return buildMetadata({
    title: author.name,
    description: author.headline,
    path: `/authors/${author.slug}`,
    type: 'profile',
  });
}

export default async function AuthorPage(
  props: LocalizedPageProps & { params: Promise<{ slug: string }> },
) {
  const { t } = pageDictionary(props.locale);
  const { slug } = await props.params;

  const [author, posts] = await Promise.all([
    loadAuthor(slug),
    publicApi<{ data: PostSummary[] }>('/posts', {
      query: { author: slug, per_page: 12 },
      tags: ['posts'],
    }),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            profilePageSchema({
              name: author.name,
              credentials: author.credentials,
              headline: author.headline,
              photo_url: author.photo_url,
              same_as: author.same_as,
              slug: author.slug,
            }),
          ),
        }}
      />

      <Container className="py-10 sm:py-14">
        <Breadcrumbs
          trail={[
            { name: t.common.home, path: '/' },
            { name: t.nav.blog, path: '/blog' },
            { name: author.name, path: `/authors/${author.slug}`, authored: true },
          ]}
        />

        <h1 className="mt-6 text-[length:var(--step-h1)] font-bold text-navy">{author.name}</h1>

        <div className="mt-6 max-w-2xl">
          <AuthorBio author={author} />
        </div>

        <h2 className="mt-12 text-[length:var(--step-h2)] font-bold text-navy">
          {t.post.authorWorks}
        </h2>

        {posts.data.length > 0 ? (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.data.map((post) => (
              <li key={post.slug} className="contents">
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-6" title={t.post.authorEmpty} />
        )}
      </Container>
    </>
  );
}
