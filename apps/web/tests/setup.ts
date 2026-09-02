import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Components under test render links and read the pathname; the App Router
// hooks are not available outside a Next request, so they are stubbed here.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('notFound');
  },
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
