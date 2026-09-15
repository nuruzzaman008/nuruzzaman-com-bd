import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MarkdownTextarea } from '@/components/ui/markdown-editor';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});
// jsdom has no canvas to resize with; the resizing has its own tests.
vi.mock('@/lib/media/prepare-upload', () => ({
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  prepareImageForUpload: async (file: File) => ({ ok: true, file, resized: false }),
}));
const uploadInParts = vi.hoisted(() => vi.fn());
vi.mock('@/lib/uploads/chunked-upload', () => ({ uploadInParts }));
vi.mock('@/lib/media/video-duration', () => ({ readVideoDuration: async () => 253 }));

function setup(value = 'Loads') {
  const onInput = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

  render(
    <form aria-label="Editor" onInput={onInput} onSubmit={onSubmit}>
      <MarkdownTextarea name="body" aria-label="Body" defaultValue={value} />
    </form>,
  );

  return { box: screen.getByLabelText('Body') as HTMLTextAreaElement, onInput, onSubmit };
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  request.mockReset();
  uploadInParts.mockReset();
});

describe('MarkdownTextarea inline formatting', () => {
  it('makes the selection bold, and bold again removes it', () => {
    const { box } = setup('carry the load');
    box.setSelectionRange(6, 9);

    click('Bold');
    expect(box.value).toBe('carry **the** load');

    click('Bold');
    expect(box.value).toBe('carry the load');
  });

  it('italicises, and inserts a placeholder when nothing is selected', () => {
    const { box } = setup('');
    box.setSelectionRange(0, 0);

    click('Italic');

    expect(box.value).toBe('*text*');
    expect(box.value.slice(box.selectionStart, box.selectionEnd)).toBe('text');
  });

  it('underlines with the tag the renderer allows', () => {
    const { box } = setup('bolt');
    box.setSelectionRange(0, 4);

    click('Underline');

    expect(box.value).toBe('<u>bolt</u>');
  });

  it('formats from the keyboard with the usual shortcuts', () => {
    const { box } = setup('bolt');
    box.setSelectionRange(0, 4);

    fireEvent.keyDown(box, { key: 'b', ctrlKey: true });

    expect(box.value).toBe('**bolt**');
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

  it('offers strikethrough, superscript and subscript in the Format menu', () => {
    const { box } = setup('x2');
    box.setSelectionRange(1, 2);

    click('Format');
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'Format' })).getByRole('menuitem', {
        name: 'Superscript',
      }),
    );

    expect(box.value).toBe('x<sup>2</sup>');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clears the formatting of the selection', () => {
    const { box } = setup('**bold** <u>line</u>');
    box.setSelectionRange(0, box.value.length);

    click('Clear formatting');

    expect(box.value).toBe('bold line');
  });

  it('tells the form about every change, so the SEO analysis recounts', () => {
    const { box, onInput } = setup('load');
    box.setSelectionRange(0, 4);

    click('Bold');

    expect(onInput).toHaveBeenCalled();
  });
});

describe('MarkdownTextarea blocks', () => {
  it('sets headings from the block format menu, which follows the cursor', () => {
    const { box } = setup('Loads');
    box.setSelectionRange(2, 2);
    const menu = screen.getByLabelText('Block format');

    for (const name of [
      'Paragraph',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Heading 4',
      'Heading 5',
      'Heading 6',
      'Preformatted',
    ]) {
      expect(within(menu).getByRole('option', { name })).toBeInTheDocument();
    }

    fireEvent.change(menu, { target: { value: 'h2' } });

    expect(box.value).toBe('## Loads');
    expect(menu).toHaveValue('h2');
  });

  it('warns that the page title is already the H1', () => {
    const { box } = setup('Loads');
    box.setSelectionRange(0, 0);

    fireEvent.change(screen.getByLabelText('Block format'), { target: { value: 'h1' } });

    expect(screen.getByRole('status')).toHaveTextContent(/page title is already the H1/);
  });

  it('quotes, and makes bulleted and numbered lists', () => {
    const { box } = setup('one\ntwo');

    box.setSelectionRange(0, 7);
    click('Bulleted list');
    expect(box.value).toBe('- one\n- two');

    box.setSelectionRange(0, box.value.length);
    click('Numbered list');
    expect(box.value).toBe('1. one\n2. two');

    box.setSelectionRange(0, box.value.length);
    click('Numbered list');
    click('Blockquote');
    expect(box.value).toBe('> one\n> two');
  });

  it('picks a list style from the menu beside the list button', () => {
    const { box } = setup('x\ny');
    box.setSelectionRange(0, 3);

    click('Numbered list style');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Lower Roman (i, ii, iii)' }));

    expect(box.value).toBe('<div data-list="lower-roman">\n\n1. x\n2. y\n\n</div>');
  });

  it('aligns the paragraph and shows the alignment as pressed', () => {
    const { box } = setup('Beam');
    box.setSelectionRange(1, 1);

    click('Align centre');

    expect(box.value).toBe('<div data-align="center">\n\nBeam\n\n</div>');
    expect(screen.getByRole('button', { name: 'Align centre' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Align left' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    click('Align left');
    expect(box.value).toBe('Beam');
  });

  it('increases and decreases the indent', () => {
    const { box } = setup('Para');
    box.setSelectionRange(0, 0);

    click('Increase indent');
    expect(box.value).toBe('<div data-indent="1">\n\nPara\n\n</div>');

    click('Decrease indent');
    expect(box.value).toBe('Para');
  });

  it('inserts a horizontal line from the Insert menu', () => {
    const { box } = setup('Above');
    box.setSelectionRange(5, 5);

    click('Insert');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Horizontal line' }));

    expect(box.value).toBe('Above\n\n---\n\n');
  });

  it('closes a menu on Escape and hands focus back to its button', () => {
    setup();

    click('Insert');
    const menu = screen.getByRole('menu', { name: 'Insert' });
    expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert' })).toHaveFocus();
  });
});

describe('MarkdownTextarea panels', () => {
  it('links the selected words through the link panel', () => {
    const { box } = setup('see docs');
    box.setSelectionRange(4, 8);

    click('Link');
    const dialog = screen.getByRole('dialog', { name: 'Link' });
    expect(within(dialog).getByLabelText('Text to display')).toHaveValue('docs');

    fireEvent.change(within(dialog).getByLabelText('Link address (URL)'), {
      target: { value: 'https://x.test' },
    });
    click('Insert link');

    expect(box.value).toBe('see [docs](https://x.test)');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('refuses an unsafe address, and Enter never submits the surrounding form', () => {
    const { box, onSubmit } = setup('x');
    box.setSelectionRange(0, 1);

    fireEvent.keyDown(box, { key: 'k', ctrlKey: true });
    const address = screen.getByLabelText('Link address (URL)');
    fireEvent.change(address, { target: { value: 'javascript:alert(1)' } });
    fireEvent.keyDown(address, { key: 'Enter' });

    expect(screen.getByRole('alert')).toHaveTextContent(/https:\/\//);
    expect(box.value).toBe('x');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes the link at the cursor', () => {
    const { box } = setup('see [docs](https://x.test)');
    box.setSelectionRange(6, 6);

    click('Remove link');

    expect(box.value).toBe('see docs');
  });

  it('inserts a special character', () => {
    const { box } = setup('90');
    box.setSelectionRange(2, 2);

    click('Special character');
    click('Insert °');

    expect(box.value).toBe('90°');
  });

  it('inserts a table of the chosen size', () => {
    const { box } = setup('');
    box.setSelectionRange(0, 0);

    click('Insert a table');
    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '2' } });
    click('Insert table');

    expect(box.value).toBe('| Column 1 | Column 2 |\n| --- | --- |\n|     |     |\n\n');
  });

  it('requires alt text before inserting an image by its address', () => {
    const { box } = setup('');
    box.setSelectionRange(0, 0);

    click('Image');
    fireEvent.change(screen.getByLabelText('Image or video address (URL)'), {
      target: { value: 'https://x.test/b.png' },
    });
    click('Insert image');
    expect(screen.getByRole('alert')).toHaveTextContent('Write the alt text first.');

    fireEvent.change(screen.getByLabelText('Alt text'), { target: { value: 'Beam detail' } });
    click('Insert image');

    expect(box.value).toBe('![Beam detail](https://x.test/b.png)\n\n');
  });

  it('uploads an image from the computer with its alt text, then inserts it', async () => {
    request.mockResolvedValue({
      data: { id: 9, url: 'https://cdn.test/beam.webp', alt_text: 'Beam' },
    });
    const { box } = setup('');
    box.setSelectionRange(0, 0);

    click('Image');
    fireEvent.change(screen.getByLabelText('Alt text'), { target: { value: 'Beam' } });
    fireEvent.change(screen.getByLabelText('Choose an image or video file'), {
      target: { files: [new File(['x'], 'beam.png', { type: 'image/png' })] },
    });

    await act(async () => {
      click('Insert image');
    });

    const [path, options] = request.mock.calls[0];
    expect(path).toBe('/admin/media');
    expect((options.body as FormData).get('alt_text')).toBe('Beam');
    expect(box.value).toBe('![Beam](https://cdn.test/beam.webp)\n\n');
  });

  it('uploads a video in parts and inserts it for the page to play', async () => {
    uploadInParts.mockResolvedValue({ upload_id: 'u-1', total: 3, filename: 'walkthrough.mp4' });
    request.mockResolvedValue({ data: { id: 10, url: 'https://cdn.test/walkthrough.mp4' } });
    const { box } = setup('');
    box.setSelectionRange(0, 0);

    click('Image');
    fireEvent.change(screen.getByLabelText('Alt text'), {
      target: { value: 'Triplex walkthrough' },
    });
    fireEvent.change(screen.getByLabelText('Choose an image or video file'), {
      target: { files: [new File(['x'], 'walkthrough.mp4', { type: 'video/mp4' })] },
    });

    await act(async () => {
      click('Insert image');
    });

    expect(request).toHaveBeenCalledWith('/admin/media', {
      method: 'POST',
      body: {
        upload_id: 'u-1',
        total: 3,
        filename: 'walkthrough.mp4',
        duration_seconds: 253,
        title: 'Triplex walkthrough',
      },
    });
    expect(box.value).toBe('![Triplex walkthrough](https://cdn.test/walkthrough.mp4)\n\n');
  });

  it('says why an upload failed', async () => {
    request.mockRejectedValue(new Error('You do not have permission.'));
    setup('');

    click('Image');
    fireEvent.change(screen.getByLabelText('Alt text'), { target: { value: 'Beam' } });
    fireEvent.change(screen.getByLabelText('Choose an image or video file'), {
      target: { files: [new File(['x'], 'beam.png', { type: 'image/png' })] },
    });

    await act(async () => {
      click('Insert image');
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The image could not be uploaded. You do not have permission.',
    );
  });

  it('closes a panel on Escape', () => {
    setup();

    click('Help');
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveTextContent('Ctrl+K');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('MarkdownTextarea editing tools', () => {
  it('undoes and redoes a toolbar change', () => {
    const { box } = setup('load');
    box.setSelectionRange(0, 4);

    click('Bold');
    expect(box.value).toBe('**load**');

    click('Undo');
    expect(box.value).toBe('load');

    click('Redo');
    expect(box.value).toBe('**load**');
  });

  it('counts words and characters as the text changes', () => {
    const { box } = setup('two words');

    expect(screen.getByText('Words: 2 · Characters: 9')).toBeInTheDocument();

    fireEvent.input(box, { target: { value: 'now three words' } });

    expect(screen.getByText('Words: 3 · Characters: 15')).toBeInTheDocument();
  });

  it('fills the window in full screen, and Escape leaves it', () => {
    const { box } = setup();

    click('Full screen');
    const frame = box.closest('[data-fullscreen]');
    expect(frame).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(box, { key: 'Escape' });

    expect(box.closest('[data-fullscreen]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('MarkdownTextarea preview', () => {
  it('renders the text with the server renderer and keeps the field in the form', async () => {
    request.mockResolvedValue({ data: { html: '<h2>Loads</h2>' } });
    const { box } = setup('## Loads');

    await act(async () => {
      click('Preview');
    });

    expect(request).toHaveBeenCalledWith('/admin/markdown/preview', {
      method: 'POST',
      body: { markdown: '## Loads' },
    });
    expect(await screen.findByRole('heading', { name: 'Loads' })).toBeInTheDocument();
    // Hidden while previewing, but still submitted with the form.
    expect(box).not.toBeVisible();
    expect(
      new FormData(screen.getByRole('form', { name: 'Editor' }) as HTMLFormElement).get('body'),
    ).toBe('## Loads');
    // Nothing can edit the hidden text meanwhile.
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();

    click('Write');
    expect(box).toBeVisible();
  });

  it('says so when the preview cannot be rendered', async () => {
    request.mockRejectedValue(new Error('offline'));
    setup('x');

    await act(async () => {
      click('Preview');
    });

    expect(await screen.findByText('The preview could not be shown.')).toBeInTheDocument();
  });
});
