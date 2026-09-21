'use client';

import { createContext, useContext, useId, useState } from 'react';

import { ADMIN_SIDEBAR_COOKIE } from '@/lib/admin-sidebar';
import { cn } from '@/lib/cn';

/*
  Outside the component, as the language switcher does: assigning to a global
  inside one is a mutation the React Compiler's rules steer away from, and this
  is a browser side effect, not render logic.
*/
function persistSidebar(collapsed: boolean): void {
  document.cookie = `${ADMIN_SIDEBAR_COOKIE}=${collapsed ? 'collapsed' : 'open'};path=/;max-age=31536000;samesite=lax`;
}

/** Whether the menu is folded to its icon rail. False outside the sidebar. */
const SidebarCollapsedContext = createContext(false);

export function useSidebarCollapsed(): boolean {
  return useContext(SidebarCollapsedContext);
}

/** Drawn only while the menu is open: the name, the language, the headings. */
export function WhenSidebarOpen({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebarCollapsed();

  // Hidden rather than unmounted, so the language switcher keeps its state.
  return <div className={collapsed ? 'lg:hidden' : undefined}>{children}</div>;
}

/**
 * The admin menu, collapsible to a narrow rail of icons.
 *
 * Collapsed, the editors get the width back - the product and article editors
 * put a live SEO analysis beside the writing area, and with the menu open on a
 * laptop screen the writing area is the one that gets squeezed. The icons stay,
 * each a link to its page with the name on hover, so the menu is still one
 * click away.
 *
 * On a phone the menu sits above the page instead, and collapsing it hides it
 * altogether, as before. The choice is remembered in a cookie the layout reads
 * on the server.
 */
export function AdminSidebar({
  initialCollapsed,
  collapseLabel,
  expandLabel,
  children,
}: {
  initialCollapsed: boolean;
  collapseLabel: string;
  expandLabel: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const contentId = useId();

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    persistSidebar(next);
  }

  const label = collapsed ? expandLabel : collapseLabel;

  return (
    <aside
      data-collapsed={collapsed ? 'true' : undefined}
      className={cn(
        'relative border-b border-line bg-navy text-white lg:border-e lg:border-b-0',
        'lg:transition-[width] lg:duration-200',
        collapsed ? 'lg:w-16' : 'lg:w-64',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls={contentId}
        aria-label={label}
        title={label}
        className={cn(
          'z-10 inline-flex size-9 items-center justify-center rounded-lg text-white/75',
          'hover:bg-white/10 hover:text-white',
          'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber',
          // Beside the logo while open; alone at the top of the rail when not.
          collapsed ? 'mx-auto my-3 flex' : 'absolute end-3 top-4',
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('size-5 transition-transform', collapsed && 'rotate-180')}
        >
          <path d="M11 17l-5-5 5-5" />
          <path d="M18 17l-5-5 5-5" />
        </svg>
      </button>

      <SidebarCollapsedContext.Provider value={collapsed}>
        <div id={contentId} className={collapsed ? 'max-lg:hidden' : undefined}>
          {children}
        </div>
      </SidebarCollapsedContext.Provider>
    </aside>
  );
}
