import type { Metadata } from 'next';
import type { CourseSummary } from '@nuruzzaman/contracts';

import { CourseCard } from '@/features/courses/course-card';
import { COURSE_TRACKS, TrackFilter } from '@/features/courses/track-filter';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { publicApi } from '@/lib/api/server';
import { buildMetadata, itemListSchema, jsonLd } from '@/lib/seo';

/**
 * A track view is a real category page, so it gets its own title and canonical.
 * Paged views canonicalise to page one, which is the URL worth indexing.
 */
export async function generateMetadata(props: {
  searchParams: Promise<{ track?: string }>;
}): Promise<Metadata> {
  const { track } = await props.searchParams;
  const active = COURSE_TRACKS.find((entry) => entry.slug === track);

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

export default async function CoursesPage(props: {
  searchParams: Promise<{ page?: string; level?: string; track?: string }>;
}) {
  const searchParams = await props.searchParams;
  const activeTrack = COURSE_TRACKS.find((track) => track.slug === searchParams.track);

  const courses = await publicApi<{
    data: CourseSummary[];
    meta?: { current_page?: number; last_page?: number };
  }>('/courses', {
    query: {
      page: searchParams.page,
      level: searchParams.level,
      track: searchParams.track,
      per_page: 12,
    },
    tags: ['courses'],
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
                  path: `/courses/${course.slug}`,
                })),
              ),
            ),
          }}
        />
      ) : null}

      <Container className="py-10 sm:py-14">
        <Breadcrumbs
          trail={[
            { name: 'হোম', path: '/' },
            { name: 'কোর্স', path: '/courses' },
          ]}
        />

        <header className="mt-6 max-w-3xl">
          <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
            {activeTrack ? activeTrack.name : 'কোর্স'}
          </h1>
          <p className="mt-3 text-muted">
            প্রতিটি কোর্স একটি বাস্তব কাজের ক্রম ধরে সাজানো। কোনো কোর্স প্রকৃত লেসন যুক্ত
            না হওয়া পর্যন্ত তালিকাভুক্ত করা হয় না।
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
            title={activeTrack ? 'এই ট্র্যাকে এখনো কোর্স নেই' : 'কোর্স এখনো প্রকাশিত হয়নি'}
            description={
              activeTrack
                ? 'অন্য ট্র্যাক দেখুন, অথবা ব্লগে এই বিষয়ের লেখা পড়ুন।'
                : 'কোনো কোর্স প্রকৃত লেসন যুক্ত না হওয়া পর্যন্ত এখানে দেখানো হয় না।'
            }
            action={
              <ButtonLink href={activeTrack ? '/courses' : '/blog'} variant="secondary">
                {activeTrack ? 'সব কোর্স দেখুন' : 'ততক্ষণে ব্লগ পড়ুন'}
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
