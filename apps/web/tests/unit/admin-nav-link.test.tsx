import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminNavGroup, AdminNavLink } from '@/components/layout/admin-nav-link';
import { AdminSidebar, WhenSidebarOpen } from '@/components/layout/admin-sidebar';
import { ADMIN_SIDEBAR_COOKIE } from '@/lib/admin-sidebar';

const path = vi.hoisted(() => ({ current: '/dashboard/orders' }));

vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

function renderMenu(initialCollapsed: boolean) {
  return render(
    <AdminSidebar initialCollapsed={initialCollapsed} collapseLabel="Collapse" expandLabel="Expand">
      <WhenSidebarOpen>
        <p>Md Nuruzzaman</p>
      </WhenSidebarOpen>
      <nav aria-label="Dashboard navigation">
        <AdminNavGroup heading="Commerce">
          <li>
            <AdminNavLink href="/dashboard/products" icon="products" label="Products" />
          </li>
          <li>
            <AdminNavLink href="/dashboard/orders" icon="orders" label="Orders" />
          </li>
        </AdminNavGroup>
        <AdminNavGroup heading="Learning">
          <li>
            <AdminNavLink
              href="/dashboard/questions"
              icon="questions"
              label="Student questions"
              badge={<span data-testid="badge">1</span>}
            />
          </li>
        </AdminNavGroup>
      </nav>
    </AdminSidebar>,
  );
}

beforeEach(() => {
  path.current = '/dashboard/orders';
});

afterEach(() => {
  document.cookie = `${ADMIN_SIDEBAR_COOKIE}=; path=/; max-age=0`;
});

describe('the admin menu with icons', () => {
  it('gives every entry an icon beside its name, and marks the page being looked at', () => {
    renderMenu(false);

    const orders = screen.getByRole('link', { name: 'Orders' });
    expect(orders).toHaveAttribute('href', '/dashboard/orders');
    expect(orders).toHaveAttribute('aria-current', 'page');
    expect(orders.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Products' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Orders')).not.toHaveClass('lg:sr-only');
  });

  it('keeps each icon a link to its page on the rail, with the name on hover', () => {
    renderMenu(true);

    const products = screen.getByRole('link', { name: 'Products' });
    expect(products).toHaveAttribute('href', '/dashboard/products');
    expect(products).toHaveAttribute('title', 'Products');
    expect(products.querySelector('svg')).not.toBeNull();
    // The name is still there for screen readers, just not drawn on the rail.
    expect(screen.getByText('Products')).toHaveClass('lg:sr-only');
    // The headings give way; the count stays on the questions icon.
    expect(screen.getByText('Commerce')).toHaveClass('lg:sr-only');
    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByText('Md Nuruzzaman').parentElement).toHaveClass('lg:hidden');
  });

  it('draws the names again when the menu is opened', () => {
    renderMenu(true);

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(screen.getByText('Products')).not.toHaveClass('lg:sr-only');
    expect(screen.getByRole('link', { name: 'Products' })).not.toHaveAttribute('title');
    expect(screen.getByText('Md Nuruzzaman').parentElement).not.toHaveClass('lg:hidden');
  });

  it('counts a page under an entry as that entry, and the dashboard home only as itself', () => {
    path.current = '/dashboard/products/42/seo';
    renderMenu(false);

    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveAttribute('aria-current');
  });
});
