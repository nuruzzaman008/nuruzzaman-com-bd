import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageLightbox } from '@/components/ui/image-lightbox';
import { Prose } from '@/components/ui/prose';

vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

beforeEach(() => {
  // jsdom knows the element but not the top layer.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

const article =
  '<p>A plan.</p><img src="https://cdn.test/plan.jpg" alt="Ground floor plan" />' +
  '<a href="/blog/x"><img src="https://cdn.test/thumb.jpg" alt="Read on" /></a>';

const picture = () => screen.getByAltText('Ground floor plan');
const lightbox = () => screen.queryByRole('dialog');

describe('clicking a picture in an article', () => {
  it('opens it as large as the screen allows, then at its actual size', () => {
    render(<Prose html={article} />);

    expect(lightbox()).not.toBeInTheDocument();

    fireEvent.click(picture());

    const dialog = screen.getByRole('dialog', { name: 'Ground floor plan' });
    const shown = within(dialog).getByAltText('Ground floor plan');
    expect(shown).toHaveAttribute('src', 'https://cdn.test/plan.jpg');
    expect(shown.className).toContain('max-h-[82dvh]');
    expect(within(dialog).getByText('Ground floor plan')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Actual size' }));
    expect(within(dialog).getByAltText('Ground floor plan').className).toContain('max-w-none');
    expect(within(dialog).getByRole('button', { name: 'Fit to the screen' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens from the keyboard, and marks the pictures as somewhere to tab to', () => {
    render(<Prose html={article} />);

    expect(picture()).toHaveAttribute('tabindex', '0');
    // The one inside a link is the link's, so it keeps its own behaviour.
    expect(screen.getByAltText('Read on')).not.toHaveAttribute('tabindex');

    picture().focus();
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(screen.getByRole('dialog', { name: 'Ground floor plan' })).toBeInTheDocument();
  });

  it('leaves a picture that is a link alone, and a middle click too', () => {
    render(<Prose html={article} />);

    fireEvent.click(screen.getByAltText('Read on'));
    expect(lightbox()).not.toBeInTheDocument();

    fireEvent.click(picture(), { ctrlKey: true });
    expect(lightbox()).not.toBeInTheDocument();
  });

  it('opens one picture when a page renders several articles', () => {
    render(
      <>
        <Prose html={article} />
        <Prose html='<img src="https://cdn.test/second.jpg" alt="Section" />' />
      </>,
    );

    fireEvent.click(screen.getByAltText('Section'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Section' })).toBeInTheDocument();
  });

  it('says the cursor is a magnifier only while it is listening', () => {
    const { unmount } = render(<ImageLightbox />);

    expect(document.documentElement.dataset.nbZoom).toBe('on');

    unmount();
    expect(document.documentElement.dataset.nbZoom).toBeUndefined();
  });
});
