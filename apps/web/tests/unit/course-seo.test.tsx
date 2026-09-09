import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CourseEditor, type Curriculum } from '@/features/admin/course-editor';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('@/features/admin/lesson-assessments', () => ({ LessonAssessments: () => null }));
it('loads saved SEO and submits both languages with the course', async () => {
  const initial: Curriculum = { id: 3, title: 'Course', slug: 'course', status: 'draft', sequential: true, issues_certificate: false, description_markdown: '', sections: [], seo: { meta_title: 'Existing Bengali', meta_title_en: 'Existing English', noindex: true } };
  request.mockResolvedValueOnce({ data: { id: 3 } }).mockResolvedValueOnce({ data: initial });
  render(<CourseEditor initial={initial} />);
  expect(screen.getByLabelText('Meta title (বাংলা)')).toHaveValue('Existing Bengali');
  fireEvent.change(screen.getByLabelText('Meta title (English)'), { target: { value: 'New English SEO title' } });
  fireEvent.change(screen.getByLabelText('Meta description (English)'), { target: { value: 'Course search description' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save course' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/courses/3', expect.objectContaining({ method: 'PATCH', body: expect.objectContaining({ seo: expect.objectContaining({ meta_title: 'Existing Bengali', meta_title_en: 'New English SEO title', meta_description_en: 'Course search description', noindex: true, nofollow: false }) }) })));
});
