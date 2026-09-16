import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApiError, type CourseOutline, type Lesson, type LessonNote } from '@nuruzzaman/contracts';

import { CourseOutlineNav } from '@/features/learn/course-outline';
import { LessonNotes } from '@/features/learn/lesson-notes';
import { LessonPlayer } from '@/features/learn/lesson-player';
import { LessonAssessments } from '@/features/learn/lesson-assessments';
import { Callout } from '@/components/ui/callout';
import { Container } from '@/components/ui/container';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.learn.playerTitle);
}

export default async function LessonPage(props: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { locale, t } = await adminDictionary();
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

  const lessons = outline.sections.flatMap((section) => section.lessons);
  const index = lessons.findIndex((lesson) => lesson.slug === lessonSlug);
  const outlineLesson = lessons[index];

  if (!outlineLesson) {
    notFound();
  }

  const neighbour = (row: (typeof lessons)[number] | undefined) =>
    row ? { slug: row.slug, title: row.title, is_unlocked: row.is_unlocked } : null;

  // Notes for this lesson only. A failure here must not take the lesson down
  // with it, so an empty list is the fallback.
  const lessonNotes: LessonNote[] = await sessionApi<{ data: LessonNote[] }>(
    `/learn/${encodeURIComponent(courseSlug)}/notes`,
  )
    .then((response) => response.data.filter((note) => note.lesson?.slug === lessonSlug))
    .catch(() => []);

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

  /*
    The lesson in the middle and the course on the right, as a classic course
    player lays them out. The sidebar is sticky and scrolls on its own, so the
    list and the exam, certificate and review buttons stay in reach while a
    long article is read. On a phone it follows the lesson.
  */
  return (
    <Container size="wide" className="py-6 sm:py-8">
      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 rounded-[--radius-card] border border-line bg-white p-4 sm:p-6">
          {lesson ? (
            <>
              <LessonPlayer
                key={lessonSlug}
                courseSlug={courseSlug}
                lesson={lesson}
                isCompleted={outlineLesson.is_completed}
                previous={neighbour(lessons[index - 1])}
                next={neighbour(lessons[index + 1])}
              />
              <LessonAssessments
                key={`activities-${lessonSlug}`}
                quizId={lesson.quiz_id}
                assignmentId={lesson.assignment_id}
              />
              <LessonNotes
                key={`notes-${lessonSlug}`}
                courseSlug={courseSlug}
                lessonSlug={lessonSlug}
                notes={lessonNotes}
              />
            </>
          ) : (
            <Callout tone="warning" title={t.learn.lockedTitle} role="status">
              <p>{lockedMessage}</p>
              <p className="mt-2">
                <Link href={`/courses/${courseSlug}`} className="underline">
                  {t.learn.courseDetails}
                </Link>
              </p>
            </Callout>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
          <CourseOutlineNav outline={outline} currentSlug={lessonSlug} locale={locale} />
        </aside>
      </div>
    </Container>
  );
}
