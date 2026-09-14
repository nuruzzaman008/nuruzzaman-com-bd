'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';

type Key = string | number;

const same = (a: Key[], b: Key[]) =>
  a.length === b.length && a.every((key, index) => key === b[index]);

/**
 * A list whose rows are put in order by pressing and dragging a handle - with
 * a mouse, a finger or a pen - or, from the keyboard, by focusing the handle
 * and pressing the up and down arrows.
 *
 * Nothing is saved while a row is moving: `onReorder` is called once, when it
 * is let go. The new order is shown straight away and kept until the items
 * passed in change, so the row does not jump back while the save is on its way.
 */
export function SortableList<T>({
  items,
  getKey,
  getLabel,
  onReorder,
  renderItem,
  label,
  handleLabel,
  disabled = false,
  className,
}: {
  items: T[];
  getKey: (item: T) => Key;
  getLabel: (item: T) => string;
  onReorder: (keys: Key[]) => void;
  /** Renders a row; place `handle` where the row should be grabbed. */
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  /** The list's accessible name. */
  label: string;
  /** The handle's accessible name; `{name}` becomes the row's label. */
  handleLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const rows = useRef(new Map<Key, HTMLLIElement>());
  // A drag in progress, as the pointer listeners see it; the state below only redraws the list.
  const drag = useRef<{ key: Key; order: Key[]; stop: () => void } | null>(null);
  const [dragging, setDragging] = useState<Key | null>(null);
  const [preview, setPreview] = useState<Key[] | null>(null);
  // The order just handed to onReorder, for the items it was chosen from.
  const [pending, setPending] = useState<{ keys: Key[]; from: T[] } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const keys = items.map(getKey);
  const settled = pending && pending.from === items ? pending.keys : keys;
  const order = preview ?? settled;
  const byKey = new Map(items.map((item) => [getKey(item), item] as const));

  function commit(next: Key[]) {
    if (same(next, settled)) {
      return;
    }

    setPending({ keys: next, from: items });
    onReorder(next);
  }

  // Unhook the pointer listeners if the list goes away in the middle of a drag.
  useEffect(() => () => drag.current?.stop(), []);

  function start(event: PointerEvent<HTMLButtonElement>, key: Key) {
    if (disabled || event.button > 0 || drag.current) {
      return;
    }

    event.preventDefault();
    const pointer = event.pointerId;
    const onMove = (e: globalThis.PointerEvent) => e.pointerId === pointer && move(e.clientY);
    const onUp = (e: globalThis.PointerEvent) => e.pointerId === pointer && end(true);
    const onCancel = (e: globalThis.PointerEvent) => e.pointerId === pointer && end(false);

    // Listened for on the window rather than the handle: the row is moved within
    // the page as it is dragged, and an element that is moved loses its pointer capture.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    drag.current = {
      key,
      order: settled,
      stop: () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      },
    };
    setDragging(key);
    setPreview(settled);
  }

  function move(clientY: number) {
    const current = drag.current;

    if (!current) {
      return;
    }

    const others = current.order.filter((key) => key !== current.key);
    let index = others.findIndex((key) => {
      const rect = rows.current.get(key)?.getBoundingClientRect();

      return rect ? clientY < rect.top + rect.height / 2 : false;
    });

    if (index === -1) {
      index = others.length;
    }

    const next = [...others.slice(0, index), current.key, ...others.slice(index)];

    if (!same(next, current.order)) {
      current.order = next;
      setPreview(next);
    }
  }

  function end(save: boolean) {
    const current = drag.current;

    if (!current) {
      return;
    }

    current.stop();
    drag.current = null;

    if (save) {
      commit(current.order);
    }

    setDragging(null);
    setPreview(null);
  }

  function nudge(event: KeyboardEvent<HTMLButtonElement>, key: Key) {
    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;

    if (!delta || disabled) {
      return;
    }

    event.preventDefault();
    const from = settled.indexOf(key);
    const to = from + delta;

    if (from === -1 || to < 0 || to >= settled.length) {
      return;
    }

    const next = [...settled];
    [next[from], next[to]] = [next[to], next[from]];
    setAnnouncement(`${getLabel(byKey.get(key) as T)}: ${to + 1} / ${next.length}`);
    commit(next);
  }

  return (
    <>
      <ul aria-label={label} className={className}>
        {order.map((key) => {
          const item = byKey.get(key);

          if (item === undefined) {
            return null;
          }

          const name = handleLabel.replace('{name}', getLabel(item));
          const handle = (
            <button
              type="button"
              aria-label={name}
              title={name}
              disabled={disabled}
              onPointerDown={(event) => start(event, key)}
              onKeyDown={(event) => nudge(event, key)}
              className={cn(
                'flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted',
                'hover:bg-surface hover:text-navy active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50',
                'focus-visible:outline-2 focus-visible:outline-blue',
              )}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <circle cx="7" cy="5" r="1.5" />
                <circle cx="13" cy="5" r="1.5" />
                <circle cx="7" cy="10" r="1.5" />
                <circle cx="13" cy="10" r="1.5" />
                <circle cx="7" cy="15" r="1.5" />
                <circle cx="13" cy="15" r="1.5" />
              </svg>
            </button>
          );

          return (
            <li
              key={key}
              ref={(node) => {
                if (node) {
                  rows.current.set(key, node);
                } else {
                  rows.current.delete(key);
                }
              }}
              className={cn(
                'rounded-md',
                dragging === key && 'bg-blue-soft shadow-md ring-2 ring-blue/40',
              )}
            >
              {renderItem(item, handle)}
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
