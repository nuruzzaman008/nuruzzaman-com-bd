import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderList, type OrderRow } from '@/features/dashboard/order-list';

const request = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const confirm = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const order = (number: string, status: string): OrderRow => ({
  number,
  status,
  billingName: 'nbconsultant',
  billingEmail: 'owner@example.com',
  placedAt: '2026-09-14T10:00:00+00:00',
  totalMinor: 499000,
  currency: 'BDT',
});

const rows = [order('NZ-260914-LT7XPD', 'pending_payment'), order('NZ-260913-HZBK15', 'fulfilled')];

beforeEach(() => {
  request.mockReset();
  refresh.mockReset();
  confirm.mockReset();
  vi.stubGlobal('confirm', confirm);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the orders list', () => {
  it('offers deleting only: an order has no editorial status', () => {
    render(<OrderList rows={rows} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));

    const actions = screen.getByLabelText('Bulk actions');
    expect(within(actions).getByRole('option', { name: 'Delete' })).toBeInTheDocument();
    expect(within(actions).queryByRole('option', { name: 'Published' })).not.toBeInTheDocument();
  });

  it('deletes by order number after asking, and names the one it would not delete', async () => {
    confirm.mockReturnValue(true);
    request
      .mockResolvedValueOnce({ message: 'Order deleted.' })
      .mockRejectedValueOnce(
        new Error(
          'Order NZ-260913-HZBK15 is fulfilled, so it is kept as a financial record. Only an order that never took money can be deleted.',
        ),
      );
    render(<OrderList rows={rows} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: NZ-260914-LT7XPD' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: NZ-260913-HZBK15' }));
    fireEvent.change(screen.getByLabelText('Bulk actions'), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Delete 2 orders?'));
    // An order is never "live on the site", so that line is not in the question.
    expect(confirm).not.toHaveBeenCalledWith(expect.stringContaining('live on the site'));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/orders/NZ-260914-LT7XPD', { method: 'DELETE' }),
    );
    const problem = await screen.findByRole('alert');
    expect(problem).toHaveTextContent('NZ-260913-HZBK15');
    expect(problem).toHaveTextContent('kept as a financial record');
    expect(await screen.findByText('1 deleted.')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
