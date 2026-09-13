/**
 * Text edits behind the editor toolbar, as pure functions of the text and the
 * selection, so they can be tested without a browser.
 *
 * Everything produced here is either plain Markdown (headings, emphasis,
 * lists, quotes, links, tables) or one of the few tags the API's renderer
 * allows through (see App\Support\MarkdownFormatting). The token lists below
 * must match that class's constants; an unknown token is rendered as nothing.
 *
 * Block formatting - alignment, indentation, list styles - is a wrapper on
 * lines of its own, separated by blank lines:
 *
 *   <div data-align="center">
 *
 *   The paragraphs it formats
 *
 *   </div>
 *
 * The blank lines are what make it reliable: the wrapper lines can never be
 * read as part of the paragraph, list or quote they surround.
 */

export const COLORS = ['blue', 'teal', 'green', 'red', 'orange', 'navy', 'gray'] as const;
export const SIZES = ['sm', 'lg', 'xl', '2xl'] as const;
export const FONTS = ['bangla', 'english', 'serif', 'mono'] as const;

/** Left is the default, so it is the absence of a wrapper rather than a token. */
export const ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export const MAX_INDENT = 3;
export const BULLET_STYLES = ['disc', 'circle', 'square'] as const;
export const NUMBER_STYLES = [
  'decimal',
  'lower-alpha',
  'upper-alpha',
  'lower-roman',
  'upper-roman',
] as const;

export const BLOCK_FORMATS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'] as const;

/**
 * Symbols that are awkward to type: engineering notation first, then
 * typography, currency and arrows.
 */
export const SPECIAL_CHARACTERS = [
  '°',
  '±',
  '×',
  '÷',
  '≈',
  '≠',
  '≤',
  '≥',
  '∞',
  '√',
  '∑',
  '∆',
  '∅',
  '‰',
  '′',
  '″',
  '²',
  '³',
  '½',
  '¼',
  '¾',
  'α',
  'β',
  'γ',
  'δ',
  'ε',
  'θ',
  'λ',
  'µ',
  'π',
  'σ',
  'τ',
  'φ',
  'Ω',
  '©',
  '®',
  '™',
  '§',
  '¶',
  '•',
  '…',
  '–',
  '—',
  '«',
  '»',
  '৳',
  '€',
  '£',
  '¥',
  '←',
  '→',
  '↑',
  '↓',
  '✓',
  '✗',
] as const;

export type BlockFormat = (typeof BLOCK_FORMATS)[number];
export type Align = (typeof ALIGNS)[number];
export type ListKind = 'bullet' | 'number';
export type WrapperKind = 'align' | 'indent' | 'list';

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

/* ------------------------------------------------------------------ basics */

function replace(
  value: string,
  from: number,
  to: number,
  text: string,
  selectionStart: number,
  selectionEnd: number,
): Edit {
  return {
    replaceStart: from,
    replaceEnd: to,
    text,
    value: value.slice(0, from) + text + value.slice(to),
    selectionStart,
    selectionEnd,
  };
}

/**
 * An edit that turns `value` into `next`, replacing only the part that
 * changed. Edits made in several steps are expressed this way, so the browser
 * records one small change in its undo history rather than the whole text.
 */
export function fromValue(
  value: string,
  next: string,
  selectionStart: number,
  selectionEnd: number,
): Edit {
  const limit = Math.min(value.length, next.length);
  let prefix = 0;

  while (prefix < limit && value[prefix] === next[prefix]) {
    prefix++;
  }

  // Never split an emoji or other surrogate pair across the boundary.
  if (prefix > 0 && isHighSurrogate(value.charCodeAt(prefix - 1))) {
    prefix--;
  }

  let suffix = 0;

  while (
    suffix < limit - prefix &&
    value[value.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++;
  }

  if (suffix > 0 && isLowSurrogate(value.charCodeAt(value.length - suffix))) {
    suffix--;
  }

  return {
    replaceStart: prefix,
    replaceEnd: value.length - suffix,
    text: next.slice(prefix, next.length - suffix),
    value: next,
    selectionStart,
    selectionEnd,
  };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function lineStartAt(value: string, index: number): number {
  return index <= 0 ? 0 : value.lastIndexOf('\n', index - 1) + 1;
}

function lineEndAt(value: string, index: number): number {
  const lineBreak = value.indexOf('\n', index);

  return lineBreak === -1 ? value.length : lineBreak;
}

/**
 * The whole lines a selection touches. A selection that ends just after a
 * line break does not reach the next line.
 */
function selectedLines(value: string, start: number, end: number) {
  const from = lineStartAt(value, start);
  const reach = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const to = lineEndAt(value, Math.max(reach, from));

  return { from, to, lines: value.slice(from, to).split('\n') };
}

const isBlank = (line: string) => line.trim() === '';

type Line = { text: string; start: number; end: number };

function linesOf(value: string): Line[] {
  const lines: Line[] = [];
  let offset = 0;

  for (const text of value.split('\n')) {
    lines.push({ text, start: offset, end: offset + text.length });
    offset += text.length + 1;
  }

  return lines;
}

function lineIndexAt(lines: Line[], index: number): number {
  let found = 0;

  for (let i = 0; i < lines.length && lines[i].start <= index; i++) {
    found = i;
  }

  return found;
}

/* ------------------------------------------------------------------ inline */

/**
 * Wraps the selection in `before` and `after`, or removes them when the
 * selection is already wrapped. With nothing selected, a placeholder is
 * inserted and selected, so typing replaces it.
 */
export function wrap(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): Edit {
  const selected = value.slice(start, end);

  // `*` and `_` also make bold; italic must not unwrap one star of `**bold**`.
  const marker = /^(\*+|_+)$/.test(before) ? before[0] : null;

  if (
    selected &&
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after &&
    !(
      marker &&
      (value[start - before.length - 1] === marker || value[end + after.length] === marker)
    )
  ) {
    return replace(
      value,
      start - before.length,
      end + after.length,
      selected,
      start - before.length,
      end - before.length,
    );
  }

  if (
    selected.length >= before.length + after.length + 1 &&
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    !(
      marker &&
      (selected[before.length] === marker ||
        selected[selected.length - after.length - 1] === marker)
    )
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);

    return replace(value, start, end, inner, start, start + inner.length);
  }

  const text = `${before}${selected || placeholder}${after}`;

  return replace(
    value,
    start,
    end,
    text,
    start + before.length,
    start + before.length + (selected || placeholder).length,
  );
}

/** A colour, size or font, as the tag the renderer recognises. */
export function spanTag(kind: 'color' | 'size' | 'font', token: string): string {
  return `<span data-${kind}="${token}">`;
}

/** A block wrapper, as the tag the renderer recognises. */
export function wrapperTag(kind: WrapperKind, token: string): string {
  return `<div data-${kind}="${token}">`;
}

/** Replaces the selection with `text` and puts the cursor after it. */
export function insertText(value: string, start: number, end: number, text: string): Edit {
  return replace(value, start, end, text, start + text.length, start + text.length);
}

const INLINE_PAIRS: Array<[string, string]> = [
  ['**', '**'],
  ['__', '__'],
  ['~~', '~~'],
  ['*', '*'],
  ['_', '_'],
  ['`', '`'],
  ['<u>', '</u>'],
  ['<sup>', '</sup>'],
  ['<sub>', '</sub>'],
];

/**
 * Removes inline formatting - emphasis, strikethrough, code, underline,
 * superscript, subscript, colour, size and font - from the selection, or from
 * the current line when nothing is selected. Headings, lists and other block
 * formatting are left alone.
 */
export function clearFormatting(value: string, start: number, end: number): Edit {
  let from = start;
  let to = end;

  if (start === end) {
    from = lineStartAt(value, start);
    to = lineEndAt(value, start);
  } else {
    // A selection just inside the markers takes the markers with it.
    for (let grown = true; grown;) {
      grown = false;

      for (const [open, close] of INLINE_PAIRS) {
        if (
          value.slice(from - open.length, from) === open &&
          value.slice(to, to + close.length) === close
        ) {
          from -= open.length;
          to += close.length;
          grown = true;
          break;
        }
      }

      const span = /<span data-(?:color|size|font)="[a-z0-9]+">$/.exec(
        value.slice(Math.max(0, from - 40), from),
      );

      if (!grown && span && value.slice(to, to + 7) === '</span>') {
        from -= span[0].length;
        to += 7;
        grown = true;
      }
    }
  }

  const cleaned = value
    .slice(from, to)
    .replace(/<\/?(?:u|sup|sub)\s*>/gi, '')
    .replace(/<span\s+data-(?:color|size|font)\s*=\s*(["'])[a-z0-9]+\1\s*>/gi, '')
    .replace(/<\/span\s*>/gi, '')
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
    .replace(/(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])/g, '$1$2')
    .replace(/(^|[^\w_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\w_])/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1');

  return fromValue(
    value,
    value.slice(0, from) + cleaned + value.slice(to),
    from,
    from + cleaned.length,
  );
}

/* ------------------------------------------------------------------- links */

/**
 * A link or image address the renderer will keep, or null. A bare domain gets
 * https:// in front; anything that could run script (`javascript:`, `data:`)
 * or reach another origin without a scheme (`//host`) is refused.
 */
export function normalizeUrl(input: string): string | null {
  const url = input.trim().replace(/ /g, '%20');

  if (url === '' || /[\s<>"`]/.test(url)) {
    return null;
  }

  if (/^(?:https?:\/\/[^/]|mailto:[^@]+@|\/(?!\/)|#)/i.test(url)) {
    return url;
  }

  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#].*)?$/i.test(url)) {
    return `https://${url}`;
  }

  return null;
}

function destination(url: string): string {
  return /[()]/.test(url) ? `<${url}>` : url;
}

function escapeLabel(text: string): string {
  return text.replace(/([[\]\\])/g, '\\$1');
}

/**
 * Turns the selection into a link, showing `text` if given, else the selected
 * words, else the address itself. Null when the address is not acceptable.
 */
export function link(
  value: string,
  start: number,
  end: number,
  url: string,
  text = '',
): Edit | null {
  const address = normalizeUrl(url);

  if (!address) {
    return null;
  }

  const label = text.trim() || value.slice(start, end) || address;

  return insertText(value, start, end, `[${escapeLabel(label)}](${destination(address)})`);
}

/** An image on a line of its own. Null when the address is not acceptable. */
export function image(
  value: string,
  start: number,
  end: number,
  url: string,
  alt: string,
): Edit | null {
  const address = normalizeUrl(url);

  return address
    ? insertBlock(value, start, end, `![${escapeLabel(alt.trim())}](${destination(address)})`)
    : null;
}

const LINK = /(!?)\[((?:\\.|[^\]\\])*)\]\((?:<[^>]*>|[^)\s]*)(?:\s+"[^"]*")?\)/g;

/**
 * Removes every link the selection touches, keeping its words. Null when
 * there is no link there.
 */
export function unlink(value: string, start: number, end: number): Edit | null {
  let out = '';
  let cursor = 0;
  let selectFrom = -1;
  let selectTo = -1;

  for (const match of value.matchAll(LINK)) {
    const from = match.index;
    const to = from + match[0].length;
    const touches = start === end ? start >= from && start <= to : start < to && end > from;

    // An image is not a link, even though it looks like one with a `!`.
    if (match[1] === '!' || !touches) {
      continue;
    }

    out += value.slice(cursor, from);
    selectFrom = selectFrom < 0 ? out.length : selectFrom;
    out += match[2].replace(/\\([[\]\\])/g, '$1');
    selectTo = out.length;
    cursor = to;
  }

  if (selectFrom < 0) {
    return null;
  }

  return fromValue(value, out + value.slice(cursor), selectFrom, selectTo);
}

/* ------------------------------------------------------------------ blocks */

/**
 * Puts `block` in a paragraph of its own - blank lines before and after - and
 * the cursor after it. A horizontal rule needs this: `---` under a line of
 * text would turn that text into a heading instead.
 */
export function insertBlock(value: string, start: number, end: number, block: string): Edit {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead =
    before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const text = lead + block + trail;
  const cursor = start + text.length;

  return replace(value, start, end, text, cursor, cursor);
}

/** A Markdown table with a header row of `header(n)` and empty body cells. */
export function tableMarkdown(
  rows: number,
  columns: number,
  header: (column: number) => string,
): string {
  const count = (n: number, max: number) => Math.min(max, Math.max(1, Math.floor(n) || 1));
  const cols = count(columns, 10);
  const row = (cells: string[]) => `| ${cells.join(' | ')} |`;

  return [
    row(Array.from({ length: cols }, (_, i) => header(i + 1))),
    row(Array<string>(cols).fill('---')),
    ...Array.from({ length: count(rows, 20) }, () => row(Array<string>(cols).fill('   '))),
  ].join('\n');
}

type Fence = { openStart: number; openEnd: number; closeStart: number; closeEnd: number };

/** Fenced code blocks; an unclosed one runs to the end of the text. */
function fences(value: string): Fence[] {
  const found: Fence[] = [];
  let open: { start: number; end: number; marker: string } | null = null;

  for (const line of linesOf(value)) {
    const fence = /^ {0,3}(```|~~~)/.exec(line.text);

    if (!fence) {
      continue;
    }

    if (open === null) {
      open = { start: line.start, end: line.end, marker: fence[1] };
    } else if (fence[1] === open.marker && /^ {0,3}(```|~~~)[`~]*\s*$/.test(line.text)) {
      found.push({
        openStart: open.start,
        openEnd: open.end,
        closeStart: line.start,
        closeEnd: line.end,
      });
      open = null;
    }
  }

  if (open) {
    found.push({
      openStart: open.start,
      openEnd: open.end,
      closeStart: value.length,
      closeEnd: value.length,
    });
  }

  return found;
}

function fenceAt(value: string, index: number): Fence | null {
  return fences(value).find((fence) => index >= fence.openStart && index <= fence.closeEnd) ?? null;
}

const HEADING = /^ {0,3}(#{1,6})(?:\s+|$)/;

/** What the block format menu should show for the line at `index`. */
export function blockFormatAt(value: string, index: number): BlockFormat {
  if (fenceAt(value, index)) {
    return 'pre';
  }

  const line = value.slice(lineStartAt(value, index), lineEndAt(value, index));
  const heading = HEADING.exec(line);

  return heading ? (`h${heading[1].length}` as BlockFormat) : 'p';
}

/**
 * Sets the lines the selection touches to a paragraph, a heading or a
 * preformatted (code) block, replacing whatever they were rather than
 * stacking one format on another.
 */
export function blockFormat(
  value: string,
  start: number,
  end: number,
  format: BlockFormat,
  placeholder: string,
): Edit {
  const fence = fenceAt(value, start);

  if (fence) {
    if (format === 'pre') {
      return fromValue(value, value, start, end);
    }

    // Leave the code block first, then format its lines like any others.
    const closed = fence.closeEnd > fence.closeStart;
    let next = value;

    if (closed) {
      next = next.slice(0, Math.max(0, fence.closeStart - 1)) + next.slice(fence.closeEnd);
    }

    const openTo = Math.min(fence.openEnd + 1, next.length);
    next = next.slice(0, fence.openStart) + next.slice(openTo);

    const removed = openTo - fence.openStart;
    const contentEnd = closed
      ? Math.max(fence.openStart, fence.closeStart - 1 - removed)
      : next.length;
    const clamp = (index: number) =>
      Math.min(contentEnd, Math.max(fence.openStart, index - removed));
    const inner =
      format === 'p' ? null : blockFormat(next, clamp(start), clamp(end), format, placeholder);

    return inner
      ? fromValue(value, inner.value, inner.selectionStart, inner.selectionEnd)
      : fromValue(value, next, clamp(start), clamp(end));
  }

  const { from, to, lines } = selectedLines(value, start, end);
  const empty = lines.length === 1 && isBlank(lines[0]);

  if (format === 'pre') {
    if (empty) {
      return replace(
        value,
        from,
        to,
        `\`\`\`\n${placeholder}\n\`\`\``,
        from + 4,
        from + 4 + placeholder.length,
      );
    }

    const body = lines.join('\n');

    return replace(value, from, to, `\`\`\`\n${body}\n\`\`\``, from + 4, from + 4 + body.length);
  }

  const prefix = format === 'p' ? '' : `${'#'.repeat(Number(format.slice(1)))} `;

  if (empty) {
    if (format === 'p') {
      return fromValue(value, value, start, end);
    }

    const text = `${prefix}${placeholder}`;

    return replace(value, from, to, text, from + prefix.length, from + text.length);
  }

  const text = lines
    .map((line) => (isBlank(line) ? line : prefix + line.replace(HEADING, '')))
    .join('\n');

  return replace(value, from, to, text, from, from + text.length);
}

/** The heading edit the H buttons used; kept as the simplest way to call it. */
export function heading(
  value: string,
  start: number,
  end: number,
  level: number,
  placeholder: string,
): Edit {
  return blockFormat(value, start, end, `h${level}` as BlockFormat, placeholder);
}

/** Quotes the lines the selection touches, or unquotes them if all are quoted. */
export function toggleQuote(value: string, start: number, end: number, placeholder: string): Edit {
  const { from, to, lines } = selectedLines(value, start, end);

  if (lines.length === 1 && isBlank(lines[0])) {
    return replace(value, from, to, `> ${placeholder}`, from + 2, from + 2 + placeholder.length);
  }

  const quoted = lines.filter((line) => !isBlank(line)).every((line) => /^ {0,3}>/.test(line));
  const text = lines
    .map((line) => {
      if (quoted) {
        return line.replace(/^ {0,3}> ?/, '');
      }

      // A blank line keeps its `>`, so the paragraphs stay in one quote.
      return isBlank(line) ? '>' : `> ${line}`;
    })
    .join('\n');

  return replace(value, from, to, text, from, from + text.length);
}

const LIST_MARKER = /^(\s*)(?:[-*+]|\d{1,9}[.)])\s+/;
const BULLET_MARKER = /^\s*[-*+]\s+/;
const NUMBER_MARKER = /^\s*\d{1,9}[.)]\s+/;

/**
 * Makes the lines the selection touches a bulleted or numbered list, turning
 * the other kind of list into this one. When they already are this kind, the
 * markers are removed - unless `force`, which only ever makes the list.
 */
export function toggleList(
  value: string,
  start: number,
  end: number,
  kind: ListKind,
  placeholder: string,
  force = false,
): Edit {
  const { from, to, lines } = selectedLines(value, start, end);

  if (lines.length === 1 && isBlank(lines[0])) {
    const marker = kind === 'bullet' ? '- ' : '1. ';

    return replace(
      value,
      from,
      to,
      `${marker}${placeholder}`,
      from + marker.length,
      from + marker.length + placeholder.length,
    );
  }

  const same = kind === 'bullet' ? BULLET_MARKER : NUMBER_MARKER;
  const already = lines.filter((line) => !isBlank(line)).every((line) => same.test(line));

  if (already && force) {
    return fromValue(value, value, from, to);
  }

  // Numbering restarts for each nesting depth.
  const counters = new Map<number, number>();

  const text = lines
    .map((line) => {
      if (isBlank(line)) {
        return line;
      }

      if (already) {
        return line.replace(LIST_MARKER, '');
      }

      const listed = LIST_MARKER.exec(line);
      const indent = listed ? listed[1] : '';
      const body = listed ? line.slice(listed[0].length) : line.trimStart();

      for (const depth of [...counters.keys()]) {
        if (depth > indent.length) {
          counters.delete(depth);
        }
      }

      const n = (counters.get(indent.length) ?? 0) + 1;
      counters.set(indent.length, n);

      return `${indent}${kind === 'bullet' ? '-' : `${n}.`} ${body}`;
    })
    .join('\n');

  return replace(value, from, to, text, from, from + text.length);
}

/* ---------------------------------------------------------------- wrappers */

const OPENER = /^<div data-(align|indent|list)="([a-z0-9-]+)">$/;
const CLOSER = /^<\/div>$/;

type Wrapper = { kind: WrapperKind; token: string; open: number; close: number };

/** The paragraph - run of non-blank lines - around the selected lines. */
function paragraphAround(lines: Line[], first: number, last: number) {
  while (first > 0 && !isBlank(lines[first - 1].text)) {
    first--;
  }

  while (last < lines.length - 1 && !isBlank(lines[last + 1].text)) {
    last++;
  }

  return { first, last };
}

/** The wrappers directly around a block of lines, innermost first. */
function wrappersAround(lines: Line[], first: number, last: number): Wrapper[] {
  const openers: Array<{ line: number; kind: WrapperKind; token: string }> = [];
  const closers: number[] = [];

  for (let i = first - 1; i >= 0; i--) {
    if (isBlank(lines[i].text)) {
      continue;
    }

    const opener = OPENER.exec(lines[i].text.trim());

    if (!opener) {
      break;
    }

    openers.push({ line: i, kind: opener[1] as WrapperKind, token: opener[2] });
  }

  for (let i = last + 1; i < lines.length; i++) {
    if (isBlank(lines[i].text)) {
      continue;
    }

    if (!CLOSER.test(lines[i].text.trim())) {
      break;
    }

    closers.push(i);
  }

  return openers
    .slice(0, closers.length)
    .map((opener, i) => ({
      kind: opener.kind,
      token: opener.token,
      open: opener.line,
      close: closers[i],
    }));
}

function blockAt(value: string, start: number, end: number) {
  const lines = linesOf(value);
  const reach = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const { first, last } = paragraphAround(
    lines,
    lineIndexAt(lines, start),
    lineIndexAt(lines, Math.max(start, reach)),
  );

  return { lines, first, last };
}

/** The token of the `kind` wrapper around the block at the selection, if any. */
export function wrapperAt(
  value: string,
  start: number,
  end: number,
  kind: WrapperKind,
): string | null {
  const { lines, first, last } = blockAt(value, start, end);

  return wrappersAround(lines, first, last).find((wrapper) => wrapper.kind === kind)?.token ?? null;
}

/**
 * Sets the `kind` wrapper around the paragraphs the selection touches to
 * `token`, changing an existing one in place, or removes it when `token` is
 * null. On an empty line a placeholder is written first, so there is
 * something to format.
 */
export function setWrapper(
  value: string,
  start: number,
  end: number,
  kind: WrapperKind,
  token: string | null,
  placeholder: string,
): Edit {
  const { lines, first, last } = blockAt(value, start, end);

  if (first === last && isBlank(lines[first].text)) {
    if (token === null) {
      return fromValue(value, value, start, end);
    }

    const line = lines[first];
    const filled = value.slice(0, line.start) + placeholder + value.slice(line.end);
    const inner = setWrapper(
      filled,
      line.start,
      line.start + placeholder.length,
      kind,
      token,
      placeholder,
    );

    return fromValue(value, inner.value, inner.selectionStart, inner.selectionEnd);
  }

  const existing = wrappersAround(lines, first, last).find((wrapper) => wrapper.kind === kind);

  if (existing && token !== null) {
    const opener = lines[existing.open];
    const tag = wrapperTag(kind, token);
    const shift = tag.length - (opener.end - opener.start);

    return fromValue(
      value,
      value.slice(0, opener.start) + tag + value.slice(opener.end),
      start + shift,
      end + shift,
    );
  }

  if (existing) {
    // The closing line first, so the opening line's offsets stay valid. Each
    // goes with one of the blank lines that separated it from the block.
    const close = existing.close;
    const blankBefore = !isBlank(lines[close].text) && close > 0 && isBlank(lines[close - 1].text);
    let next: string;

    if (close === lines.length - 1) {
      const from = Math.max(0, (blankBefore ? lines[close - 1].start : lines[close].start) - 1);
      next = value.slice(0, from);
    } else {
      const from = blankBefore ? lines[close - 1].start : lines[close].start;
      next = value.slice(0, from) + value.slice(lines[close].end + 1);
    }

    const open = existing.open;
    const blankAfter = open + 1 < lines.length && isBlank(lines[open + 1].text);
    const openTo = blankAfter ? lines[open + 1].end + 1 : lines[open].end + 1;
    const removed = openTo - lines[open].start;

    next = next.slice(0, lines[open].start) + next.slice(openTo);

    return fromValue(value, next, Math.max(0, start - removed), Math.max(0, end - removed));
  }

  if (token === null) {
    return fromValue(value, value, start, end);
  }

  const opener = `${wrapperTag(kind, token)}\n\n`;
  const blockStart = lines[first].start;
  const blockEnd = lines[last].end;

  return fromValue(
    value,
    value.slice(0, blockStart) +
      opener +
      value.slice(blockStart, blockEnd) +
      '\n\n</div>' +
      value.slice(blockEnd),
    start + opener.length,
    end + opener.length,
  );
}

/** Aligns the paragraphs the selection touches; left removes the alignment. */
export function align(
  value: string,
  start: number,
  end: number,
  to: Align,
  placeholder: string,
): Edit {
  return setWrapper(value, start, end, 'align', to === 'left' ? null : to, placeholder);
}

/**
 * Indents or outdents by one step. List items nest under the item above them,
 * which is what indenting a list means; anything else - including the first
 * item of a list, which has nothing to nest under - moves as a block, up to
 * MAX_INDENT steps.
 */
export function indent(
  value: string,
  start: number,
  end: number,
  delta: 1 | -1,
  placeholder: string,
): Edit {
  const { from, to, lines } = selectedLines(value, start, end);
  const filled = lines.filter((line) => !isBlank(line));

  if (filled.length > 0 && filled.every((line) => LIST_MARKER.test(line))) {
    const above = value.slice(lineStartAt(value, Math.max(0, from - 1)), Math.max(0, from - 1));
    const nests =
      delta > 0 ? from > 0 && LIST_MARKER.test(above) : filled.some((line) => /^ /.test(line));

    if (nests) {
      const text = lines
        .map((line) =>
          isBlank(line) ? line : delta > 0 ? `    ${line}` : line.replace(/^ {1,4}/, ''),
        )
        .join('\n');

      return replace(value, from, to, text, from, from + text.length);
    }
  }

  const level = Number(wrapperAt(value, start, end, 'indent') ?? 0);
  const next = Math.min(MAX_INDENT, Math.max(0, level + delta));

  if (next === level) {
    return fromValue(value, value, start, end);
  }

  return setWrapper(value, start, end, 'indent', next === 0 ? null : String(next), placeholder);
}

/**
 * Makes the selection a list of `kind` in `style`. The default style for the
 * kind is the absence of a wrapper, so choosing it removes one.
 */
export function listStyle(
  value: string,
  start: number,
  end: number,
  kind: ListKind,
  style: string,
  placeholder: string,
): Edit {
  const listed = toggleList(value, start, end, kind, placeholder, true);
  const fallback = kind === 'bullet' ? BULLET_STYLES[0] : NUMBER_STYLES[0];
  const styled = setWrapper(
    listed.value,
    listed.selectionStart,
    listed.selectionEnd,
    'list',
    style === fallback ? null : style,
    placeholder,
  );

  return fromValue(value, styled.value, styled.selectionStart, styled.selectionEnd);
}

/* ------------------------------------------------------------------- count */

/** Roughly what a reader sees: the Markdown syntax and tags taken out. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/^ {0,3}(?:```|~~~).*$/gm, ' ')
    .replace(/<[^>\n]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*(?:(?:#{1,6}|>|[-*+]|\d{1,9}[.)])[ \t]+)+/gm, ' ')
    .replace(/^[ \t|:-]*-{3,}[ \t|:-]*$/gm, ' ')
    .replace(/[*_~`|#>]/g, ' ');
}

export function wordCount(markdown: string): { words: number; characters: number } {
  const text = plainText(markdown);
  // Letters with their vowel signs and joiners, so a Bengali word is one word.
  const words = (text.match(/[\p{L}\p{M}\p{N}‌‍'’-]+/gu) ?? []).filter((word) =>
    /[\p{L}\p{N}]/u.test(word),
  );

  return { words: words.length, characters: Array.from(text.replace(/\s+/g, ' ').trim()).length };
}
