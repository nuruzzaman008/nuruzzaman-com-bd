import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

  it('marks a discount with a word, not colour alone', () => {
    render(
      <PriceTag value={{ currency: 'BDT', amount_minor: 200000, compare_at_minor: 250000 }} />,
    );

    expect(screen.getByText('ছাড়')).toBeInTheDocument();
    expect(screen.getByText('২,৫০০.০০৳')).toBeInTheDocument();
  });
});
