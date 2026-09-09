export function isAdministrator(roles: readonly string[]): boolean {
  return roles.some((role) => role === 'admin' || role === 'super_admin');
}

export function loginDestination(roles: readonly string[], next: string | null): string {
  const staff = roles.some((role) => ['super_admin', 'admin', 'editor', 'instructor', 'support'].includes(role));
  const fallback = staff ? '/dashboard' : '/account';
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || Array.from(next).some((character) => character.charCodeAt(0) < 32)) return fallback;
  const pathname = new URL(next, 'https://local.invalid').pathname;
  if (isAdministrator(roles) && pathname !== '/dashboard' && !pathname.startsWith('/dashboard/')) return '/dashboard';
  return next;
}
