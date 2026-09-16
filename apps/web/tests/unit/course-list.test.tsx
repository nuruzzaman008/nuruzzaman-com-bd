import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CourseList, type CourseRow } from '@/features/dashboard/course-list';
import { ProductList, type ProductRow } from '@/features/dashboard/product-list';

const request = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const confirm = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: class extends Error {} }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const courses: CourseRow[] = [
  { id: 3, slug: 'rcc-footing', title: 'RCC footing design', level: 'Intermediate', lessons: 4, seoScore: 52, live: true },
  { id: 4, slug: 'draft-course', title: 'Draft course', level: 'Beginner', lessons: 0, seoScore: null, live: false },
];

const products: ProductRow[] = [
  {
    id: 7,
    slug: 'nb-engineering-tools',
    title: 'NB Engineering Tools',
    type: 'software_license',
    seoScore: 88,
    live: true,
    variants: [{ id: 1, sku: 'NBT-Y', price: { currency: 'BDT', amount_minor: 700000 } }],
  },
];

beforeEach(() => {
  request.mockReset();
  refresh.mockReset();
  confirm.mockReset();
  vi.stubGlobal('confirm', confirm);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the courses list', () => {
  it('deletes the chosen courses after saying how many are live', async () => {
    confirm.mockReturnValue(true);
    request.mockResolvedValue({ message: 'Course moved to trash.' });
    render(<CourseList rows={courses} emptyTitle="No courses yet" />);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: RCC footing design' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: Draft course' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Delete 2 courses?'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 of them are live'));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenCalledWith('/admin/courses/3', { method: 'DELETE' });
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps a course the API refuses, and says why', async () => {
    confirm.mockReturnValue(true);
    request.mockRejectedValue(
      new Error('2 learner(s) are enrolled in this course, so it cannot be deleted.'),
    );
    render(<CourseList rows={courses} emptyTitle="No courses yet" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: RCC footing design' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const problem = await screen.findByRole('alert');
    expect(problem).toHaveTextContent('RCC footing design');
    expect(problem).toHaveTextContent('learner(s) are enrolled');
  });
});

describe('the products list', () => {
  it('selects and deletes a product, and shows its score and price', async () => {
    confirm.mockReturnValue(true);
    request.mockResolvedValue({ message: 'Product moved to trash.' });
    render(<ProductList rows={products} emptyTitle="No products yet" />);

    expect(screen.getByRole('link', { name: 'SEO analysis: 88' })).toBeInTheDocument();
    expect(screen.getByText('NBT-Y')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bulk select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select: NB Engineering Tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Delete 1 product?'));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/products/7', { method: 'DELETE' }));
  });
});
