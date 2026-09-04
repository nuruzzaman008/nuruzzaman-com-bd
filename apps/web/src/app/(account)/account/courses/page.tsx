import type { Metadata } from 'next';
import Link from 'next/link';
import type { Certificate, Course, Enrollment } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { date, number } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';
import { statusLabel } from '@/lib/status';

export const metadata: Metadata = privateMetadata('আমার কোর্স');

/** Tone per enrolment state; the wording comes from the shared status map. */
const STATUS_TONES: Record<string, 'success' | 'info' | 'warning'> = {
  active: 'info',
  completed: 'success',
  expired: 'warning',
  revoked: 'warning',
};

export default async function AccountCoursesPage() {
  const [enrollments, certificates, wishlist] = await Promise.all([
    sessionApi<{ data: Enrollment[] }>('/account/courses'),
    sessionApi<{ data: Certificate[] }>('/account/certificates'),
    sessionApi<{ data: Course[] }>('/account/wishlist'),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">আমার কোর্স</h1>

        {enrollments.data.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="এখনো কোনো কোর্সে ভর্তি হননি"
            description="কোর্স কিনলে সেটি এখানে যুক্ত হবে এবং অগ্রগতি সংরক্ষিত থাকবে।"
            action={<ButtonLink href="/courses">কোর্স দেখুন</ButtonLink>}
          />
        ) : (
          <ul className="mt-6 space-y-4">
            {enrollments.data.map((enrollment) => (
              <li key={enrollment.id}>
                <Card className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-bold text-navy">{enrollment.course.title}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {enrollment.course.lesson_count
                          ? `${number(enrollment.course.lesson_count)} টি লেসন`
                          : null}
                        {enrollment.expires_at
                          ? ` · মেয়াদ ${date(enrollment.expires_at)}`
                          : null}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONES[enrollment.status] ?? 'info'}>
                      {statusLabel('enrollment', enrollment.status)}
                    </Badge>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">অগ্রগতি</span>
                      <span className="font-latin font-semibold text-navy">
                        {enrollment.progress_percent}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={enrollment.progress_percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${enrollment.course.title} অগ্রগতি`}
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
                      {enrollment.progress_percent > 0 ? 'চালিয়ে যান' : 'শুরু করুন'}
                    </ButtonLink>
                    <ButtonLink
                      href={`/account/courses/${enrollment.course.slug}`}
                      variant="secondary"
                    >
                      অগ্রগতি ও মার্কস
                    </ButtonLink>
                    <ButtonLink href={`/courses/${enrollment.course.slug}`} variant="ghost">
                      কোর্স পাতা
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
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">সংরক্ষিত কোর্স</h2>
          <ul className="mt-4 space-y-3">
            {wishlist.data.map((course) => (
              <li key={course.slug}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold text-navy">{course.title}</p>
                    {course.subtitle ? (
                      <p className="mt-0.5 text-sm text-muted">{course.subtitle}</p>
                    ) : null}
                  </div>
                  <ButtonLink href={`/courses/${course.slug}`} variant="secondary">
                    দেখুন
                  </ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {certificates.data.length > 0 ? (
        <section>
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">সার্টিফিকেট</h2>
          <ul className="mt-4 space-y-3">
            {certificates.data.map((certificate) => (
              <li key={certificate.verification_id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold text-navy">{certificate.course_title}</p>
                    <p className="font-latin text-xs text-muted">
                      {certificate.verification_id} · {date(certificate.issued_at)}
                    </p>
                  </div>
                  <Link
                    href={`/verify/${certificate.verification_id}`}
                    className="text-sm text-blue hover:underline"
                  >
                    যাচাই পাতা
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
