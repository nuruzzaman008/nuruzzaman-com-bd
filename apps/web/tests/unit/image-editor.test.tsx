import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaItem } from '@nuruzzaman/contracts';

import {
  ImageEditor,
  editedSize,
  moveCrop,
  resizeCrop,
  turnedSize,
} from '@/features/dashboard/image-editor';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const photo: MediaItem = {
  id: 12,
  url: 'https://nuruzzaman.com.bd/storage/uploads/2026/09/site.jpg',
  original_name: 'site.jpg',
  title: 'site',
  mime_type: 'image/jpeg',
  size_bytes: 400000,
  width: 1200,
  height: 800,
  duration_seconds: null,
  alt_text: null,
  caption: null,
  description: null,
  credit: null,
  focal: { x: 0.5, y: 0.5 },
  exclude_from_sitemap: false,
  editable: true,
  edited: true,
  attachment_path: '/attachment/12',
  uploaded_by: null,
  uploaded_at: '2026-09-10T10:00:00+00:00',
};

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({
    data: { ...photo, used_in: [], shared_as_social_image: 0, focus_keywords: [] },
  });
});

describe('image edit arithmetic', () => {
  it('works out the result the way the API does', () => {
    expect(turnedSize(1200, 800, 90)).toEqual({ width: 800, height: 1200 });

    const edit = {
      rotate: 90 as const,
      flip_horizontal: false,
      flip_vertical: false,
      crop: { x: 0, y: 0, width: 600, height: 900 },
      scale_width: 300,
    };
    expect(editedSize(1200, 800, edit)).toEqual({ width: 300, height: 450 });
    // Never enlarged.
    expect(editedSize(1200, 800, { ...edit, crop: null, scale_width: 5000 })).toEqual({
      width: 800,
      height: 1200,
    });
  });

  it('keeps a crop inside the image while it is moved or resized', () => {
    const bounds = { width: 1000, height: 500 };
    const crop = { x: 100, y: 100, width: 400, height: 200 };

    expect(moveCrop(crop, 900, -300, bounds)).toEqual({ x: 600, y: 0, width: 400, height: 200 });
    expect(resizeCrop(crop, 2000, -500, bounds)).toEqual({
      x: 100,
      y: 100,
      width: 900,
      height: 10,
    });
  });
});

describe('ImageEditor', () => {
  it('sends the rotation, flip and scale that were chosen', async () => {
    const onSaved = vi.fn();
    render(<ImageEditor item={photo} onCancel={vi.fn()} onSaved={onSaved} />);

    expect(screen.getByRole('button', { name: 'Save edits' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Rotate right/ }));
    fireEvent.click(screen.getByRole('button', { name: /Flip horizontally/ }));
    fireEvent.change(screen.getByLabelText('Scale: new width (px)'), { target: { value: '400' } });
    expect(screen.getByRole('status')).toHaveTextContent('Result: 400 × 600 px');

    fireEvent.click(screen.getByRole('button', { name: 'Save edits' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/12/edit', {
        method: 'POST',
        body: {
          rotate: 90,
          flip_horizontal: true,
          flip_vertical: false,
          crop: null,
          scale_width: 400,
        },
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('crops from a starting box that can be sized exactly', async () => {
    render(<ImageEditor item={photo} onCancel={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Crop/ }));
    expect(screen.getByTestId('crop-area')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Crop width (px)'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Crop height (px)'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save edits' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/12/edit', {
        method: 'POST',
        body: {
          rotate: 0,
          flip_horizontal: false,
          flip_vertical: false,
          crop: { x: 120, y: 80, width: 500, height: 300 },
          scale_width: null,
        },
      }),
    );
  });

  it('restores the original only after asking', async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    render(<ImageEditor item={photo} onCancel={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Restore original image' }));
    expect(request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Restore original image' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/media/12/restore', {
        method: 'POST',
        body: undefined,
      }),
    );

    vi.unstubAllGlobals();
  });
});
