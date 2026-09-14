'use client';

import { MediaFileInput } from '@/components/ui/media-file-input';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';

import {
  DropdownMenu,
  EditorPanel,
  Icon,
  Separator,
  TOOL_BUTTON,
  TOOL_SELECT,
  ToolButton,
  type MenuEntry,
} from '@/components/ui/markdown-editor-parts';
import { Prose } from '@/components/ui/prose';
import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { date, number } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import * as md from '@/lib/markdown-format';
import { ACCEPTED_TYPES, prepareImageForUpload } from '@/lib/media/prepare-upload';

type Snapshot = { value: string; start: number; end: number };
type Panel = 'link' | 'image' | 'table' | 'character' | 'count' | 'help';

/** The menu bar, in the classic editor's order. */
const MENUS = ['edit', 'view', 'insert', 'format', 'tools', 'table'] as const;
type MenuKey = (typeof MENUS)[number];

const INPUT =
  'min-h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink focus:border-blue focus:outline-none';

/*
  Outside the component: these are browser side effects on a DOM node, not
  render logic. insertText through execCommand keeps the browser's own undo
  history and fires a real input event; where it is unavailable the text is
  replaced directly and the event is fired by hand, so anything listening on
  the form - the SEO analysis - still sees the change.
*/
function command(name: string, text?: string): boolean {
  try {
    return (
      typeof document.queryCommandSupported === 'function' &&
      document.queryCommandSupported(name) &&
      document.execCommand(name, false, text)
    );
  } catch {
    return false;
  }
}

function apply(element: HTMLTextAreaElement, edit: md.Edit): void {
  element.focus();

  if (edit.replaceStart !== edit.replaceEnd || edit.text !== '') {
    element.setSelectionRange(edit.replaceStart, edit.replaceEnd);

    const done = edit.text === '' ? command('delete') : command('insertText', edit.text);

    if (!done) {
      element.setRangeText(edit.text, edit.replaceStart, edit.replaceEnd, 'end');
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  element.setSelectionRange(edit.selectionStart, edit.selectionEnd);
}

/**
 * A Markdown textarea with a classic editor's menus and toolbar, a preview,
 * and a word count.
 *
 * The text stays Markdown - headings, emphasis, lists, quotes, links, images
 * and tables as Markdown, and underline, superscript, subscript, colour, size,
 * font, alignment, indentation and list styles as the few tags the server's
 * renderer allows - so what is stored is still readable source, and still
 * safe: the renderer strips anything else. The preview asks that same
 * renderer, so it shows what readers will get rather than an approximation.
 *
 * Colours, sizes and fonts are a fixed palette, not a picker: the colours are
 * the site's contrast-checked ones, and the fonts are the ones the site already
 * loads, so formatting cannot make a page unreadable or slower.
 *
 * A drop-in for Textarea: it takes the same props, and the textarea keeps its
 * name and value while previewing, so the form submits it as before. Pasting
 * needs no "paste as text" mode: a textarea only ever receives plain text.
 */
export function MarkdownTextarea({
  className,
  id,
  onInput,
  onKeyDown,
  onSelect,
  ...props
}: ComponentProps<'textarea'>) {
  const { locale, t } = useLocale();
  const words = t.admin.markdownEditor;
  const ref = useRef<HTMLTextAreaElement>(null);
  const history = useRef<{ undo: Snapshot[]; redo: Snapshot[] }>({ undo: [], redo: [] });
  const fallbackId = useId();
  const textareaId = id ?? fallbackId;

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ state: 'loading' | 'ready' | 'failed'; html: string }>({
    state: 'ready',
    html: '',
  });
  const [fullscreen, setFullscreen] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [format, setFormat] = useState<md.BlockFormat>(() =>
    md.blockFormatAt(String(props.defaultValue ?? props.value ?? ''), 0),
  );
  const [alignment, setAlignment] = useState<md.Align>('left');
  const [stats, setStats] = useState(() =>
    md.wordCount(String(props.defaultValue ?? props.value ?? '')),
  );

  useEffect(() => {
    if (!fullscreen) {
      return;
    }

    // The page behind must not scroll while the editor fills the window.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  /** Brings the menus, the alignment buttons and the count in line with the text. */
  function sync() {
    const element = ref.current;

    if (!element) {
      return;
    }

    const { value, selectionStart: start, selectionEnd: end } = element;
    setFormat(md.blockFormatAt(value, start));
    setAlignment((md.wrapperAt(value, start, end, 'align') as md.Align | null) ?? 'left');
    setStats(md.wordCount(value));
  }

  function snapshot(element: HTMLTextAreaElement): Snapshot {
    return { value: element.value, start: element.selectionStart, end: element.selectionEnd };
  }

  function run(make: (value: string, start: number, end: number) => md.Edit | null): boolean {
    const element = ref.current;

    if (!element) {
      return false;
    }

    const edit = make(element.value, element.selectionStart, element.selectionEnd);

    if (!edit) {
      return false;
    }

    if (edit.value !== element.value) {
      history.current.undo = [...history.current.undo.slice(-99), snapshot(element)];
      history.current.redo = [];
    }

    setNotice(null);
    apply(element, edit);
    sync();

    return true;
  }

  /** Undo and redo: the browser's own history, or ours where it has none. */
  function travel(direction: 'undo' | 'redo') {
    const element = ref.current;

    if (!element) {
      return;
    }

    element.focus();

    if (!command(direction)) {
      const from = direction === 'undo' ? history.current.undo : history.current.redo;
      const to = direction === 'undo' ? history.current.redo : history.current.undo;
      const target = from.pop();

      if (!target) {
        return;
      }

      to.push(snapshot(element));
      apply(element, md.fromValue(element.value, target.value, target.start, target.end));
    }

    sync();
  }

  function selectAll() {
    const element = ref.current;

    element?.focus();
    element?.select();
  }

  const inline = (before: string, after: string) =>
    run((value, start, end) => md.wrap(value, start, end, before, after, words.placeholder));

  const actions = {
    bold: () => inline('**', '**'),
    italic: () => inline('*', '*'),
    underline: () => inline('<u>', '</u>'),
    strikethrough: () => inline('~~', '~~'),
    superscript: () => inline('<sup>', '</sup>'),
    subscript: () => inline('<sub>', '</sub>'),
    code: () => inline('`', '`'),
    blockquote: () =>
      run((value, start, end) => md.toggleQuote(value, start, end, words.placeholder)),
    list: (kind: md.ListKind) =>
      run((value, start, end) => md.toggleList(value, start, end, kind, words.placeholder)),
    listStyle: (kind: md.ListKind, style: string) =>
      run((value, start, end) => md.listStyle(value, start, end, kind, style, words.placeholder)),
    align: (to: md.Align) =>
      run((value, start, end) => md.align(value, start, end, to, words.placeholder)),
    indent: (delta: 1 | -1) =>
      run((value, start, end) => md.indent(value, start, end, delta, words.placeholder)),
    clear: () => run((value, start, end) => md.clearFormatting(value, start, end)),
    unlink: () => run((value, start, end) => md.unlink(value, start, end)),
    line: () => run((value, start, end) => md.insertBlock(value, start, end, '---')),
    date: () =>
      run((value, start, end) =>
        md.insertText(value, start, end, date(new Date().toISOString(), locale) ?? ''),
      ),
    selectAll,
    format: (next: md.BlockFormat) => {
      run((value, start, end) => md.blockFormat(value, start, end, next, words.placeholder));
      // The page's title is already its H1; say so where the choice is made.
      setNotice(next === 'h1' ? words.h1Hint : null);
    },
  };

  function openPanel(next: Panel) {
    const element = ref.current;

    setSelectedText(
      element ? element.value.slice(element.selectionStart, element.selectionEnd) : '',
    );
    setPanel(next);
  }

  function closePanel() {
    setPanel(null);
    ref.current?.focus();
  }

  async function togglePreview() {
    if (previewing) {
      setPreviewing(false);

      return;
    }

    setPanel(null);
    setPreviewing(true);
    setPreview({ state: 'loading', html: '' });

    try {
      const response = await api<{ data: { html: string } }>('/admin/markdown/preview', {
        method: 'POST',
        body: { markdown: ref.current?.value ?? '' },
      });
      setPreview({ state: 'ready', html: response.data.html });
    } catch {
      setPreview({ state: 'failed', html: '' });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);

    if (
      event.defaultPrevented ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.shiftKey
    ) {
      return;
    }

    const shortcut = {
      b: actions.bold,
      i: actions.italic,
      u: actions.underline,
      k: () => openPanel('link'),
    }[event.key.toLowerCase()];

    if (shortcut) {
      event.preventDefault();
      shortcut();
    }
  }

  function handleInput(event: Parameters<NonNullable<ComponentProps<'textarea'>['onInput']>>[0]) {
    onInput?.(event);
    sync();
  }

  function handleSelect(event: SyntheticEvent<HTMLTextAreaElement>) {
    onSelect?.(event);
    sync();
  }

  const heading = (level: number) => words.heading.replace('{level}', String(level));
  const formatLabel = (value: md.BlockFormat) =>
    value === 'p'
      ? words.formats.p
      : value === 'pre'
        ? words.formats.pre
        : heading(Number(value.slice(1)));
  const off = previewing;

  /*
    A function rather than a list built during render: the items close over
    actions that read the textarea, and those must only run on a choice.
  */
  function menuItems(menu: MenuKey): MenuEntry[] {
    switch (menu) {
      case 'edit':
        return [
          {
            key: 'undo',
            label: words.undo,
            shortcut: 'Ctrl+Z',
            disabled: off,
            onSelect: () => travel('undo'),
          },
          {
            key: 'redo',
            label: words.redo,
            shortcut: 'Ctrl+Y',
            disabled: off,
            onSelect: () => travel('redo'),
          },
          { key: 'sep', separator: true },
          {
            key: 'all',
            label: words.selectAll,
            shortcut: 'Ctrl+A',
            disabled: off,
            onSelect: selectAll,
          },
        ];
      case 'view':
        return [
          {
            key: 'preview',
            label: previewing ? words.write : words.preview,
            onSelect: () => void togglePreview(),
          },
          {
            key: 'fullscreen',
            label: fullscreen ? words.exitFullscreen : words.fullscreen,
            onSelect: () => setFullscreen((current) => !current),
          },
        ];
      case 'insert':
        return [
          { key: 'image', label: words.image, disabled: off, onSelect: () => openPanel('image') },
          {
            key: 'link',
            label: words.link,
            shortcut: 'Ctrl+K',
            disabled: off,
            onSelect: () => openPanel('link'),
          },
          {
            key: 'character',
            label: words.specialCharacter,
            disabled: off,
            onSelect: () => openPanel('character'),
          },
          { key: 'line', label: words.horizontalLine, disabled: off, onSelect: actions.line },
          { key: 'table', label: words.table, disabled: off, onSelect: () => openPanel('table') },
          { key: 'date', label: words.date, disabled: off, onSelect: actions.date },
        ];
      case 'format':
        return [
          {
            key: 'bold',
            label: words.bold,
            shortcut: 'Ctrl+B',
            disabled: off,
            onSelect: actions.bold,
          },
          {
            key: 'italic',
            label: words.italic,
            shortcut: 'Ctrl+I',
            disabled: off,
            onSelect: actions.italic,
          },
          {
            key: 'underline',
            label: words.underline,
            shortcut: 'Ctrl+U',
            disabled: off,
            onSelect: actions.underline,
          },
          {
            key: 'strike',
            label: words.strikethrough,
            disabled: off,
            onSelect: actions.strikethrough,
          },
          { key: 'sup', label: words.superscript, disabled: off, onSelect: actions.superscript },
          { key: 'sub', label: words.subscript, disabled: off, onSelect: actions.subscript },
          { key: 'code', label: words.code, disabled: off, onSelect: actions.code },
          { key: 'sep1', separator: true },
          { key: 'quote', label: words.blockquote, disabled: off, onSelect: actions.blockquote },
          { key: 'sep2', separator: true },
          ...md.ALIGNS.map((to) => ({
            key: `align-${to}`,
            label: alignLabel(to),
            checked: alignment === to,
            disabled: off,
            onSelect: () => actions.align(to),
          })),
          { key: 'sep3', separator: true },
          { key: 'clear', label: words.clearFormatting, disabled: off, onSelect: actions.clear },
        ];
      case 'tools':
        return [
          { key: 'count', label: words.wordCount, onSelect: () => openPanel('count') },
          { key: 'help', label: words.help, onSelect: () => openPanel('help') },
        ];
      case 'table':
        return [
          { key: 'table', label: words.table, disabled: off, onSelect: () => openPanel('table') },
        ];
    }
  }

  function alignLabel(to: md.Align): string {
    return {
      left: words.alignLeft,
      center: words.alignCenter,
      right: words.alignRight,
      justify: words.alignJustify,
    }[to];
  }

  function listMenu(kind: md.ListKind): MenuEntry[] {
    return (kind === 'bullet' ? md.BULLET_STYLES : md.NUMBER_STYLES).map((style) => ({
      key: style,
      label: words.listStyles[style],
      onSelect: () => actions.listStyle(kind, style),
    }));
  }

  const palette = (
    kind: 'color' | 'size' | 'font',
    label: string,
    tokens: readonly string[],
    names: Record<string, string>,
  ) => (
    <select
      aria-label={label}
      title={label}
      className={TOOL_SELECT}
      value=""
      disabled={off}
      onChange={(event) => {
        if (event.target.value) {
          inline(md.spanTag(kind, event.target.value), '</span>');
        }
      }}
    >
      <option value="">{label}</option>
      {tokens.map((token) => (
        <option key={token} value={token}>
          {names[token]}
        </option>
      ))}
    </select>
  );

  const count = (template: string, value: number) =>
    template.replace('{count}', number(value, locale));

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-white'
          : 'flex flex-col rounded-lg border border-line bg-white focus-within:border-blue'
      }
      data-fullscreen={fullscreen || undefined}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && fullscreen && !event.defaultPrevented) {
          event.preventDefault();
          setFullscreen(false);
        }
      }}
    >
      {/* ---------------------------------------------------------- menus */}
      <div
        role="group"
        aria-label={words.menubar}
        className={cn(
          'flex flex-wrap items-center gap-0.5 bg-surface px-1.5 pt-1',
          !fullscreen && 'rounded-t-lg',
        )}
      >
        {MENUS.map((menu) => (
          <DropdownMenu
            key={menu}
            label={words.menus[menu]}
            trigger={words.menus[menu]}
            items={menuItems(menu)}
            triggerClassName="min-h-8 px-2.5"
          />
        ))}
      </div>

      {/* -------------------------------------------------------- toolbar */}
      <div
        role="toolbar"
        aria-label={words.toolbar}
        aria-controls={textareaId}
        className="flex flex-col gap-1 border-b border-line bg-surface p-1.5"
      >
        <div className="flex flex-wrap items-center gap-1">
          <select
            aria-label={words.blockFormat}
            title={words.blockFormat}
            className={TOOL_SELECT}
            value={format}
            disabled={off}
            onChange={(event) => actions.format(event.target.value as md.BlockFormat)}
          >
            {md.BLOCK_FORMATS.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>

          <Separator />

          <ToolButton
            label={words.bold}
            shortcut="Ctrl+B"
            className="font-latin font-bold"
            disabled={off}
            onClick={actions.bold}
          >
            B
          </ToolButton>
          <ToolButton
            label={words.italic}
            shortcut="Ctrl+I"
            className="font-latin italic"
            disabled={off}
            onClick={actions.italic}
          >
            I
          </ToolButton>
          <ToolButton
            label={words.underline}
            shortcut="Ctrl+U"
            className="font-latin underline"
            disabled={off}
            onClick={actions.underline}
          >
            U
          </ToolButton>
          <ToolButton label={words.blockquote} disabled={off} onClick={actions.blockquote}>
            <Icon name="quote" />
          </ToolButton>

          <Separator />

          {(['bullet', 'number'] as const).map((kind) => (
            <div key={kind} className="flex items-center">
              <ToolButton
                label={kind === 'bullet' ? words.bulletList : words.numberList}
                disabled={off}
                onClick={() => actions.list(kind)}
              >
                <Icon name={kind === 'bullet' ? 'bullets' : 'numbers'} />
              </ToolButton>
              <DropdownMenu
                label={kind === 'bullet' ? words.bulletStyle : words.numberStyle}
                triggerLabel={kind === 'bullet' ? words.bulletStyle : words.numberStyle}
                trigger={<Icon name="chevron" className="size-3.5" />}
                items={listMenu(kind)}
                disabled={off}
                triggerClassName="min-w-6 px-0.5"
              />
            </div>
          ))}

          <Separator />

          {(['left', 'center', 'right'] as const).map((to) => (
            <ToolButton
              key={to}
              label={alignLabel(to)}
              pressed={alignment === to}
              disabled={off}
              onClick={() => actions.align(to)}
            >
              <Icon
                name={to === 'left' ? 'alignLeft' : to === 'center' ? 'alignCenter' : 'alignRight'}
              />
            </ToolButton>
          ))}

          <Separator />

          <ToolButton
            label={words.link}
            shortcut="Ctrl+K"
            disabled={off}
            onClick={() => openPanel('link')}
          >
            <Icon name="link" />
          </ToolButton>
          <ToolButton label={words.unlink} disabled={off} onClick={actions.unlink}>
            <Icon name="unlink" />
          </ToolButton>

          <Separator />

          <ToolButton
            label={words.undo}
            shortcut="Ctrl+Z"
            disabled={off}
            onClick={() => travel('undo')}
          >
            <Icon name="undo" />
          </ToolButton>
          <ToolButton
            label={words.redo}
            shortcut="Ctrl+Y"
            disabled={off}
            onClick={() => travel('redo')}
          >
            <Icon name="redo" />
          </ToolButton>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {palette('font', words.font, md.FONTS, words.fonts)}
          {palette('size', words.size, md.SIZES, words.sizes)}

          <Separator />

          <ToolButton label={words.outdent} disabled={off} onClick={() => actions.indent(-1)}>
            <Icon name="outdent" />
          </ToolButton>
          <ToolButton label={words.indent} disabled={off} onClick={() => actions.indent(1)}>
            <Icon name="indent" />
          </ToolButton>
          <ToolButton label={words.clearFormatting} disabled={off} onClick={actions.clear}>
            <Icon name="clear" />
          </ToolButton>

          <Separator />

          <ToolButton
            label={words.specialCharacter}
            className="font-latin text-base"
            disabled={off}
            onClick={() => openPanel('character')}
          >
            Ω
          </ToolButton>
          <ToolButton label={words.horizontalLine} disabled={off} onClick={actions.line}>
            <Icon name="line" />
          </ToolButton>
          {palette('color', words.color, md.COLORS, words.colors)}
          <ToolButton label={words.table} disabled={off} onClick={() => openPanel('table')}>
            <Icon name="table" />
          </ToolButton>
          <ToolButton label={words.image} disabled={off} onClick={() => openPanel('image')}>
            <Icon name="image" />
          </ToolButton>
          <ToolButton label={words.help} onClick={() => openPanel('help')}>
            <Icon name="help" />
          </ToolButton>

          <div className="ms-auto flex items-center gap-1">
            <button
              type="button"
              className={cn(TOOL_BUTTON, 'border border-line bg-white font-semibold')}
              aria-pressed={previewing}
              onClick={() => void togglePreview()}
            >
              <Icon name="eye" />
              {previewing ? words.write : words.preview}
            </button>
            <ToolButton
              label={fullscreen ? words.exitFullscreen : words.fullscreen}
              shortcut={fullscreen ? 'Esc' : undefined}
              pressed={fullscreen}
              onClick={() => setFullscreen((current) => !current)}
            >
              <Icon name={fullscreen ? 'minimize' : 'maximize'} />
            </ToolButton>
          </div>
        </div>
      </div>

      {notice ? (
        <p role="status" className="border-b border-line bg-blue-soft px-3 py-2 text-xs text-navy">
          {notice}
        </p>
      ) : null}

      {/* --------------------------------------------------------- panels */}
      {panel === 'link' ? (
        <LinkPanel
          initialText={selectedText}
          onClose={closePanel}
          onInsert={(url, text) => {
            const done = run((value, start, end) => md.link(value, start, end, url, text));
            if (done) {
              setPanel(null);
            }

            return done;
          }}
        />
      ) : null}

      {panel === 'image' ? (
        <ImagePanel
          onClose={closePanel}
          onInsert={(url, alt) => {
            const done = run((value, start, end) => md.image(value, start, end, url, alt));
            if (done) {
              setPanel(null);
            }

            return done;
          }}
        />
      ) : null}

      {panel === 'table' ? (
        <TablePanel
          onClose={closePanel}
          onInsert={(rows, columns) => {
            const table = md.tableMarkdown(rows, columns, (n) =>
              words.tableColumn.replace('{n}', String(n)),
            );
            run((value, start, end) => md.insertBlock(value, start, end, table));
            setPanel(null);
          }}
        />
      ) : null}

      {panel === 'character' ? (
        <EditorPanel title={words.specialCharacter} closeLabel={words.close} onClose={closePanel}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1">
            {md.SPECIAL_CHARACTERS.map((character) => (
              <button
                key={character}
                type="button"
                aria-label={words.insertCharacter.replace('{character}', character)}
                title={character}
                className={cn(TOOL_BUTTON, 'border border-line font-latin text-base')}
                onClick={() => {
                  run((value, start, end) => md.insertText(value, start, end, character));
                  setPanel(null);
                }}
              >
                {character}
              </button>
            ))}
          </div>
        </EditorPanel>
      ) : null}

      {panel === 'count' ? (
        <EditorPanel title={words.wordCount} closeLabel={words.close} onClose={closePanel}>
          <p className="text-sm text-ink">
            {count(words.words, stats.words)} · {count(words.characters, stats.characters)}
          </p>
        </EditorPanel>
      ) : null}

      {panel === 'help' ? (
        <EditorPanel title={words.shortcuts} closeLabel={words.close} onClose={closePanel}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            {(
              [
                ['Ctrl+B', words.bold],
                ['Ctrl+I', words.italic],
                ['Ctrl+U', words.underline],
                ['Ctrl+K', words.link],
                ['Ctrl+Z', words.undo],
                ['Ctrl+Y', words.redo],
                ['Ctrl+A', words.selectAll],
                ['Esc', words.exitFullscreen],
              ] as const
            ).map(([keys, action]) => (
              <div key={keys} className="contents">
                <dt>
                  <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-latin text-xs">
                    {keys}
                  </kbd>
                </dt>
                <dd className="text-ink">{action}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">{words.helpNote}</p>
        </EditorPanel>
      ) : null}

      {/* ----------------------------------------------------------- text */}
      <textarea
        {...props}
        ref={ref}
        id={textareaId}
        hidden={previewing}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        // Its own classes, not the form kit's: the border and rounding belong
        // to the frame around the toolbar and the text, and the class helper
        // does not merge conflicting utilities.
        className={cn(
          'block min-h-32 w-full bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70',
          'focus:outline-none aria-[invalid=true]:bg-danger-soft',
          fullscreen ? 'flex-1 resize-none' : 'resize-y',
          className,
        )}
      />

      {previewing ? (
        <div
          className={cn('min-h-32 p-4', fullscreen && 'flex-1 overflow-y-auto')}
          aria-live="polite"
        >
          {preview.state === 'loading' ? (
            <p className="text-sm text-muted">{words.previewLoading}</p>
          ) : preview.state === 'failed' ? (
            <p className="text-sm text-danger">{words.previewFailed}</p>
          ) : preview.html ? (
            <Prose html={preview.html} />
          ) : (
            <p className="text-sm text-muted">{words.previewEmpty}</p>
          )}
        </div>
      ) : null}

      {/* ----------------------------------------------------- status bar */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-1.5 text-xs text-muted',
          !fullscreen && 'rounded-b-lg',
        )}
      >
        <span>{formatLabel(format)}</span>
        <span>
          {count(words.words, stats.words)} · {count(words.characters, stats.characters)}
        </span>
      </div>
    </div>
  );
}

function PanelError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  ) : null;
}

function LinkPanel({
  initialText,
  onInsert,
  onClose,
}: {
  initialText: string;
  onInsert: (url: string, text: string) => boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const words = t.admin.markdownEditor;
  const [url, setUrl] = useState('');
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const urlId = useId();
  const textId = useId();

  function insert() {
    setError(onInsert(url, text) ? null : words.invalidUrl);
  }

  return (
    <EditorPanel title={words.link} closeLabel={words.close} onClose={onClose} onSubmit={insert}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={urlId} className="text-sm font-medium text-navy">
            {words.linkUrl}
          </label>
          <input
            id={urlId}
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            className={cn(INPUT, 'font-latin')}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={textId} className="text-sm font-medium text-navy">
            {words.linkText}
          </label>
          <input
            id={textId}
            type="text"
            autoComplete="off"
            className={INPUT}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={cn(TOOL_BUTTON, 'bg-blue px-4 font-semibold text-white hover:bg-navy')}
          onClick={insert}
        >
          {words.insertLink}
        </button>
        <PanelError message={error} />
      </div>
    </EditorPanel>
  );
}

function ImagePanel({
  onInsert,
  onClose,
}: {
  onInsert: (url: string, alt: string) => boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const words = t.admin.markdownEditor;
  const [alt, setAlt] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const altId = useId();
  const altHintId = useId();
  const fileId = useId();
  const urlId = useId();

  async function insert() {
    const description = alt.trim();
    setError(null);

    // Alt text is required, not suggested: it is what search engines and
    // screen readers get instead of the picture, and the SEO analysis counts it.
    if (!description) {
      setError(words.imageAltRequired);

      return;
    }

    if (!file) {
      if (!url.trim()) {
        setError(words.imageNeeded);
      } else if (!onInsert(url, description)) {
        setError(words.invalidUrl);
      }

      return;
    }

    setBusy(true);

    try {
      // Resized in the browser first: the host's PHP refuses files over 2 MB.
      const prepared = await prepareImageForUpload(file);

      if (!prepared.ok) {
        setError(
          {
            type: t.admin.products.uploadWrongType,
            'too-large': t.admin.products.uploadTooLarge,
            unreadable: t.admin.products.uploadUnreadable,
          }[prepared.reason],
        );

        return;
      }

      const body = new FormData();
      body.set('file', prepared.file);
      body.set('alt_text', description);

      const response = await api<{ data: { url: string | null } }>('/admin/media', {
        method: 'POST',
        body,
      });

      if (!response.data.url || !onInsert(response.data.url, description)) {
        setError(t.admin.products.uploadFailed);
      }
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : '';
      setError(
        reason ? `${t.admin.products.uploadFailed} ${reason}` : t.admin.products.uploadFailed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <EditorPanel
      title={words.image}
      closeLabel={words.close}
      onClose={onClose}
      onSubmit={() => void insert()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor={altId} className="text-sm font-medium text-navy">
            {words.imageAlt}
          </label>
          <input
            id={altId}
            type="text"
            autoComplete="off"
            aria-describedby={altHintId}
            className={INPUT}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
          <p id={altHintId} className="text-xs text-muted">
            {words.imageAltHint}
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor={fileId} className="text-sm font-medium text-navy">
            {words.imageFile}
          </label>
          <MediaFileInput scope="public"
            id={fileId}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="block w-full text-sm text-ink file:me-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-navy"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={urlId} className="text-sm font-medium text-navy">
            {words.imageUrl}
          </label>
          <input
            id={urlId}
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            disabled={file !== null}
            className={cn(INPUT, 'font-latin disabled:bg-surface')}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          className={cn(TOOL_BUTTON, 'bg-blue px-4 font-semibold text-white hover:bg-navy')}
          onClick={() => void insert()}
        >
          {busy ? words.uploading : words.insertImage}
        </button>
        <PanelError message={error} />
      </div>
    </EditorPanel>
  );
}

function TablePanel({
  onInsert,
  onClose,
}: {
  onInsert: (rows: number, columns: number) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const words = t.admin.markdownEditor;
  const [rows, setRows] = useState('3');
  const [columns, setColumns] = useState('3');
  const rowsId = useId();
  const columnsId = useId();
  const insert = () => onInsert(Number(rows), Number(columns));

  return (
    <EditorPanel title={words.table} closeLabel={words.close} onClose={onClose} onSubmit={insert}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28 space-y-1">
          <label htmlFor={rowsId} className="text-sm font-medium text-navy">
            {words.rows}
          </label>
          <input
            id={rowsId}
            type="number"
            inputMode="numeric"
            className={cn(INPUT, 'font-latin')}
            value={rows}
            onChange={(event) => setRows(event.target.value)}
          />
        </div>
        <div className="w-28 space-y-1">
          <label htmlFor={columnsId} className="text-sm font-medium text-navy">
            {words.columns}
          </label>
          <input
            id={columnsId}
            type="number"
            inputMode="numeric"
            className={cn(INPUT, 'font-latin')}
            value={columns}
            onChange={(event) => setColumns(event.target.value)}
          />
        </div>
        <button
          type="button"
          className={cn(
            TOOL_BUTTON,
            'min-h-10 bg-blue px-4 font-semibold text-white hover:bg-navy',
          )}
          onClick={insert}
        >
          {words.insertTable}
        </button>
      </div>
    </EditorPanel>
  );
}
