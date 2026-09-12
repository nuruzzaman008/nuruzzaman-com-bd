import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CouponManager } from '@/features/dashboard/coupon-manager';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

/** What the API's paginator puts on the wire. */
function withCoupons(list: unknown[] = []) {
  request.mockImplementation((path: string, options?: { method?: string }) =>
    options?.method
      ? Promise.resolve({ data: {} })
      : Promise.resolve({ data: { data: list } }),
  );
}

beforeEach(() => {
  request.mockReset();
  withCoupons();
});

describe('CouponManager', () => {
  it('sends a percentage exactly as typed', async () => {
    render(<CouponManager />);

    fireEvent.change(await screen.findByLabelText(/Coupon code/), { target: { value: 'NB-TEN' } });
    fireEvent.change(screen.getByLabelText(/Percent off/), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/coupons',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            code: 'NB-TEN',
            discount_type: 'percent',
            // A percentage is a plain number. Multiplying it by 100 here would
            // ask for 1000% off, which PricingService clamps to 100% - a free
            // order, from a form that looked right.
            discount_value: 10,
          }),
        }),
      ),
    );
  });

  it('converts a taka amount into poisha', async () => {
    render(<CouponManager />);

    fireEvent.change(await screen.findByLabelText(/Coupon code/), { target: { value: 'NB-2K' } });
    fireEvent.change(screen.getByLabelText(/Discount type/), { target: { value: 'fixed' } });
    fireEvent.change(screen.getByLabelText(/Taka off/), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/coupons',
        expect.objectContaining({
          body: expect.objectContaining({
            discount_type: 'fixed',
            // 2,000 taka is 200,000 poisha. Sending 2000 would take twenty
            // taka off an order the owner meant to discount by two thousand.
            discount_value: 200000,
          }),
        }),
      ),
    );
  });

  it('converts the minimum spend too', async () => {
    render(<CouponManager />);

    fireEvent.change(await screen.findByLabelText(/Coupon code/), { target: { value: 'NB-MIN' } });
    fireEvent.change(screen.getByLabelText(/Minimum spend/), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/admin/coupons',
        expect.objectContaining({
          body: expect.objectContaining({ minimum_subtotal_minor: 500000 }),
        }),
      ),
    );
  });

  it('offers a generated code that the API would accept', async () => {
    render(<CouponManager />);

    const input = (await screen.findByLabelText(/Coupon code/)) as HTMLInputElement;
    const first = input.value;

    // The API validates against /^[A-Za-z0-9_-]+$/ and a length of 48.
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeLessThanOrEqual(48);
    // No characters that are misread when a code is typed off a screen.
    expect(first).not.toMatch(/[O0I1]/);

    fireEvent.click(screen.getByRole('button', { name: 'Generate a code' }));
    expect(input.value).not.toBe(first);
  });

  it('shows each existing coupon in the units a person thinks in', async () => {
    withCoupons([
      {
        id: 1, code: 'NB-TEN', description: null, discount_type: 'percent',
        discount_value: 10, minimum_subtotal_minor: 0, max_redemptions: null,
        is_active: true, ends_at: null, redemptions_count: 3,
      },
      {
        id: 2, code: 'NB-2K', description: null, discount_type: 'fixed',
        discount_value: 200000, minimum_subtotal_minor: 500000, max_redemptions: 50,
        is_active: false, ends_at: null, redemptions_count: 0,
      },
    ]);

    render(<CouponManager />);

    // Read back as taka, not poisha.
    expect(await screen.findByText(/10% · 3 uses · active/)).toBeInTheDocument();
    expect(
      screen.getByText(/BDT 2,000 · min BDT 5,000 · 0\/50 uses · inactive/),
    ).toBeInTheDocument();
  });

  it('does not claim success when the API refuses', async () => {
    render(<CouponManager />);
    await screen.findByLabelText(/Coupon code/);

    request.mockRejectedValueOnce(new Error('That code is already taken.'));
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is already taken.');
    expect(screen.queryByText('Coupon created.')).not.toBeInTheDocument();
  });
});
