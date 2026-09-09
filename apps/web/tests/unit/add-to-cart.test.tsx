import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductVariant } from '@nuruzzaman/contracts';
import { AddToCart } from '@/features/catalog/add-to-cart';

const mocks = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: mocks.api, ApiError: class extends Error {} }));
vi.mock('@/lib/session/session-provider', () => ({ useSession: () => ({ refresh: mocks.refresh }) }));
const variants = [{ id: 7, name: 'Course access', is_purchasable: true, price: { amount_minor: 150000, currency: 'BDT' } }] as ProductVariant[];

describe('course enrolment cart action', () => {
  beforeEach(() => vi.clearAllMocks());
  it('adds the selected course before navigating and blocks repeat clicks while pending', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<AddToCart variants={variants} hidePrice openCart buttonLabel="Enrol on this course" />);
    const button = screen.getByRole('button', { name: 'Enrol on this course' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(mocks.api).toHaveBeenCalledWith('/cart/items', { method: 'POST', body: { variant_id: 7, quantity: 1 } });
    expect(mocks.push).not.toHaveBeenCalled();
    resolve({ data: {} });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/cart'));
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it('stays on the course and offers retry when adding fails', async () => {
    mocks.api.mockRejectedValue(new Error('Unavailable'));
    render(<AddToCart variants={variants} hidePrice openCart buttonLabel="Enrol" />);
    fireEvent.click(screen.getByRole('button', { name: 'Enrol' }));
    await screen.findByRole('alert');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enrol' })).toBeEnabled();
  });
});
