import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SortableList } from '@/components/ui/sortable-list';

const rows = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

function setup() {
  const onReorder = vi.fn();

  render(
    <SortableList
      items={rows}
      getKey={(row) => row.id}
      getLabel={(row) => row.name}
      label="Files"
      handleLabel="Move {name}"
      onReorder={onReorder}
      renderItem={(row, handle) => (
        <div>
          {handle}
          <span>{row.name}</span>
        </div>
      )}
    />,
  );

  return onReorder;
}

const shown = () => screen.getAllByRole('listitem').map((row) => row.textContent);

describe('SortableList', () => {
  it('moves a row with the arrow keys and shows the new order at once', () => {
    const onReorder = setup();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Move Alpha' }), { key: 'ArrowDown' });

    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
    expect(shown()).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it('does not move a row past either end', () => {
    const onReorder = setup();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Move Alpha' }), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move Gamma' }), { key: 'ArrowDown' });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('drags a row by its handle and saves once, when it is let go', () => {
    const onReorder = setup();

    screen.getAllByRole('listitem').forEach((row, index) => {
      row.getBoundingClientRect = () =>
        ({
          top: index * 40,
          height: 40,
          bottom: index * 40 + 40,
          left: 0,
          right: 300,
          width: 300,
          x: 0,
          y: index * 40,
          toJSON: () => ({}),
        }) as DOMRect;
    });

    const handle = screen.getByRole('button', { name: 'Move Alpha' });
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 });

    // Moving shows the place it would land, without saving anything yet.
    expect(shown()).toEqual(['Beta', 'Gamma', 'Alpha']);
    expect(onReorder).not.toHaveBeenCalled();

    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 });

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
  });

  it('puts the row back when a drag is cancelled', () => {
    const onReorder = setup();
    const handle = screen.getByRole('button', { name: 'Move Alpha' });

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 10 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });

    expect(onReorder).not.toHaveBeenCalled();
    expect(shown()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});
