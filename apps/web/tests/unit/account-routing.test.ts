import { describe, expect, it } from 'vitest';
import { isAdministrator, loginDestination } from '../../src/lib/account-routing';
describe('admin and customer account separation', () => {
  it('keeps admins in their dashboard even with a customer next link', () => {
    expect(loginDestination(['admin'], '/account')).toBe('/dashboard');
    expect(loginDestination(['super_admin', 'customer'], '/account/courses')).toBe('/dashboard');
    expect(loginDestination(['admin'], '/dashboard/courses')).toBe('/dashboard/courses');
    expect(loginDestination(['admin'], null)).toBe('/dashboard');
  });
  it('preserves customer destinations and instructor roles', () => {
    expect(loginDestination(['customer'], '/account/orders')).toBe('/account/orders');
    expect(loginDestination(['customer'], null)).toBe('/account');
    expect(isAdministrator(['instructor'])).toBe(false);
  });
  it('rejects external and backslash redirect destinations', () => {
    expect(loginDestination(['admin'], '//evil.example')).toBe('/dashboard');
    expect(loginDestination(['customer'], '/\\evil.example')).toBe('/account');
  });

  it('sends a customer who reaches the staff entrance to their own account', () => {
    // /nb-staff signs in with next=/dashboard. Following that for someone
    // without a staff role would bounce them straight back out, and the bounce
    // is an answer in itself: it confirms the address they guessed is real.
    expect(loginDestination(['customer'], '/dashboard')).toBe('/account');
    expect(loginDestination(['customer'], '/dashboard/orders')).toBe('/account');
    expect(loginDestination([], '/dashboard')).toBe('/account');
  });

  it('still lets every staff role through to the dashboard', () => {
    // The bounce above must not catch the people the entrance is for.
    for (const role of ['super_admin', 'admin', 'editor', 'instructor', 'support']) {
      expect(loginDestination([role], '/dashboard'), role).toBe('/dashboard');
    }
    // Non-administrator staff keep the deeper path they asked for.
    expect(loginDestination(['support'], '/dashboard/support-tickets')).toBe(
      '/dashboard/support-tickets',
    );
  });
});
