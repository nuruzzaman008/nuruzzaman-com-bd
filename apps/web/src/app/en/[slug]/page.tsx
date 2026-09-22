/*
 * English route for the pages added in the dashboard. Written in the same form
 * as the ones scripts/generate-en-routes.py makes, which only reads (public):
 * edit the page at app/(cms)/[slug] instead.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import BengaliPage from '../../(cms)/[slug]/view';
import { generateMetadata as bengaliMeta } from '../../(cms)/[slug]/view';
import { englishMetadata } from '@/lib/i18n/metadata';

export async function generateMetadata(props: any) {
  // The locale goes to the page metadata too, so the English document's own
  // title and description are the ones used.
  const base = await (bengaliMeta as any)({ ...props, locale: 'en' });
  const params = props?.params ? await props.params : {};
  const path = '/[slug]'.replace(/\[(\w+)\]/g, (_m, key) => params[key] ?? '');

  return englishMetadata(base, path);
}
export default function EnglishPage(props: any) {
  // The same component, told which language to render in.
  return <BengaliPage {...props} locale="en" />;
}
