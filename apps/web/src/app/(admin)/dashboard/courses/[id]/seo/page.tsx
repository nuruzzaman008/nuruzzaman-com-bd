import { redirect } from 'next/navigation';

/**
 * The course editor now carries the SEO fields and the live analysis beside
 * them, the way the product and article editors do. Keeping this screen as
 * well would put two editors on one course, each able to overwrite what the
 * other just saved, so the address - which older links and bookmarks still
 * use - forwards to the editor instead.
 */
export default async function CourseSeoPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  redirect(`/dashboard/courses/${encodeURIComponent(id)}`);
}
