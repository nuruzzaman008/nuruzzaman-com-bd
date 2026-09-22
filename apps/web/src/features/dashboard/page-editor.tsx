'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Page, User } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/form';
import { MarkdownTextarea } from '@/components/ui/markdown-editor';
import { FeaturedImageCard, useFeaturedImage } from '@/features/dashboard/featured-image';
import { SeoAnalysisPanel } from '@/features/dashboard/seo-analysis-panel';
import { ApiError, api } from '@/lib/api/browser';
import { date } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSession } from '@/lib/session/session-provider';
import { isSitePage, pagePathForSlug } from '@/lib/site';
import { statusLabel } from '@/lib/status';

/** The same page in the other language: `about` for `about-en`, and back. */
export type PageCounterpart = { id: number; slug: string; title: string } | null;

const TEMPLATES = ['default', 'legal', 'support'] as const;

/** A draft, a page in review or a scheduled one can go live; the API says the same. */
const PUBLISHABLE = ['draft', 'in_review', 'scheduled'];

/** The moves other than publishing, as ContentStatus allows them. */
const MOVES: Record<string, { to: string; label: 'backToDraft' | 'archive' }[]> = {
  published: [
    { to: 'draft', label: 'backToDraft' },
    { to: 'archived', label: 'archive' },
  ],
  archived: [{ to: 'draft', label: 'backToDraft' }],
};

/** Where the SEO analysis finds each input; a constant so the panel reads it once. */
const SEO_FIELDS = {
  title: 'title',
  slug: 'slug',
  content: 'body_markdown',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
  focusKeyword: 'focus_keyword',
};

/** A super admin holds every permission without it being listed. */
function can(user: User | null, permission: string): boolean {
  return Boolean(user?.roles.includes('super_admin') || user?.permissions?.includes(permission));
}

/**
 * The editor for one CMS page: its words, its address, its SEO and whether it
 * is on the site.
 *
 * The body is Markdown, rendered by the API with raw HTML stripped, so nothing
 * typed here can put a script on the page. A save refreshes the live page.
 *
 * The site's own pages (about, FAQ, the policies) are shown at fixed routes, so
 * their address is locked and they cannot be taken offline or deleted here.
 */
export function PageEditor({ page, counterpart }: { page: Page; counterpart: PageCounterpart }) {
  const { locale, t } = useLocale();
  const words = t.admin.pageEditor;
  const { user } = useSession();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [slug, setSlug] = useState(page.slug);
  const [reviewer, setReviewer] = useState('');
  // Set by the sidebar's Publish button just before it submits the form, so
  // one click saves the words and then publishes them.
  const intent = useRef<'save' | 'publish'>('save');

  const english = page.slug.endsWith('-en');
  const sitePage = isSitePage(page.slug);
  const published = page.status === 'published';
  const mayPublish = can(user, 'pages.publish');
  const mayManage = can(user, 'pages.manage');
  const canPublish = mayPublish && PUBLISHABLE.includes(page.status);
  // Leaving the site is not offered for the site's own pages: their route
  // would answer "not found".
  const moves = sitePage && published ? [] : (MOVES[page.status] ?? []);
  const slugLocked = sitePage || english || counterpart !== null;

  // The share image lives on the page's SEO row; a page has no cover of its own.
  const image = useFeaturedImage({
    initialCover: page.share_image
      ? { id: page.share_image.id, url: page.share_image.url, alt: page.share_image.alt }
      : null,
    fallbackAlt: page.title,
  });

  function submit(next: 'save' | 'publish') {
    intent.current = next;
    (document.getElementById('page-editor') as HTMLFormElement | null)?.requestSubmit();
  }

  function fail(caught: unknown, fallback: string) {
    if (caught instanceof ApiError) {
      setErrors(caught.fields);

      if (!caught.isValidation) {
        setMessage(caught.message);
      }
    } else {
      setMessage(fallback);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const publishing = intent.current === 'publish';
    intent.current = 'save';

    setBusy(true);
    setErrors({});
    setMessage(null);
    setSaved(null);

    const form = new FormData(event.currentTarget);
    const template = String(form.get('template') ?? page.template);

    try {
      await image.persistAlt();

      await api<{ data: Page }>(`/admin/pages/${page.id}`, {
        method: 'PATCH',
        body: {
          title: form.get('title'),
          ...(slugLocked ? {} : { slug }),
          body_markdown: form.get('body_markdown'),
          template,
          // Only when the kind changes: a legal page waits for a professional
          // review, and saving the words must not start or end that wait.
          ...(template !== page.template ? { requires_legal_review: template === 'legal' } : {}),
          seo: {
            meta_title: form.get('meta_title') || null,
            meta_description: form.get('meta_description') || null,
            focus_keyword: form.get('focus_keyword') || null,
            canonical_url: form.get('canonical_url') || null,
            noindex: form.get('noindex') === 'on',
            nofollow: form.get('nofollow') === 'on',
            // Sent only when the picture was changed, so saving the words can
            // never lose it.
            ...(image.changed ? { og_media_id: image.cover?.id ?? null } : {}),
          },
        },
      });

      if (publishing) {
        await api<{ data: Page }>(`/admin/pages/${page.id}/transition`, {
          method: 'POST',
          body: { status: 'published' },
        });
      }

      setSaved(publishing ? words.publishedDone : published ? words.updated : words.saved);
      router.refresh();
    } catch (caught) {
      fail(caught, words.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function transition(to: string) {
    setBusy(true);
    setMessage(null);
    setSaved(null);

    try {
      await api<{ data: Page }>(`/admin/pages/${page.id}/transition`, {
        method: 'POST',
        body: { status: to },
      });

      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : words.statusFailed);
    } finally {
      setBusy(false);
    }
  }

  /** Copies this page into an English draft, to be translated there. */
  async function createEnglish() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await api<{ data: Page }>('/admin/pages', {
        method: 'POST',
        body: {
          title: page.title,
          slug: `${page.slug}-en`,
          body_markdown: page.body_markdown ?? '',
          template: page.template,
          requires_legal_review: page.template === 'legal',
        },
      });

      router.push(`/dashboard/pages/${response.data.id}`);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : words.createFailed);
      setBusy(false);
    }
  }

  async function recordReview(reviewed: boolean) {
    if (reviewed && !reviewer.trim()) {
      setMessage(words.reviewerNeeded);

      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await api<{ data: Page }>(`/admin/pages/${page.id}/legal-review`, {
        method: 'POST',
        body: { reviewer: reviewed ? reviewer.trim() : (page.legal_reviewer ?? '-'), reviewed },
      });

      setReviewer('');
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : words.reviewFailed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(words.removeConfirm)) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await api(`/admin/pages/${page.id}`, { method: 'DELETE' });
      router.push('/dashboard/pages');
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : words.removeFailed);
      setBusy(false);
    }
  }

  const address = pagePathForSlug(slugLocked ? page.slug : slug || page.slug);

  return (
    <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form id="page-editor" onSubmit={save} noValidate className="min-w-0 space-y-5">
        <ErrorSummary errors={errors} />

        {message ? (
          <Callout tone="danger" role="alert">
            {message}
          </Callout>
        ) : null}

        {saved ? (
          <Callout tone="success" role="status">
            {saved}
          </Callout>
        ) : null}

        <Field label={words.title} required error={errors.title?.[0]}>
          {(props) => <Input name="title" defaultValue={page.title} {...props} />}
        </Field>

        <Field
          label={words.slug}
          required
          hint={
            slugLocked
              ? sitePage
                ? words.slugLocked
                : english
                  ? words.englishOf
                  : words.slugLockedPair
              : words.slugHint
          }
          error={errors.slug?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="slug"
              value={slug}
              readOnly={slugLocked}
              className="font-latin"
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
            />
          )}
        </Field>

        <p className="text-sm text-muted">
          {words.address}:{' '}
          <span className="font-latin font-medium text-navy">nuruzzaman.com.bd{address}</span>
        </p>

        <Field label={words.body} hint={words.bodyHint} error={errors.body_markdown?.[0]}>
          {(props) => (
            <MarkdownTextarea
              name="body_markdown"
              defaultValue={page.body_markdown ?? ''}
              className="min-h-96 text-sm"
              {...props}
            />
          )}
        </Field>

        <Field label={words.template} hint={words.templateHint}>
          {(props) => (
            <Select name="template" defaultValue={page.template} {...props}>
              {TEMPLATES.map((value) => (
                <option key={value} value={value}>
                  {words.templates[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset className="space-y-5 border-t border-line pt-5">
          <legend className="font-bold text-navy">SEO</legend>

          <Field
            label={words.focusKeyword}
            hint={words.focusHint}
            error={errors['seo.focus_keyword']?.[0]}
          >
            {(props) => (
              <Input name="focus_keyword" defaultValue={page.seo?.focus_keyword ?? ''} {...props} />
            )}
          </Field>

          <Field
            label={words.metaTitle}
            hint={words.metaTitleHint}
            error={errors['seo.meta_title']?.[0]}
          >
            {(props) => (
              <Input name="meta_title" defaultValue={page.seo?.meta_title ?? ''} {...props} />
            )}
          </Field>

          <Field
            label={words.metaDescription}
            hint={words.metaDescriptionHint}
            error={errors['seo.meta_description']?.[0]}
          >
            {(props) => (
              <Textarea
                name="meta_description"
                defaultValue={page.seo?.meta_description ?? ''}
                {...props}
              />
            )}
          </Field>

          <FeaturedImageCard
            image={image}
            hint={words.shareImageHint}
            error={errors['seo.og_media_id']?.[0]}
          />

          <Field
            label={words.canonical}
            hint={words.canonicalHint}
            error={errors['seo.canonical_url']?.[0]}
          >
            {(props) => (
              <Input
                name="canonical_url"
                type="url"
                inputMode="url"
                defaultValue={page.seo?.canonical_url ?? ''}
                className="font-latin"
                {...props}
              />
            )}
          </Field>

          <Checkbox
            name="noindex"
            defaultChecked={page.seo?.noindex ?? false}
            label={words.noindex}
          />
          <Checkbox
            name="nofollow"
            defaultChecked={page.seo?.nofollow ?? false}
            label={words.nofollow}
          />
        </fieldset>

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t.admin.common.saving : published ? words.update : words.saveDraft}
        </Button>
      </form>

      <aside className="space-y-4">
        <Card className="p-5">
          <p className="text-sm text-muted">{words.currentStatus}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={published ? 'success' : 'neutral'}>
              {statusLabel('content', page.status, locale)}
            </Badge>
            {sitePage ? <Badge tone="info">{words.sitePage}</Badge> : null}
          </div>

          <p className="mt-3 text-sm text-muted">
            {published ? words.liveNote : words.draftNote}{' '}
            {published ? (
              <a
                href={pagePathForSlug(page.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue underline"
              >
                {words.view}
              </a>
            ) : null}
          </p>

          <div className="mt-4 space-y-2">
            {published ? (
              <Button
                type="button"
                className="w-full"
                disabled={busy}
                onClick={() => submit('save')}
              >
                {busy ? t.admin.common.saving : words.update}
              </Button>
            ) : canPublish ? (
              <Button
                type="button"
                className="w-full"
                disabled={busy}
                onClick={() => submit('publish')}
              >
                {busy ? words.publishing : words.publish}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={busy}
                onClick={() => submit('save')}
              >
                {busy ? t.admin.common.saving : words.saveDraft}
              </Button>
            )}

            {mayManage
              ? moves.map((move) => (
                  <Button
                    key={move.to}
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void transition(move.to)}
                  >
                    {words[move.label]}
                  </Button>
                ))
              : null}
          </div>

          {!published && !mayPublish ? (
            <p className="mt-3 text-xs text-muted">{words.publishNeedsRight}</p>
          ) : null}
          {sitePage ? <p className="mt-3 text-xs text-muted">{words.sitePageNote}</p> : null}
        </Card>

        <SeoAnalysisPanel
          formId="page-editor"
          kind="page"
          recordId={page.id}
          featuredImage={image.analysisInput}
          fields={SEO_FIELDS}
        />

        <Card className="p-5">
          <p className="font-bold text-navy">{words.language}</p>
          <p className="mt-1 text-sm text-muted">
            {english ? words.englishVersion : words.bengaliVersion}
          </p>

          {counterpart ? (
            <Link
              href={`/dashboard/pages/${counterpart.id}`}
              className="mt-3 inline-block text-sm font-semibold text-blue underline"
            >
              {english ? words.editBengali : words.editEnglish}
            </Link>
          ) : english ? null : (
            <>
              <p className="mt-3 text-xs text-muted">{words.englishMissing}</p>
              {mayManage ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={busy}
                  onClick={() => void createEnglish()}
                >
                  {busy ? words.creatingEnglish : words.createEnglish}
                </Button>
              ) : null}
            </>
          )}
        </Card>

        {page.template === 'legal' ? (
          <Card className="p-5">
            <p className="font-bold text-navy">{words.legalTitle}</p>
            <p className="mt-1 text-xs text-muted">{words.legalBody}</p>

            {page.legal_reviewer ? (
              <p className="mt-3 text-sm">
                {words.reviewedBy}: <strong>{page.legal_reviewer}</strong>
                {page.legal_reviewed_at ? ` · ${date(page.legal_reviewed_at, locale)}` : null}
              </p>
            ) : null}

            {mayPublish ? (
              page.legal_reviewer ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={busy}
                  onClick={() => void recordReview(false)}
                >
                  {words.clearReview}
                </Button>
              ) : (
                <div className="mt-3 space-y-2">
                  <Field label={words.reviewer}>
                    {(props) => (
                      <Input
                        {...props}
                        value={reviewer}
                        onChange={(event) => setReviewer(event.target.value)}
                      />
                    )}
                  </Field>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void recordReview(true)}
                  >
                    {words.markReviewed}
                  </Button>
                </div>
              )
            ) : null}
          </Card>
        ) : null}

        {!sitePage && mayManage ? (
          <Button
            type="button"
            variant="danger"
            className="w-full"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? words.removing : words.remove}
          </Button>
        ) : null}
      </aside>
    </div>
  );
}
