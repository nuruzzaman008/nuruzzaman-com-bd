import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require_ = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-explicit-any */
const handler = require_('../../cache-handler.js') as any;
const { outOfDate, readStamps, stampsFile, tagsOf, writeStamps, KEEP_MS } = handler;

const file = () => join(mkdtempSync(join(tmpdir(), 'nb-tags-')), 'nb-revalidated-tags.json');

describe('the cache handler Next.js is given', () => {
  it('is Next\u2019s own file cache, so an upgrade that moves it fails here first', () => {
    const FileSystemCache = require_(
      'next/dist/server/lib/incremental-cache/file-system-cache',
    ).default;

    expect(typeof FileSystemCache).toBe('function');
    expect(handler.prototype).toBeInstanceOf(FileSystemCache);
    for (const method of ['get', 'set', 'revalidateTag', 'resetRequestCache']) {
      expect(typeof handler.prototype[method]).toBe('function');
    }
    expect(require_('next/dist/lib/constants').NEXT_CACHE_TAGS_HEADER).toBe('x-next-cache-tags');
  });

  it('keeps its stamps in the release being served', () => {
    expect(stampsFile({ serverDistDir: join('/srv', 'app', '.next', 'server') })).toBe(
      join('/srv', 'app', '.next', 'cache', 'nb-revalidated-tags.json'),
    );
  });
});

describe('tags shared between server processes', () => {
  it('reads back what another process wrote, and forgets day-old stamps', () => {
    const path = file();
    const now = Date.now();

    writeStamps(path, ['posts', 'post:footing-basics'], now);
    expect(readStamps(path)).toEqual({ posts: now, 'post:footing-basics': now });

    // A second revalidation keeps the other tag but drops what has aged out.
    writeFileSync(path, JSON.stringify({ posts: now - KEEP_MS - 1, sitemap: now - 1000 }));
    writeStamps(path, ['posts'], now);

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ posts: now, sitemap: now - 1000 });
  });

  it('treats a missing or damaged file as nothing having been revalidated', () => {
    const path = file();

    expect(readStamps(path)).toEqual({});

    writeFileSync(path, '{"posts": 1, "half-writ');
    expect(readStamps(path, true)).toEqual({});
  });

  it('finds a page\u2019s tags in its header and a fetch\u2019s in the read itself', () => {
    const page = { value: { headers: { 'x-next-cache-tags': 'posts,post:footing-basics' } } };

    expect(tagsOf(page, {})).toEqual(['posts', 'post:footing-basics']);
    expect(tagsOf({ value: { tags: ['media:2'] } }, { tags: ['posts'], softTags: ['sitemap'] })).toEqual(
      ['media:2', 'posts', 'sitemap'],
    );
    expect(tagsOf(null, undefined)).toEqual([]);
  });

  it('counts an entry as out of date only when it was stored before the revalidation', () => {
    const stamps = { posts: 2_000 };

    expect(outOfDate(stamps, ['posts'], 1_999)).toBe(true);
    expect(outOfDate(stamps, ['posts'], 2_001)).toBe(false);
    expect(outOfDate(stamps, ['sitemap'], 1)).toBe(false);
    expect(outOfDate({}, [], 1)).toBe(false);
  });
});

/**
 * One server process, reading pages Next.js cached on disk. A second process is
 * whatever writes the stamps file - that is all they share.
 */
function process_(stamps: string) {
  const distDir = mkdtempSync(join(tmpdir(), 'nb-dist-'));
  const nodeFs = require_('next/dist/server/lib/node-fs-methods').nodeFs;
  const Handler = handler as new (ctx: unknown) => {
    get(key: string, ctx: unknown): Promise<unknown>;
    revalidateTag(tags: string[], durations?: unknown): Promise<void>;
  };

  mkdirSync(join(distDir, 'app'), { recursive: true });

  return {
    cache: new Handler({
      fs: nodeFs,
      flushToDisk: true,
      serverDistDir: distDir,
      revalidatedTags: [],
      // No memory store: every read is the shared copy on disk.
      maxMemoryCacheSize: 0,
    }),
    /** Stands in for a page Next.js rendered and cached, tagged the way a post page is. */
    cachePage(tags: string, at = Date.now()) {
      writeFileSync(join(distDir, 'app', 'post.html'), '<p>the page</p>');
      writeFileSync(join(distDir, 'app', 'post.rsc'), 'rsc');
      writeFileSync(
        join(distDir, 'app', 'post.meta'),
        JSON.stringify({ status: 200, headers: { 'x-next-cache-tags': tags } }),
      );
      for (const name of ['post.html', 'post.rsc', 'post.meta']) {
        utimesSync(join(distDir, 'app', name), new Date(at), new Date(at));
      }
    },
    read: () => (new Handler({
      fs: nodeFs,
      flushToDisk: true,
      serverDistDir: distDir,
      revalidatedTags: [],
      maxMemoryCacheSize: 0,
    })).get('/post', { kind: 'APP_PAGE' }),
    stamps,
  };
}

describe('a publish reaching every process', () => {
  it('turns a page another process cached into a miss, until it is rendered again', async () => {
    const path = file();

    process.env.NB_CACHE_TAGS_FILE = path;

    try {
      const server = process_(path);
      const cachedAt = Date.now() - 10_000;

      server.cachePage('posts,post:footing-basics', cachedAt);
      expect(await server.read()).not.toBeNull();

      // The publish: the webhook reached the *other* process, which stamped it.
      writeStamps(path, ['posts'], cachedAt + 1_000);
      expect(await server.read()).toBeNull();

      // This process renders the page again; what it stores now is current.
      server.cachePage('posts,post:footing-basics', cachedAt + 2_000);
      expect(await server.read()).not.toBeNull();
    } finally {
      delete process.env.NB_CACHE_TAGS_FILE;
    }
  });

  it('stamps the tags it is asked to revalidate, for the other processes to see', async () => {
    const path = file();

    process.env.NB_CACHE_TAGS_FILE = path;

    try {
      await process_(path).cache.revalidateTag(['posts', 'sitemap'], { expire: 0 });

      expect(Object.keys(readStamps(path, true)).sort()).toEqual(['posts', 'sitemap']);
    } finally {
      delete process.env.NB_CACHE_TAGS_FILE;
    }
  });
});
