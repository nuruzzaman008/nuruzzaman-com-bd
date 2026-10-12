'use client';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api/browser';
import { WhatsAppCalls } from './whatsapp-calls';
type Contact = {
  id: number;
  name: string | null;
  phone: string;
  opt_out: boolean;
  suppressed: boolean;
};
const Context = createContext<{ setContact: (contact: Contact | null) => void } | null>(null);
export const useWhatsAppRuntime = () => useContext(Context);
export function WhatsAppRuntime({ children }: { children: ReactNode }) {
  const [contact, setContact] = useState<Contact | null>(null),
    [enabled, setEnabled] = useState(false);
  const pathname = usePathname();
  const value = useMemo(() => ({ setContact }), []);
  const lastUnread = useRef<number | null>(null);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    async function load() {
      try {
        const r = await api<{ data: { enabled: boolean; unread: number } }>(
          '/admin/whatsapp/overview',
          {
            signal: controller.signal,
          },
        );
        if (!disposed) {
          setEnabled(r.data.enabled);
          if (lastUnread.current !== null && r.data.unread > lastUnread.current)
            window.dispatchEvent(new Event('nb:whatsapp-notification'));
          lastUnread.current = r.data.unread;
        }
      } catch {
        /* The inbox shows detailed connection errors. */
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  return (
    <Context.Provider value={value}>
      <WhatsAppCalls
        contact={contact}
        enabled={enabled}
        floating={pathname !== '/dashboard/whatsapp'}
      />
      {children}
    </Context.Provider>
  );
}
