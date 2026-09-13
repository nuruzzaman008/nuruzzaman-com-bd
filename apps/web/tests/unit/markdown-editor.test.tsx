import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MarkdownTextarea } from '@/components/ui/markdown-editor';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

function setup(value = 'Loads') {
  const onInput = vi.fn();

  render(
    <form aria-label="Editor" onInput={onInput}>
      <MarkdownTextarea name="body" aria-label="Body" defaultValue={value} />
    </form>,
  );

  return { box: screen.getByLabelText('Body') as HTMLTextAreaElement, onInput };
}

beforeEach(() => {
  request.mockReset();
});

describe('MarkdownTextarea toolbar', () => {
  it('makes the selection bold', () => {
    const { box } = setup('carry the load');
    box.setSelectionRange(6, 9);

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(box.value).toBe('carry **the** load');
  });

  it('italicises, and inserts a placeholder when nothing is selected', () => {
    const { box } = setup('');
    box.setSelectionRange(0, 0);

    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));

    expect(box.value).toBe('*text*');
    expect(box.value.slice(box.selectionStart, box.selectionEnd)).toBe('text');
  });

  it('underlines with the tag the renderer allows', () => {
    const { box } = setup('bolt');
    box.setSelectionRange(0, 4);

    fireEvent.click(screen.getByRole('button', { name: 'Underline' }));

    expect(box.value).toBe('<u>bolt</u>');
  });

  it('offers all six heading levels and sets the current line', () => {
    const { box } = setup('### Loads');
    box.setSelectionRange(4, 4);

    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByRole('button', { name: `Heading ${level}` })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Heading 2' }));

    expect(box.value).toBe('## Loads');
  });

  it('warns about H1 on the button itself', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Heading 1' }).getAttribute('title')).toMatch(/H1/);
  });

  it('applies a colour, a size and a font from the palette, then resets the menu', () => {
    const { box } = setup('shear');

    box.setSelectionRange(0, 5);
    fireEvent.change(screen.getByLabelText('Colour'), { target: { value: 'blue' } });
    expect(box.value).toBe('<span data-color="blue">shear</span>');
    expect(screen.getByLabelText('Colour')).toHaveValue('');

    box.setSelectionRange(0, box.value.length);
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'xl' } });
    expect(box.value.startsWith('<span data-size="xl">')).toBe(true);

    box.setSelectionRange(0, 0);
    fireEvent.change(screen.getByLabelText('Font'), { target: { value: 'serif' } });
    expect(box.value.startsWith('<span data-font="serif">text</span>')).toBe(true);
  });

  it('tells the form about every change, so the SEO analysis recounts', () => {
    const { box, onInput } = setup('load');
    box.setSelectionRange(0, 4);

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(onInput).toHaveBeenCalled();
  });
});

describe('MarkdownTextarea preview', () => {
  it('renders the text with the server renderer and keeps the field in the form', async () => {
    request.mockResolvedValue({ data: { html: '<h2>Loads</h2>' } });
    const { box } = setup('## Loads');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    });

    expect(request).toHaveBeenCalledWith('/admin/markdown/preview', {
      method: 'POST',
      body: { markdown: '## Loads' },
    });
    expect(await screen.findByRole('heading', { name: 'Loads' })).toBeInTheDocument();
    // Hidden while previewing, but still submitted with the form.
    expect(box).not.toBeVisible();
    expect(new FormData(screen.getByRole('form', { name: 'Editor' }) as HTMLFormElement).get('body')).toBe(
      '## Loads',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Write' }));
    expect(box).toBeVisible();
  });

  it('says so when the preview cannot be rendered', async () => {
    request.mockRejectedValue(new Error('offline'));
    setup('x');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    });

    expect(await screen.findByText('The preview could not be shown.')).toBeInTheDocument();
  });
});
