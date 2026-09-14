import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductPrices, type PricedVariant } from '@/features/dashboard/product-prices';

const request = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const variants: PricedVariant[] = [
  {
    id: 11,
    sku: 'NBET-V6-SINGLE',
    name: 'Single machine licence',
    credit_amount: null,
    device_limit: 1,
    is_active: true,
    price: { currency: 'BDT', amount_minor: 499000, compare_at_minor: 790000 },
  },
  {
    id: 12,
    sku: 'NBC-1000',
    name: '1,000 NB Credits',
    credit_amount: 1000,
    device_limit: null,
    is_active: false,
    price: null,
  },
];

const row = (sku: string) => within(document.querySelector<HTMLElement>(`[data-sku="${sku}"]`)!);

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: {} });
  refresh.mockReset();
  render(<ProductPrices productId={7} variants={variants} />);
});

describe('ProductPrices', () => {
  it('shows each variant with its current price, regular price and whether it is on sale', () => {
    const licence = row('NBET-V6-SINGLE');
    expect(licence.getByLabelText('Price (৳)')).toHaveValue(4990);
    expect(licence.getByLabelText('Regular price (৳, optional)')).toHaveValue(7900);
    expect(licence.getByText('On sale')).toBeInTheDocument();

    const pack = row('NBC-1000');
    expect(pack.getByText('1,000 NB Credits', { selector: 'p.text-sm' })).toBeInTheDocument();
    expect(pack.getByText('Off sale')).toBeInTheDocument();
  });

  it('saves a new price in minor units and refreshes the page', async () => {
    const licence = row('NBET-V6-SINGLE');
    fireEvent.change(licence.getByLabelText('Price (৳)'), { target: { value: '5500' } });
    fireEvent.change(licence.getByLabelText('Regular price (৳, optional)'), {
      target: { value: '' },
    });
    fireEvent.click(licence.getByRole('button', { name: 'Save price' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/products/7/variants/11/prices', {
        method: 'POST',
        body: { amount_minor: 550000, compare_at_minor: null },
      }),
    );
    expect(await licence.findByRole('status')).toHaveTextContent(
      'the site shows the new price now',
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('refuses a regular price that is not higher than the price, without saving', () => {
    const licence = row('NBET-V6-SINGLE');
    fireEvent.change(licence.getByLabelText('Price (৳)'), { target: { value: '8000' } });
    fireEvent.change(licence.getByLabelText('Regular price (৳, optional)'), {
      target: { value: '7900' },
    });
    fireEvent.click(licence.getByRole('button', { name: 'Save price' }));

    expect(licence.getByRole('alert')).toHaveTextContent('has to be higher');
    expect(request).not.toHaveBeenCalled();
  });

  it('puts a pack that is off sale back on sale', async () => {
    fireEvent.click(row('NBC-1000').getByRole('button', { name: 'Put on sale' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/products/7/variants/12', {
        method: 'PATCH',
        body: { is_active: true },
      }),
    );
  });
});
