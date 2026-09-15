import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/*
  Content versions every server process shares.

  Passenger runs the site as several Node processes, and Next.js remembers
  which cache tags were revalidated in each process's own memory. The
  revalidation webhook reaches one of them, so the rest went on serving the
  old data until their 300-second window ran out - an Update showed on the
  site about five minutes later.

  Here a revalidation also bumps a version per tag in a small file on disk,
  which every process reads, and public fetches carry their tags' versions in
  their cache key. A bumped tag is a cache miss in every process at once.
*/

type Versions = Record<string, number>;

/** Inside the release's own cache directory, so a deploy starts clean. */
export function versionsFile(): string {
  return (
    process.env.NB_CONTENT_VERSIONS_FILE ??
    join(process.cwd(), '.next', 'cache', 'nb-content-versions.json')
  );
}

let memo: { file: string; mtime: number; versions: Versions } | null = null;

/** Read on every public fetch, so it is only parsed again when the file changed. */
export function readVersions(file = versionsFile()): Versions {
  try {
    const mtime = statSync(file).mtimeMs;

    if (memo && memo.file === file && memo.mtime === mtime) {
      return memo.versions;
    }

    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const versions: Versions = {};

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [tag, value] of Object.entries(parsed)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          versions[tag] = value;
        }
      }
    }

    memo = { file, mtime, versions };

    return versions;
  } catch {
    // No file yet, or a torn read: nothing has been revalidated since the deploy.
    return {};
  }
}

/** The part of a cache key that changes whenever one of these tags is revalidated. */
export function contentVersion(tags: string[] | undefined, file = versionsFile()): string {
  if (!tags || tags.length === 0) {
    return '';
  }

  const versions = readVersions(file);

  return tags.map((tag) => versions[tag] ?? 0).join('.');
}

/** Called by the revalidation webhook. Written to a temporary file and renamed, so no reader sees half of it. */
export function bumpVersions(tags: string[], file = versionsFile(), now = Date.now()): void {
  const versions = { ...readVersions(file) };

  for (const tag of tags) {
    // Always moves forward, even for two bumps in the same millisecond.
    versions[tag] = Math.max(now, (versions[tag] ?? 0) + 1);
  }

  mkdirSync(dirname(file), { recursive: true });

  const temporary = `${file}.${process.pid}.${now}.tmp`;
  writeFileSync(temporary, JSON.stringify(versions));
  renameSync(temporary, file);

  memo = null;
}
