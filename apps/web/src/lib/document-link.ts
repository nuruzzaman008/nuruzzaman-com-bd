/**
 * Documents a lesson links to rather than stores: a Google Drive, Dropbox or
 * OneDrive share, or any other https:// address. The API checks the address
 * again (App\Support\DocumentLink); this is so the form can say so at once.
 */

export type DocumentProvider = 'google_drive' | 'dropbox' | 'onedrive' | 'other';

/** Brand names, the same in every language. */
export const PROVIDER_NAMES: Record<DocumentProvider, string> = {
  google_drive: 'Google Drive',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
  other: 'Link',
};

const DOMAINS: Array<[DocumentProvider, string[]]> = [
  ['google_drive', ['drive.google.com', 'docs.google.com']],
  ['dropbox', ['dropbox.com', 'dropboxusercontent.com']],
  ['onedrive', ['onedrive.live.com', '1drv.ms', 'sharepoint.com']],
];

/** The service a usable link is on, or null when the API would refuse it. */
export function documentProvider(url: string): DocumentProvider | null {
  const value = url.trim();

  if (!value || value.length > 512 || /\s/.test(value)) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  for (const [provider, domains] of DOMAINS) {
    if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return provider;
    }
  }

  return 'other';
}
