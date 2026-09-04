import type { Metadata } from 'next';
import type { CourseSummary } from '@nuruzzaman/contracts';

import { CourseCard } from '@/features/courses/course-card';
import { COURSE_TRACK_SLUGS, TrackFilter } from '@/features/courses/track-filter';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { publicApi } from '@/lib/api/server';
import { buildMetadata, itemListSchema, jsonLd } from '@/lib/seo';
import { taxonomyLabel } from '@/lib/i18n/labels';
import { localizePath } from '@/lib/i18n/locale';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';

/**
 * A track view is a real category page, so it gets its own title and canonical.
 * Paged views canonicalise to page one, which is the URL worth indexing.
 */
export async function generateMetadata(
  props: LocalizedPageProps & { searchParams: Promise<{ track?: string }> },
): Promise<Metadata> {
  const { locale, t } = pageDictionary(props.locale);
  const { track } = await props.searchParams;
  const active =
    track && COURSE_TRACK_SLUGS.includes(track as never)
      ? { slug: track, name: taxonomyLabel(t, track, null, locale) }
      : null;

  if (!active) {
    return buildMetadata({
      title: 'কোর্স — বাংলায় প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং',
      description:
        'ফাউন্ডেশন, RCC ডিজাইন, কোয়ান্টিটি এস্টিমেট, AutoCAD প্রোডাক্টিভিটি ও NB Engineering Tools নিয়ে বাংলায় ধাপে ধাপে কোর্স।',
      path: '/courses',
    });
  }

  return buildMetadata({
    title: `${active.name} — কোর্স`,
    description: `${active.name} বিষয়ে বাংলায় প্র্যাকটিক্যাল কোর্স। প্রতিটি লেসনে অ্যাজাম্পশন ও সীমাবদ্ধতা স্পষ্ট করে লেখা।`,
    path: `/courses?track=${active.slug}`,
  });
}

export default async function CoursesPage(
  props: LocalizedPageProps & {
    searchParams: Promise<{ page?: string; level?: string; track?: string }>;
  },
) {
  const { locale, t } = pageDictionary(props.locale);
  const searchParams = await props.searchParams;
  const activeTrackName =
    searchParams.track && COURSE_TRACK_SLUGS.includes(searchParams.track as never)
      ? taxonomyLabel(t, searchParams.track, null, locale)
      : null;

  const courses = await publicApi<{
    data: CourseSummary[];
    meta?: { current_page?: number; last_page?: number };
  }>('/courses', {
    query: {
      page: searchParams.page,
      level: searchParams.level,
      track: searchParams.track,
      per_page: 12,
      locale,
    },
    tags: ['courses', `courses:${locale}`],
  });

  return (
    <>
      {courses.data.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              itemListSchema(
                courses.data.map((course) => ({
                  name: course.title,
                  path: localizePath(`/courses/${course.slug}`, locale),
                })),
              ),
            ),
          }}
        />
      ) : null}

      <Container className="py-10 sm:py-14">
        <Breadcrumbs
          trail={[
            { name: t.common.home, path: '/' },
            { name: t.courses.heading, path: '/courses' },
          ]}
        />

        <header className="mt-6 max-w-3xl">
          <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
            {activeTrackName ?? t.courses.heading}
          </h1>
          <p className="mt-3 text-muted">
            {t.courses.intro}
          </p>
        </header>

        <TrackFilter active={searchParams.track} />

        {courses.data.length > 0 ? (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.data.map((course) => (
              <li key={course.slug} className="contents">
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-8"
            title={activeTrackName ? t.courses.emptyTrackTitle : t.courses.emptyTitle}
            description={
              activeTrackName
                ? t.courses.emptyTrackDescription
                : t.courses.emptyDescription
            }
            action={
              <ButtonLink href={activeTrackName ? '/courses' : '/blog'} variant="secondary">
                {activeTrackName ? t.courses.seeAll : t.courses.readBlog}
              </ButtonLink>
            }
          />
        )}

        <Pagination
          meta={courses.meta}
          basePath="/courses"
          searchParams={searchParams as Record<string, string | undefined>}
        />
      </Container>
    </>
  );
}
