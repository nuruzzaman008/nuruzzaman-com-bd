import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ApiError, type Course } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { LocaleLink } from '@/components/ui/locale-link';
import { PriceTag } from '@/components/ui/price';
import { Prose } from '@/components/ui/prose';
import { publicApi } from '@/lib/api/server';
import { counted, date, duration, number } from '@/lib/format';
import { pageDictionary, type LocalizedPageProps } from '@/lib/i18n/page';
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
      <ul data-authored="true" className="mt-3 space-y-2 text-sm">
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

export default async function CoursePage(
  props: LocalizedPageProps & { params: Promise<{ slug: string }> },
) {
  const { locale, t } = pageDictionary(props.locale);
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
            { name: t.common.home, path: '/' },
            { name: t.nav.courses, path: '/courses' },
            { name: course.title, path: `/courses/${course.slug}`, authored: true },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <header>
              <div className="flex flex-wrap gap-2">
                <Badge tone="teal">{course.language}</Badge>
                {course.issues_certificate ? (
                  <Badge tone="info">{t.ui.certificate}</Badge>
                ) : null}
                {course.sequential ? <Badge>{t.course.sequential}</Badge> : null}
              </div>

              <h1
                data-authored="true"
                className="mt-3 text-[length:var(--step-h1)] leading-tight font-bold text-navy"
              >
                {course.title}
              </h1>

              {course.subtitle ? (
                <p data-authored="true" className="mt-4 text-lg text-muted">
                  {course.subtitle}
                </p>
              ) : null}

              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {course.lesson_count ? (
                  <span>{counted(course.lesson_count, 'lesson', locale)}</span>
                ) : null}
                {course.estimated_minutes ? (
                  <span>{duration(course.estimated_minutes * 60, locale)}</span>
                ) : null}
                {course.last_reviewed_at ? (
                  <span>
                    {t.course.lastReviewed}: {date(course.last_reviewed_at, locale)}
                  </span>
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
              <FactList title={t.course.outcomes} items={course.outcomes ?? []} />
              <FactList title={t.course.audience} items={course.audience ?? []} />
              <FactList title={t.course.prerequisites} items={course.prerequisites ?? []} />
              <FactList
                title={t.course.requiredSoftware}
                items={course.required_software ?? []}
              />
            </div>

            {course.sections?.length ? (
              <section className="mt-12">
                <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
                  {t.course.curriculum}
                </h2>
                <ol data-authored="true" className="mt-5 space-y-4">
                  {course.sections.map((section, index) => (
                    <li key={section.id}>
                      <Card className="p-5">
                        <h3 className="font-bold text-navy">
                          <span className="font-latin text-muted">{number(index + 1, locale)}.</span>{' '}
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
                                  {lesson.duration_seconds
                                    ? duration(lesson.duration_seconds, locale)
                                    : null}
                                  {lesson.is_free_preview ? (
                                    <Badge tone="success">{t.course.freePreview}</Badge>
                                  ) : null}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-muted">{t.course.noLessons}</p>
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
                  {t.course.reviewsHeading}
                </h2>
                <p className="mt-1 text-sm text-muted">{t.course.reviewsNote}</p>
                <ul data-authored="true" className="mt-5 space-y-4">
                  {course.reviews.map((review) => (
                    <li key={review.id}>
                      <Card className="p-5">
                        <p className="text-sm font-semibold text-navy">
                          {review.title ?? t.course.reviewFallbackTitle}{' '}
                          <span className="font-latin text-muted">({review.rating}/5)</span>
                        </p>
                        {review.body ? <p className="mt-2 text-sm">{review.body}</p> : null}
                        <p className="mt-3 text-xs text-muted">
                          {review.author_name ?? t.course.reviewFallbackAuthor} ·{' '}
                          {t.course.verifiedEnrollment}
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
                    {t.course.enroll}
                  </ButtonLink>
                ) : (
                  <Callout tone="info">
                    {t.course.enrollClosed}
                  </Callout>
                )}

                {previewLesson ? (
                  <ButtonLink
                    href={`/courses/${course.slug}/preview/${previewLesson.slug}`}
                    variant="secondary"
                    className="w-full"
                  >
                    {t.course.watchPreview}
                  </ButtonLink>
                ) : null}
              </div>

              <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t.course.access}</dt>
                  <dd className="text-end font-medium text-navy">
                    {course.access_duration_days
                      ? `${number(course.access_duration_days, locale)} ${t.course.days}`
                      : t.course.accessUnpublished}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t.ui.certificate}</dt>
                  <dd className="text-end font-medium text-navy">
                    {course.issues_certificate
                      ? t.course.certificateOnCompletion
                      : t.course.certificateNone}
                  </dd>
                </div>
                {course.support_policy ? (
                  <div>
                    <dt className="text-muted">{t.course.support}</dt>
                    <dd data-authored="true" className="mt-1 text-navy">
                      {course.support_policy}
                    </dd>
                  </div>
                ) : null}
                {course.refund_policy ? (
                  <div>
                    <dt className="text-muted">{t.course.refund}</dt>
                    <dd data-authored="true" className="mt-1 text-navy">
                      {course.refund_policy}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <p className="mt-5 text-xs text-muted">
                {t.course.certificateNote}{' '}
                <LocaleLink href="/course-terms" className="underline">
                  {t.pageTitle.courseTerms}
                </LocaleLink>
              </p>
            </Card>
          </aside>
        </div>
      </Container>
    </>
  );
}
