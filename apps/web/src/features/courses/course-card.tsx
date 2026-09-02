import Image from 'next/image';
import Link from 'next/link';
import type { CourseSummary } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CoverArt } from '@/components/ui/cover-art';
import { duration, number } from '@/lib/format';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'শুরুর স্তর',
  intermediate: 'মাঝারি স্তর',
  advanced: 'উন্নত স্তর',
};

export function CourseCard({ course }: { course: CourseSummary }) {
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
        <CoverArt topic={course.track ?? undefined} label={course.track_name ?? undefined} />
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">{LEVEL_LABELS[course.level] ?? course.level}</Badge>
          <Badge>{course.language}</Badge>
          {course.issues_certificate ? <Badge tone="info">সার্টিফিকেট</Badge> : null}
        </div>

        <h3 className="mt-3 text-lg leading-snug font-bold text-navy">
          <Link
            href={`/courses/${course.slug}`}
            className="after:absolute after:inset-0 hover:text-blue"
          >
            {course.title}
          </Link>
        </h3>

        {course.subtitle ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted">{course.subtitle}</p>
        ) : null}

        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {course.lesson_count ? <span>{number(course.lesson_count)} টি লেসন</span> : null}
          {course.estimated_minutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{duration(course.estimated_minutes * 60)}</span>
            </>
          ) : null}
        </p>
      </div>
    </Card>
  );
}
