import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PriceTag } from '@/components/ui/price';

describe('PriceTag', () => {
  it('shows an honest fallback when no price has been published', () => {
    render(<PriceTag value={null} />);

    expect(screen.getByText('দাম জানতে যোগাযোগ করুন')).toBeInTheDocument();
    // Nothing that looks like a zero price may appear.
    expect(screen.queryByText(/০\.০০/)).not.toBeInTheDocument();
  });

  it('renders a published price', () => {
    render(<PriceTag value={{ currency: 'BDT', amount_minor: 250000 }} />);

    expect(screen.getByText('২,৫০০.০০৳')).toBeInTheDocument();
  });

  it('marks a discount with a word and its size, not colour alone', () => {
    render(
      <PriceTag value={{ currency: 'BDT', amount_minor: 200000, compare_at_minor: 250000 }} />,
    );

    expect(screen.getByText('২০% ছাড়')).toBeInTheDocument();
    expect(screen.getByText('২,৫০০.০০৳')).toBeInTheDocument();
    // A discount with no end has nothing to count down to.
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('says a free course is free, rather than showing a zero', () => {
    render(<PriceTag value={{ currency: 'BDT', amount_minor: 0 }} />);

    expect(screen.getByText('ফ্রি')).toBeInTheDocument();
    expect(screen.queryByText(/০\.০০/)).not.toBeInTheDocument();
  });
});

describe('PriceTag with an offer that ends', () => {
  const offer = {
    currency: 'BDT',
    amount_minor: 500000,
    compare_at_minor: 1000000,
    offer_ends_at: '2026-09-16T04:00:00Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T04:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down to the end of the offer', () => {
    render(<PriceTag value={offer} />);

    expect(screen.getByText('৫,০০০.০০৳')).toBeInTheDocument();
    expect(screen.getByText('৫০% ছাড়')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('অফার শেষ হতে বাকি ৩ দিন ০০:০০:০০');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('অফার শেষ হতে বাকি ২ দিন ২৩:৫৯:৫৯');
  });

  it('shows the regular price once the offer is over, even on a cached page', () => {
    render(<PriceTag value={offer} />);

    act(() => {
      vi.setSystemTime(new Date('2026-09-16T04:00:01Z'));
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('১০,০০০.০০৳')).toBeInTheDocument();
    expect(screen.queryByText('৫,০০০.০০৳')).not.toBeInTheDocument();
    expect(screen.queryByText(/ছাড়/)).not.toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});
