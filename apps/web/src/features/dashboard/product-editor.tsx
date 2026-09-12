'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/form';
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
  is_price_public?: boolean;
};

type Medium = {
  id: number;
  url: string | null;
  original_name: string | null;
  alt_text: string | null;
  mime_type?: string | null;
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

  const [media, setMedia] = useState<Medium[]>([]);
  // Distinguished from an empty library, so the permission hint is only shown
  // to someone who actually lacks the permission - not during the first render
  // and not to an admin whose library is simply empty.
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [coverId, setCoverId] = useState<number | null>(initial.cover_media_id ?? null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const loadMedia = useCallback(async () => {
    try {
      // The admin media index answers with a paginator, so the list is at the
      // top-level `data` key and there is no second envelope.
      const response = await api<{ data: Medium[] }>('/admin/media');
      setMedia(response.data ?? []);
      setMediaState('ready');
    } catch {
      // The picker needs `media.manage`, which a commerce-only admin may not
      // hold. A chooser that cannot list its options is not worth an error
      // banner across the whole form; the current image still shows.
      setMedia([]);
      setMediaState('denied');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadMedia();
    })();
  }, [loadMedia]);

  const chosen = media.find((item) => item.id === coverId);
  const preview = chosen?.url ?? (coverId === initial.cover_media_id ? initial.cover_url : null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setSaved(false);
    setMessage(null);
    setErrors({});

    try {
      await api(`/admin/products/${initial.id}`, {
        method: 'PATCH',
        body: {
          name: String(form.get('name') ?? '').trim(),
          slug: String(form.get('slug') ?? '').trim(),
          type: String(form.get('type') ?? ''),
          tagline: String(form.get('tagline') ?? '').trim() || null,
          description_markdown: String(form.get('description_markdown') ?? '').trim() || null,
          cover_media_id: coverId,
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

        <div className="mt-4 flex flex-wrap items-start gap-5">
          {preview ? (
            /* Not next/image: these are admin-uploaded files on the public
               disk, and the loader is configured for the site's own assets. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={chosen?.alt_text ?? ''}
              className="size-28 rounded-lg border border-line object-cover"
            />
          ) : (
            <div className="grid size-28 place-items-center rounded-lg border border-dashed border-line p-2 text-center text-xs text-muted">
              {t.admin.products.noImage}
            </div>
          )}

          <Field
            label={t.admin.products.chooseImage}
            hint={
              mediaState === 'denied'
                ? t.admin.products.mediaUnavailable
                : mediaState === 'ready' && media.length === 0
                  ? t.admin.products.mediaEmpty
                  : undefined
            }
            error={errors.cover_media_id?.[0]}
            className="min-w-64 flex-1"
          >
            {(props) => (
              <Select
                {...props}
                value={coverId ?? ''}
                onChange={(event) =>
                  setCoverId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">{t.admin.products.noImage}</option>
                {media.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.alt_text || item.original_name || `#${item.id}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {chosen && !chosen.alt_text ? (
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
