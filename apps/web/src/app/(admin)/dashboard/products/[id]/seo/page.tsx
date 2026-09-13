import { redirect } from 'next/navigation';

/**
 * The product editor now carries the SEO fields and the live analysis beside
 * them, the way the article editor does. Keeping this screen as well would put
 * two editors on one record, each able to overwrite what the other just saved,
 * so the address - which older links and bookmarks still use - forwards to the
 * editor instead.
 */
export default async function ProductSeoPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  redirect(`/dashboard/products/${encodeURIComponent(id)}`);
}
