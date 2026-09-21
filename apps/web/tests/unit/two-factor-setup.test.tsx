import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TwoFactorSetup } from '@/features/dashboard/two-factor-setup';

const request = vi.hoisted(() => vi.fn());
const refreshSession = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

const FakeApiError = vi.hoisted(
  () =>
    class extends Error {
      fields: Record<string, string[]> = {};
      isValidation = false;
      isNetworkError = false;
    },
);

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('@/lib/session/session-provider', () => ({
  useSession: () => ({ user: null, isLoading: false, refresh: refreshSession }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/nuruzzaman.com.bd:staff%40example.test?secret=${SECRET}&issuer=nuruzzaman.com.bd`;
const CODES = [
  'ABCD-EFGH-JKLM-NPQR',
  'BCDE-FGHJ-KLMN-PQRS',
  'CDEF-GHJK-LMNP-QRST',
  'DEFG-HJKL-MNPQ-RSTU',
  'EFGH-JKLM-NPQR-STUV',
  'FGHJ-KLMN-PQRS-TUVW',
  'GHJK-LMNP-QRST-UVWX',
  'HJKL-MNPQ-RSTU-VWXY',
];

beforeEach(() => {
  request.mockReset();
  refreshSession.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
});

describe('TwoFactorSetup', () => {
  it('shows a QR code, the setup key and a code field, then the recovery codes once', async () => {
    request.mockResolvedValueOnce({ data: { secret: SECRET, otpauth_uri: URI } });
    request.mockResolvedValueOnce({ data: { mfa_enabled: true, recovery_codes: CODES } });

    render(<TwoFactorSetup enabled={false} />);

    expect(screen.getByRole('heading', { name: 'Set up Google Authenticator' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start the setup' }));

    expect(
      await screen.findByRole('img', { name: 'QR code for setting up Google Authenticator' }),
    ).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/me/mfa', { method: 'POST' });
    // The key, grouped in fours for typing by hand.
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/6-digit code from the app/), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(await screen.findByText('Two-step verification is active.')).toBeTruthy();
    expect(request).toHaveBeenLastCalledWith('/me/mfa/confirm', {
      method: 'POST',
      body: { code: '123456' },
    });
    for (const code of CODES) expect(screen.getByText(code)).toBeTruthy();
    // The secret is gone from the screen once it has done its job.
    expect(screen.queryByText(/JBSW Y3DP/)).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'I have saved these codes' }));

    expect(screen.queryByText(CODES[0])).toBeNull();
    expect(router.refresh).toHaveBeenCalled();
  });

  it('on the page before the dashboard, goes on to it once the codes are saved', async () => {
    request.mockResolvedValueOnce({ data: { secret: SECRET, otpauth_uri: URI } });
    request.mockResolvedValueOnce({ data: { mfa_enabled: true, recovery_codes: CODES } });

    render(<TwoFactorSetup enabled={false} autoStart completeHref="/dashboard/orders" />);

    await screen.findByRole('img', { name: 'QR code for setting up Google Authenticator' });
    fireEvent.change(screen.getByLabelText(/6-digit code from the app/), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable' }));
    await screen.findByText(CODES[0]);

    // Not before the codes are saved: they would be lost.
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'I have saved these codes' }));

    expect(router.replace).toHaveBeenCalledWith('/dashboard/orders');
  });

  it('starts at once when arriving from "Set it up now", and only once', async () => {
    request.mockResolvedValue({ data: { secret: SECRET, otpauth_uri: URI } });

    const { rerender } = render(<TwoFactorSetup enabled={false} autoStart />);

    expect(
      await screen.findByRole('img', { name: 'QR code for setting up Google Authenticator' }),
    ).toBeTruthy();
    rerender(<TwoFactorSetup enabled={false} autoStart />);

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps the setup open and says why when the code is wrong', async () => {
    const refusal = new FakeApiError('invalid');
    refusal.isValidation = true;
    refusal.fields = { code: ['That code is not right.'] };
    request.mockResolvedValueOnce({ data: { secret: SECRET, otpauth_uri: URI } });
    request.mockRejectedValueOnce(refusal);

    render(<TwoFactorSetup enabled={false} autoStart />);

    await screen.findByRole('img', { name: 'QR code for setting up Google Authenticator' });
    fireEvent.change(screen.getByLabelText(/6-digit code from the app/), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(await screen.findByText('That code is not right.')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'QR code for setting up Google Authenticator' }),
    ).toBeTruthy();
  });

  it('once it is on: says so, counts the codes left and makes a new set with the password', async () => {
    request.mockResolvedValueOnce({ data: { recovery_codes: CODES } });

    render(<TwoFactorSetup enabled recoveryCodesRemaining={2} />);

    expect(screen.getByText('Two-step verification is active on this account.')).toBeTruthy();
    expect(screen.getByText('2 of 8 recovery codes left.')).toBeTruthy();
    expect(screen.getByText('You are running low on recovery codes. Make a new set.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start the setup' })).toBeNull();

    const [regeneratePassword] = screen.getAllByLabelText(/Your password, to confirm/);
    fireEvent.change(regeneratePassword, { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make new recovery codes' }));

    expect(await screen.findByText(CODES[0])).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/me/mfa/recovery-codes', {
      method: 'POST',
      body: { password: 'secret-password' },
    });
  });
});
