/**
 * The page staff pass through before the dashboard opens: setting up Google
 * Authenticator, or typing the code in a session that has not yet.
 */
export const TWO_STEP_PATH = '/dashboard/two-step';

/**
 * Where to go once the code is in. Only a dashboard page, so a crafted
 * `?next=` cannot send anyone off the site or round in a loop.
 */
export function afterTwoStep(next: string | null | undefined): string {
  if (
    !next ||
    !/^\/dashboard(\/[A-Za-z0-9\-._~/%]*)?$/.test(next) ||
    next.startsWith(TWO_STEP_PATH)
  ) {
    return '/dashboard';
  }

  return next;
}

/** The two-step page, remembering the dashboard page that was asked for. */
export function twoStepHref(from: string | null | undefined): string {
  const next = afterTwoStep(from);

  return next === '/dashboard'
    ? TWO_STEP_PATH
    : `${TWO_STEP_PATH}?next=${encodeURIComponent(next)}`;
}
