import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StaffTwoFactorReset } from '@/features/dashboard/staff-two-factor-reset';

const request = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ current: { user: null as unknown } }));

const FakeApiError = vi.hoisted(
  () =>
    class extends Error {
      fields: Record<string, string[]> = {};
      isValidation = false;
      isNetworkError = false;
      status = 0;
    },
);

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('@/lib/session/session-provider', () => ({
  useSession: () => ({ ...session.current, isLoading: false, refresh: vi.fn() }),
}));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

function viewerWith(roles: string[], id = 1) {
  session.current = { user: { id, roles } };
}

function renderFor(targetRoles: string[], initialEnabled = true, userId = 2) {
  return render(
    <StaffTwoFactorReset
      userId={userId}
      userName="Rahim"
      targetRoles={targetRoles}
      initialEnabled={initialEnabled}
    />,
  );
}

const RESET = { name: 'Reset two-step verification' };

beforeEach(() => {
  request.mockReset();
  viewerWith(['super_admin']);
});

describe('StaffTwoFactorReset', () => {
  it('resets with the viewer’s own current code', async () => {
    request.mockResolvedValueOnce({ data: { id: 2, mfa_enabled: false } });

    renderFor(['admin']);

    expect(screen.getByText('On (Google Authenticator is set up).')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', RESET));
    fireEvent.change(screen.getByLabelText(/Your own 6-digit code/), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(
      await screen.findByText(
        "Rahim's two-step verification was reset. They will be asked to set it up again the next time they open the dashboard.",
      ),
    ).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/admin/users/2/mfa/reset', {
      method: 'POST',
      body: { code: '123456' },
    });
    expect(screen.queryByRole('button', RESET)).toBeNull();
  });

  it('shows a wrong code under the field and keeps the form open', async () => {
    const refusal = new FakeApiError('invalid');
    refusal.isValidation = true;
    refusal.fields = { code: ['That code from your authenticator app is not right.'] };
    request.mockRejectedValueOnce(refusal);

    renderFor(['editor']);

    fireEvent.click(screen.getByRole('button', RESET));
    fireEvent.change(screen.getByLabelText(/Your own 6-digit code/), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(
      await screen.findByText('That code from your authenticator app is not right.'),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Your own 6-digit code/)).toBeTruthy();
  });

  it('is offered to an admin for other staff, but not for a super admin', () => {
    viewerWith(['admin']);

    const { unmount } = renderFor(['support']);
    expect(screen.getByRole('button', RESET)).toBeTruthy();
    unmount();

    renderFor(['super_admin']);
    expect(screen.queryByText('Two-step verification')).toBeNull();
  });

  it('is not offered to other staff, on the viewer’s own account, or for customers', () => {
    viewerWith(['editor']);
    const first = renderFor(['support']);
    expect(screen.queryByText('Two-step verification')).toBeNull();
    first.unmount();

    viewerWith(['super_admin'], 2);
    const own = renderFor(['super_admin'], true, 2);
    expect(screen.queryByText('Two-step verification')).toBeNull();
    own.unmount();

    viewerWith(['super_admin']);
    renderFor(['customer']);
    expect(screen.queryByText('Two-step verification')).toBeNull();
  });

  it('says when it is not set up, with nothing to reset', () => {
    renderFor(['instructor'], false);

    expect(
      screen.getByText(
        'Not set up. They will be asked to set it up the next time they open the dashboard.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', RESET)).toBeNull();
  });
});
