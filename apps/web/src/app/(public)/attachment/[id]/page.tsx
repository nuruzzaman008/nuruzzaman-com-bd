import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ApiError } from '@nuruzzaman/contracts';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/container';
import { publicApi } from '@/lib/api/server';
import { date, fileSize } from '@/lib/format';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
import { buildMetadata } from '@/lib/seo';

type Attachment = {
  id: number;
  url: string | null;
  title: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  alt_text: string | null;
  caption: string | null;
  description: string | null;
  exclude_from_sitemap: boolean;
  uploaded_at: string | null;
  updated_at: string | null;
};

async function loadAttachment(id: string): Promise<Attachment> {
  if (!/^\d+$/.test(id)) {
    notFound();
  }

  try {
    const response = await publicApi<{ data: Attachment }>(`/media/${id}`, {
      tags: ['media', `media:${id}`],
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const attachment = await loadAttachment(id);

  return buildMetadata({
    title: attachment.title,
    description: attachment.caption || attachment.description || attachment.alt_text,
    path: `/attachment/${attachment.id}`,
    image: attachment.mime_type.startsWith('image/') ? attachment.url : null,
  });
}

/**
 * An attachment page, as WordPress has one: the file on its own, with the
 * title, caption and description written for it in the media library.
 */
export default async function AttachmentPage(
  props: LocalizedPageProps & { params: Promise<{ id: string }> },
) {
  const { locale, t } = pageDictionary(props.locale);
  const bn = locale === 'bn';
  const { id } = await props.params;
  const attachment = await loadAttachment(id);
  const url = attachment.url;

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs
        trail={[
          { name: t.common.home, path: '/' },
          { name: attachment.title, path: `/attachment/${attachment.id}`, authored: true },
        ]}
      />

      <article className="mx-auto mt-6 max-w-4xl">
        <h1
          data-authored="true"
          className="text-[length:var(--step-h1)] leading-tight font-bold text-navy"
        >
          {attachment.title}
        </h1>

        {url ? (
          <figure className="mt-6">
            {attachment.mime_type.startsWith('image/') ? (
              <Image
                src={url}
                alt={attachment.alt_text ?? ''}
                width={attachment.width ?? 1200}
                height={attachment.height ?? 800}
                sizes="(min-width: 1024px) 896px, 100vw"
                priority
                unoptimized={attachment.mime_type === 'image/svg+xml'}
                className="h-auto w-full rounded-[--radius-card] border border-line"
              />
            ) : attachment.mime_type.startsWith('video/') ? (
              <video
                controls
                preload="metadata"
                src={url}
                className="w-full rounded-[--radius-card] bg-black"
              />
            ) : attachment.mime_type === 'application/pdf' ? (
              <iframe
                src={url}
                title={attachment.title}
                className="h-[80dvh] w-full rounded-[--radius-card] border border-line"
              />
            ) : null}
            {attachment.caption ? (
              <figcaption data-authored="true" className="mt-3 text-sm text-muted">
                {attachment.caption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        {attachment.description ? (
          <div data-authored="true" className="mt-6 space-y-4 text-lg leading-relaxed text-navy">
            {attachment.description.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}

        <p className="mt-6 text-sm text-muted">
          {[date(attachment.uploaded_at, locale), fileSize(attachment.size_bytes)]
            .filter(Boolean)
            .join(' · ')}
          {url ? (
            <>
              {' · '}
              <a href={url} download={attachment.original_name} className="text-blue underline">
                {bn ? 'ফাইল ডাউনলোড করুন' : 'Download file'}
              </a>
            </>
          ) : null}
        </p>
      </article>
    </Container>
  );
}
