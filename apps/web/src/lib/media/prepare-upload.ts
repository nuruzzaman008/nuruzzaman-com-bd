/**
 * Getting a featured image from an admin's computer onto the live server.
 *
 * The API accepts files up to 20 MB, but the host's PHP refuses any upload
 * larger than upload_max_filesize before Laravel ever sees it, and on this
 * account that is 2 MB - the ea-php84 default, which neither .user.ini nor
 * php.ini in the API's docroot overrides (checked on the server). A photo from
 * a phone is usually 3-8 MB, so sent as it is, it fails with nothing more
 * helpful than "the file failed to upload".
 *
 * So a large image is made smaller in the browser first. That is also simply
 * right for a featured image: the widest place one is shown is the product
 * page, and a social share card is 1200x630. 2400px on the long edge keeps a
 * sharp 2x rendering of both, and anything already small enough is sent
 * untouched.
 */

/** What the host's PHP accepts per file. See the note above. */
export const SERVER_UPLOAD_LIMIT_BYTES = 2 * 1024 * 1024;

/** The longest edge kept: a 2x rendering of the widest place a cover appears. */
export const MAX_EDGE_PX = 2400;

/**
 * JPEG, PNG and WebP only, though the API also takes SVG, AVIF and PDF. A
 * featured image doubles as the social share card, and the platforms that
 * render those cards do not reliably show SVG or AVIF - the card goes blank.
 */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Tried in order until the result fits under the limit. */
const QUALITIES = [0.85, 0.72, 0.6] as const;

export type PreparedUpload =
  | { ok: true; file: File; resized: boolean }
  | { ok: false; reason: 'type' | 'too-large' | 'unreadable' };

export function isAcceptedType(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

/** Scales a size down to fit within `maxEdge`, never up, never to zero. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE_PX,
): { width: number; height: number } {
  const longest = Math.max(width, height);

  if (longest <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longest;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Whether the server would refuse it, or it is larger than it needs to be. */
export function needsResize(size: number, width: number, height: number): boolean {
  return size > SERVER_UPLOAD_LIMIT_BYTES || Math.max(width, height) > MAX_EDGE_PX;
}

function encode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  type: string,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    return Promise.resolve(null);
  }

  // JPEG has no transparency; without a ground, a transparent PNG turns black.
  if (type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renamed(name: string, type: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image';

  return `${base}.${type === 'image/webp' ? 'webp' : 'jpg'}`;
}

/**
 * The file to send: the original when it is already fine, a smaller copy when
 * it is not, or the reason it cannot be sent at all.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedUpload> {
  if (!isAcceptedType(file.type)) {
    return { ok: false, reason: 'type' };
  }

  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  try {
    if (!needsResize(file.size, bitmap.width, bitmap.height)) {
      return { ok: true, file, resized: false };
    }

    const { width, height } = fitWithin(bitmap.width, bitmap.height);

    // WebP first: far smaller than JPEG at the same quality. A browser that
    // cannot encode it quietly hands back PNG instead, which is the cue to
    // move on to JPEG rather than to keep lowering the quality of a PNG.
    for (const type of ['image/webp', 'image/jpeg']) {
      for (const quality of QUALITIES) {
        const blob = await encode(bitmap, width, height, type, quality);

        if (!blob || blob.type !== type) {
          break;
        }

        if (blob.size <= SERVER_UPLOAD_LIMIT_BYTES) {
          return {
            ok: true,
            file: new File([blob], renamed(file.name, type), { type }),
            resized: true,
          };
        }
      }
    }

    // No canvas to resize with, but the original is within the limit: it was
    // only larger in pixels than it needed to be, and the server will take it.
    if (file.size <= SERVER_UPLOAD_LIMIT_BYTES) {
      return { ok: true, file, resized: false };
    }

    return { ok: false, reason: 'too-large' };
  } finally {
    bitmap.close();
  }
}
