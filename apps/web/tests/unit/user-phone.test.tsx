import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { UserPhone } from '@/features/admin/user-phone';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/i18n/locale-provider', () => ({ useLocale: () => ({ locale: 'en' }) }));
it('highlights a missing phone and saves a required number', async () => {
  request.mockResolvedValue({ data: {} });
  render(<UserPhone id={42} phone={null} />);
  expect(screen.getByText('Phone required — please add')).toBeVisible();
  const input = screen.getByLabelText('Mobile number (required)');
  expect(input).toBeRequired();
  fireEvent.change(input, { target: { value: '+8801712345678' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save phone' }));
  await screen.findByText('Phone saved.');
  expect(request).toHaveBeenCalledWith('/admin/users/42', { method: 'PATCH', body: { phone: '+8801712345678' } });
});
