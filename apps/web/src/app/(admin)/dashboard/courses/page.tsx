import type { Metadata } from 'next';
import Link from 'next/link';
import type { Course } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { number } from '@/lib/format';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('কোর্স');

export default async function DashboardCoursesPage() {
  const courses = await sessionApi<{ data: Course[] }>('/admin/courses');

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">কোর্স</h1>
      <p className="mt-2 text-muted">
        অন্তত একটি লেসন যুক্ত না করা পর্যন্ত কোনো কোর্স প্রকাশ করা যায় না।
      </p>

      <div className="mt-6">
        <DataTable
          caption="কোর্সের তালিকা"
          rows={courses.data}
          getRowKey={(course) => course.slug}
          empty={<EmptyState title="কোনো কোর্স নেই" />}
          columns={[
            {
              key: 'title',
              header: 'কোর্স',
              render: (course) => (
                <span>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="block font-medium text-blue hover:underline"
                  >
                    {course.title}
                  </Link>
                  <span className="font-latin block text-xs text-muted">/{course.slug}</span>
                </span>
              ),
            },
            { key: 'level', header: 'স্তর', render: (course) => course.level },
            {
              key: 'lessons',
              header: 'লেসন',
              align: 'end',
              render: (course) => number(course.lesson_count ?? 0),
            },
            {
              key: 'published',
              header: 'প্রকাশ',
              render: (course) =>
                course.published_at ? (
                  <Badge tone="success">প্রকাশিত</Badge>
                ) : (
                  <Badge tone="neutral">খসড়া</Badge>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
