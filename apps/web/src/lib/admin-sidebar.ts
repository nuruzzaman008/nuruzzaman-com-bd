/**
 * Whether the admin menu is collapsed.
 *
 * A cookie for the same reason the admin language is one (see
 * lib/i18n/admin-locale.ts): the admin layout is a server component, and it
 * has to know before it renders. Kept in localStorage instead, a collapsed menu
 * would render open on every page load and then snap shut once the browser
 * caught up.
 *
 * No `server-only`: the toggle writes the same cookie from the browser, so both
 * sides need the name to agree.
 */
export const ADMIN_SIDEBAR_COOKIE = 'nb_admin_sidebar';

/** Open unless the cookie says otherwise, so a first visit shows the menu. */
export function sidebarCollapsedFrom(value: string | undefined): boolean {
  return value === 'collapsed';
}
