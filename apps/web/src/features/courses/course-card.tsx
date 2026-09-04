'use client';

import Image from 'next/image';
import type { CourseSummary } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CoverArt } from '@/components/ui/cover-art';
import { LocaleLink } from '@/components/ui/locale-link';
import { counted, duration } from '@/lib/format';
import { levelLabel, taxonomyLabel } from '@/lib/i18n/labels';
import { useLocale } from '@/lib/i18n/locale-provider';

export function CourseCard({ course }: { course: CourseSummary }) {
  const { locale, t } = useLocale();
  const trackName = course.track
    ? taxonomyLabel(t, course.track, course.track_name, locale)
    : (course.track_name ?? undefined);

  return (
    <Card
      as="article"
      className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-[--shadow-raised] focus-within:shadow-[--shadow-raised]"
    >
      {course.cover_url ? (
        <Image
          src={course.cover_url}
          alt=""
          width={800}
          height={450}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <CoverArt
          topic={course.track ?? undefined}
          seed={course.slug}
          label={trackName ?? undefined}
        />
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">{levelLabel(t, course.level)}</Badge>
          <Badge>{course.language}</Badge>
          {course.issues_certificate ? <Badge tone="info">{t.ui.certificate}</Badge> : null}
        </div>

        <h3 data-authored="true" className="mt-3 text-lg leading-snug font-bold text-navy">
          <LocaleLink
            href={`/courses/${course.slug}`}
            className="after:absolute after:inset-0 hover:text-blue"
          >
            {course.title}
          </LocaleLink>
        </h3>

        {course.subtitle ? (
          <p data-authored="true" className="mt-2 line-clamp-2 text-sm text-muted">
            {course.subtitle}
          </p>
        ) : null}

        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {course.lesson_count ? (
            <span>{counted(course.lesson_count, 'lesson', locale)}</span>
          ) : null}
          {course.estimated_minutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{duration(course.estimated_minutes * 60, locale)}</span>
            </>
          ) : null}
        </p>
      </div>
    </Card>
  );
}
