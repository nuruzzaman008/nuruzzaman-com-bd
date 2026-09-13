'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/form';
import { MarkdownTextarea } from '@/components/ui/markdown-editor';
import { FeaturedImageCard, useFeaturedImage } from '@/features/dashboard/featured-image';
import { SeoAnalysisPanel } from '@/features/dashboard/seo-analysis-panel';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

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

  const image = useFeaturedImage({
    initialCover: initial.cover_media_id
      ? { id: initial.cover_media_id, url: initial.cover_url ?? null, alt: initial.cover_alt ?? null }
      : null,
    fallbackAlt: initial.name_raw ?? initial.name,
  });

  const seo = initial.seo ?? null;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim() || null;

    setBusy(true);
    setSaved(false);
    setMessage(null);
    setErrors({});

    try {
      await image.persistAlt();

      await api(`/admin/products/${initial.id}`, {
        method: 'PATCH',
        body: {
          name: String(form.get('name') ?? '').trim(),
          slug: String(form.get('slug') ?? '').trim(),
          type: String(form.get('type') ?? ''),
          tagline: text('tagline'),
          description_markdown: text('description_markdown'),
          cover_media_id: image.cover?.id ?? null,
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

        <FeaturedImageCard
          image={image}
          hint={t.admin.products.featuredImageHint}
          error={errors.cover_media_id?.[0]}
        />

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
              <MarkdownTextarea
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
          featuredImage={image.analysisInput}
          fields={SEO_FIELDS}
        />
      </aside>
    </div>
  );
}
