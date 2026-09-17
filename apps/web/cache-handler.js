'use strict';

/*
  The cache Next.js uses for pages, route handlers and fetches, with one
  addition: a revalidated tag is shared between server processes.

  Passenger runs this site as several Node processes. Next.js keeps the tags
  that were revalidated in each process's own memory, so the webhook Laravel
  calls after a publish reached one process while the others went on serving
  what they had cached until their own 300-second window ran out. That is why
  an Update showed on the site up to five minutes later, and why reloading
  sometimes showed the new page and sometimes the old one - the two processes
  disagreed.

  A revalidated tag is now also stamped with the time in a small file inside
  .next/cache, which every process reads. Anything cached before a tag's stamp
  is a miss, so one publish empties the cache of every process at once and the
  first visitor after it gets a freshly rendered page.
*/

const { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

/*
  Next's own handler, and the header it keeps a cached page's tags in. Both are
  internal paths: tests/unit/cache-handler.test.ts checks they still exist, so
  a Next.js upgrade that moves them fails the build rather than the site.
*/
const FileSystemCache = require('next/dist/server/lib/incremental-cache/file-system-cache').default;
const { NEXT_CACHE_TAGS_HEADER } = require('next/dist/lib/constants');

/** Stamps are dropped after a day. Nothing is cached for anywhere near that long. */
const KEEP_MS = 24 * 60 * 60 * 1000;

/** Inside the release's own cache directory, so every deploy starts clean. */
function stampsFile(ctx) {
  if (process.env.NB_CACHE_TAGS_FILE) {
    return process.env.NB_CACHE_TAGS_FILE;
  }

  // ctx.serverDistDir is .next/server; the cache sits next to it.
  const distDir = ctx && ctx.serverDistDir ? join(ctx.serverDistDir, '..') : join(process.cwd(), '.next');

  return join(distDir, 'cache', 'nb-revalidated-tags.json');
}

let memo = null;

/** Parsed again only when the file changed, because this runs on every cache read. */
function readStamps(file, fresh = false) {
  try {
    const { mtimeMs } = statSync(/* turbopackIgnore: true */ file);

    if (!fresh && memo && memo.file === file && memo.mtime === mtimeMs) {
      return memo.stamps;
    }

    const parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ file, 'utf8'));
    const stamps = {};

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [tag, at] of Object.entries(parsed)) {
        if (typeof at === 'number' && Number.isFinite(at)) {
          stamps[tag] = at;
        }
      }
    }

    memo = { file, mtime: mtimeMs, stamps };

    return stamps;
  } catch {
    // No file yet, or a half-written one: nothing has been revalidated.
    return {};
  }
}

/** Written to a temporary file and renamed, so no reader ever sees half of it. */
function writeStamps(file, tags, now = Date.now()) {
  const stamps = {};

  for (const [tag, at] of Object.entries(readStamps(file, true))) {
    if (now - at < KEEP_MS) {
      stamps[tag] = at;
    }
  }

  for (const tag of tags) {
    stamps[tag] = now;
  }

  mkdirSync(dirname(file), { recursive: true });

  const temporary = `${file}.${process.pid}.${now}.tmp`;

  writeFileSync(temporary, JSON.stringify(stamps));
  renameSync(temporary, file);
  memo = null;

  return stamps;
}

/** The tags a cache entry carries: a page keeps them in a header, a fetch is asked for them. */
function tagsOf(entry, ctx) {
  const tags = [];
  const header = entry && entry.value && entry.value.headers && entry.value.headers[NEXT_CACHE_TAGS_HEADER];

  if (typeof header === 'string' && header.length > 0) {
    tags.push(...header.split(','));
  }

  if (entry && entry.value && Array.isArray(entry.value.tags)) {
    tags.push(...entry.value.tags);
  }

  if (ctx) {
    if (Array.isArray(ctx.tags)) {
      tags.push(...ctx.tags);
    }

    if (Array.isArray(ctx.softTags)) {
      tags.push(...ctx.softTags);
    }
  }

  return tags;
}

/** True when one of the tags was revalidated after this entry was stored. */
function outOfDate(stamps, tags, lastModified) {
  const storedAt = typeof lastModified === 'number' ? lastModified : 0;

  return tags.some((tag) => (stamps[tag] ?? 0) > storedAt);
}

module.exports = class SharedTagCacheHandler extends FileSystemCache {
  constructor(ctx) {
    super(ctx);
    this.stampsFile = stampsFile(ctx);
  }

  async revalidateTag(tags, durations) {
    await super.revalidateTag(tags, durations);

    const list = (typeof tags === 'string' ? [tags] : tags) ?? [];

    if (list.length === 0) {
      return;
    }

    try {
      writeStamps(this.stampsFile, list);
    } catch (error) {
      // The other processes then refresh on their own schedule, as before.
      console.error('Could not share the revalidated tags with the other server processes.', error);
    }
  }

  async get(key, ctx) {
    const entry = await super.get(key, ctx);

    if (!entry) {
      return entry;
    }

    const tags = tagsOf(entry, ctx);

    if (tags.length > 0 && outOfDate(readStamps(this.stampsFile), tags, entry.lastModified)) {
      return null;
    }

    return entry;
  }
};

module.exports.stampsFile = stampsFile;
module.exports.readStamps = readStamps;
module.exports.writeStamps = writeStamps;
module.exports.tagsOf = tagsOf;
module.exports.outOfDate = outOfDate;
module.exports.KEEP_MS = KEEP_MS;
