import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiError, type CourseOutline, type Lesson } from '@nuruzzaman/contracts';

import { CourseOutlineNav } from '@/features/learn/course-outline';
import { LessonPlayer } from '@/features/learn/lesson-player';
import { Callout } from '@/components/ui/callout';
import { Container } from '@/components/ui/container';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('কোর্স প্লেয়ার');

export default async function LessonPage(props: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = await props.params;

  let outline: CourseOutline;

  try {
    const response = await sessionApi<{ data: CourseOutline }>(
      `/learn/${encodeURIComponent(courseSlug)}/outline`,
    );
    outline = response.data;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) {
      redirect(`/login?next=/learn/${courseSlug}/${lessonSlug}`);
    }

    if (error instanceof ApiError && (error.isForbidden || error.status === 404)) {
      notFound();
    }

    throw error;
  }

  const outlineLesson = outline.sections
    .flatMap((section) => section.lessons)
    .find((lesson) => lesson.slug === lessonSlug);

  if (!outlineLesson) {
    notFound();
  }

  let lesson: Lesson | null = null;
  let lockedMessage: string | null = null;

  try {
    const response = await sessionApi<{ data: Lesson }>(
      `/learn/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`,
    );
    lesson = response.data;
  } catch (error) {
    // A locked lesson is a normal state, not a crash: the sidebar stays usable
    // and the reason is explained inline.
    if (error instanceof ApiError && error.isForbidden) {
      lockedMessage = error.message;
    } else {
      throw error;
    }
  }

  return (
    <Container size="wide" className="py-8">
      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <CourseOutlineNav outline={outline} currentSlug={lessonSlug} />
        </aside>

        <div className="rounded-[--radius-card] border border-line bg-white p-6 sm:p-8">
          {lesson ? (
            <LessonPlayer
              courseSlug={courseSlug}
              lesson={lesson}
              isCompleted={outlineLesson.is_completed}
            />
          ) : (
            <Callout tone="warning" title="এই লেসনটি এখনো খোলেনি" role="status">
              <p>{lockedMessage}</p>
              <p className="mt-2">
                <Link href={`/courses/${courseSlug}`} className="underline">
                  কোর্সের বিস্তারিত দেখুন
                </Link>
              </p>
            </Callout>
          )}
        </div>
      </div>
    </Container>
  );
}
