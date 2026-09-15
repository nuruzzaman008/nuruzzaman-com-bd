import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaItem } from '@nuruzzaman/contracts';

import {
  lengthLabel,
  mediaFiltersFrom,
  mediaHref,
  mediaTitle,
} from '@/features/dashboard/media-filters';
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
  title: null,
  mime_type: 'image/webp',
  size_bytes: 120000,
  width: 1200,
  height: 900,
  duration_seconds: null,
  alt_text: null,
  caption: null,
  description: null,
  credit: null,
  focal: { x: 0.5, y: 0.5 },
  exclude_from_sitemap: false,
  editable: true,
  edited: false,
  attachment_path: `/attachment/${id}`,
  uploaded_by: null,
  uploaded_at: '2026-09-10T10:00:00+00:00',
  ...overrides,
});

const items = [
  file(1, { alt_text: 'Ground floor plan' }),
  file(2, { original_name: 'six-storey-building.webp' }),
  file(3, { original_name: 'boq.pdf', mime_type: 'application/pdf', url: null, editable: false }),
];

const detailOf = (item: MediaItem) => ({
  ...item,
  used_in: [],
  shared_as_social_image: 0,
  focus_keywords: [],
});

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

/** Answers the details fetch for any file; other calls fall to the test's own mocks. */
function answerDetails() {
  request.mockImplementation(async (path: string, options?: { method?: string }) => {
    const id = Number(path.split('/').pop());
    const item = items.find((candidate) => candidate.id === id);

    if (!options?.method && item) {
      return { data: detailOf(item) };
    }

    throw new Error(`Unexpected ${options?.method} ${path}`);
  });
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
    expect(mediaHref({ type: 'video', month: '2026-09', q: 'duplex', view: 'list' }, 2)).toBe(
      '/dashboard/media?type=video&month=2026-09&q=duplex&view=list&page=2',
    );
    expect(mediaFiltersFrom({ type: 'audio', month: 'September', q: '  ', page: 'x' })).toEqual({
      filters: { q: undefined, type: undefined, month: undefined, view: 'grid' },
      page: 1,
    });
  });

  it('titles a file by its title, then its alt text, then its name', () => {
    expect(mediaTitle({ title: 'Duplex plan', alt_text: 'Plan', original_name: 'a.png' })).toBe(
      'Duplex plan',
    );
    expect(mediaTitle({ title: null, alt_text: 'Plan', original_name: 'a.png' })).toBe('Plan');
    expect(mediaTitle({ alt_text: null, original_name: 'plan.final.png' })).toBe('plan.final');
  });

  it('says a video length the way WordPress does', () => {
    expect(lengthLabel(253, false)).toBe('4 minutes, 13 seconds');
    expect(lengthLabel(3601, false)).toBe('1 hour, 1 second');
    expect(lengthLabel(null, false)).toBeNull();
  });
});

describe('MediaLibrary', () => {
  it('opens a file in attachment details, moves to the next one and saves a title on leaving the field', async () => {
    renderLibrary();
    answerDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Details: six-storey-building' }));
    const dialog = screen.getByRole('dialog', { name: 'Attachment details' });
    expect(within(dialog).getByText('six-storey-building.webp')).toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/media/2'));

    request.mockImplementationOnce(async () => ({
      data: { ...items[1], title: 'Six storey building' },
    }));
    const title = within(dialog).getByLabelText('Title');
    fireEvent.change(title, { target: { value: 'Six storey building' } });
    fireEvent.blur(title);

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/2', {
        method: 'PATCH',
        body: { title: 'Six storey building' },
      }),
    );
    expect(refresh).toHaveBeenCalled();

    answerDetails();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next media item' }));
    expect(screen.getByRole('dialog', { name: 'Attachment details' })).toHaveTextContent('boq.pdf');
    expect(screen.getByRole('button', { name: 'Next media item' })).toBeDisabled();
  });

  it('filters by type and month, searches, switches to the list and opens the uploader', () => {
    renderLibrary();

    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'video' } });
    expect(push).toHaveBeenLastCalledWith('/dashboard/media?type=video');

    fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: '2026-09' } });
    expect(push).toHaveBeenLastCalledWith('/dashboard/media?month=2026-09');
    expect(screen.getByRole('option', { name: 'September 2026' })).toBeInTheDocument();

    const search = screen.getByLabelText('Search media');
    fireEvent.change(search, { target: { value: 'duplex' } });
    fireEvent.submit(search.closest('form')!);
    expect(push).toHaveBeenLastCalledWith('/dashboard/media?q=duplex');

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(push).toHaveBeenLastCalledWith('/dashboard/media?view=list');

    fireEvent.click(screen.getByRole('button', { name: 'Add New Media File' }));
    expect(screen.getByText('Drop files to upload')).toBeInTheDocument();
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
    request.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') {
        throw new Conflict(409, 'This file is still used by: Product “NB Engineering Tools”.');
      }

      return { data: detailOf(items[0]) };
    });

    fireEvent.click(screen.getByRole('button', { name: 'Details: Ground floor plan' }));
    const dialog = screen.getByRole('dialog', { name: 'Attachment details' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(request.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(
      1,
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Attachment details' })).toBeInTheDocument();
  });
});
