import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_EDGE_PX,
  SERVER_UPLOAD_LIMIT_BYTES,
  fitWithin,
  isAcceptedType,
  needsResize,
  prepareImageForUpload,
} from '@/lib/media/prepare-upload';

const MB = 1024 * 1024;

function fileOf(bytes: number, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/**
 * jsdom has neither createImageBitmap nor a real canvas, so both are stood in
 * for: the bitmap reports the size a real photo would have, and toBlob answers
 * with a blob of whatever size and type the scenario calls for. What is under
 * test is the decision-making around them, not the browser's encoder.
 */
function stubImage(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }));

  return { close };
}

function stubCanvas(answer: (type: string, quality: number) => { bytes: number; type: string }) {
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const sizes: { width: number; height: number; type: string; quality: number }[] = [];

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    sizes.push({ width: this.width, height: this.height, type: type ?? '', quality: quality ?? 0 });
    const result = answer(type ?? '', quality ?? 0);
    callback(new Blob([new Uint8Array(result.bytes)], { type: result.type }));
  });

  return { context, sizes };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the pieces', () => {
  it('accepts only images a share card can show', () => {
    expect(isAcceptedType('image/jpeg')).toBe(true);
    expect(isAcceptedType('image/png')).toBe(true);
    expect(isAcceptedType('image/webp')).toBe(true);

    expect(isAcceptedType('image/svg+xml')).toBe(false);
    expect(isAcceptedType('image/avif')).toBe(false);
    expect(isAcceptedType('image/gif')).toBe(false);
    expect(isAcceptedType('application/pdf')).toBe(false);
    expect(isAcceptedType('')).toBe(false);
  });

  it('scales down to the long edge, keeping the shape', () => {
    expect(fitWithin(6000, 4000)).toEqual({ width: 2400, height: 1600 });
    expect(fitWithin(3000, 4500)).toEqual({ width: 1600, height: 2400 });
  });

  it('never scales up, and never to nothing', () => {
    expect(fitWithin(1200, 630)).toEqual({ width: 1200, height: 630 });
    expect(fitWithin(100000, 1)).toEqual({ width: MAX_EDGE_PX, height: 1 });
  });

  it('resizes only what the server would refuse or what is needlessly large', () => {
    expect(needsResize(SERVER_UPLOAD_LIMIT_BYTES, 1200, 800)).toBe(false);
    expect(needsResize(SERVER_UPLOAD_LIMIT_BYTES + 1, 1200, 800)).toBe(true);
    expect(needsResize(500_000, 4032, 3024)).toBe(true);
    expect(needsResize(500_000, 1200, 800)).toBe(false);
  });
});

describe('prepareImageForUpload', () => {
  it('turns away a type without trying to decode it', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);

    const result = await prepareImageForUpload(fileOf(1000, 'logo.svg', 'image/svg+xml'));

    expect(result).toEqual({ ok: false, reason: 'type' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('sends an image that is already fine exactly as it is', async () => {
    const { close } = stubImage(1200, 630);
    const original = fileOf(400_000, 'cover.jpg', 'image/jpeg');

    const result = await prepareImageForUpload(original);

    expect(result).toEqual({ ok: true, file: original, resized: false });
    expect(close).toHaveBeenCalled();
  });

  it('shrinks a phone photo to WebP under the server limit', async () => {
    const { close } = stubImage(4032, 3024);
    const { sizes } = stubCanvas((type) => ({ bytes: 700_000, type }));

    const result = await prepareImageForUpload(fileOf(6 * MB, 'IMG_2041.JPG', 'image/jpeg'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.resized).toBe(true);
    expect(result.file.type).toBe('image/webp');
    expect(result.file.name).toBe('IMG_2041.webp');
    expect(result.file.size).toBeLessThanOrEqual(SERVER_UPLOAD_LIMIT_BYTES);
    // Drawn at the fitted size, not at the camera's.
    expect(sizes[0]).toMatchObject({ width: 2400, height: 1800, type: 'image/webp' });
    expect(close).toHaveBeenCalled();
  });

  it('lowers the quality before giving up', async () => {
    stubImage(4032, 3024);
    const { sizes } = stubCanvas((type, quality) => ({
      bytes: quality > 0.8 ? 3 * MB : MB,
      type,
    }));

    const result = await prepareImageForUpload(fileOf(6 * MB, 'photo.jpg', 'image/jpeg'));

    expect(result.ok).toBe(true);
    expect(sizes.map((entry) => entry.quality)).toEqual([0.85, 0.72]);
  });

  it('falls back to JPEG, on white, where the browser cannot encode WebP', async () => {
    stubImage(4000, 3000);
    // Asked for WebP, a browser without it hands back PNG - the tell.
    const { context } = stubCanvas((type) =>
      type === 'image/webp' ? { bytes: 5 * MB, type: 'image/png' } : { bytes: 900_000, type },
    );

    const result = await prepareImageForUpload(fileOf(5 * MB, 'badge.png', 'image/png'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.file.type).toBe('image/jpeg');
    expect(result.file.name).toBe('badge.jpg');
    // A transparent PNG drawn onto JPEG without a ground comes out black.
    expect(context.fillRect).toHaveBeenCalled();
  });

  it('says so when even the smallest attempt is over the limit', async () => {
    stubImage(9000, 9000);
    stubCanvas((type) => ({ bytes: 3 * MB, type }));

    const result = await prepareImageForUpload(fileOf(40 * MB, 'poster.png', 'image/png'));

    expect(result).toEqual({ ok: false, reason: 'too-large' });
  });

  it('still sends an oversized-in-pixels file when there is no canvas, if the server takes it', async () => {
    stubImage(5000, 3000);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const original = fileOf(1.5 * MB, 'wide.jpg', 'image/jpeg');

    const result = await prepareImageForUpload(original);

    expect(result).toEqual({ ok: true, file: original, resized: false });
  });

  it('reports a file that will not decode as unreadable', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')));

    const result = await prepareImageForUpload(fileOf(2000, 'broken.jpg', 'image/jpeg'));

    expect(result).toEqual({ ok: false, reason: 'unreadable' });
  });
});
