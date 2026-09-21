import { describe, expect, it } from 'vitest';

import { TWO_STEP_PATH, afterTwoStep, twoStepHref } from '@/lib/two-step';

describe('the page before the dashboard', () => {
  it('goes on to the dashboard page that was asked for', () => {
    expect(afterTwoStep('/dashboard/orders')).toBe('/dashboard/orders');
    expect(afterTwoStep('/dashboard')).toBe('/dashboard');
    expect(twoStepHref('/dashboard/orders')).toBe(`${TWO_STEP_PATH}?next=%2Fdashboard%2Forders`);
    expect(twoStepHref('/dashboard')).toBe(TWO_STEP_PATH);
  });

  it('never sends anyone off the dashboard, or back round to itself', () => {
    for (const next of [
      null,
      undefined,
      '',
      'https://evil.example/dashboard',
      '//evil.example',
      '/account',
      '/dashboardx',
      '/dashboard?x=https://evil.example',
      '/dashboard/<script>',
      TWO_STEP_PATH,
      `${TWO_STEP_PATH}?next=/dashboard`,
    ]) {
      expect(afterTwoStep(next)).toBe('/dashboard');
    }
  });
});
