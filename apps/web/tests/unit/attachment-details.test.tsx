import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttachmentDetails } from '@/features/dashboard/attachment-details';
import type { MediaDetail } from '@/features/dashboard/media-filters';

const request = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const image: MediaDetail = {
  id: 5,
  url: 'https://nuruzzaman.com.bd/storage/uploads/2026/09/six-storey.jpg',
  original_name: 'Design-Example-of-a-Six-Storey-Building-day-view.jpg',
  title: 'Design-Example-of-a-Six-Storey-Building-day-view',
  mime_type: 'image/jpeg',
  size_bytes: 258048,
  width: 1102,
  height: 1428,
  duration_seconds: null,
  alt_text: null,
  caption: null,
  description: null,
  credit: null,
  focal: { x: 0.5, y: 0.5 },
  exclude_from_sitemap: false,
  editable: true,
  edited: false,
  attachment_path: '/attachment/5',
  uploaded_by: { id: 2, name: 'Fatema' },
  uploaded_at: '2026-06-15T10:00:00+00:00',
  used_in: [
    {
      label: 'Article',
      title: 'Design Example of a Six Storey Building',
      edit_path: '/dashboard/posts/9',
    },
  ],
  shared_as_social_image: 0,
  focus_keywords: [
    {
      keyword: 'six storey building design',
      source: 'Article “Design Example of a Six Storey Building”',
    },
  ],
};

const video: MediaDetail = {
  ...image,
  id: 6,
  url: 'https://nuruzzaman.com.bd/storage/uploads/2026/09/walkthrough.mp4',
  original_name: 'Modern-triplex-house-design-in-kushtia-Animation-Video.mp4',
  title: 'Modern triplex house design in kushtia',
  mime_type: 'video/mp4',
  width: null,
  height: null,
  duration_seconds: 253,
  editable: false,
  attachment_path: '/attachment/6',
  focus_keywords: [],
};

function renderDetails(
  item: MediaDetail,
  overrides: Partial<Parameters<typeof AttachmentDetails>[0]> = {},
) {
  const props = {
    item,
    onClose: vi.fn(),
    onChanged: vi.fn(),
    onDelete: vi.fn(async () => undefined),
    ...overrides,
  };

  render(<AttachmentDetails {...props} />);

  return { props, dialog: screen.getByRole('dialog', { name: 'Attachment details' }) };
}

beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (_path: string, options?: { body?: object }) => ({
    data: { ...image, ...(options?.body ?? {}) },
  }));
});

describe('AttachmentDetails', () => {
  it('lists the facts WordPress shows, with where the file is used', () => {
    const { dialog } = renderDetails(image);

    expect(dialog).toHaveTextContent('Uploaded on:');
    expect(dialog).toHaveTextContent('Uploaded by: Fatema');
    expect(
      within(dialog).getByRole('link', { name: 'Design Example of a Six Storey Building' }),
    ).toHaveAttribute('href', '/dashboard/posts/9');
    expect(dialog).toHaveTextContent('File type: image/jpeg');
    expect(dialog).toHaveTextContent('Dimensions: 1102 by 1428 pixels');

    expect(within(dialog).getByRole('link', { name: 'View attachment page' })).toHaveAttribute(
      'href',
      '/attachment/5',
    );
    expect(within(dialog).getByRole('link', { name: 'Edit more details' })).toHaveAttribute(
      'href',
      '/dashboard/media/5',
    );
    expect(within(dialog).getByRole('link', { name: 'Download file' })).toHaveAttribute(
      'download',
      image.original_name,
    );
    // Already has its details, so nothing is fetched.
    expect(request).not.toHaveBeenCalled();
  });

  it('sets the focus keyword as the alt text and leaves the page out of the sitemap', async () => {
    const { dialog, props } = renderDetails(image);

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Use focus keyword: six storey building design' }),
    );

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/5', {
        method: 'PATCH',
        body: { alt_text: 'six storey building design' },
      }),
    );
    expect(within(dialog).getByLabelText('Alternative Text')).toHaveValue(
      'six storey building design',
    );
    expect(props.onChanged).toHaveBeenCalled();

    fireEvent.click(within(dialog).getByLabelText('Exclude this attachment from sitemap'));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/5', {
        method: 'PATCH',
        body: { exclude_from_sitemap: true },
      }),
    );
  });

  it('does not save a field that did not change', () => {
    const { dialog } = renderDetails(image);

    fireEvent.blur(within(dialog).getByLabelText('Title'));

    expect(request).not.toHaveBeenCalled();
  });

  it('plays a video and gives its length, with no alt text or editing', () => {
    const { dialog } = renderDetails(video);

    expect(dialog.querySelector('video')).toHaveAttribute('controls');
    expect(dialog).toHaveTextContent('Length: 4 minutes, 13 seconds');
    expect(within(dialog).queryByLabelText('Alternative Text')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Edit Image' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Caption')).toBeInTheDocument();
  });

  it('opens the image editor, moves between files and closes on Escape', () => {
    const onPrev = vi.fn();
    const { dialog, props } = renderDetails(image, { onPrev });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit Image' }));
    expect(within(dialog).getByRole('button', { name: /Rotate right/ })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Previous media item' }));
    expect(onPrev).toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Next media item' })).toBeDisabled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });
});
