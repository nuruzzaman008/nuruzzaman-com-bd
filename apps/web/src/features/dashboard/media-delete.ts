import type { MediaItem } from '@nuruzzaman/contracts';

import { ApiError, api } from '@/lib/api/browser';

export type MediaDeleteOutcome = { deleted: number; failed: string[] };

/**
 * Deletes library files one by one.
 *
 * The API refuses a file still used as a cover or inside an article's text,
 * naming those places. Every refused file is listed in one question, and they
 * are deleted only if the admin says so again - never silently.
 */
export async function deleteMediaFiles(
  files: Pick<MediaItem, 'id' | 'original_name'>[],
  bn: boolean,
): Promise<MediaDeleteOutcome> {
  const inUse: { file: Pick<MediaItem, 'id' | 'original_name'>; message: string }[] = [];
  const failed: string[] = [];
  let deleted = 0;

  for (const file of files) {
    try {
      await api(`/admin/media/${file.id}`, { method: 'DELETE' });
      deleted += 1;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        inUse.push({ file, message: caught.message });
      } else {
        failed.push(`${file.original_name}: ${caught instanceof Error ? caught.message : ''}`);
      }
    }
  }

  if (inUse.length > 0) {
    const list = inUse
      .map(({ file, message }) => `• ${file.original_name} — ${message}`)
      .join('\n');

    const anyway = window.confirm(
      bn
        ? `এই ফাইলগুলো এখনো ব্যবহার হচ্ছে:\n${list}\n\nমুছলে ওই জায়গাগুলোতে এগুলো আর দেখা যাবে না। তবুও মুছবেন?`
        : `These files are still in use:\n${list}\n\nThose places will lose them. Delete anyway?`,
    );

    if (anyway) {
      for (const { file } of inUse) {
        try {
          await api(`/admin/media/${file.id}`, { method: 'DELETE', query: { force: 1 } });
          deleted += 1;
        } catch (caught) {
          failed.push(`${file.original_name}: ${caught instanceof Error ? caught.message : ''}`);
        }
      }
    }
  }

  return { deleted, failed };
}
