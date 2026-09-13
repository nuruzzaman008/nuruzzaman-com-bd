'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/form';
import { SeoAnalysisPanel } from '@/features/dashboard/seo-analysis-panel';
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
  seo?: {
    meta_title?: string | null;
    meta_description?: string | null;
    focus_keyword?: string | null;
    canonical_url?: string | null;
    noindex?: boolean;
    nofollow?: boolean;
  } | null;
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
 * Where the analysis finds each input in this form.
 *
 * A constant rather than an inline object: the panel re-reads the form when
 * this changes, and a new object on every render would make it re-read on
 * every keystroke in the image description.
 */
const SEO_FIELDS = {
  title: 'name',
  slug: 'slug',
  content: 'description_markdown',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
  focusKeyword: 'focus_keyword',
  excerpt: 'tagline',
};

/**
 * Editing a product, with its SEO analysis beside it.
 *
 * Laid out like the article editor: the writing in the middle, the analysis
 * on the right, recalculated as the admin types - so the score can be watched
 * while the copy is written, instead of saved, checked on another screen, and
 * come back to. The SEO fields live in this form for the same reason; a
 * separate SEO screen would be a second editor on the same record.
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

  // The featured image. Set by uploading and cleared with Remove.
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

  const seo = initial.seo ?? null;

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
      // the admin's back would also write any half-finished edits.
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
    const text = (name: string) => String(form.get(name) ?? '').trim() || null;

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
          tagline: text('tagline'),
          description_markdown: text('description_markdown'),
          cover_media_id: cover?.id ?? null,
          is_price_public: form.get('is_price_public') === 'on',
          seo: {
            focus_keyword: text('focus_keyword'),
            meta_title: text('meta_title'),
            meta_description: text('meta_description'),
            // A blank canonical must clear the value: an empty string fails the
            // API's url rule. The boxes travel as explicit booleans, so a page
            // can be put back into the index as easily as it was taken out.
            canonical_url: text('canonical_url'),
            noindex: form.get('noindex') === 'on',
            nofollow: form.get('nofollow') === 'on',
          },
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form id="product-editor" onSubmit={save} className="min-w-0 space-y-6">
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

        {/* ------------------------------------------------ featured image */}
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

        {/* ------------------------------------------------------------ copy */}
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
                rows={18}
                defaultValue={initial.description_markdown ?? ''}
                className="min-h-96 font-mono text-[13px]"
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

        {/* ------------------------------------------------------------- SEO */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-bold text-navy">SEO</h2>

          <Field
            label={t.admin.seoEditor.focusKeyword}
            hint={t.admin.seoEditor.focusHint}
            error={errors['seo.focus_keyword']?.[0]}
          >
            {(props) => (
              <Input {...props} name="focus_keyword" defaultValue={seo?.focus_keyword ?? ''} />
            )}
          </Field>

          <Field label="Meta title" error={errors['seo.meta_title']?.[0]}>
            {(props) => (
              <Input
                {...props}
                name="meta_title"
                maxLength={255}
                defaultValue={seo?.meta_title ?? ''}
              />
            )}
          </Field>

          <Field label="Meta description" error={errors['seo.meta_description']?.[0]}>
            {(props) => (
              <Textarea
                {...props}
                name="meta_description"
                maxLength={320}
                defaultValue={seo?.meta_description ?? ''}
              />
            )}
          </Field>

          <Field
            label={t.admin.seoEditor.canonical}
            hint={t.admin.seoEditor.canonicalHint}
            error={errors['seo.canonical_url']?.[0]}
          >
            {(props) => (
              <Input
                {...props}
                name="canonical_url"
                type="url"
                inputMode="url"
                defaultValue={seo?.canonical_url ?? ''}
                className="font-latin"
              />
            )}
          </Field>

          <Checkbox
            name="noindex"
            defaultChecked={seo?.noindex ?? false}
            label={
              <span>
                {t.admin.seoEditor.noindex}
                <span className="mt-0.5 block text-xs text-muted">
                  {t.admin.seoEditor.noindexHint}
                </span>
              </span>
            }
            error={errors['seo.noindex']?.[0]}
          />

          <Checkbox
            name="nofollow"
            defaultChecked={seo?.nofollow ?? false}
            label={
              <span>
                {t.admin.seoEditor.nofollow}
                <span className="mt-0.5 block text-xs text-muted">
                  {t.admin.seoEditor.nofollowHint}
                </span>
              </span>
            }
            error={errors['seo.nofollow']?.[0]}
          />
        </Card>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={busy}>
            {busy ? t.admin.products.saving : t.admin.products.save}
          </Button>

          <Link
            href={`/products/${initial.slug}`}
            className="text-sm font-medium text-blue hover:underline"
          >
            {t.admin.products.viewPublic}
          </Link>
        </div>
      </form>

      {/* Sticky and scrollable on its own, so the score stays in view while a
          long description is being written further down the page. */}
      <aside className="xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto">
        <SeoAnalysisPanel
          formId="product-editor"
          kind="product"
          recordId={initial.id}
          // Live, as the admin uploads, removes or describes the image - not
          // the state it was in when the page loaded.
          featuredImage={cover ? { alt: altText.trim() || null } : null}
          fields={SEO_FIELDS}
        />
      </aside>
    </div>
  );
}
