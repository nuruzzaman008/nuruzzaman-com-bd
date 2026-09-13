import { describe, expect, it } from 'vitest';

import { documentProvider } from '@/lib/document-link';

describe('documentProvider', () => {
  it('recognises the usual places documents are shared from', () => {
    expect(documentProvider('https://drive.google.com/file/d/1AbC/view?usp=sharing')).toBe(
      'google_drive',
    );
    expect(documentProvider('https://docs.google.com/document/d/1AbC/edit')).toBe('google_drive');
    expect(documentProvider('https://www.dropbox.com/scl/fi/abc/Notes.pdf?rlkey=x&dl=0')).toBe(
      'dropbox',
    );
    expect(documentProvider('https://1drv.ms/b/s!Abc')).toBe('onedrive');
    expect(documentProvider('https://example.com/notes.pdf')).toBe('other');
  });

  it('does not mistake a look-alike address for the real service', () => {
    expect(documentProvider('https://notdropbox.com/file')).toBe('other');
  });

  it('refuses anything that is not a full https link', () => {
    for (const bad of [
      '',
      'http://drive.google.com/file/d/1/view',
      'drive.google.com/file/d/1/view',
      'javascript:alert(1)',
      'https://user:secret@example.com/a.pdf',
      'https://example.com/my notes.pdf',
    ]) {
      expect(documentProvider(bad), bad).toBeNull();
    }
  });
});
