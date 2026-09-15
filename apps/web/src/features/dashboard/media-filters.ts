import type { MediaItem } from '@nuruzzaman/contracts';

/**
 * The media library's filters live in the address, so a search or a month can
 * be reloaded, bookmarked and paged through. Kept out of the client component
 * so the server page can build the same addresses.
 */
export type MediaFilters = {
  q?: string;
  type?: 'image' | 'video' | 'pdf';
  month?: string;
  view?: 'grid' | 'list';
};

/** One file's attachment details: the list item plus where it is used. */
export type MediaDetail = MediaItem & {
  used_in: { label: string; title: string; edit_path: string | null }[];
  shared_as_social_image: number;
  focus_keywords: { keyword: string; source: string }[];
};

export const MEDIA_BASE_PATH = '/dashboard/media';

export function mediaHref(filters: MediaFilters, page = 1): string {
  const query = new URLSearchParams();

  if (filters.type) query.set('type', filters.type);
  if (filters.month) query.set('month', filters.month);
  if (filters.q) query.set('q', filters.q);
  if (filters.view === 'list') query.set('view', 'list');
  if (page > 1) query.set('page', String(page));

  const search = query.toString();

  return search ? `${MEDIA_BASE_PATH}?${search}` : MEDIA_BASE_PATH;
}

/** Reads the filters from a page's search params, dropping anything malformed. */
export function mediaFiltersFrom(params: Record<string, string | string[] | undefined>): {
  filters: MediaFilters;
  page: number;
} {
  const one = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const type = one('type');
  const month = one('month');

  return {
    filters: {
      q: one('q').trim() || undefined,
      type: type === 'image' || type === 'video' || type === 'pdf' ? type : undefined,
      month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined,
      view: one('view') === 'list' ? 'list' : 'grid',
    },
    page: Math.max(1, Number(one('page')) || 1),
  };
}

/** What a tile shows: the title, else the alt text, else the file's own name. */
export function mediaTitle(item: {
  title?: string | null;
  alt_text: string | null;
  original_name: string;
}): string {
  return item.title?.trim() || item.alt_text?.trim() || item.original_name.replace(/\.[^.]+$/, '');
}

export function isImage(item: { url: string | null; mime_type: string }): boolean {
  return Boolean(item.url) && item.mime_type.startsWith('image/');
}

export function isVideo(item: { url: string | null; mime_type: string }): boolean {
  return Boolean(item.url) && item.mime_type.startsWith('video/');
}

export function monthLabel(month: string, bn: boolean): string {
  const [year, number] = month.split('-').map(Number);

  return new Intl.DateTimeFormat(bn ? 'bn-BD' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}

/** A video's length the way WordPress says it: "4 minutes, 13 seconds". */
export function lengthLabel(seconds: number | null | undefined, bn: boolean): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const parts: [number, string, string, string][] = [
    [Math.floor(seconds / 3600), 'hour', 'hours', 'ঘণ্টা'],
    [Math.floor((seconds % 3600) / 60), 'minute', 'minutes', 'মিনিট'],
    [seconds % 60, 'second', 'seconds', 'সেকেন্ড'],
  ];

  return parts
    .filter(([value]) => value > 0)
    .map(([value, one, many, bengali]) =>
      bn ? `${value.toLocaleString('bn-BD')} ${bengali}` : `${value} ${value === 1 ? one : many}`,
    )
    .join(', ');
}
