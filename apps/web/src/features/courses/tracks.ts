/**
 * The catalogue's subject tracks. Mirrors CourseTracks on the API side; the
 * slugs are the contract between the two and also key the generated cover
 * artwork. The display names live in the dictionary, so the filter reads in
 * whichever language the visitor is browsing in.
 *
 * Deliberately not in track-filter.tsx. That file is a client component, and a
 * plain value exported from a 'use client' module is replaced by a client
 * reference when a server component imports it - so the array arrived on the
 * server as a proxy with no methods, and reading a track from the query string
 * threw `COURSE_TRACK_SLUGS.includes is not a function`. Keeping the constant
 * in a module with no directive lets both sides import the same array.
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

export type CourseTrackSlug = (typeof COURSE_TRACK_SLUGS)[number];

/** Whether a value from a URL names a real track. */
export function isCourseTrack(value: string | undefined): value is CourseTrackSlug {
  return Boolean(value) && COURSE_TRACK_SLUGS.includes(value as CourseTrackSlug);
}
