'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SeoAnalysisPanel } from '@/features/dashboard/seo-analysis-panel';
import type { Post } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import type { Dictionary } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';

type Transition = keyof Dictionary['admin']['postEditor'];

/** Which moves each status allows. The API enforces the same rules. */
const TRANSITIONS: Record<string, { label: Transition; to: string }[]> = {
  draft: [
    { label: 'sendToReview', to: 'in_review' },
    { label: 'publish', to: 'published' },
  ],
  in_review: [
    { label: 'backToDraft', to: 'draft' },
    { label: 'publish', to: 'published' },
  ],
  scheduled: [
    { label: 'publishNow', to: 'published' },
    { label: 'backToDraft', to: 'draft' },
  ],
  published: [{ label: 'archive', to: 'archived' }],
  archived: [{ label: 'backToDraft', to: 'draft' }],
};

/**
 * Markdown editor for an article.
 *
 * The body is stored as Markdown source; the API renders it with raw HTML
 * stripped, so nothing typed here can inject script into a published page.
 * Every save snapshots a revision on the server first.
 */
export function PostEditor({ post }: { post: Post }) {
  const { t } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    setSaved(false);

    const form = new FormData(event.currentTarget);

    try {
      await api<{ data: Post }>(`/admin/posts/${post.id}`, {
        method: 'PATCH',
        body: {
          title: form.get('title'),
          slug: form.get('slug'),
          excerpt: form.get('excerpt') || null,
          body_markdown: form.get('body_markdown'),
          funnel_stage: form.get('funnel_stage') || null,
          search_intent: form.get('search_intent') || null,
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
        setMessage(t.admin.postEditor.saveFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  async function transition(to: string) {
    setBusy(true);
    setMessage(null);

    try {
      await api<{ data: Post }>(`/admin/posts/${post.id}/transition`, {
        method: 'POST',
        body: { status: to },
      });

      router.refresh();
    } catch (caught) {
      setMessage(
        caught instanceof ApiError ? caught.message : t.admin.postEditor.statusFailed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form id="post-editor" onSubmit={save} noValidate className="space-y-5">
        <ErrorSummary errors={errors} />

        {message ? (
          <Callout tone="danger" role="alert">
            {message}
          </Callout>
        ) : null}

        {saved ? (
          <Callout tone="success" role="status">
            {t.admin.postEditor.saved}
          </Callout>
        ) : null}

        <Field label={t.admin.postEditor.title} required error={errors.title?.[0]}>
          {(props) => <Input name="title" defaultValue={post.title} {...props} />}
        </Field>

        <Field
          label={t.admin.postEditor.slug}
          required
          hint={t.admin.postEditor.slugHint}
          error={errors.slug?.[0]}
        >
          {(props) => (
            <Input name="slug" defaultValue={post.slug} className="font-latin" {...props} />
          )}
        </Field>

        <Field label={t.admin.postEditor.excerpt} error={errors.excerpt?.[0]}>
          {(props) => <Textarea name="excerpt" defaultValue={post.excerpt ?? ''} {...props} />}
        </Field>

        <Field
          label={t.admin.postEditor.body}
          required
          hint={t.admin.postEditor.bodyHint}
          error={errors.body_markdown?.[0]}
        >
          {(props) => (
            <Textarea
              name="body_markdown"
              defaultValue={post.body_markdown ?? ''}
              className="font-latin min-h-96 text-sm"
              spellCheck={false}
              {...props}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.admin.postEditor.funnelStage}>
            {(props) => (
              <Select name="funnel_stage" defaultValue={post.funnel_stage ?? ''} {...props}>
                <option value="">{t.admin.postEditor.choose}</option>
                <option value="awareness">Awareness</option>
                <option value="consideration">Consideration</option>
                <option value="decision">Decision</option>
              </Select>
            )}
          </Field>

          <Field label={t.admin.postEditor.searchIntent}>
            {(props) => (
              <Select name="search_intent" defaultValue="" {...props}>
                <option value="">{t.admin.postEditor.choose}</option>
                <option value="informational">Informational</option>
                <option value="commercial">Commercial</option>
                <option value="transactional">Transactional</option>
                <option value="navigational">Navigational</option>
              </Select>
            )}
          </Field>
        </div>

        <fieldset className="space-y-5 border-t border-line pt-5">
          <legend className="font-bold text-navy">SEO</legend>

          <Field
            label={t.admin.postEditor.focusKeyword}
            hint={t.admin.postEditor.focusHint}
          >
            {(props) => (
              <Input name="focus_keyword" defaultValue={post.seo?.focus_keyword ?? ''} {...props} />
            )}
          </Field>

          <Field label="Meta title">
            {(props) => (
              <Input name="meta_title" defaultValue={post.seo?.meta_title ?? ''} {...props} />
            )}
          </Field>

          <Field label="Meta description">
            {(props) => (
              <Textarea
                name="meta_description"
                defaultValue={post.seo?.meta_description ?? ''}
                {...props}
              />
            )}
          </Field>
        </fieldset>

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t.admin.common.saving : t.admin.common.save}
        </Button>
      </form>

      <aside className="space-y-4">
        <Card className="p-5">
          <p className="text-sm text-muted">{t.admin.postEditor.currentStatus}</p>
          <Badge tone={post.status === 'published' ? 'success' : 'neutral'}>{post.status}</Badge>

          <div className="mt-4 space-y-2">
            {(TRANSITIONS[post.status] ?? []).map((option) => (
              <Button
                key={option.to}
                type="button"
                variant="secondary"
                className="w-full"
                disabled={busy}
                onClick={() => void transition(option.to)}
              >
                {t.admin.postEditor[option.label]}
              </Button>
            ))}
          </div>

          {!post.reviewed_at ? (
            <Callout tone="warning" className="mt-4">
              {t.admin.postEditor.reviewWarning}
            </Callout>
          ) : null}
        </Card>

        <SeoAnalysisPanel
          formId="post-editor"
          kind="post"
          fields={{
            title: 'title',
            slug: 'slug',
            content: 'body_markdown',
            metaTitle: 'meta_title',
            metaDescription: 'meta_description',
            focusKeyword: 'focus_keyword',
            excerpt: 'excerpt',
          }}
        />
      </aside>
    </div>
  );
}
