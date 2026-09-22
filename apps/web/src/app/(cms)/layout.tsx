/*
 * The shell for pages added in the dashboard. Reuses the public layout, so the
 * header, footer and their data fetching exist once; only the public group's
 * loading.tsx is left out (see [slug]/view.tsx).
 */
export { default } from '../(public)/layout';
