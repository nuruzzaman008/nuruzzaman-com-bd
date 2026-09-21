import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/features/auth/login-form';
import { MfaStepUp } from '@/features/dashboard/mfa-step-up';

const request = vi.hoisted(() => vi.fn());
const refreshSession = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
const params = vi.hoisted(() => ({ current: new URLSearchParams() }));

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
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => params.current,
}));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const admin = { id: 1, email: 'staff@example.test', roles: ['admin'] };

beforeEach(() => {
  request.mockReset();
  refreshSession.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
  params.current = new URLSearchParams();
});

describe('LoginForm two-step verification', () => {
  it('asks for the code after a correct password, and signs in only with it', async () => {
    request.mockResolvedValueOnce({ data: { mfa_required: true } });
    request.mockResolvedValueOnce({ data: admin });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: admin.email } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const code = await screen.findByLabelText(/Verification code/);
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify the code' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(request).toHaveBeenLastCalledWith('/auth/mfa', {
      method: 'POST',
      body: { code: '123456' },
    });
  });

  it('starts at the code when Google sign-in sends the visitor back for it', async () => {
    params.current = new URLSearchParams('mfa=1');
    request.mockResolvedValueOnce({ data: admin });

    render(<LoginForm />);

    expect(screen.queryByLabelText(/Password/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Verification code/), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify the code' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/auth/mfa', { method: 'POST', body: { code: '654321' } });
  });

  it('asks in plain words for the 6-digit code from the app', () => {
    params.current = new URLSearchParams('mfa=1');

    render(<LoginForm />);

    expect(screen.getByText('Enter the 6-digit code from your authenticator app.')).toBeTruthy();
  });

  it('takes a recovery code instead when the phone is not to hand', async () => {
    params.current = new URLSearchParams('mfa=1');
    request.mockResolvedValueOnce({ data: admin });

    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a recovery code instead' }));
    expect(screen.queryByLabelText(/Verification code/)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Recovery code/), {
      target: { value: 'ABCD-EFGH-JKLM-NPQR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify the code' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/auth/mfa', {
      method: 'POST',
      body: { recovery_code: 'ABCD-EFGH-JKLM-NPQR' },
    });

    // And back again.
    fireEvent.click(screen.getByRole('button', { name: 'Use the code from the app instead' }));
    expect(screen.getByLabelText(/Verification code/)).toBeTruthy();
  });

  it('offers the password again when the code step has expired', () => {
    params.current = new URLSearchParams('mfa=1');

    render(<LoginForm />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Start again with your email and password' }),
    );

    expect(screen.getByLabelText(/Password/)).toBeTruthy();
    expect(screen.queryByLabelText(/Verification code/)).toBeNull();
  });
});

describe('MfaStepUp', () => {
  it('sends the code for this session and reloads the dashboard', async () => {
    request.mockResolvedValueOnce({ data: { mfa_session_verified: true } });

    render(<MfaStepUp />);

    fireEvent.change(screen.getByLabelText(/Verification code/), { target: { value: '112233' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify the code' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/me/mfa/verify', {
      method: 'POST',
      body: { code: '112233' },
    });
  });

  it('accepts a recovery code as well', async () => {
    request.mockResolvedValueOnce({ data: { mfa_session_verified: true } });

    render(<MfaStepUp />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a recovery code instead' }));
    fireEvent.change(screen.getByLabelText(/Recovery code/), {
      target: { value: 'WXYZ-2345-6789-ABCD' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify the code' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/me/mfa/verify', {
      method: 'POST',
      body: { recovery_code: 'WXYZ-2345-6789-ABCD' },
    });
  });

  it('shows the refusal and stays put when the code is wrong', async () => {
    const refusal = new FakeApiError('Too many wrong codes. Try again in 15 minute(s).');
    request.mockRejectedValueOnce(refusal);

    render(<MfaStepUp />);

    fireEvent.change(screen.getByLabelText(/Verification code/), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify the code' }));

    await screen.findByText('Too many wrong codes. Try again in 15 minute(s).');
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
