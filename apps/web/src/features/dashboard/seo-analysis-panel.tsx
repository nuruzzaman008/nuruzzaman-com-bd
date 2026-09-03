'use client';

import { useEffect, useMemo, useState } from 'react';

import { analyzeSeo, type CheckStatus, type SeoInput } from '@/lib/seo-analysis/analyze';
import { cn } from '@/lib/cn';

/**
 * Item-wise SEO analysis, live as the author types.
 *
 * It reads the editor's own form rather than duplicating its state: the fields
 * are uncontrolled, and mirroring every one into React would mean two sources
 * of truth that can disagree. An `input` listener on the form is enough, and it
 * keeps working if a field is added later.
 *
 * The score is shown, but the list matters more — a number invites chasing 100,
 * which is not the goal. Warnings are suggestions and say so.
 */

const STATUS_STYLES: Record<CheckStatus, { dot: string; label: string }> = {
  pass: { dot: 'bg-success', label: 'ঠিক আছে' },
  warn: { dot: 'bg-warning', label: 'বিবেচনা করুন' },
  fail: { dot: 'bg-danger', label: 'সমস্যা' },
};

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
  fields,
}: {
  /** The editor form to read from. */
  formId: string;
  kind: SeoInput['kind'];
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
  const [values, setValues] = useState<SeoInput | null>(null);

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

  const analysis = useMemo(() => (values ? analyzeSeo(values) : null), [values]);

  if (!analysis) {
    return null;
  }

  const tone =
    analysis.score >= 80 ? 'text-success' : analysis.score >= 50 ? 'text-warning' : 'text-danger';

  return (
    <section
      aria-label="SEO বিশ্লেষণ"
      className="rounded-[--radius-card] border border-line bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-bold text-navy">SEO বিশ্লেষণ</h2>
          <p className="mt-0.5 text-xs text-muted">
            {analysis.passed} ঠিক · {analysis.warned} বিবেচনা · {analysis.failed} সমস্যা
          </p>
        </div>
        <p className={cn('font-latin text-3xl font-bold', tone)}>{analysis.score}</p>
      </header>

      {analysis.keywordMissing ? (
        <p className="border-b border-line bg-amber-soft px-5 py-3 text-sm text-navy">
          ফোকাস কিওয়ার্ড দিলে কিওয়ার্ড-ভিত্তিক চেকগুলোও চালু হবে। এখন শুধু দৈর্ঘ্য ও
          গঠনের চেক দেখানো হচ্ছে।
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
                        STATUS_STYLES[check.status].dot,
                      )}
                    />
                    <span className="min-w-0">
                      <span className="sr-only">{STATUS_STYLES[check.status].label}: </span>
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
        এগুলো পরিচ্ছন্নতার চেক — কোনো র‍্যাঙ্কিংয়ের প্রতিশ্রুতি নয়। সব সবুজ হলেই লেখা
        ভালো হয়ে যায় না, আর কিছু হলুদ থাকলেও সমস্যা নেই।
      </p>
    </section>
  );
}
