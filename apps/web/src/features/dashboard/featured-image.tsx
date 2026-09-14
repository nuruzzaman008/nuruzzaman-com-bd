'use client';

import { MediaFileInput } from '@/components/ui/media-file-input';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { ACCEPTED_TYPES, prepareImageForUpload } from '@/lib/media/prepare-upload';

/**
 * A record's featured image, shared by the product and article editors.
 *
 * One implementation, because the rules are the same wherever an image is set:
 * a large photo is resized in the browser to fit the host's 2 MB PHP limit, an
 * upload is selected but not saved behind the admin's back, and the
 * description belongs to the image rather than to the record, so a changed one
 * is written to the image.
 */

export type Cover = { id: number; url: string | null; alt: string | null };

type Medium = { id: number; url: string | null; alt_text: string | null };

export function useFeaturedImage({
  initialCover,
  fallbackAlt,
}: {
  initialCover: Cover | null;
  /** Offered as the description when the image has none: the record's name. */
  fallbackAlt: string;
}) {
  const { t } = useLocale();
  const [cover, setCover] = useState<Cover | null>(initialCover);
  // Describes the current image, and the next one uploaded. Starting from the
  // record's name means an image is never left undescribed unseen.
  const [altText, setAltText] = useState(initialCover?.alt ?? fallbackAlt);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setNotice(null);

    try {
      const prepared = await prepareImageForUpload(file);

      if (!prepared.ok) {
        const reasons = {
          type: t.admin.products.uploadWrongType,
          'too-large': t.admin.products.uploadTooLarge,
          unreadable: t.admin.products.uploadUnreadable,
        };
        setNotice({ tone: 'danger', text: reasons[prepared.reason] });

        return;
      }

      const body = new FormData();
      body.set('file', prepared.file);

      const alt = altText.trim();
      if (alt) {
        body.set('alt_text', alt);
      }

      const response = await api<{ data: Medium }>('/admin/media', { method: 'POST', body });
      const uploaded = response.data;

      // Selected, not saved: the form is saved as a whole, and saving behind
      // the admin's back would also write any half-finished edits.
      setCover({ id: uploaded.id, url: uploaded.url, alt: uploaded.alt_text });
      setAltText(uploaded.alt_text ?? '');
      setNotice({ tone: 'success', text: t.admin.products.uploadDone });
    } catch (caught) {
      // The server's own reason is worth showing: "The file failed to upload"
      // from PHP reads very differently from a refusal on permission.
      const reason =
        caught instanceof ApiError
          ? (caught.fields?.file?.[0] ?? caught.message)
          : caught instanceof Error
            ? caught.message
            : null;

      setNotice({
        tone: 'danger',
        text: reason ? `${t.admin.products.uploadFailed} ${reason}` : t.admin.products.uploadFailed,
      });
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setCover(null);
    setNotice(null);
  }

  /**
   * Writes a changed description to the current image. Called before the
   * record itself is saved - and only acts on a change, so an untouched field
   * rewrites nothing.
   */
  async function persistAlt() {
    const alt = altText.trim();

    if (cover && alt !== (cover.alt ?? '')) {
      await api(`/admin/media/${cover.id}`, { method: 'PATCH', body: { alt_text: alt || null } });
      setCover({ ...cover, alt: alt || null });
    }
  }

  return {
    cover,
    altText,
    setAltText,
    uploading,
    notice,
    upload,
    remove,
    persistAlt,
    /** Whether the image differs from the one the page was loaded with. */
    changed: (cover?.id ?? null) !== (initialCover?.id ?? null),
    /** For the SEO analysis: live, including a description not yet saved. */
    analysisInput: cover ? { alt: altText.trim() || null } : null,
  };
}

export type FeaturedImage = ReturnType<typeof useFeaturedImage>;

export function FeaturedImageCard({
  image,
  hint,
  fallback,
  error,
}: {
  image: FeaturedImage;
  /** What the image is used for, in this record's terms. */
  hint: string;
  /** Shown while there is no image - e.g. the generated cover an article falls back to. */
  fallback?: React.ReactNode;
  error?: string;
}) {
  const { t } = useLocale();
  const fileInput = useRef<HTMLInputElement>(null);
  const { cover } = image;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-navy">{t.admin.products.featuredImage}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-start">
        <div>
          {cover?.url ? (
            /* Not next/image: next/image only allows the media host when
               NEXT_PUBLIC_MEDIA_HOST was set at build time, and a plain img
               shows a just-uploaded file in every environment. Contained, not
               cropped, so the whole picture can be judged. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt={cover.alt ?? ''}
              className="aspect-video w-full rounded-lg border border-line bg-surface object-contain"
            />
          ) : (
            (fallback ?? (
              <div className="grid aspect-video w-full place-items-center rounded-lg border border-dashed border-line bg-surface p-4 text-center text-sm text-muted">
                {t.admin.products.noImage}
              </div>
            ))
          )}

          {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}
        </div>

        <div className="space-y-4">
          <Field label={t.admin.products.uploadAlt} hint={t.admin.products.uploadAltHint}>
            {(props) => (
              <Input
                {...props}
                value={image.altText}
                maxLength={255}
                onChange={(event) => image.setAltText(event.target.value)}
                // Enter here would submit the whole form.
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                  }
                }}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <MediaFileInput scope="public"
              ref={fileInput}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              aria-label={t.admin.products.uploadImage}
              tabIndex={-1}
              className="sr-only"
              onChange={(event) => {
                const input = event.currentTarget;
                const picked = input.files?.[0];
                // Cleared at once, so choosing the same file again still fires.
                input.value = '';

                if (picked) {
                  void image.upload(picked);
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={image.uploading}
              onClick={() => fileInput.current?.click()}
            >
              {image.uploading ? t.admin.products.uploading : t.admin.products.uploadImage}
            </Button>

            {cover ? (
              <Button
                type="button"
                variant="ghost"
                className="text-danger"
                disabled={image.uploading}
                onClick={image.remove}
              >
                {t.admin.products.removeImage}
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted">{t.admin.products.uploadHint}</p>
        </div>
      </div>

      {image.notice ? (
        <Callout
          tone={image.notice.tone}
          role={image.notice.tone === 'danger' ? 'alert' : 'status'}
          className="mt-4"
        >
          {image.notice.text}
        </Callout>
      ) : null}

      {cover && !cover.alt ? (
        <Callout tone="warning" className="mt-4">
          {t.admin.products.altMissing}
        </Callout>
      ) : null}
    </Card>
  );
}
