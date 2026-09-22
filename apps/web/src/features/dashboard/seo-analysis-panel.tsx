'use client';

import { useEffect, useMemo, useState } from 'react';

import { analyzeSeo, type CheckStatus, type SeoInput } from '@/lib/seo-analysis/analyze';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { absoluteUrl } from '@/lib/env';
import { number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { brand, pagePathForSlug } from '@/lib/site';

/**
 * Item-wise SEO analysis, live as the author types.
 *
 * It reads the editor's own form rather than duplicating its state: the fields
 * are uncontrolled, and mirroring every one into React would mean two sources
 * of truth that can disagree. An `input` listener on the form is enough, and it
 * keeps working if a field is added later.
 *
 * The list matters more than the score — a number invites chasing 100, which is
 * not the goal. Warnings are suggestions and say so.
 *
 * No focus keyword, no score. The score is an average over the checks, and the
 * keyword checks are the ones that measure whether the page is about anything
 * in particular; without them the remaining length-and-structure checks can put
 * a comfortable 73 on a page with no subject at all. A missing number is
 * honest; that one is not.
 */

const STATUS_DOTS: Record<CheckStatus, string> = {
  pass: 'bg-success',
  warn: 'bg-warning',
  fail: 'bg-danger',
};

/** Where each kind of record is read on the site. */
function publicPath(kind: SeoInput['kind'], slug: string): string {
  switch (kind) {
    case 'post':
      return `/blog/${slug}`;
    case 'course':
      return `/courses/${slug}`;
    case 'product':
      return `/products/${slug}`;
    case 'page':
      return pagePathForSlug(slug);
  }
}

/** Cut to what a search result shows, counting Bengali letters as one each. */
function clip(text: string, limit: number): string {
  const letters = Array.from(text.trim());

  return letters.length > limit ? `${letters.slice(0, limit - 1).join('').trimEnd()}…` : text.trim();
}

/**
 * Roughly how the record appears as a Google result: the title with the
 * brand the layout appends, the address, and the description - or the
 * site-wide one that goes out when none was written.
 *
 * Built from the same values the page's metadata is, so it shows what will
 * actually be sent; how Google then words the result is up to Google.
 */
function SearchPreview({ values }: { values: SeoInput }) {
  const { t } = useLocale();
  const words = t.admin.seoPanel;
  const title = (values.metaTitle || values.title).trim();
  const fullTitle = title.includes(brand.owner) ? title : `${title} — ${brand.owner}`;
  const written = (values.metaDescription || values.excerpt || '').trim();
  const path = publicPath(values.kind, values.slug.trim() || '…');
  const host = new URL(absoluteUrl('/')).host;
  const crumbs = [host, ...path.split('/').filter(Boolean)].join(' › ');

  return (
    <div className="border-b border-line px-5 py-4">
      <h3 className="text-xs font-bold tracking-wide text-muted uppercase">{words.preview}</h3>
      <div className="mt-3 rounded-lg border border-line bg-white p-3" data-testid="search-preview">
        <p className="font-latin truncate text-xs text-[#202124]">{crumbs}</p>
        <p className="mt-1 text-base leading-snug text-[#1a0dab]">{clip(fullTitle, 60)}</p>
        <p className="mt-1 text-sm leading-snug text-[#4d5156]">
          {clip(written || brand.heroSupport, 160)}
        </p>
      </div>
      {written ? null : <p className="mt-2 text-xs text-warning">{words.previewNoDescription}</p>}
      <p className="mt-2 text-xs text-muted">{words.previewNote}</p>
    </div>
  );
}

/** Reads a named field out of the editor form. */
function readField(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);

  if (!field) {
    return '';
  }

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value;
  }

  if (field instanceof HTMLSelectElement) {
    return field.value;
  }

  return '';
}

export function SeoAnalysisPanel({
  formId,
  kind,
  recordId,
  featuredImage,
  fields,
}: {
  /** The editor form to read from. */
  formId: string;
  kind: SeoInput['kind'];
  /**
   * This record's id. Without it the keyword-reuse check is skipped rather
   * than reporting the record's own keyword back as a clash with itself.
   */
  recordId?: number;
  /**
   * The featured image, where the editor can set one. Left out, the check is
   * skipped rather than failing a page that has no way to add an image.
   */
  featuredImage?: { alt: string | null } | null;
  /** Field names in that form, since each editor names them differently. */
  fields: {
    title: string;
    slug: string;
    content: string;
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    excerpt?: string;
  };
}) {
  const { locale, t } = useLocale();
  const [values, setValues] = useState<SeoInput | null>(null);
  const [usedBy, setUsedBy] = useState<{ keyword: string; rows: { title: string }[] } | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const read = () =>
      setValues({
        kind,
        title: readField(form, fields.title),
        slug: readField(form, fields.slug),
        content: readField(form, fields.content),
        metaTitle: readField(form, fields.metaTitle),
        metaDescription: readField(form, fields.metaDescription),
        focusKeyword: readField(form, fields.focusKeyword),
        excerpt: fields.excerpt ? readField(form, fields.excerpt) : undefined,
      });

    read();
    form.addEventListener('input', read);

    return () => form.removeEventListener('input', read);
  }, [formId, kind, fields]);

  const keyword = values?.focusKeyword.trim() ?? '';

  /*
    Whether anything else already targets this keyword is a question only the
    database can answer, so it is asked here rather than inside analyzeSeo,
    which stays a pure function of what the author typed.

    Debounced, because the panel re-reads the form on every keystroke and a
    keyword is typed one letter at a time. An answer is kept alongside the
    keyword it was for, so a stale reply cannot be shown against a newer word.
  */
  useEffect(() => {
    // Nothing to clear here: the answer is stored with the keyword it was for,
    // and the memo below ignores it unless the two still match.
    if (!keyword || recordId === undefined) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await api<{ data: { used_by: { title: string }[] } }>(
            '/admin/seo/keyword-usage',
            { query: { keyword, kind, id: recordId }, signal: controller.signal },
          );

          setUsedBy({ keyword, rows: response.data.used_by });
        } catch {
          // The check is skipped when the lookup fails; an author should not be
          // told their keyword is unique because a request timed out.
          setUsedBy(null);
        }
      })();
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [keyword, kind, recordId]);

  const analysis = useMemo(
    () =>
      values
        ? analyzeSeo(
            {
              ...values,
              keywordUsedBy: usedBy?.keyword === keyword ? usedBy.rows : undefined,
              featuredImage,
            },
            t,
          )
        : null,
    [values, usedBy, keyword, featuredImage, t],
  );

  if (!analysis) {
    return null;
  }

  const tone =
    analysis.score >= 80 ? 'text-success' : analysis.score >= 50 ? 'text-warning' : 'text-danger';
  const scored = !analysis.keywordMissing;

  return (
    <section
      aria-label={t.admin.seoPanel.title}
      className="rounded-[--radius-card] border border-line bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-bold text-navy">{t.admin.seoPanel.title}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {t.admin.seoPanel.summary
              .replace('{passed}', number(analysis.passed, locale))
              .replace('{warned}', number(analysis.warned, locale))
              .replace('{failed}', number(analysis.failed, locale))}
          </p>
        </div>
        {scored ? (
          <p className={cn('text-3xl font-bold', tone)}>{number(analysis.score, locale)}</p>
        ) : (
          <p className="max-w-[11rem] text-end text-xs font-semibold text-muted">
            {t.admin.seoPanel.scoreLocked}
            <span className="mt-0.5 block font-normal">
              {t.admin.seoPanel.scoreLockedHint}
            </span>
          </p>
        )}
      </header>

      {values ? <SearchPreview values={values} /> : null}

      {analysis.keywordMissing ? (
        <p className="border-b border-line bg-amber-soft px-5 py-3 text-sm text-navy">
          {t.admin.seoPanel.noKeyword}
        </p>
      ) : null}

      <div className="divide-y divide-line">
        {analysis.groups
          .filter((group) => group.checks.length > 0)
          .map((group) => (
            <div key={group.id} className="px-5 py-4">
              <h3 className="text-xs font-bold tracking-wide text-muted uppercase">
                {group.heading}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {group.checks.map((check) => (
                  <li key={check.id} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1.5 size-2.5 shrink-0 rounded-full',
                        STATUS_DOTS[check.status],
                      )}
                    />
                    <span className="min-w-0">
                      <span className="sr-only">
                        {t.admin.seoPanel[check.status]}:{' '}
                      </span>
                      <span className="text-sm text-navy">{check.message}</span>
                      {check.hint ? (
                        <span className="mt-0.5 block text-xs text-muted">{check.hint}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        {t.admin.seoPanel.disclaimer}
      </p>
    </section>
  );
}
