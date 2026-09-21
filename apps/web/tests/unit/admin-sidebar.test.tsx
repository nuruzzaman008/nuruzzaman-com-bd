import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { ADMIN_SIDEBAR_COOKIE, sidebarCollapsedFrom } from '@/lib/admin-sidebar';

function renderSidebar(initialCollapsed: boolean) {
  return render(
    <AdminSidebar
      initialCollapsed={initialCollapsed}
      collapseLabel="Collapse the menu"
      expandLabel="Expand the menu"
    >
      <nav aria-label="Dashboard navigation">
        {/* A same-page anchor: the fixture only needs something to hide, and a
            route path here would trip the Next.js link rule for no reason. */}
        <a href="#products">Products</a>
      </nav>
    </AdminSidebar>,
  );
}

function cookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${ADMIN_SIDEBAR_COOKIE}=`))
    ?.split('=')[1];
}

afterEach(() => {
  document.cookie = `${ADMIN_SIDEBAR_COOKIE}=; path=/; max-age=0`;
});

describe('AdminSidebar', () => {
  it('is open by default, with a button to collapse it', () => {
    renderSidebar(false);

    const toggle = screen.getByRole('button', { name: 'Collapse the menu' });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Products' })).toBeVisible();
  });

  it('collapses to its icon rail and remembers the choice', () => {
    const { container } = renderSidebar(false);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse the menu' }));

    const toggle = screen.getByRole('button', { name: 'Expand the menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('aside')).toHaveAttribute('data-collapsed', 'true');
    // The links stay: on a wide screen the rail keeps them as icons; on a
    // phone the menu is hidden by its max-lg:hidden class.
    expect(screen.getByRole('link', { name: 'Products' })).toBeInTheDocument();
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toHaveClass(
      'max-lg:hidden',
    );
    // The layout reads this on the server, so the next page renders collapsed.
    expect(cookie()).toBe('collapsed');
  });

  it('points the button at the part it hides', () => {
    renderSidebar(false);

    const toggle = screen.getByRole('button', { name: 'Collapse the menu' });
    const controlled = document.getElementById(toggle.getAttribute('aria-controls') ?? '');

    expect(controlled).not.toBeNull();
    expect(controlled).toContainElement(screen.getByRole('link', { name: 'Products' }));
  });

  it('renders collapsed when the cookie says so, and opens again', () => {
    const { container } = renderSidebar(true);

    expect(container.querySelector('aside')).toHaveAttribute('data-collapsed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Expand the menu' }));

    expect(container.querySelector('aside')).not.toHaveAttribute('data-collapsed');
    expect(screen.getByRole('link', { name: 'Products' })).toBeVisible();
    expect(cookie()).toBe('open');
  });
});

describe('sidebarCollapsedFrom', () => {
  it('is collapsed only when the cookie says collapsed', () => {
    expect(sidebarCollapsedFrom('collapsed')).toBe(true);
    expect(sidebarCollapsedFrom('open')).toBe(false);
    expect(sidebarCollapsedFrom(undefined)).toBe(false);
    // Anything unexpected shows the menu rather than hiding it.
    expect(sidebarCollapsedFrom('garbage')).toBe(false);
  });
});
