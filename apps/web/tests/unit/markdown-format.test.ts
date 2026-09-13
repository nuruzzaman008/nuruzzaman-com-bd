import { describe, expect, it } from 'vitest';

import {
  BULLET_STYLES,
  COLORS,
  FONTS,
  NUMBER_STYLES,
  SIZES,
  align,
  blockFormat,
  blockFormatAt,
  clearFormatting,
  fromValue,
  heading,
  image,
  indent,
  insertBlock,
  link,
  listStyle,
  normalizeUrl,
  plainText,
  spanTag,
  tableMarkdown,
  toggleList,
  toggleQuote,
  unlink,
  wordCount,
  wrap,
  wrapperAt,
} from '@/lib/markdown-format';

const selected = (edit: { value: string; selectionStart: number; selectionEnd: number }) =>
  edit.value.slice(edit.selectionStart, edit.selectionEnd);

describe('wrap', () => {
  it('wraps the selection and keeps it selected', () => {
    const edit = wrap('carry the load', 6, 9, '**', '**', 'text');

    expect(edit.value).toBe('carry **the** load');
    expect(selected(edit)).toBe('the');
  });

  it('inserts a selected placeholder when nothing is selected', () => {
    const edit = wrap('ab', 1, 1, '<u>', '</u>', 'text');

    expect(edit.value).toBe('a<u>text</u>b');
    expect(selected(edit)).toBe('text');
  });

  it('reports the range it replaced, for the browser to apply', () => {
    const edit = wrap('one two', 4, 7, '*', '*', 'text');

    expect([edit.replaceStart, edit.replaceEnd, edit.text]).toEqual([4, 7, '*two*']);
  });

  it('removes the markers when the selection is already wrapped', () => {
    expect(wrap('carry **the** load', 8, 11, '**', '**', 'text').value).toBe('carry the load');
    expect(wrap('carry **the** load', 6, 13, '**', '**', 'text').value).toBe('carry the load');
  });

  it('adds italic to bold text instead of taking a star off the bold', () => {
    expect(wrap('**the**', 2, 5, '*', '*', 'text').value).toBe('***the***');
  });
});

describe('blockFormat', () => {
  it('turns the line under the cursor into a heading', () => {
    expect(heading('intro\nLoads\nend', 8, 8, 2, 'text').value).toBe('intro\n## Loads\nend');
  });

  it('replaces an existing heading mark instead of stacking another', () => {
    expect(heading('### Loads', 3, 3, 2, 'text').value).toBe('## Loads');
    expect(heading('# Loads', 0, 0, 6, 'text').value).toBe('###### Loads');
  });

  it('applies to every line the selection touches, leaving blank lines alone', () => {
    const value = 'one\n\ntwo\nthree';

    expect(heading(value, 0, value.indexOf('two') + 3, 3, 'text').value).toBe(
      '### one\n\n### two\nthree',
    );
  });

  it('does not reach the next line when the selection ends on a line break', () => {
    expect(heading('one\ntwo', 0, 4, 2, 'text').value).toBe('## one\ntwo');
  });

  it('inserts a selected placeholder on an empty line, including the very first one', () => {
    const edit = heading('before\n\nafter', 7, 7, 4, 'text');

    expect(edit.value).toBe('before\n#### text\nafter');
    expect(selected(edit)).toBe('text');
    // The first line of a text starting with a line break is that empty line,
    // not the one after it.
    expect(heading('\nabc', 0, 0, 2, 'text').value).toBe('## text\nabc');
  });

  it('makes a heading a paragraph again', () => {
    expect(blockFormat('## Loads', 4, 4, 'p', 'text').value).toBe('Loads');
  });

  it('fences lines as preformatted text and takes the fences away again', () => {
    const fenced = blockFormat('x = 1\ny = 2', 0, 11, 'pre', 'text');

    expect(fenced.value).toBe('```\nx = 1\ny = 2\n```');
    expect(blockFormatAt(fenced.value, 5)).toBe('pre');
    expect(blockFormat(fenced.value, 5, 5, 'p', 'text').value).toBe('x = 1\ny = 2');
    expect(blockFormat(fenced.value, 5, 5, 'h3', 'text').value).toBe('### x = 1\ny = 2');
  });

  it('reports the format at the cursor', () => {
    expect(blockFormatAt('intro\n### Loads', 8)).toBe('h3');
    expect(blockFormatAt('intro\n### Loads', 2)).toBe('p');
  });
});

describe('quotes and lists', () => {
  it('quotes paragraphs as one quote, and unquotes them', () => {
    const quoted = toggleQuote('a\n\nb', 0, 4, 'text');

    expect(quoted.value).toBe('> a\n>\n> b');
    expect(toggleQuote(quoted.value, 0, quoted.value.length, 'text').value).toBe('a\n\nb');
  });

  it('makes and removes bulleted and numbered lists', () => {
    expect(toggleList('one\ntwo', 0, 7, 'bullet', 'text').value).toBe('- one\n- two');
    expect(toggleList('one\ntwo', 0, 7, 'number', 'text').value).toBe('1. one\n2. two');
    expect(toggleList('1. one\n2. two', 0, 13, 'number', 'text').value).toBe('one\ntwo');
  });

  it('turns one kind of list into the other, keeping nesting', () => {
    expect(toggleList('- one\n    - sub\n- two', 0, 20, 'number', 'text').value).toBe(
      '1. one\n    1. sub\n2. two',
    );
  });

  it('starts a list with a placeholder on an empty line', () => {
    const edit = toggleList('', 0, 0, 'number', 'text');

    expect(edit.value).toBe('1. text');
    expect(selected(edit)).toBe('text');
  });

  it('styles a list with a wrapper, changes it, and removes it for the default', () => {
    const roman = listStyle('x\ny', 0, 3, 'number', 'lower-roman', 'text');

    expect(roman.value).toBe('<div data-list="lower-roman">\n\n1. x\n2. y\n\n</div>');

    const square = listStyle('- a\n- b', 1, 1, 'bullet', 'square', 'text');
    expect(square.value).toBe('<div data-list="square">\n\n- a\n- b\n\n</div>');

    const circle = listStyle(
      square.value,
      square.selectionStart,
      square.selectionStart,
      'bullet',
      'circle',
      'text',
    );
    expect(circle.value).toBe('<div data-list="circle">\n\n- a\n- b\n\n</div>');

    const plain = listStyle(
      circle.value,
      circle.selectionStart,
      circle.selectionStart,
      'bullet',
      'disc',
      'text',
    );
    expect(plain.value).toBe('- a\n- b');
  });
});

describe('alignment and indentation', () => {
  const text = 'Intro\n\nBeam text\n\nEnd';

  it('wraps only the paragraph at the cursor, with blank lines around the wrapper', () => {
    const centred = align(text, 9, 9, 'center', 'text');

    expect(centred.value).toBe('Intro\n\n<div data-align="center">\n\nBeam text\n\n</div>\n\nEnd');
    // The cursor stays where it was in the words.
    expect(centred.value.slice(centred.selectionStart, centred.selectionStart + 2)).toBe('am');
  });

  it('changes an alignment in place, and left removes it entirely', () => {
    const centred = align(text, 9, 9, 'center', 'text');
    const right = align(
      centred.value,
      centred.selectionStart,
      centred.selectionStart,
      'right',
      'text',
    );

    expect(right.value).toBe('Intro\n\n<div data-align="right">\n\nBeam text\n\n</div>\n\nEnd');
    expect(wrapperAt(right.value, right.selectionStart, right.selectionStart, 'align')).toBe(
      'right',
    );

    const left = align(right.value, right.selectionStart, right.selectionStart, 'left', 'text');
    expect(left.value).toBe(text);
  });

  it('removes a wrapper at the very end of the text cleanly', () => {
    const centred = align('Beam', 0, 4, 'center', 'text');

    expect(
      align(centred.value, centred.selectionStart, centred.selectionEnd, 'left', 'text').value,
    ).toBe('Beam');
  });

  it('aligns an empty line by writing a placeholder first', () => {
    const edit = align('A\n\n', 3, 3, 'center', 'text');

    expect(edit.value).toBe('A\n\n<div data-align="center">\n\ntext\n\n</div>');
    expect(selected(edit)).toBe('text');
  });

  it('finds its own wrapper among others around the same paragraph', () => {
    const indented = indent('Para', 0, 0, 1, 'text');
    const both = align(
      indented.value,
      indented.selectionStart,
      indented.selectionStart,
      'center',
      'text',
    );

    expect(both.value).toBe(
      '<div data-indent="1">\n\n<div data-align="center">\n\nPara\n\n</div>\n\n</div>',
    );
    expect(wrapperAt(both.value, both.selectionStart, both.selectionStart, 'indent')).toBe('1');

    const unaligned = align(both.value, both.selectionStart, both.selectionStart, 'left', 'text');
    expect(unaligned.value).toBe(indented.value);
  });

  it('indents a paragraph up to three steps and back', () => {
    let edit = indent('Para', 0, 0, 1, 'text');
    expect(edit.value).toBe('<div data-indent="1">\n\nPara\n\n</div>');

    for (let i = 0; i < 4; i++) {
      edit = indent(edit.value, edit.selectionStart, edit.selectionStart, 1, 'text');
    }
    expect(edit.value).toBe('<div data-indent="3">\n\nPara\n\n</div>');

    for (let i = 0; i < 3; i++) {
      edit = indent(edit.value, edit.selectionStart, edit.selectionStart, -1, 'text');
    }
    expect(edit.value).toBe('Para');
  });

  it('nests a list item under the one above it, and un-nests it', () => {
    const nested = indent('- a\n- b', 6, 6, 1, 'text');

    expect(nested.value).toBe('- a\n    - b');
    expect(indent(nested.value, 9, 9, -1, 'text').value).toBe('- a\n- b');
  });

  it('indents the first item as a block, since it has nothing to nest under', () => {
    expect(indent('- a\n- b', 1, 1, 1, 'text').value).toBe(
      '<div data-indent="1">\n\n- a\n- b\n\n</div>',
    );
  });
});

describe('links and images', () => {
  it('accepts web, mail, site and anchor addresses, and completes a bare domain', () => {
    expect(normalizeUrl('https://example.test/a')).toBe('https://example.test/a');
    expect(normalizeUrl('mailto:info@example.test')).toBe('mailto:info@example.test');
    expect(normalizeUrl('/products')).toBe('/products');
    expect(normalizeUrl('#loads')).toBe('#loads');
    expect(normalizeUrl('example.test/tools')).toBe('https://example.test/tools');
  });

  it('refuses addresses that could run script or leave the scheme out', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      '//evil.test',
      'vbscript:x',
      '',
      'a"b',
    ]) {
      expect(normalizeUrl(bad), bad).toBeNull();
    }
  });

  it('links the selected words, or the address when nothing is selected', () => {
    expect(link('see docs', 4, 8, 'https://x.test')?.value).toBe('see [docs](https://x.test)');
    expect(link('see ', 4, 4, 'https://x.test')?.value).toBe(
      'see [https://x.test](https://x.test)',
    );
    expect(link('a', 0, 1, 'https://x.test/a_(b)')?.value).toBe('[a](<https://x.test/a_(b)>)');
    expect(link('a', 0, 1, 'javascript:alert(1)')).toBeNull();
  });

  it('removes the link at the cursor, keeping its words', () => {
    const edit = unlink('see [the docs](https://x.test) now', 6, 6);

    expect(edit?.value).toBe('see the docs now');
    expect(edit && selected(edit)).toBe('the docs');
    expect(unlink('no links here', 3, 3)).toBeNull();
    // An image is not a link.
    expect(unlink('![beam](/b.png)', 3, 3)).toBeNull();
  });

  it('puts an image in a paragraph of its own', () => {
    expect(image('Text', 4, 4, 'https://x.test/b.png', 'Beam [detail]')?.value).toBe(
      'Text\n\n![Beam \\[detail\\]](https://x.test/b.png)\n\n',
    );
  });
});

describe('insertBlock and tableMarkdown', () => {
  it('separates a horizontal line with blank lines, so the text above stays a paragraph', () => {
    expect(insertBlock('A\nB', 1, 1, '---').value).toBe('A\n\n---\n\nB');
    expect(insertBlock('', 0, 0, '---').value).toBe('---\n\n');
  });

  it('builds a table with a header row and empty cells, within limits', () => {
    const table = tableMarkdown(2, 3, (n) => `Column ${n}`);

    expect(table.split('\n')).toEqual([
      '| Column 1 | Column 2 | Column 3 |',
      '| --- | --- | --- |',
      '|     |     |     |',
      '|     |     |     |',
    ]);
    expect(tableMarkdown(500, 0, String).split('\n')).toHaveLength(22);
  });
});

describe('clearFormatting', () => {
  it('removes every kind of inline formatting from the selection', () => {
    const value = 'a **b** <u>c</u> <span data-color="red">d</span> ~~e~~ *f* `g` x<sup>2</sup>';

    expect(clearFormatting(value, 0, value.length).value).toBe('a b c d e f g x2');
  });

  it('takes the markers just outside the selection with it', () => {
    const edit = clearFormatting('**bold** and', 2, 6);

    expect(edit.value).toBe('bold and');
    expect(selected(edit)).toBe('bold');
  });

  it('leaves list markers and headings alone', () => {
    expect(clearFormatting('* item with **bold**', 3, 3).value).toBe('* item with bold');
  });
});

describe('fromValue', () => {
  it('replaces only what changed', () => {
    expect(fromValue('abcdef', 'abXYef', 0, 0)).toMatchObject({
      replaceStart: 2,
      replaceEnd: 4,
      text: 'XY',
    });
  });

  it('never splits an emoji', () => {
    expect(fromValue('a😀', 'a😃', 0, 0)).toMatchObject({
      replaceStart: 1,
      replaceEnd: 3,
      text: '😃',
    });
  });
});

describe('wordCount', () => {
  it('counts the words a reader sees, Bengali included', () => {
    expect(wordCount('## লোড **হিসাব**\n\n- beam one')).toEqual({ words: 4, characters: 18 });
  });

  it('ignores formatting tags and link addresses', () => {
    expect(plainText('<div data-align="center">\n\n[docs](https://x.test)\n\n</div>').trim()).toBe(
      'docs',
    );
    expect(wordCount('<u>one</u> ![alt](/a.png)').words).toBe(1);
  });
});

describe('tokens', () => {
  it('produces exactly the span shape the server renderer recognises', () => {
    expect(spanTag('color', 'blue')).toBe('<span data-color="blue">');
    expect(spanTag('size', '2xl')).toBe('<span data-size="2xl">');
    expect(spanTag('font', 'serif')).toBe('<span data-font="serif">');
  });

  it('offers only tokens made of the characters the renderer accepts', () => {
    // App\Support\MarkdownFormatting matches [a-z0-9]+ for spans and
    // [a-z0-9-]+ for blocks; anything else would be stripped, silently losing
    // the formatting.
    for (const token of [...COLORS, ...SIZES, ...FONTS]) {
      expect(token).toMatch(/^[a-z0-9]+$/);
    }

    for (const token of [...BULLET_STYLES, ...NUMBER_STYLES]) {
      expect(token).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
