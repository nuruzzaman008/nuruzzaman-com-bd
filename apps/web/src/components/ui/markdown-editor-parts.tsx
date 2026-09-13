'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';

/*
  The pieces the Markdown editor is built from: icons, toolbar buttons, the
  drop-down menus and the small panels that ask for a link, an image or a
  table. Kept apart so the editor itself reads as its layout and its actions.
*/

export const TOOL_BUTTON =
  'inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-sm text-navy ' +
  'hover:bg-blue-soft aria-pressed:bg-blue-soft aria-expanded:bg-blue-soft ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue';

export const TOOL_SELECT =
  'min-h-9 max-w-40 rounded-md border border-line bg-white px-2 text-sm text-navy disabled:opacity-50';

const filled = { fill: 'currentColor', stroke: 'none' } as const;

const ICONS = {
  quote: <path {...filled} d="M6 17h3l2-4V7H5v6h3zM14 17h3l2-4V7h-6v6h3z" />,
  bullets: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle {...filled} cx="4.5" cy="6" r="1.5" />
      <circle {...filled} cx="4.5" cy="12" r="1.5" />
      <circle {...filled} cx="4.5" cy="18" r="1.5" />
    </>
  ),
  numbers: (
    <>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path strokeWidth={1.6} d="M4 4.5 5.5 4v4M3.5 14c.4-.8 2.6-1 2.6.4 0 1-2.6 1.8-2.6 3.1h2.8" />
    </>
  ),
  alignLeft: <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />,
  alignCenter: <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
  alignRight: <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />,
  alignJustify: <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
  link: (
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  ),
  unlink: (
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1M4 4l16 16" />
  ),
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  redo: <path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
  outdent: <path d="M4 6h16M11 10h9M11 14h9M4 18h16M7 9l-3 3 3 3" />,
  indent: <path d="M4 6h16M11 10h9M11 14h9M4 18h16M4 9l3 3-3 3" />,
  clear: <path d="M6 5h12M12 5 9 19M14.5 14.5l5 5M19.5 14.5l-5 5" />,
  line: <path d="M3 12h18" />,
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5-5-9 8" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  maximize: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  minimize: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  code: <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
    >
      {ICONS[name]}
    </svg>
  );
}

type ToolButtonProps = Omit<ComponentProps<'button'>, 'aria-label' | 'title' | 'type'> & {
  label: string;
  shortcut?: string;
  pressed?: boolean;
};

/** An icon button whose name is its label, with the shortcut in the tooltip. */
export function ToolButton({
  label,
  shortcut,
  pressed,
  className,
  children,
  ...props
}: ToolButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={pressed}
      className={cn(TOOL_BUTTON, className)}
    >
      {children}
    </button>
  );
}

export function Separator() {
  return <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-line" />;
}

export type MenuEntry =
  | {
      key: string;
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      shortcut?: string;
      /** For a choice among options: a radio item, checked or not. */
      checked?: boolean;
    }
  | { key: string; separator: true };

/**
 * A button that opens a menu of actions. The menu takes focus when it opens,
 * moves through its items with the arrow keys, and closes on Escape - handing
 * focus back to its button - on Tab, on a choice, or on a click elsewhere.
 */
export function DropdownMenu({
  label,
  trigger,
  triggerLabel,
  items,
  disabled,
  triggerClassName,
}: {
  /** The menu's name, and the button's too unless `triggerLabel` is given. */
  label: string;
  trigger: ReactNode;
  /** For a button showing only an icon. */
  triggerLabel?: string;
  items: MenuEntry[];
  disabled?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus();

    function outside(event: Event) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', outside);

    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const entries = Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [],
    );
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => entries[(i + entries.length) % entries.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focus(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focus(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focus(0);
        break;
      case 'End':
        event.preventDefault();
        focus(-1);
        break;
      case 'Escape':
        // Handled here, so an editor in full screen does not also close.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        title={triggerLabel}
        disabled={disabled}
        className={cn(TOOL_BUTTON, triggerClassName)}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </button>

      {open ? (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={move}
          className="absolute start-0 top-full z-30 mt-1 min-w-52 rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {items.map((item) =>
            'separator' in item ? (
              <div key={item.key} role="separator" className="my-1 h-px bg-line" />
            ) : (
              <button
                key={item.key}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                disabled={item.disabled}
                tabIndex={-1}
                className={
                  'flex w-full items-center justify-between gap-6 px-3 py-2 text-start text-sm text-navy ' +
                  'hover:bg-blue-soft focus:bg-blue-soft focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ' +
                  'aria-checked:font-semibold'
                }
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span>{item.label}</span>
                {item.shortcut ? (
                  <span className="font-latin text-xs text-muted">{item.shortcut}</span>
                ) : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A small panel under the toolbar that asks for what an action needs - a
 * link's address, an image, a table's size. Not modal: the text stays in
 * view. Escape closes it, and Enter in one of its fields runs its action
 * instead of submitting the form the editor sits in.
 */
export function EditorPanel({
  title,
  closeLabel,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  onSubmit?: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>('input, select, textarea, button:not([data-panel-close])')
      ?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      className="border-b border-line bg-white p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          onSubmit?.();
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id={titleId} className="text-sm font-bold text-navy">
          {title}
        </h3>
        <button
          type="button"
          data-panel-close
          aria-label={closeLabel}
          title={closeLabel}
          className={TOOL_BUTTON}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </div>
  );
}
