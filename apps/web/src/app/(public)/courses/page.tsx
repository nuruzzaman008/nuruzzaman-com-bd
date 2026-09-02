import type { Metadata } from 'next';
import type { CourseSummary } from '@nuruzzaman/contracts';

import { CourseCard } from '@/features/courses/course-card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { publicApi } from '@/lib/api/server';
import { buildMetadata, itemListSchema, jsonLd } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'কোর্স — বাংলায় প্র্যাকটিক্যাল ইঞ্জিনিয়ারিং',
  description:
    'AutoCAD প্রোডাক্টিভিটি, RCC ডিজাইন ও NB Engineering Tools নিয়ে বাংলায় ধাপে ধাপে কোর্স।',
  path: '/courses',
});

export default async function CoursesPage(props: {
  searchParams: Promise<{ page?: string; level?: string }>;
}) {
  const searchParams = await props.searchParams;

  const courses = await publicApi<{
    data: CourseSummary[];
    meta?: { current_page?: number; last_page?: number };
  }>('/courses', {
    query: { page: searchParams.page, level: searchParams.level, per_page: 12 },
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
          <h1 className="text-[length:var(--step-h1)] font-bold text-navy">কোর্স</h1>
          <p className="mt-3 text-muted">
            প্রতিটি কোর্স একটি বাস্তব কাজের ক্রম ধরে সাজানো। কোনো কোর্স প্রকৃত লেসন যুক্ত
            না হওয়া পর্যন্ত তালিকাভুক্ত করা হয় না।
          </p>
        </header>

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
            title="কোর্স এখনো প্রকাশিত হয়নি"
            description="তিনটি কোর্স তৈরি হচ্ছে: NB Engineering Tools ওয়ার্কফ্লো, AutoCAD প্রোডাক্টিভিটি এবং RCC ফুটিং ডিজাইন। প্রকৃত লেসন প্রস্তুত হলে এখানে যুক্ত হবে।"
            action={
              <ButtonLink href="/blog" variant="secondary">
                ততক্ষণে ব্লগ পড়ুন
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
