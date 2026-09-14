import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaFileInput, acceptsFile } from '@/components/ui/media-file-input';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', () => ({
  useLocale: () => ({ locale: 'en', t: { ui: { close: 'Close' } } }),
}));

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({
    data: [
      { id: 2, source: 'media', name: 'Notes.pdf', mime_type: 'application/pdf', size_bytes: 5 },
    ],
    last_page: 1,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.stubGlobal(
    'DataTransfer',
    class {
      files: File[] = [];
      items = { add: (file: File) => this.files.push(file) };
    },
  );
});

function field(onChange = vi.fn()) {
  render(
    <form>
      <MediaFileInput
        aria-label="Document"
        name="document"
        multiple
        scope="course"
        courseId={12}
        onChange={onChange}
      />
    </form>,
  );
  const input = screen.getByLabelText('Document') as HTMLInputElement;
  // jsdom lacks a FileList constructor; make the native field accept this test's transfer.
  Object.defineProperty(input, 'files', { writable: true, value: [] });
  return input;
}

describe('Media file picker', () => {
  it('opens the library first and preserves new-file selection callbacks', async () => {
    const changed = vi.fn();
    field(changed);
    fireEvent.click(screen.getByRole('button', { name: 'Choose from Media / Upload' }));
    expect(await screen.findByText('Notes.pdf')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      '/uploads/library',
      expect.objectContaining({
        query: expect.objectContaining({ scope: 'course', course_id: 12 }),
      }),
    );
    const file = new File(['data'], 'new.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Choose new files'), { target: { files: [file] } });
    expect(changed).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('new.pdf')).toBeInTheDocument();
  });

  it('attaches an authorized existing file through the original file field', async () => {
    const changed = vi.fn();
    const input = field(changed);
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['notes'], { type: 'application/pdf' }),
      });
    vi.stubGlobal('fetch', fetcher);
    fireEvent.click(screen.getByRole('button', { name: 'Choose from Media / Upload' }));
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Attach selected' }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(input.files?.[0].name).toBe('Notes.pdf');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/uploads/library/media/2?scope=course&course_id=12',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('keeps an existing selection when the library cannot download a file', async () => {
    const changed = vi.fn();
    field(changed);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose from Media / Upload' }));
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Attach selected' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot open');
    expect(changed).not.toHaveBeenCalled();
  });

  it('respects the receiving field’s MIME and extension restrictions', () => {
    expect(acceptsFile('Notes.PDF', '', '.pdf')).toBe(true);
    expect(acceptsFile('Photo.jpg', '', 'image/jpeg')).toBe(true);
    expect(acceptsFile('Video.webm', 'video/webm', '.mp4,.webm')).toBe(true);
    expect(acceptsFile('Notes.pdf', 'application/pdf', 'image/png')).toBe(false);
  });
});
