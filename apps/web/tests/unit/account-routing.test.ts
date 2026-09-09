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
});
