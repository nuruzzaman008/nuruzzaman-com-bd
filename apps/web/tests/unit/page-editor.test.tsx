import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Page } from '@nuruzzaman/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageEditor, type PageCounterpart } from '@/features/dashboard/page-editor';

const request = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
const session = vi.hoisted(() => ({ user: null as unknown }));

/** A stand-in for the real ApiError, hoisted so vi.mock can reach it. */
const FakeApiError = vi.hoisted(
  () =>
    class extends Error {
      constructor(
        readonly status: number,
        message: string,
        readonly fields: Record<string, string[]> = {},
      ) {
        super(message);
      }

      get isValidation() {
        return this.status === 422;
      }
    },
);

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/api/browser', () => ({ api: request, ApiError: FakeApiError }));
vi.mock('@/lib/session/session-provider', () => ({ useSession: () => session }));
vi.mock('@/lib/i18n/locale-provider', async () => {
  const { getDictionary } = await import('@/lib/i18n/dictionary');

  return { useLocale: () => ({ locale: 'en' as const, t: getDictionary('en') }) };
});

const OWNER = { roles: ['super_admin'], permissions: [] };
const EDITOR = { roles: ['editor'], permissions: ['pages.view', 'pages.manage'] };

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    id: 1,
    slug: 'about',
    status: 'published',
    title: 'About',
    body_html: '<p>Old words.</p>',
    body_markdown: 'Old words.',
    translated: true,
    toc: [],
    template: 'default',
    awaiting_legal_review: false,
    legal_reviewer: null,
    legal_reviewed_at: null,
    published_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    seo: {
      meta_title: null,
      meta_description: null,
      canonical_url: null,
      noindex: false,
      nofollow: false,
    },
    ...overrides,
  } as Page;
}

function calls(path: string, method: string) {
  return request.mock.calls.filter(
    ([called, options]) => called === path && options?.method === method,
  );
}

function show(page: Page, counterpart: PageCounterpart = null) {
  render(<PageEditor page={page} counterpart={counterpart} />);
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ data: { id: 99 } });
  router.refresh.mockReset();
  router.push.mockReset();
  session.user = OWNER;
});

describe('PageEditor', () => {
  it('saves the words of a site page without moving it or taking it offline', async () => {
    show(pageWith());

    expect(screen.getByLabelText(/^Address \(slug\)/)).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Delete this page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Take off the site/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View on site' })).toHaveAttribute('href', '/about');

    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'About me' } });
    fireEvent.change(screen.getByLabelText(/Meta title/), {
      target: { value: 'About Nuruzzaman' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Update' })[0]!);

    await waitFor(() => expect(calls('/admin/pages/1', 'PATCH')).toHaveLength(1));
    const body = calls('/admin/pages/1', 'PATCH')[0]![1].body;

    expect(body.title).toBe('About me');
    expect(body.body_markdown).toBe('Old words.');
    expect(body.seo).toMatchObject({ meta_title: 'About Nuruzzaman', noindex: false });
    // The address is not sent at all, and neither is the legal-review flag.
    expect('slug' in body).toBe(false);
    expect('requires_legal_review' in body).toBe(false);
    expect(await screen.findByText(/Updated\. The site shows it/)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it('publishes a new page in one click, after saving its words and address', async () => {
    show(
      pageWith({
        id: 7,
        slug: 'our-services',
        title: 'Services',
        status: 'draft',
        published_at: null,
      }),
    );

    expect(screen.getByText(/nuruzzaman\.com\.bd\/our-services/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Address \(slug\)/), { target: { value: 'services' } });
    expect(screen.getByText(/nuruzzaman\.com\.bd\/services/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(calls('/admin/pages/7/transition', 'POST')).toHaveLength(1));
    expect(calls('/admin/pages/7', 'PATCH')[0]![1].body.slug).toBe('services');
    expect(calls('/admin/pages/7/transition', 'POST')[0]![1].body).toEqual({ status: 'published' });
    expect(screen.getByRole('button', { name: 'Delete this page' })).toBeInTheDocument();
  });

  it('copies a page into an English draft and opens it', async () => {
    show(
      pageWith({ slug: 'terms', title: 'শর্তাবলি', body_markdown: '## শর্ত', template: 'legal' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create the English version' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dashboard/pages/99'));
    expect(calls('/admin/pages', 'POST')[0]![1].body).toEqual({
      title: 'শর্তাবলি',
      slug: 'terms-en',
      body_markdown: '## শর্ত',
      template: 'legal',
      requires_legal_review: true,
    });
  });

  it('links the two languages to each other instead', () => {
    show(pageWith({ id: 16, slug: 'about-en' }), { id: 1, slug: 'about', title: 'About' });

    expect(screen.getByRole('link', { name: 'Edit the Bengali version' })).toHaveAttribute(
      'href',
      '/dashboard/pages/1',
    );
    expect(screen.getByRole('link', { name: 'View on site' })).toHaveAttribute('href', '/en/about');
    expect(
      screen.queryByRole('button', { name: 'Create the English version' }),
    ).not.toBeInTheDocument();
  });

  it('lets an editor save but leaves publishing to an admin', () => {
    session.user = EDITOR;
    show(pageWith({ id: 7, slug: 'our-services', status: 'draft', published_at: null }));

    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Save draft' }).length).toBeGreaterThan(0);
    expect(screen.getByText(/You may not publish/)).toBeInTheDocument();
  });

  it('records a legal review by name', async () => {
    show(pageWith({ slug: 'privacy-policy', template: 'legal', awaiting_legal_review: true }));

    fireEvent.click(screen.getByRole('button', { name: 'Record as reviewed' }));
    expect(await screen.findByText("Give the reviewer's name.")).toBeInTheDocument();
    expect(calls('/admin/pages/1/legal-review', 'POST')).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Reviewer's name"), { target: { value: 'Adv. Karim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record as reviewed' }));

    await waitFor(() => expect(calls('/admin/pages/1/legal-review', 'POST')).toHaveLength(1));
    expect(calls('/admin/pages/1/legal-review', 'POST')[0]![1].body).toEqual({
      reviewer: 'Adv. Karim',
      reviewed: true,
    });
  });
});
