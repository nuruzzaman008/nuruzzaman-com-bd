import { describe, expect, it } from 'vitest';

import { COLORS, FONTS, SIZES, heading, spanTag, wrap } from '@/lib/markdown-format';

describe('wrap', () => {
  it('wraps the selection and keeps it selected', () => {
    const edit = wrap('carry the load', 6, 9, '**', '**', 'text');

    expect(edit.value).toBe('carry **the** load');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe('the');
  });

  it('inserts a selected placeholder when nothing is selected', () => {
    const edit = wrap('ab', 1, 1, '<u>', '</u>', 'text');

    expect(edit.value).toBe('a<u>text</u>b');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe('text');
  });

  it('reports the range it replaced, for the browser to apply', () => {
    const edit = wrap('one two', 4, 7, '*', '*', 'text');

    expect([edit.replaceStart, edit.replaceEnd, edit.text]).toEqual([4, 7, '*two*']);
  });
});

describe('heading', () => {
  it('turns the line under the cursor into a heading', () => {
    const edit = heading('intro\nLoads\nend', 8, 8, 2, 'text');

    expect(edit.value).toBe('intro\n## Loads\nend');
  });

  it('replaces an existing heading mark instead of stacking another', () => {
    expect(heading('### Loads', 3, 3, 2, 'text').value).toBe('## Loads');
    expect(heading('# Loads', 0, 0, 6, 'text').value).toBe('###### Loads');
  });

  it('applies to every line the selection touches, leaving blank lines alone', () => {
    const value = 'one\n\ntwo\nthree';
    const edit = heading(value, 0, value.indexOf('two') + 3, 3, 'text');

    expect(edit.value).toBe('### one\n\n### two\nthree');
  });

  it('does not reach the next line when the selection ends on a line break', () => {
    expect(heading('one\ntwo', 0, 4, 2, 'text').value).toBe('## one\ntwo');
  });

  it('inserts a selected placeholder on an empty line', () => {
    const edit = heading('before\n\nafter', 7, 7, 4, 'text');

    expect(edit.value).toBe('before\n#### text\nafter');
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe('text');
  });
});

describe('spanTag', () => {
  it('produces exactly the shape the server renderer recognises', () => {
    expect(spanTag('color', 'blue')).toBe('<span data-color="blue">');
    expect(spanTag('size', '2xl')).toBe('<span data-size="2xl">');
    expect(spanTag('font', 'serif')).toBe('<span data-font="serif">');
  });

  it('offers only tokens made of the characters the renderer accepts', () => {
    // App\Support\MarkdownFormatting matches [a-z0-9]+; anything else would be
    // left as raw HTML and stripped, silently losing the formatting.
    for (const token of [...COLORS, ...SIZES, ...FONTS]) {
      expect(token).toMatch(/^[a-z0-9]+$/);
    }
  });
});
