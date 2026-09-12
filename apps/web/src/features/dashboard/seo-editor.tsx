'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SeoAnalysisPanel } from '@/features/dashboard/seo-analysis-panel';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import type { SeoInput } from '@/lib/seo-analysis/analyze';

/**
 * SEO fields plus the live item-wise analysis, for a course or a product.
 *
 * Courses and products are edited elsewhere (or not yet at all); this screen
 * exists so their search-facing text gets the same scrutiny as an article's,
 * rather than being the one content type nobody checks.
 *
 * The body text is read-only here. It is the strongest input to the analysis,
 * so it must be visible, but this screen is not the place to rewrite a course
 * description — editing it here would put two editors on one field.
 */
export function SeoEditor({
  kind,
  endpoint,
  recordId,
  title,
  slug,
  body,
  excerpt,
  seo,
}: {
  kind: SeoInput['kind'];
  /** Admin PATCH endpoint for this record, e.g. `/admin/courses/12`. */
  endpoint: string;
  /** This record's id, so the keyword-reuse check can exclude it. */
  recordId?: number;
  title: string;
  slug: string;
  body: string;
  excerpt?: string;
  seo: {
    meta_title?: string | null;
    meta_description?: string | null;
    focus_keyword?: string | null;
    canonical_url?: string | null;
    noindex?: boolean;
    nofollow?: boolean;
  } | null;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setMessage(null);
    setErrors({});

    const form = new FormData(event.currentTarget);

    try {
      await api(endpoint, {
        method: 'PATCH',
        body: {
          seo: {
            meta_title: form.get('meta_title') || null,
            meta_description: form.get('meta_description') || null,
            focus_keyword: form.get('focus_keyword') || null,
            canonical_url: form.get('canonical_url') || null,
            noindex: form.get('noindex') === 'on',
            nofollow: form.get('nofollow') === 'on',
          },
        },
      });

      setSaved(true);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fields);

        if (!caught.isValidation) {
          setMessage(caught.message);
        }
      } else {
        setMessage(t.admin.seoEditor.failed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <form id="seo-editor" onSubmit={save} noValidate className="space-y-5">
        {message ? (
          <Callout tone="danger" role="alert">
            {message}
          </Callout>
        ) : null}

        {saved ? (
          <Callout tone="success" role="status">
            {t.admin.seoEditor.saved}
          </Callout>
        ) : null}

        {/* Read by the analysis panel, never submitted. */}
        <input type="hidden" name="title" defaultValue={title} />
        <input type="hidden" name="slug" defaultValue={slug} />
        <input type="hidden" name="body_markdown" defaultValue={body} />
        {excerpt !== undefined ? (
          <input type="hidden" name="excerpt" defaultValue={excerpt} />
        ) : null}

        <Field
          label={t.admin.seoEditor.focusKeyword}
          hint={t.admin.seoEditor.focusHint}
          error={errors['seo.focus_keyword']?.[0]}
        >
          {(props) => (
            <Input name="focus_keyword" defaultValue={seo?.focus_keyword ?? ''} {...props} />
          )}
        </Field>

        <Field label="Meta title" error={errors['seo.meta_title']?.[0]}>
          {(props) => <Input name="meta_title" defaultValue={seo?.meta_title ?? ''} {...props} />}
        </Field>

        <Field label="Meta description" error={errors['seo.meta_description']?.[0]}>
          {(props) => (
            <Textarea
              name="meta_description"
              defaultValue={seo?.meta_description ?? ''}
              {...props}
            />
          )}
        </Field>

        {/*
          The indexing controls. The API has accepted all three since the seo
          table was created, and nothing in the admin could set them: a page
          that needed to be kept out of the index, or pointed at a canonical
          elsewhere, could only be changed in the database.
        */}
        <Field
          label={t.admin.seoEditor.canonical}
          hint={t.admin.seoEditor.canonicalHint}
          error={errors['seo.canonical_url']?.[0]}
        >
          {(props) => (
            <Input
              name="canonical_url"
              type="url"
              inputMode="url"
              defaultValue={seo?.canonical_url ?? ''}
              className="font-latin"
              {...props}
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

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t.admin.common.saving : t.admin.common.save}
        </Button>
      </form>

      <aside>
        <SeoAnalysisPanel
          formId="seo-editor"
          kind={kind}
          recordId={recordId}
          fields={{
            title: 'title',
            slug: 'slug',
            content: 'body_markdown',
            metaTitle: 'meta_title',
            metaDescription: 'meta_description',
            focusKeyword: 'focus_keyword',
            excerpt: excerpt !== undefined ? 'excerpt' : undefined,
          }}
        />
      </aside>
    </div>
  );
}
