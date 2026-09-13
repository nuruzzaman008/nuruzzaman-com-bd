import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CoursePricingFields,
  fromDhakaInput,
  pricingFromForm,
  toDhakaInput,
  type CoursePricing,
} from '@/features/admin/course-pricing-fields';

vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

function setup(props: { initial?: CoursePricing | null; fallbackMinor?: number | null } = {}) {
  render(
    <form aria-label="Course">
      <CoursePricingFields {...props} />
    </form>,
  );

  return () =>
    pricingFromForm(new FormData(screen.getByRole('form', { name: 'Course' }) as HTMLFormElement));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-13T04:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Bangladesh time', () => {
  it('converts both ways, whatever the browser zone', () => {
    expect(toDhakaInput('2026-09-16T04:00:00Z')).toBe('2026-09-16T10:00');
    expect(fromDhakaInput('2026-09-16T10:00')).toBe('2026-09-16T04:00:00.000Z');
  });
});

describe('CoursePricingFields', () => {
  it('sets a regular price with a 50% offer that ends in 72 hours', () => {
    const read = setup({ fallbackMinor: 150000 });

    fireEvent.change(screen.getByLabelText('Regular price (BDT)'), { target: { value: '10000' } });
    fireEvent.click(screen.getByLabelText('Run a limited-time offer'));

    // The end defaults to three days from now.
    expect(screen.getByLabelText('Offer ends (Bangladesh time)')).toHaveValue('2026-09-16T10:00');

    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '50' } });
    expect(screen.getByLabelText('Offer price (BDT)')).toHaveValue(5000);

    expect(read()).toEqual({
      type: 'paid',
      regular_minor: 1000000,
      offer_minor: 500000,
      offer_ends_at: '2026-09-16T04:00:00.000Z',
    });
    expect(screen.getByText(/^Students see:/)).toHaveTextContent('50% off');
  });

  it('works out the discount from an offer price, and sets the end with one click', () => {
    const read = setup({
      initial: { type: 'paid', regular_minor: 1000000, offer_minor: null, offer_ends_at: null },
    });

    fireEvent.click(screen.getByLabelText('Run a limited-time offer'));
    fireEvent.change(screen.getByLabelText('Offer price (BDT)'), { target: { value: '7500' } });
    expect(screen.getByLabelText('Discount (%)')).toHaveValue(25);

    fireEvent.click(screen.getByRole('button', { name: '24 hours' }));
    expect(read()).toMatchObject({
      offer_minor: 750000,
      offer_ends_at: '2026-09-14T04:00:00.000Z',
    });

    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(read()).toMatchObject({ offer_ends_at: '2026-09-20T04:00:00.000Z' });
  });

  it('loads a running offer exactly as it was saved, so saving again changes nothing', () => {
    const read = setup({
      initial: {
        type: 'paid',
        regular_minor: 1000000,
        offer_minor: 500000,
        offer_ends_at: '2026-09-16T04:00:00+00:00',
      },
    });

    expect(screen.getByLabelText('Run a limited-time offer')).toBeChecked();
    expect(screen.getByLabelText('Discount (%)')).toHaveValue(50);
    expect(screen.getByLabelText('Offer ends (Bangladesh time)')).toHaveValue('2026-09-16T10:00');
    expect(read()).toEqual({
      type: 'paid',
      regular_minor: 1000000,
      offer_minor: 500000,
      offer_ends_at: '2026-09-16T04:00:00.000Z',
    });
  });

  it('turns an offer off', () => {
    const read = setup({
      initial: {
        type: 'paid',
        regular_minor: 1000000,
        offer_minor: 500000,
        offer_ends_at: '2026-09-16T04:00:00+00:00',
      },
    });

    fireEvent.click(screen.getByLabelText('Run a limited-time offer'));

    expect(read()).toEqual({
      type: 'paid',
      regular_minor: 1000000,
      offer_minor: null,
      offer_ends_at: null,
    });
  });

  it('makes a course free', () => {
    const read = setup({
      initial: { type: 'paid', regular_minor: 500000, offer_minor: null, offer_ends_at: null },
    });

    fireEvent.click(screen.getByRole('radio', { name: /^Free/ }));

    expect(screen.queryByLabelText('Regular price (BDT)')).not.toBeInTheDocument();
    expect(read()).toEqual({ type: 'free' });
    expect(screen.getByText(/^Students see: Free/)).toBeInTheDocument();
  });

  it('opens a free course as free', () => {
    setup({ initial: { type: 'free', regular_minor: 0, offer_minor: null, offer_ends_at: null } });

    expect(screen.getByRole('radio', { name: /^Free/ })).toBeChecked();
  });
});
