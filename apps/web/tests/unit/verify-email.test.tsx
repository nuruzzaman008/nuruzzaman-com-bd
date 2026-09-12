import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VerifyEmail } from '@/features/account/verify-email';

const request = vi.hoisted(() => vi.fn());
const refreshSession = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ current: new URLSearchParams() }));

// Declared through vi.hoisted: vi.mock is lifted above the file, so a plain
// class declaration here is not yet initialised when the factory runs.
const FakeApiError = vi.hoisted(
  () =>
    class extends Error {
      status: number;

      constructor(status: number) {
        super('failed');
        this.status = status;
      }
    },
);

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('@/lib/session/session-provider', () => ({
  useSession: () => ({ refresh: refreshSession }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => params.current,
}));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

function withTarget(target: string | null) {
  params.current = new URLSearchParams(target === null ? '' : `target=${encodeURIComponent(target)}`);
}

beforeEach(() => {
  request.mockReset();
  refreshSession.mockReset();
});

describe('VerifyEmail', () => {
  it('verifies the address and refreshes the session so the warning clears', async () => {
    withTarget('/api/v1/auth/verify-email/8/abc123?expires=1&signature=deadbeef');
    request.mockResolvedValue({ message: 'Email verified.' });

    render(<VerifyEmail />);

    await screen.findByText('Your email is verified. Downloads and activation are now open.');

    // The signed path is sent as the mail built it, minus the client's own
    // base. Rebuilding it from parts would invalidate the signature.
    expect(request).toHaveBeenCalledWith('/auth/verify-email/8/abc123?expires=1&signature=deadbeef', {
      method: 'GET',
    });
    // Without this the sidebar keeps claiming the address is unverified.
    expect(refreshSession).toHaveBeenCalled();
  });

  it('reports an already verified address rather than an error', async () => {
    withTarget('/api/v1/auth/verify-email/8/abc123');
    request.mockResolvedValue({ message: 'Email already verified.' });

    render(<VerifyEmail />);

    await screen.findByText('This email was already verified.');
  });

  it.each([
    ['an absolute URL to somewhere else', 'https://evil.example/steal'],
    ['a protocol-relative URL', '//evil.example/steal'],
    ['another endpoint on this API', '/api/v1/admin/users'],
    ['a path outside the API', '/account/orders'],
    [null, null],
  ])('refuses %s without calling anything', async (_label, target) => {
    withTarget(target as string | null);

    render(<VerifyEmail />);

    expect(
      await screen.findByText('That link is incomplete. Open it again from the email.'),
    ).toBeInTheDocument();
    // The point of the check: a target from the URL must never become a
    // request, or the page can be aimed at a server of someone else's choosing.
    expect(request).not.toHaveBeenCalled();
  });

  it('names an expired link and offers a new one', async () => {
    withTarget('/api/v1/auth/verify-email/8/abc123');
    request.mockRejectedValue(new FakeApiError(403));

    render(<VerifyEmail />);

    await screen.findByText(
      'That link has expired (they last 60 minutes). Send yourself a new one below.',
    );
    expect(screen.getByRole('button', { name: 'Send a new link' })).toBeInTheDocument();
  });

  it('does not blame the link when the failure is something else', async () => {
    withTarget('/api/v1/auth/verify-email/8/abc123');
    request.mockRejectedValue(new FakeApiError(500));

    render(<VerifyEmail />);

    await waitFor(() =>
      expect(screen.getByText('The email could not be verified.')).toBeInTheDocument(),
    );
  });
});
