import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleEditor } from '@/features/dashboard/role-editor';

const request = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ current: { user: null as unknown, isLoading: false } }));

const FakeApiError = vi.hoisted(
  () =>
    class extends Error {
      status: number;

      constructor(status: number, message = 'failed') {
        super(message);
        this.status = status;
      }
    },
);

vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('@/lib/session/session-provider', () => ({
  useSession: () => ({ ...session.current, refresh: vi.fn() }),
}));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

function viewing(id: number, roles: string[]) {
  session.current = { user: { id, roles, email_verified: true }, isLoading: false };
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: {} });
  viewing(1, ['super_admin']);
});

describe('RoleEditor', () => {
  it('draws nothing for staff who are not a super admin', () => {
    // An editor or an admin opening the same page sees no control at all. The
    // API refuses them either way; this only avoids offering what will fail.
    viewing(5, ['admin']);

    const { container } = render(
      <RoleEditor userId={9} userName="Someone" initialRoles={['customer']} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('refuses the viewer their own account', () => {
    viewing(1, ['super_admin']);

    render(<RoleEditor userId={1} userName="Me" initialRoles={['super_admin']} />);

    expect(screen.getByText('You cannot change your own role.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save roles' })).not.toBeInTheDocument();
  });

  it('sends the roles that are ticked', async () => {
    render(<RoleEditor userId={9} userName="Someone" initialRoles={['customer']} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'admin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save roles' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/admin/users/9/roles', {
        method: 'PUT',
        body: { roles: ['customer', 'admin'] },
      }),
    );
    expect(await screen.findByText('Roles changed.')).toBeInTheDocument();
  });

  it('asks for a password when the API demands one, then retries', async () => {
    // 423 is the API saying "confirm first", not a failure. Without the retry
    // the change would be silently lost after the password was given.
    request.mockRejectedValueOnce(new FakeApiError(423));

    render(<RoleEditor userId={9} userName="Someone" initialRoles={['customer']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save roles' }));

    const field = await screen.findByLabelText('Your password');
    expect(screen.getByText('Confirm with your password. This is only for changing a role.')).toBeInTheDocument();

    request.mockResolvedValue({ data: {} });
    fireEvent.change(field, { target: { value: 'correct horse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/me/confirm-password', {
        method: 'POST',
        body: { password: 'correct horse' },
      }),
    );
    // And the roles went after it, not instead of it.
    expect(request).toHaveBeenCalledWith('/admin/users/9/roles', {
      method: 'PUT',
      body: { roles: ['customer'] },
    });
  });

  it('says a super admin is out of reach when the API refuses', async () => {
    // The policy lets only another super admin touch one. A viewer who is not
    // one never sees this control, so a 403 here means the target is protected.
    request.mockRejectedValue(new FakeApiError(403));

    render(<RoleEditor userId={9} userName="The owner" initialRoles={['super_admin']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save roles' }));

    expect(
      await screen.findByText('A super admin account can only be changed by another super admin.'),
    ).toBeInTheDocument();
  });

  it('does not claim success when the change failed', async () => {
    request.mockRejectedValue(new FakeApiError(500, 'Server exploded'));

    render(<RoleEditor userId={9} userName="Someone" initialRoles={['customer']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save roles' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
    expect(screen.queryByText('Roles changed.')).not.toBeInTheDocument();
  });
});
