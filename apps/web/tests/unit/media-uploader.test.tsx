import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUploader } from '@/features/dashboard/media-uploader';

const request = vi.hoisted(() => vi.fn());
const uploadInParts = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/uploads/chunked-upload', () => ({ uploadInParts }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

function sized(name: string, type: string, bytes: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });

  return file;
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: {} });
  uploadInParts.mockReset();
  uploadInParts.mockImplementation(async (file: File, onProgress?: (fraction: number) => void) => {
    onProgress?.(1);

    return { upload_id: `id-${file.name}`, total: 1, filename: file.name };
  });
});

describe('MediaUploader', () => {
  it('sends each accepted file in parts and refuses the rest with a reason', async () => {
    const onUploaded = vi.fn();
    render(<MediaUploader onUploaded={onUploaded} />);

    fireEvent.change(screen.getByLabelText('Select Files'), {
      target: {
        files: [
          sized('duplex-plan.png', 'image/png', 300_000),
          sized('setup.exe', 'application/x-msdownload', 1_000),
          sized('huge-photo.jpg', 'image/jpeg', 25 * 1024 * 1024),
        ],
      },
    });

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));

    expect(uploadInParts).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/admin/media', {
      method: 'POST',
      body: {
        upload_id: 'id-duplex-plan.png',
        total: 1,
        filename: 'duplex-plan.png',
        duration_seconds: null,
      },
    });
    expect(screen.getByText(/This kind of file is not accepted/)).toBeInTheDocument();
    expect(screen.getByText(/The file is too large/)).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('lets a video be far larger than an image', async () => {
    const onUploaded = vi.fn();
    render(<MediaUploader onUploaded={onUploaded} />);

    fireEvent.change(screen.getByLabelText('Select Files'), {
      target: { files: [sized('walkthrough.mp4', 'video/mp4', 250 * 1024 * 1024)] },
    });

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/admin/media', {
      method: 'POST',
      body: expect.objectContaining({ filename: 'walkthrough.mp4' }),
    });
  });
});
