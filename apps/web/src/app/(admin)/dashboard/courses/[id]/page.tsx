import { CourseEditor, type Curriculum } from '@/features/admin/course-editor';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

export const metadata = privateMetadata('Course editor');

export default async function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await sessionApi<{ data: Curriculum }>(`/admin/courses/${encodeURIComponent(id)}/curriculum`);
  return <CourseEditor initial={data} />;
}
