import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PART_BYTES, uploadInParts } from '@/lib/uploads/chunked-upload';

const request = vi.hoisted(() => vi.fn());

const FakeApiError = vi.hoisted(
  () =>
    class extends Error {
      constructor(
        readonly status: number,
        message: string,
      ) {
        super(message);
      }
    },
);

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));

const sentParts = () =>
  request.mock.calls.map(([path, options]) => {
    const body = options.body as FormData;

    return {
      path,
      uploadId: body.get('upload_id'),
      index: body.get('index'),
      size: (body.get('chunk') as Blob).size,
    };
  });

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: { received: 0 } });
});

describe('uploadInParts', () => {
  it('sends a file larger than the host limit as parts under it, reporting progress', async () => {
    const file = new File([new Uint8Array(Math.round(2.5 * PART_BYTES))], 'Septic tank design.pdf');
    const progress: number[] = [];

    const result = await uploadInParts(file, (fraction) => progress.push(fraction));

    expect(result).toMatchObject({ total: 3, filename: 'Septic tank design.pdf' });
    expect(progress).toEqual([1 / 3, 2 / 3, 1]);

    const parts = sentParts();
    expect(parts.map((part) => part.index)).toEqual(['0', '1', '2']);
    expect(parts.every((part) => part.path === '/admin/uploads/chunks')).toBe(true);
    expect(parts.every((part) => part.uploadId === result.upload_id)).toBe(true);
    expect(parts.every((part) => part.size <= PART_BYTES)).toBe(true);
    expect(parts.reduce((sum, part) => sum + part.size, 0)).toBe(file.size);
  });

  it('sends an empty file as one part, so it can still be attached', async () => {
    const result = await uploadInParts(new File([], 'empty.txt'));

    expect(result.total).toBe(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('tries a part again after a dropped connection', async () => {
    request.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const wait = vi.fn(async () => undefined);

    const result = await uploadInParts(new File(['notes'], 'notes.txt'), undefined, wait);

    expect(result.total).toBe(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('stops at once when the server refuses a part', async () => {
    request.mockRejectedValueOnce(new FakeApiError(422, 'The chunk failed to upload.'));
    const wait = vi.fn(async () => undefined);

    await expect(uploadInParts(new File(['notes'], 'notes.txt'), undefined, wait)).rejects.toThrow(
      'The chunk failed to upload.',
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
