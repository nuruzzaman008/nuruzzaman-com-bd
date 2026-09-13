/**
 * Text edits behind the editor toolbar, as pure functions of the text and the
 * selection, so they can be tested without a browser.
 *
 * Everything produced here is either plain Markdown (headings, bold, italic)
 * or one of the few tags the API's renderer allows through (see
 * App\Support\MarkdownFormatting). The token lists below must match that
 * class's constants; an unknown token is simply rendered as plain text.
 */

export const COLORS = ['blue', 'teal', 'green', 'red', 'orange', 'navy', 'gray'] as const;
export const SIZES = ['sm', 'lg', 'xl', '2xl'] as const;
export const FONTS = ['bangla', 'english', 'serif', 'mono'] as const;

export type Edit = {
  /** The range of the original text to replace. */
  replaceStart: number;
  replaceEnd: number;
  /** What goes in its place. */
  text: string;
  /** The whole text afterwards. */
  value: string;
  /** What to select afterwards. */
  selectionStart: number;
  selectionEnd: number;
};

/**
 * Wraps the selection in `before` and `after`. With nothing selected, a
 * placeholder is inserted and selected, so typing replaces it.
 */
export function wrap(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): Edit {
  const selected = value.slice(start, end) || placeholder;
  const text = `${before}${selected}${after}`;

  return {
    replaceStart: start,
    replaceEnd: end,
    text,
    value: value.slice(0, start) + text + value.slice(end),
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

/** A colour, size or font, as the tag the renderer recognises. */
export function spanTag(kind: 'color' | 'size' | 'font', token: string): string {
  return `<span data-${kind}="${token}">`;
}

/**
 * Makes every line the selection touches a heading of `level`, replacing a
 * heading mark already there rather than stacking a second one. On an empty
 * line a placeholder is inserted and selected.
 */
export function heading(
  value: string,
  start: number,
  end: number,
  level: number,
  placeholder: string,
): Edit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  // A selection that ends just after a line break does not reach the next line.
  const searchFrom = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nextBreak = value.indexOf('\n', searchFrom);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  const prefix = `${'#'.repeat(level)} `;
  const lines = value.slice(lineStart, lineEnd).split('\n');

  if (lines.length === 1 && lines[0].trim() === '') {
    const text = `${prefix}${placeholder}`;

    return {
      replaceStart: lineStart,
      replaceEnd: lineEnd,
      text,
      value: value.slice(0, lineStart) + text + value.slice(lineEnd),
      selectionStart: lineStart + prefix.length,
      selectionEnd: lineStart + text.length,
    };
  }

  const text = lines
    .map((line) => (line.trim() === '' ? line : prefix + line.replace(/^\s{0,3}#{1,6}\s+/, '')))
    .join('\n');

  return {
    replaceStart: lineStart,
    replaceEnd: lineEnd,
    text,
    value: value.slice(0, lineStart) + text + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + text.length,
  };
}
