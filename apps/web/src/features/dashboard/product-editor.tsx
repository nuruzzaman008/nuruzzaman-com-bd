'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { ACCEPTED_TYPES, prepareImageForUpload } from '@/lib/media/prepare-upload';

export type EditableProduct = {
  id: number;
  slug: string;
  type: string;
  name: string;
  /** The stored Bengali name, before `?locale=` picked a language. */
  name_raw?: string | null;
  tagline?: string | null;
  tagline_raw?: string | null;
  description_markdown?: string | null;
  cover_media_id?: number | null;
  cover_url?: string | null;
  cover_alt?: string | null;
  is_price_public?: boolean;
};

type Medium = { id: number; url: string | null; alt_text: string | null };

type Cover = { id: number; url: string | null; alt: string | null };

/** The values ProductType accepts; the API refuses anything else. */
const PRODUCT_TYPES = [
  'software_license',
  'credit_refill',
  'course',
  'bundle',
  'digital_resource',
] as const;

/**
 * Editing a product's own copy.
 *
 * Until now the catalogue row linked to the public page and to an SEO panel,
 * and there was nowhere to change a name, a slug, a description or the
 * featured image — though the API has accepted PATCH all along.
 *
 * Note `description_markdown` rather than the `description_html` the public
 * payload carries. Loading the rendering into this form would save it back
 * over its own source, and the next edit would render the rendering.
 */
export function ProductEditor({ initial }: { initial: EditableProduct }) {
  const { t } = useLocale();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // The featured image. Set by uploading and cleared with Remove; the library
  // chooser it replaced only listed files, and nothing could put any there.
  const [cover, setCover] = useState<Cover | null>(
    initial.cover_media_id
      ? { id: initial.cover_media_id, url: initial.cover_url ?? null, alt: initial.cover_alt ?? null }
      : null,
  );

  // Describes the current image, and the next one uploaded. It starts as the
  // image's own alt text, or the product's name where there is none, so an
  // image is never left undescribed without the admin being able to see it.
  const [altText, setAltText] = useState(initial.cover_alt ?? initial.name_raw ?? initial.name);

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const picked = input.files?.[0];
    // Cleared at once, so choosing the same file again still fires a change.
    input.value = '';

    if (!picked) {
      return;
    }

    setUploading(true);
    setUploadNotice(null);

    try {
      const prepared = await prepareImageForUpload(picked);

      if (!prepared.ok) {
        const reasons = {
          type: t.admin.products.uploadWrongType,
          'too-large': t.admin.products.uploadTooLarge,
          unreadable: t.admin.products.uploadUnreadable,
        };
        setUploadNotice({ tone: 'danger', text: reasons[prepared.reason] });

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
      // the admin's back would also write any half-finished edits above.
      setCover({ id: uploaded.id, url: uploaded.url, alt: uploaded.alt_text });
      setAltText(uploaded.alt_text ?? '');
      setUploadNotice({ tone: 'success', text: t.admin.products.uploadDone });
    } catch (caught) {
      // The server's own reason is worth showing: "The file failed to upload"
      // from PHP reads very differently from a refusal on permission.
      const reason =
        caught instanceof ApiError
          ? (caught.fields?.file?.[0] ?? caught.message)
          : caught instanceof Error
            ? caught.message
            : null;

      setUploadNotice({
        tone: 'danger',
        text: reason ? `${t.admin.products.uploadFailed} ${reason}` : t.admin.products.uploadFailed,
      });
    } finally {
      setUploading(false);
    }
  }

  function removeCover() {
    setCover(null);
    setUploadNotice(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setSaved(false);
    setMessage(null);
    setErrors({});

    try {
      // The description belongs to the image, not the product, so a change to
      // it is written to the image - and only a change: an untouched field
      // must not rewrite anything.
      const alt = altText.trim();

      if (cover && alt !== (cover.alt ?? '')) {
        await api(`/admin/media/${cover.id}`, {
          method: 'PATCH',
          body: { alt_text: alt || null },
        });
        setCover({ ...cover, alt: alt || null });
      }

      await api(`/admin/products/${initial.id}`, {
        method: 'PATCH',
        body: {
          name: String(form.get('name') ?? '').trim(),
          slug: String(form.get('slug') ?? '').trim(),
          type: String(form.get('type') ?? ''),
          tagline: String(form.get('tagline') ?? '').trim() || null,
          description_markdown: String(form.get('description_markdown') ?? '').trim() || null,
          cover_media_id: cover?.id ?? null,
          is_price_public: form.get('is_price_public') === 'on',
        },
      });

      setSaved(true);
      // The slug may have changed, and the row this page was reached from
      // still shows the old one.
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fields).length > 0) {
        setErrors(caught.fields);
      } else {
        setMessage(caught instanceof Error ? caught.message : t.admin.products.saveFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <ErrorSummary errors={errors} />

      {message ? (
        <Callout tone="danger" role="alert">
          {message}
        </Callout>
      ) : null}

      {saved ? (
        <Callout tone="success" role="status">
          {t.admin.products.saved}
        </Callout>
      ) : null}

      <Card className="grid gap-5 p-6 sm:grid-cols-2">
        <Field
          label={t.admin.common.name}
          required
          error={errors.name?.[0]}
          className="sm:col-span-2"
        >
          {(props) => (
            <Input
              {...props}
              name="name"
              maxLength={200}
              defaultValue={initial.name_raw ?? initial.name}
            />
          )}
        </Field>

        <Field
          label={t.admin.common.slug}
          hint={t.admin.products.slugHint}
          required
          error={errors.slug?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="slug"
              maxLength={180}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              defaultValue={initial.slug}
              className="font-latin"
            />
          )}
        </Field>

        <Field label={t.admin.common.type} error={errors.type?.[0]}>
          {(props) => (
            <Select {...props} name="type" defaultValue={initial.type} className="font-latin">
              {PRODUCT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label={t.admin.products.tagline}
          hint={t.admin.products.taglineHint}
          error={errors.tagline?.[0]}
          className="sm:col-span-2"
        >
          {(props) => (
            <Input
              {...props}
              name="tagline"
              maxLength={255}
              defaultValue={initial.tagline_raw ?? initial.tagline ?? ''}
            />
          )}
        </Field>

        <Field
          label={t.admin.products.description}
          hint={t.admin.products.descriptionHint}
          error={errors.description_markdown?.[0]}
          className="sm:col-span-2"
        >
          {(props) => (
            <Textarea
              {...props}
              name="description_markdown"
              rows={14}
              defaultValue={initial.description_markdown ?? ''}
              className="min-h-72 font-mono text-[13px]"
            />
          )}
        </Field>

        <Checkbox
          name="is_price_public"
          defaultChecked={initial.is_price_public ?? true}
          label={t.admin.products.pricePublic}
          className="sm:col-span-2"
        />
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-navy">{t.admin.products.featuredImage}</h2>
        <p className="mt-1 text-sm text-muted">{t.admin.products.featuredImageHint}</p>

        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-start">
          <div>
            {cover?.url ? (
              /* Not next/image: next/image only allows the media host when
                 NEXT_PUBLIC_MEDIA_HOST was set at build time, and a plain img
                 shows a just-uploaded file in every environment. Contained,
                 not cropped, so the whole picture can be judged. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.url}
                alt={cover.alt ?? ''}
                className="aspect-video w-full rounded-lg border border-line bg-surface object-contain"
              />
            ) : (
              <div className="grid aspect-video w-full place-items-center rounded-lg border border-dashed border-line bg-surface p-4 text-center text-sm text-muted">
                {t.admin.products.noImage}
              </div>
            )}

            {errors.cover_media_id?.[0] ? (
              <p className="mt-2 text-sm font-medium text-danger">{errors.cover_media_id[0]}</p>
            ) : null}
          </div>

          <div className="space-y-4">
            <Field label={t.admin.products.uploadAlt} hint={t.admin.products.uploadAltHint}>
              {(props) => (
                <Input
                  {...props}
                  value={altText}
                  maxLength={255}
                  onChange={(event) => setAltText(event.target.value)}
                  // Enter here would submit the whole product form.
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                    }
                  }}
                />
              )}
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                aria-label={t.admin.products.uploadImage}
                tabIndex={-1}
                className="sr-only"
                onChange={(event) => void upload(event)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? t.admin.products.uploading : t.admin.products.uploadImage}
              </Button>

              {cover ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger"
                  disabled={uploading}
                  onClick={removeCover}
                >
                  {t.admin.products.removeImage}
                </Button>
              ) : null}
            </div>

            <p className="text-xs text-muted">{t.admin.products.uploadHint}</p>
          </div>
        </div>

        {uploadNotice ? (
          <Callout
            tone={uploadNotice.tone}
            role={uploadNotice.tone === 'danger' ? 'alert' : 'status'}
            className="mt-4"
          >
            {uploadNotice.text}
          </Callout>
        ) : null}

        {cover && !cover.alt ? (
          <Callout tone="warning" className="mt-4">
            {t.admin.products.altMissing}
          </Callout>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={busy}>
          {busy ? t.admin.products.saving : t.admin.products.save}
        </Button>

        <Link
          href={`/dashboard/products/${initial.id}/seo`}
          className="text-sm font-medium text-blue hover:underline"
        >
          {t.admin.products.seoLink}
        </Link>

        <Link
          href={`/shop/${initial.slug}`}
          className="text-sm font-medium text-blue hover:underline"
        >
          {t.admin.products.viewPublic}
        </Link>
      </div>
    </form>
  );
}
