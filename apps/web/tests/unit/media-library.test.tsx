import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaItem } from '@nuruzzaman/contracts';

import { mediaFiltersFrom, mediaHref, mediaTitle } from '@/features/dashboard/media-filters';
import { MediaLibrary } from '@/features/dashboard/media-library';
import { ApiError } from '@/lib/api/browser';

const request = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock('@/lib/api/browser', () => ({
  api: request,
  ApiError: class extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const Conflict = ApiError as unknown as new (status: number, message: string) => Error;

const file = (id: number, overrides: Partial<MediaItem> = {}): MediaItem => ({
  id,
  url: `https://nuruzzaman.com.bd/storage/uploads/2026/09/${id}.webp`,
  original_name: `file-${id}.webp`,
  mime_type: 'image/webp',
  size_bytes: 120000,
  width: 1200,
  height: 900,
  alt_text: null,
  caption: null,
  credit: null,
  focal: { x: 0.5, y: 0.5 },
  uploaded_at: '2026-09-10T10:00:00+00:00',
  ...overrides,
});

const items = [
  file(1, { alt_text: 'Ground floor plan' }),
  file(2, { original_name: 'six-storey-building.webp' }),
  file(3, { original_name: 'boq.pdf', mime_type: 'application/pdf', url: null }),
];

const confirm = vi.fn();

function renderLibrary(view: 'grid' | 'list' = 'grid') {
  render(
    <MediaLibrary
      items={items}
      months={['2026-09', '2026-08']}
      filters={{ view }}
      page={{ current: 1, last: 1, total: 3 }}
    />,
  );
}

beforeEach(() => {
  request.mockReset();
  push.mockReset();
  refresh.mockReset();
  confirm.mockReset();
  vi.stubGlobal('confirm', confirm);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('media filters', () => {
  it('keeps filters in the address and drops malformed ones', () => {
    expect(mediaHref({ type: 'image', month: '2026-09', q: 'duplex', view: 'list' }, 2)).toBe(
      '/dashboard/media?type=image&month=2026-09&q=duplex&view=list&page=2',
    );
    expect(mediaFiltersFrom({ type: 'video', month: 'September', q: '  ', page: 'x' })).toEqual({
      filters: { q: undefined, type: undefined, month: undefined, view: 'grid' },
      page: 1,
    });
    expect(mediaTitle({ alt_text: null, original_name: 'plan.final.png' })).toBe('plan.final');
  });
});

describe('MediaLibrary', () => {
  it('shows every file as a titled tile and edits its alt text from the details', async () => {
    renderLibrary();

    expect(screen.getByRole('button', { name: 'Details: Ground floor plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details: boq' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Details: six-storey-building' }));
    const dialog = screen.getByRole('dialog', { name: 'Attachment details' });
    expect(within(dialog).getByText('six-storey-building.webp')).toBeInTheDocument();

    request.mockResolvedValue({ data: { ...items[1], alt_text: 'Six storey building' } });
    fireEvent.change(within(dialog).getByLabelText(/^Alt text/), {
      target: { value: 'Six storey building' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/2', {
        method: 'PATCH',
        body: { alt_text: 'Six storey building', caption: null },
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('filters by type and month, searches, and switches to the list', () => {
    renderLibrary();

    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'image' } });
    expect(push).toHaveBeenLastCalledWith('/dashboard/media?type=image');

    fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: '2026-09' } });
    expect(push).toHaveBeenLastCalledWith('/dashboard/media?month=2026-09');
    expect(screen.getByRole('option', { name: 'September 2026' })).toBeInTheDocument();

    const search = screen.getByLabelText('Search media');
    fireEvent.change(search, { target: { value: 'duplex' } });
    fireEvent.submit(search.closest('form')!);
    expect(push).toHaveBeenLastCalledWith('/dashboard/media?q=duplex');

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(push).toHaveBeenLastCalledWith('/dashboard/media?view=list');
  });

  it('bulk deletes the chosen files, asking again for one still in use', async () => {
    renderLibrary();
    confirm.mockReturnValue(true);
    request
      .mockResolvedValueOnce({ message: 'Media deleted.' })
      .mockRejectedValueOnce(
        new Conflict(409, 'This file is still used by: Article “Beam design”.'),
      )
      .mockResolvedValueOnce({ message: 'Media deleted.' });

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select: Ground floor plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select: boq' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(confirm).toHaveBeenNthCalledWith(1, 'Delete 2 files permanently?');
    expect(confirm).toHaveBeenLastCalledWith(
      expect.stringContaining('boq.pdf — This file is still used by: Article “Beam design”.'),
    );
    expect(request.mock.calls).toEqual([
      ['/admin/media/1', { method: 'DELETE' }],
      ['/admin/media/3', { method: 'DELETE' }],
      ['/admin/media/3', { method: 'DELETE', query: { force: 1 } }],
    ]);
  });

  it('keeps a file in use when the admin declines the second question', async () => {
    renderLibrary('list');
    confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
    request.mockRejectedValueOnce(
      new Conflict(409, 'This file is still used by: Product “NB Engineering Tools”.'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details: Ground floor plan' }));
    const dialog = screen.getByRole('dialog', { name: 'Attachment details' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Attachment details' })).toBeInTheDocument();
  });
});
