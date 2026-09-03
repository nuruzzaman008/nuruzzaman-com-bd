'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Cart, User } from '@nuruzzaman/contracts';

import { api } from '@/lib/api/browser';

/**
 * The signed-in visitor, fetched once per page load and shared.
 *
 * The header and the footer both need to know who is here — the header to
 * label the account link and show the cart count, the footer to decide whether
 * to offer the admin entrance. Without this they would each call `/me`, which
 * is two round trips for one answer.
 *
 * Being signed out is the normal case, not an error: both requests fail
 * quietly and leave the state null.
 *
 * This is presentation only. Every read and write is authorised by the API, so
 * what is rendered here can never grant access on its own.
 */

const STAFF_ROLES = ['super_admin', 'admin', 'editor', 'instructor', 'support'];

type SessionValue = {
  user: User | null;
  cartCount: number | null;
  isStaff: boolean;
  /** True until the first `/me` attempt settles, so nothing flashes. */
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue>({
  user: null,
  cartCount: null,
  isStaff: false,
  isLoading: true,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cartCount, setCartCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      const me = await api<{ data: User }>('/me');

      if (!isCancelled()) {
        setUser(me.data);
      }
    } catch {
      if (!isCancelled()) {
        setUser(null);
      }
    } finally {
      if (!isCancelled()) {
        setIsLoading(false);
      }
    }

    try {
      const cart = await api<{ data: Cart }>('/cart');

      if (!isCancelled()) {
        setCartCount(cart.data.lines.reduce((total, line) => total + line.quantity, 0));
      }
    } catch {
      if (!isCancelled()) {
        setCartCount(0);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Wrapped rather than called directly so no state is set synchronously in
    // the effect body, and so a navigation mid-flight cannot write to an
    // unmounted provider.
    void (async () => {
      await load(() => cancelled);
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      cartCount,
      isStaff: Boolean(user?.roles.some((role) => STAFF_ROLES.includes(role))),
      isLoading,
      refresh: () => load(),
    }),
    [user, cartCount, isLoading, load],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
