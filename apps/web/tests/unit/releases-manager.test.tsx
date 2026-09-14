import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReleasesManager, type AdminRelease } from '@/features/dashboard/releases-manager';

const request = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const uploadInParts = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/uploads/chunked-upload', () => ({ uploadInParts }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const licences = [
  { id: 1, label: 'Single machine licence' },
  { id: 2, label: '3-PC office licence' },
  { id: 3, label: '5-PC office licence' },
];

const empty: AdminRelease = {
  id: 9,
  slug: 'nb-engineering-tools-autocad-2025',
  name: 'NB Engineering Tools — AutoCAD 2025',
  version: '6.0',
  size_bytes: null,
  checksum_sha256: null,
  original_filename: null,
  is_available: false,
  variant_ids: [1],
};

const uploaded: AdminRelease = {
  ...empty,
  id: 10,
  slug: 'nb-engineering-tools-autocad-2024',
  name: 'NB Engineering Tools — AutoCAD 2024',
  size_bytes: 150 * 1024 * 1024,
  checksum_sha256: 'a'.repeat(64),
  original_filename: 'NB_Tools_2024_Setup.exe',
  variant_ids: [1, 2, 3],
};

const card = (slug: string) =>
  within(document.querySelector<HTMLElement>(`[data-release="${slug}"]`)!);

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((path: string, options?: { method?: string }) =>
    Promise.resolve(
      path === '/admin/download-assets' && options?.method === 'POST'
        ? { data: { id: 42 } }
        : { data: {} },
    ),
  );
  refresh.mockReset();
  uploadInParts.mockReset();
  uploadInParts.mockResolvedValue({ upload_id: 'u-1', total: 150, filename: 'Setup.exe' });
  render(<ReleasesManager releases={[empty, uploaded]} licences={licences} />);
});

describe('ReleasesManager', () => {
  it('creates a release with a slug made from its name and gives it to every licence', async () => {
    fireEvent.change(screen.getAllByLabelText('Name')[0], {
      target: { value: 'NB Engineering Tools — AutoCAD 2026' },
    });
    fireEvent.change(screen.getAllByLabelText('Version')[0], { target: { value: '6.0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create release' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/download-assets/42/variants', {
        method: 'PUT',
        body: { variant_ids: [1, 2, 3] },
      }),
    );
    expect(request).toHaveBeenCalledWith('/admin/download-assets', {
      method: 'POST',
      body: {
        name: 'NB Engineering Tools — AutoCAD 2026',
        slug: 'nb-engineering-tools-autocad-2026',
        version: '6.0',
      },
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('uploads an installer in parts to its release', async () => {
    const release = card(empty.slug);
    const file = new File(['MZ'], 'NB_Tools_2025_Setup.exe');
    fireEvent.change(release.getByLabelText(`Installer file for ${empty.name}`), {
      target: { files: [file] },
    });
    fireEvent.click(release.getByRole('button', { name: 'Upload installer' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/download-assets/9/file', {
        method: 'POST',
        body: { upload_id: 'u-1', total: 150, filename: 'Setup.exe' },
      }),
    );
    expect(uploadInParts.mock.calls[0][0]).toBe(file);
  });

  it('refuses an installer over 300 MB, or one that is not an installer, before sending anything', () => {
    const release = card(empty.slug);
    const big = new File(['MZ'], 'huge.exe');
    Object.defineProperty(big, 'size', { value: 301 * 1024 * 1024 });
    fireEvent.change(release.getByLabelText(`Installer file for ${empty.name}`), {
      target: { files: [big] },
    });
    fireEvent.click(release.getByRole('button', { name: 'Upload installer' }));
    expect(release.getByRole('alert')).toHaveTextContent('up to 300 MB');

    fireEvent.change(release.getByLabelText(`Installer file for ${empty.name}`), {
      target: { files: [new File(['x'], 'notes.pdf')] },
    });
    fireEvent.click(release.getByRole('button', { name: 'Upload installer' }));
    expect(release.getByRole('alert')).toHaveTextContent('.exe, .msi or .zip');

    expect(uploadInParts).not.toHaveBeenCalled();
  });

  it('only lets the download be switched on once a file exists', async () => {
    expect(card(empty.slug).getByRole('button', { name: 'Switch download on' })).toBeDisabled();

    fireEvent.click(card(uploaded.slug).getByRole('button', { name: 'Switch download on' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/download-assets/10', {
        method: 'PATCH',
        body: { is_available: true },
      }),
    );
  });

  it('saves which licences give a release', async () => {
    const release = card(empty.slug);
    fireEvent.click(release.getByLabelText('5-PC office licence'));
    fireEvent.click(release.getByRole('button', { name: 'Save licences' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/download-assets/9/variants', {
        method: 'PUT',
        body: { variant_ids: [1, 3] },
      }),
    );
  });
});
