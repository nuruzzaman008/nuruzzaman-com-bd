import { CourseEditor } from '@/features/admin/course-editor';
import { privateMetadata } from '@/lib/seo';

export const metadata = privateMetadata('New course');

export default function NewCoursePage() { return <CourseEditor />; }
