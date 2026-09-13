import { ApiError, api } from '@/lib/api/browser';

/*
  Sending a large file to the API in parts.

  The host's PHP refuses any single upload over 2 MB, which rules out every
  lesson video and most PDFs sent whole. So a file goes in 1 MB parts, and the
  endpoint it is meant for is then given the upload id, the number of parts
  and the file name instead of the file. See App\Services\Uploads\ChunkedUploads.
*/

/** Comfortably under the host's 2 MB per-request limit. */
export const PART_BYTES = 1024 * 1024;

/** What the lesson file and video endpoints accept. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

const ATTEMPTS = 3;

export type UploadedParts = { upload_id: string; total: number; filename: string };

/** A dropped connection or a busy server is worth another try; a refusal is not. */
function retryable(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 429 || error.status >= 500;
}

export async function uploadInParts(
  file: File,
  onProgress?: (fraction: number) => void,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<UploadedParts> {
  const uploadId = crypto.randomUUID();
  const total = Math.max(1, Math.ceil(file.size / PART_BYTES));

  for (let index = 0; index < total; index++) {
    const body = new FormData();
    body.set('upload_id', uploadId);
    body.set('index', String(index));
    body.set('chunk', file.slice(index * PART_BYTES, (index + 1) * PART_BYTES), `${index}.part`);

    for (let attempt = 1; ; attempt++) {
      try {
        await api('/admin/uploads/chunks', { method: 'POST', body });
        break;
      } catch (error) {
        // Part 40 of 90 failing on the way should not cost the first 39.
        if (attempt >= ATTEMPTS || !retryable(error)) {
          throw error;
        }

        await wait(1000 * attempt);
      }
    }

    onProgress?.((index + 1) / total);
  }

  return { upload_id: uploadId, total, filename: file.name };
}
