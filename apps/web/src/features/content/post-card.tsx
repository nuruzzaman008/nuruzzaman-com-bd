import Image from 'next/image';
import Link from 'next/link';
import type { PostSummary } from '@nuruzzaman/contracts';

import { Card } from '@/components/ui/card';
import { date, isoDate, minutes } from '@/lib/format';

export function PostCard({ post, priority = false }: { post: PostSummary; priority?: boolean }) {
  return (
    <Card
      as="article"
      className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-[--shadow-raised] focus-within:shadow-[--shadow-raised]"
    >
      {post.cover_url ? (
        <Image
          src={post.cover_url}
          alt={post.cover_alt ?? ''}
          width={800}
          height={450}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          // The first card in a list is often the LCP element, so it is never lazy.
          priority={priority}
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="aspect-[16/9] w-full bg-blue-soft"
        />
      )}

      <div className="flex flex-1 flex-col p-5">
        {post.categories?.length ? (
          <p className="text-xs font-semibold text-teal">{post.categories[0].name}</p>
        ) : null}

        <h3 className="mt-1.5 text-lg leading-snug font-bold text-navy">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 hover:text-blue">
            {post.title}
          </Link>
        </h3>

        {post.excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm text-muted">{post.excerpt}</p>
        ) : null}

        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {post.author?.name ? <span>{post.author.name}</span> : null}
          {post.published_at ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={isoDate(post.published_at)}>{date(post.published_at)}</time>
            </>
          ) : null}
          {post.reading_minutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{minutes(post.reading_minutes)} পড়া</span>
            </>
          ) : null}
        </p>
      </div>
    </Card>
  );
}
