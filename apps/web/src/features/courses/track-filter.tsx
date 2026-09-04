'use client';

import { LocaleLink } from '@/components/ui/locale-link';
import { cn } from '@/lib/cn';
import { taxonomyLabel } from '@/lib/i18n/labels';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * The catalogue's subject tracks. Mirrors CourseTracks on the API side; the
 * slugs are the contract between the two and also key the generated cover
 * artwork. The display names live in the dictionary, so the filter reads in
 * whichever language the visitor is browsing in.
 */
export const COURSE_TRACK_SLUGS = [
  'foundation-geotechnical',
  'rcc-design-detailing',
  'structural-engineering',
  'steel-design',
  'autocad-productivity',
  'engineering-software',
  'bnbc-code-application',
  'construction-quality',
  'quantity-estimation',
  'mouza-drawing-workflow',
] as const;

/**
 * Track filter rendered as links rather than a client-side control, so each
 * filtered view has its own shareable URL.
 */
export function TrackFilter({ active }: { active?: string }) {
  const { locale, t } = useLocale();
  const options = [
    { slug: '', name: t.taxonomy.trackFilter },
    ...COURSE_TRACK_SLUGS.map((slug) => ({
      slug,
      name: taxonomyLabel(t, slug, null, locale),
    })),
  ];

  return (
    <nav aria-label={t.taxonomy.filterLabel} className="mt-6">
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = (active ?? '') === option.slug;

          return (
            <li key={option.slug || 'all'}>
              <LocaleLink
                href={option.slug ? `/courses?track=${option.slug}` : '/courses'}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-block rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'border-blue bg-blue text-white'
                    : 'border-line bg-white text-navy hover:border-blue hover:text-blue',
                )}
              >
                {option.name}
              </LocaleLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
