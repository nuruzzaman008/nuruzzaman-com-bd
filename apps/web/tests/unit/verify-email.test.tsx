import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VerifyEmail } from '@/features/account/verify-email';

const request = vi.hoisted(() => vi.fn());
const refreshSession = vi.hoisted(() => vi.fn());
const params = vi.hoisted(() => ({ current: new URLSearchParams() }));
const session = vi.hoisted(() => ({
  current: { user: null as unknown, isLoading: false },
}));

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
  useSession: () => ({ ...session.current, refresh: refreshSession }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => params.current,
}));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

function withTarget(target: string | null) {
  params.current = new URLSearchParams(target === null ? '' : `target=${encodeURIComponent(target)}`);
}

function signedInAs(id: number, emailVerified = false) {
  session.current = { user: { id, email_verified: emailVerified, roles: [] }, isLoading: false };
}

beforeEach(() => {
  request.mockReset();
  refreshSession.mockReset();
  // The account layout guarantees a session before this page renders, so a
  // signed-in visitor whose address is unverified is the ordinary case.
  signedInAs(8);
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

  it('says whose link it is when someone else is signed in, and does not send it', async () => {
    // Two people on one computer, or a second account in the same browser. The
    // API answers this with the same 403 as an expired signature, and a new
    // link would not help - so it must not be offered as the remedy.
    withTarget('/api/v1/auth/verify-email/8/abc123');
    signedInAs(42);

    render(<VerifyEmail />);

    expect(
      await screen.findByText(
        'This link was sent to a different account. Sign out, then open the link from your email again.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send a new link' })).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('waits for the session rather than sending a request that cannot succeed', async () => {
    withTarget('/api/v1/auth/verify-email/8/abc123');
    session.current = { user: null, isLoading: true };

    render(<VerifyEmail />);

    // The route needs a session, so asking before there is one earns a 401 and
    // reports an expired link for a link that is perfectly good.
    await screen.findByText('Verifying your email…');
    expect(request).not.toHaveBeenCalled();
  });

  it('trusts the session when it already says the address is verified', async () => {
    // Re-opening the link from the email after it worked. The session carries
    // the answer, so there is nothing to ask.
    withTarget('/api/v1/auth/verify-email/8/abc123');
    signedInAs(8, true);

    render(<VerifyEmail />);

    expect(await screen.findByText('This email was already verified.')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
