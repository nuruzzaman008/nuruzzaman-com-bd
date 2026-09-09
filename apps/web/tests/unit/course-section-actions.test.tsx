import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CourseEditor, type Curriculum } from '@/features/admin/course-editor';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('@/features/admin/lesson-assessments', () => ({ LessonAssessments: () => null }));
const initial: Curriculum = { id: 3, title: 'Test course', slug: 'test-course', status: 'draft', sequential: true, issues_certificate: false, description_markdown: null, sections: [{ id: 12, title: 'Foundations', position: 0, drip_days: 2, lessons: [] }] };
afterEach(() => { vi.restoreAllMocks(); request.mockReset(); });
it('opens the selected section for editing and saves the title and drip days', async () => {
  request.mockResolvedValueOnce({}).mockResolvedValueOnce({ data: { ...initial, sections: [{ ...initial.sections[0], title: 'Updated foundations', drip_days: 5 }] } });
  render(<CourseEditor initial={initial} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit section: Foundations' }));
  const form = within(screen.getByRole('form', { name: 'Edit section Foundations' }));
  fireEvent.change(form.getByLabelText('Section title'), { target: { value: 'Updated foundations' } });
  fireEvent.change(form.getByLabelText('Drip days'), { target: { value: '5' } });
  fireEvent.click(form.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Updated foundations' });
  expect(request).toHaveBeenCalledWith('/admin/courses/3/sections/12', { method: 'PATCH', body: { title: 'Updated foundations', drip_days: 5 } });
  expect(screen.queryByRole('form', { name: /Edit section/ })).not.toBeInTheDocument();
});
it('cancels edits and cancelled deletion without sending requests', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<CourseEditor initial={initial} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit section: Foundations' }));
  fireEvent.click(within(screen.getByRole('form', { name: 'Edit section Foundations' })).getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete section: Foundations' }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('cannot be undone'));
  expect(request).not.toHaveBeenCalled();
});
it('deletes only the confirmed section and reloads the curriculum', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  request.mockResolvedValueOnce({}).mockResolvedValueOnce({ data: { ...initial, sections: [] } });
  render(<CourseEditor initial={initial} />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete section: Foundations' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete section: Foundations' })).not.toBeInTheDocument());
  expect(request).toHaveBeenCalledWith('/admin/courses/3/sections/12', { method: 'DELETE' });
});
it('keeps the section visible when deletion fails', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  request.mockRejectedValueOnce(new Error('Delete failed'));
  render(<CourseEditor initial={initial} />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete section: Foundations' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed');
  expect(screen.getByRole('button', { name: 'Delete section: Foundations' })).toBeEnabled();
});
