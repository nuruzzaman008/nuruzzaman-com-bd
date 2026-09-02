import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, type Course } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { PriceTag } from '@/components/ui/price';
import { Prose } from '@/components/ui/prose';
import { publicApi } from '@/lib/api/server';
import { date, duration, number } from '@/lib/format';
import { buildMetadata, courseSchema, jsonLd } from '@/lib/seo';

async function loadCourse(slug: string): Promise<Course> {
  try {
    const response = await publicApi<{ data: Course }>(`/courses/${encodeURIComponent(slug)}`, {
      tags: ['courses', `course:${slug}`],
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const course = await loadCourse(slug);

  return buildMetadata({
    title: course.title,
    description: course.subtitle,
    path: `/courses/${course.slug}`,
    image: course.cover_url,
    seo: course.seo,
  });
}

function FactList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-[length:var(--step-h3)] font-bold text-navy">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function CoursePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const course = await loadCourse(slug);

  const purchasable = course.variants?.find((variant) => variant.is_purchasable) ?? null;
  const previewLesson = course.sections
    ?.flatMap((section) => section.lessons)
    .find((lesson) => lesson.is_free_preview);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            courseSchema({
              title: course.title,
              slug: course.slug,
              subtitle: course.subtitle,
              language: course.language,
              cover_url: course.cover_url,
              rating: course.rating ?? null,
              instructors: course.instructors,
            }),
          ),
        }}
      />

      <Container className="py-10 sm:py-14">
        <Breadcrumbs
          trail={[
            { name: 'হোম', path: '/' },
            { name: 'কোর্স', path: '/courses' },
            { name: course.title, path: `/courses/${course.slug}` },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <header>
              <div className="flex flex-wrap gap-2">
                <Badge tone="teal">{course.language}</Badge>
                {course.issues_certificate ? <Badge tone="info">সার্টিফিকেট</Badge> : null}
                {course.sequential ? <Badge>ধারাবাহিক</Badge> : null}
              </div>

              <h1 className="mt-3 text-[length:var(--step-h1)] leading-tight font-bold text-navy">
                {course.title}
              </h1>

              {course.subtitle ? <p className="mt-4 text-lg text-muted">{course.subtitle}</p> : null}

              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {course.lesson_count ? <span>{number(course.lesson_count)} টি লেসন</span> : null}
                {course.estimated_minutes ? (
                  <span>{duration(course.estimated_minutes * 60)}</span>
                ) : null}
                {course.last_reviewed_at ? (
                  <span>সর্বশেষ পর্যালোচনা: {date(course.last_reviewed_at)}</span>
                ) : null}
              </p>
            </header>

            {course.cover_url ? (
              <Image
                src={course.cover_url}
                alt=""
                width={1200}
                height={630}
                sizes="(min-width: 1024px) 700px, 100vw"
                priority
                className="mt-8 aspect-[1200/630] w-full rounded-[--radius-card] border border-line object-cover"
              />
            ) : null}

            {course.description_html ? (
              <Prose html={course.description_html} className="mt-8" />
            ) : null}

            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <FactList title="কী শিখবেন" items={course.outcomes ?? []} />
              <FactList title="কাদের জন্য" items={course.audience ?? []} />
              <FactList title="পূর্বশর্ত" items={course.prerequisites ?? []} />
              <FactList title="প্রয়োজনীয় সফটওয়্যার" items={course.required_software ?? []} />
            </div>

            {course.sections?.length ? (
              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">কারিকুলাম</h2>
                <ol className="mt-5 space-y-4">
                  {course.sections.map((section, index) => (
                    <li key={section.id}>
                      <Card className="p-5">
                        <h3 className="font-bold text-navy">
                          <span className="font-latin text-muted">{number(index + 1)}.</span>{' '}
                          {section.title}
                        </h3>
                        {section.summary ? (
                          <p className="mt-1 text-sm text-muted">{section.summary}</p>
                        ) : null}

                        {section.lessons.length > 0 ? (
                          <ul className="mt-3 divide-y divide-line border-t border-line">
                            {section.lessons.map((lesson) => (
                              <li
                                key={lesson.slug}
                                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                              >
                                <span>{lesson.title}</span>
                                <span className="flex items-center gap-2 text-muted">
                                  {lesson.duration_seconds ? duration(lesson.duration_seconds) : null}
                                  {lesson.is_free_preview ? (
                                    <Badge tone="success">ফ্রি প্রিভিউ</Badge>
                                  ) : null}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-muted">
                            এই মডিউলের লেসন এখনো যুক্ত করা হয়নি।
                          </p>
                        )}
                      </Card>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {course.reviews?.length ? (
              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  শিক্ষার্থীদের রিভিউ
                </h2>
                <p className="mt-1 text-sm text-muted">
                  শুধু যাচাইকৃত এনরোলমেন্ট থেকে দেওয়া রিভিউ প্রকাশ করা হয়।
                </p>
                <ul className="mt-5 space-y-4">
                  {course.reviews.map((review) => (
                    <li key={review.id}>
                      <Card className="p-5">
                        <p className="text-sm font-semibold text-navy">
                          {review.title ?? 'রিভিউ'}{' '}
                          <span className="font-latin text-muted">({review.rating}/5)</span>
                        </p>
                        {review.body ? <p className="mt-2 text-sm">{review.body}</p> : null}
                        <p className="mt-3 text-xs text-muted">
                          {review.author_name ?? 'শিক্ষার্থী'} · যাচাইকৃত এনরোলমেন্ট
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="p-6">
              <PriceTag value={purchasable?.price ?? null} size="lg" />

              <div className="mt-5 space-y-3">
                {purchasable ? (
                  <ButtonLink href={`/shop?variant=${purchasable.id}`} className="w-full">
                    কোর্সে ভর্তি হন
                  </ButtonLink>
                ) : (
                  <Callout tone="info">
                    এই কোর্সের এনরোলমেন্ট এখনো খোলা হয়নি। দাম ও ভর্তির তারিখ প্রকাশিত হলে
                    এখানে দেখা যাবে।
                  </Callout>
                )}

                {previewLesson ? (
                  <ButtonLink
                    href={`/courses/${course.slug}/preview/${previewLesson.slug}`}
                    variant="secondary"
                    className="w-full"
                  >
                    ফ্রি প্রিভিউ দেখুন
                  </ButtonLink>
                ) : null}
              </div>

              <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">অ্যাক্সেস</dt>
                  <dd className="text-end font-medium text-navy">
                    {course.access_duration_days
                      ? `${number(course.access_duration_days)} দিন`
                      : 'মেয়াদ প্রকাশিত হয়নি'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">সার্টিফিকেট</dt>
                  <dd className="text-end font-medium text-navy">
                    {course.issues_certificate ? 'কোর্স সম্পূর্ণ করলে' : 'নেই'}
                  </dd>
                </div>
                {course.support_policy ? (
                  <div>
                    <dt className="text-muted">সাপোর্ট</dt>
                    <dd className="mt-1 text-navy">{course.support_policy}</dd>
                  </div>
                ) : null}
                {course.refund_policy ? (
                  <div>
                    <dt className="text-muted">রিফান্ড</dt>
                    <dd className="mt-1 text-navy">{course.refund_policy}</dd>
                  </div>
                ) : null}
              </dl>

              <p className="mt-5 text-xs text-muted">
                সার্টিফিকেট কেবল কোর্স সম্পন্ন হওয়ার প্রমাণ; এটি কোনো পেশাগত লাইসেন্স নয়।{' '}
                <Link href="/course-terms" className="underline">
                  কোর্স শর্তাবলি
                </Link>
              </p>
            </Card>
          </aside>
        </div>
      </Container>
    </>
  );
}
