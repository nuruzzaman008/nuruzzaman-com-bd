'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SeoAnalysisPanel } from '@/features/dashboard/seo-analysis-panel';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Field, Input, Textarea } from '@/components/ui/form';
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
  title,
  slug,
  body,
  excerpt,
  seo,
}: {
  kind: SeoInput['kind'];
  /** Admin PATCH endpoint for this record, e.g. `/admin/courses/12`. */
  endpoint: string;
  title: string;
  slug: string;
  body: string;
  excerpt?: string;
  seo: {
    meta_title?: string | null;
    meta_description?: string | null;
    focus_keyword?: string | null;
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

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t.admin.common.saving : t.admin.common.save}
        </Button>
      </form>

      <aside>
        <SeoAnalysisPanel
          formId="seo-editor"
          kind={kind}
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
