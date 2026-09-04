import type { Metadata } from 'next';
import Link from 'next/link';
import type { Certificate, Course, Enrollment } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { counted, date, number } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.customer.courses.title);
}

/** Tone per enrolment state; the wording comes from the shared status map. */
const STATUS_TONES: Record<string, 'success' | 'info' | 'warning'> = {
  active: 'info',
  completed: 'success',
  expired: 'warning',
  revoked: 'warning',
};

export default async function AccountCoursesPage() {
  const { locale, t } = await adminDictionary();

  const [enrollments, certificates, wishlist] = await Promise.all([
    sessionApi<{ data: Enrollment[] }>('/account/courses'),
    sessionApi<{ data: Certificate[] }>('/account/certificates'),
    sessionApi<{ data: Course[] }>('/account/wishlist'),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
          {t.customer.courses.title}
        </h1>

        {enrollments.data.length === 0 ? (
          <EmptyState
            className="mt-6"
            title={t.customer.courses.emptyTitle}
            description={t.customer.courses.emptyBody}
            action={<ButtonLink href="/courses">{t.customer.courses.browse}</ButtonLink>}
          />
        ) : (
          <ul className="mt-6 space-y-4">
            {enrollments.data.map((enrollment) => (
              <li key={enrollment.id}>
                <Card className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-navy" data-authored="true">
                        {enrollment.course.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        {enrollment.course.lesson_count
                          ? counted(enrollment.course.lesson_count, 'lesson', locale)
                          : null}
                        {enrollment.expires_at
                          ? ` · ${t.customer.courses.expiresOn.replace(
                              '{date}',
                              date(enrollment.expires_at, locale) ?? '',
                            )}`
                          : null}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONES[enrollment.status] ?? 'info'}>
                      {statusLabel('enrollment', enrollment.status, locale)}
                    </Badge>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">{t.customer.courses.progress}</span>
                      <span className="font-semibold text-navy">
                        {number(enrollment.progress_percent, locale)}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={enrollment.progress_percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t.customer.courses.progressOf.replace(
                        '{title}',
                        enrollment.course.title,
                      )}
                      className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"
                    >
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{ width: `${enrollment.progress_percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <ButtonLink
                      href={
                        enrollment.last_lesson_slug
                          ? `/learn/${enrollment.course.slug}/${enrollment.last_lesson_slug}`
                          : `/learn/${enrollment.course.slug}`
                      }
                    >
                      {enrollment.progress_percent > 0
                        ? t.customer.courses.continue
                        : t.customer.courses.start}
                    </ButtonLink>
                    <ButtonLink
                      href={`/account/courses/${enrollment.course.slug}`}
                      variant="secondary"
                    >
                      {t.customer.courses.progressAndMarks}
                    </ButtonLink>
                    <ButtonLink href={`/courses/${enrollment.course.slug}`} variant="ghost">
                      {t.customer.courses.coursePage}
                    </ButtonLink>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {wishlist.data.length > 0 ? (
        <section>
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
            {t.customer.courses.saved}
          </h2>
          <ul className="mt-4 space-y-3">
            {wishlist.data.map((course) => (
              <li key={course.slug}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold text-navy" data-authored="true">
                      {course.title}
                    </p>
                    {course.subtitle ? (
                      <p className="mt-0.5 text-sm text-muted" data-authored="true">
                        {course.subtitle}
                      </p>
                    ) : null}
                  </div>
                  <ButtonLink href={`/courses/${course.slug}`} variant="secondary">
                    {t.customer.view}
                  </ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {certificates.data.length > 0 ? (
        <section>
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">
            {t.customer.courses.certificates}
          </h2>
          <ul className="mt-4 space-y-3">
            {certificates.data.map((certificate) => (
              <li key={certificate.verification_id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold text-navy" data-authored="true">
                      {certificate.course_title}
                    </p>
                    <p className="font-latin text-xs text-muted">
                      {certificate.verification_id} · {date(certificate.issued_at, locale)}
                    </p>
                  </div>
                  <Link
                    href={`/verify/${certificate.verification_id}`}
                    className="text-sm text-blue hover:underline"
                  >
                    {t.customer.courses.verifyPage}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
