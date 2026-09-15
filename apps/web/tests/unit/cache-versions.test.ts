import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { bumpVersions, contentVersion, readVersions } from '@/lib/cache-versions';

let file: string;

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), 'nb-versions-')), 'versions.json');
});

describe('shared content versions', () => {
  it('starts at zero before anything is revalidated', () => {
    expect(readVersions(file)).toEqual({});
    expect(contentVersion(['posts', 'post:bolt-shear'], file)).toBe('0.0');
    expect(contentVersion(undefined, file)).toBe('');
  });

  it('changes the key of every fetch using a revalidated tag, and only those', () => {
    const before = contentVersion(['posts', 'post:bolt-shear'], file);
    const unrelated = contentVersion(['products'], file);

    bumpVersions(['post:bolt-shear'], file, 1_000);

    expect(contentVersion(['posts', 'post:bolt-shear'], file)).not.toBe(before);
    expect(contentVersion(['posts', 'post:bolt-shear'], file)).toBe('0.1000');
    expect(contentVersion(['products'], file)).toBe(unrelated);
  });

  it('always moves a version forward, even twice in one millisecond', () => {
    bumpVersions(['posts'], file, 5_000);
    bumpVersions(['posts'], file, 5_000);

    expect(readVersions(file).posts).toBe(5_001);
  });

  it('leaves no temporary file behind', () => {
    bumpVersions(['posts', 'sitemap'], file, 7_000);

    const directory = file.slice(0, file.lastIndexOf('versions.json'));
    expect(readdirSync(directory)).toEqual(['versions.json']);
  });

  it('treats an unreadable file as nothing revalidated rather than failing a page', () => {
    writeFileSync(file, '{not json');

    expect(readVersions(file)).toEqual({});
    expect(contentVersion(['posts'], file)).toBe('0');
  });
});
