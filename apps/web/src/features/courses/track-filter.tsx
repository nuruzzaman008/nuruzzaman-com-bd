import Link from 'next/link';

import { cn } from '@/lib/cn';

/**
 * The catalogue's subject tracks. Mirrors App\Support\CourseTracks on the API
 * side; the slugs are the contract between the two and also key the generated
 * cover artwork.
 */
export const COURSE_TRACKS: { slug: string; name: string }[] = [
  { slug: 'foundation-geotechnical', name: 'ফাউন্ডেশন ও জিওটেকনিক্যাল' },
  { slug: 'rcc-design-detailing', name: 'RCC ডিজাইন ও ডিটেইলিং' },
  { slug: 'structural-engineering', name: 'স্ট্রাকচারাল অ্যানালাইসিস' },
  { slug: 'steel-design', name: 'স্টিল স্ট্রাকচার ডিজাইন' },
  { slug: 'autocad-productivity', name: 'AutoCAD ও ড্রাফটিং' },
  { slug: 'engineering-software', name: 'ইঞ্জিনিয়ারিং সফটওয়্যার' },
  { slug: 'bnbc-code-application', name: 'BNBC ও কোড প্রয়োগ' },
  { slug: 'construction-quality', name: 'নির্মাণ মান ও সাইট প্র্যাকটিস' },
  { slug: 'quantity-estimation', name: 'কোয়ান্টিটি ও এস্টিমেট' },
  { slug: 'mouza-drawing-workflow', name: 'মৌজা ম্যাপ ও ল্যান্ড ড্রয়িং' },
];

/**
 * Track filter rendered as links rather than a client-side control, so it works
 * without JavaScript and each filtered view has its own shareable URL.
 */
export function TrackFilter({ active }: { active?: string }) {
  const options = [{ slug: '', name: 'সব ট্র্যাক' }, ...COURSE_TRACKS];

  return (
    <nav aria-label="বিষয় অনুযায়ী ফিল্টার" className="mt-6">
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = (active ?? '') === option.slug;

          return (
            <li key={option.slug || 'all'}>
              <Link
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
