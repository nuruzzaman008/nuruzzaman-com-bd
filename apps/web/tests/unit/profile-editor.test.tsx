import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ProfileEditor } from '@/features/account/profile-editor';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('@/lib/i18n/locale-provider', () => ({ useLocale: () => ({ locale: 'en' }) }));
const user = { id: 8, name: 'Test Buyer', phone: '01712345678', email: 'test@example.test', roles: ['customer'], status: 'active', email_verified: true, profile: { organization: 'Office' } };
it('shows details and saves admin edits', async () => {
  request.mockResolvedValue({ data: user });
  render(<ProfileEditor initial={user} admin />);
  expect(screen.getByText('test@example.test')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Upload photo' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'New Office' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByText('Profile saved.');
  expect(request).toHaveBeenCalledWith('/admin/users/8', { method: 'PATCH', body: expect.objectContaining({ phone: '01712345678', profile: expect.objectContaining({ organization: 'New Office' }) }) });
});
it('lets the owner upload a photo as multipart data', async () => {
  request.mockResolvedValue({ data: { ...user, profile: { has_photo: true } } });
  render(<ProfileEditor initial={user} />);
  const input = screen.getByLabelText('Profile photo');
  fireEvent.change(input, { target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] } });
  fireEvent.submit(screen.getByRole('button', { name: 'Upload photo' }).closest('form')!);
  await screen.findByText('Photo uploaded.');
  expect(request).toHaveBeenCalledWith('/me/avatar', { method: 'POST', body: expect.any(FormData) });
  expect(screen.getByRole('img', { name: 'Profile photo' })).toHaveAttribute('src', '/api/v1/me/avatar?v=1');
});
