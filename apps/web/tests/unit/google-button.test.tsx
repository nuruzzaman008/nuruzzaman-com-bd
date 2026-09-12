import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleButton } from '@/features/auth/google-button';

const params = vi.hoisted(() => ({ current: new URLSearchParams() }));

vi.mock('next/navigation', () => ({ useSearchParams: () => params.current }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

beforeEach(() => {
  params.current = new URLSearchParams();
});

describe('GoogleButton', () => {
  it('begins the flow at this origin, not the API domain', () => {
    render(<GoogleButton />);

    // Same-origin on purpose: the session cookie has no domain set, so one
    // established at api.nuruzzaman.com.bd would never be sent back from the
    // site. The site's /api rewrite carries the request the rest of the way.
    const link = screen.getByRole('link', { name: /Continue with Google/ });
    expect(link).toHaveAttribute('href', '/api/v1/auth/google/redirect');
  });

  it('no longer refuses staff, so that message is gone entirely', () => {
    // Staff may sign in with Google by the owner's decision, and the API sends
    // them to the dashboard. Nothing should still be carrying the old refusal.
    params.current = new URLSearchParams('error=staff_password_only');

    render(<GoogleButton />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/cannot sign in with Google/)).not.toBeInTheDocument();
  });

  it.each([
    ['google_unverified', 'That Google address is not verified, so it cannot be used to sign in.'],
    ['google_cancelled', 'Google sign-in was cancelled.'],
    ['account_inactive', 'This account is not active. Please contact support.'],
    ['google_failed', 'Signing in with Google did not work. Please try again.'],
  ])('names the reason for %s', (reason, expected) => {
    params.current = new URLSearchParams(`error=${reason}`);

    render(<GoogleButton />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('says nothing when there is nothing to report', () => {
    render(<GoogleButton />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores an error it does not recognise rather than echoing it', () => {
    // The value comes from a query string, so it must never be rendered as
    // given - only a message of ours, chosen by matching a known key.
    params.current = new URLSearchParams('error=<img src=x onerror=alert(1)>');

    render(<GoogleButton />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('onerror');
  });
});
