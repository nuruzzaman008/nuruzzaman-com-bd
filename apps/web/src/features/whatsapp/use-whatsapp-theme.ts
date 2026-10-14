'use client';
import { useEffect, useSyncExternalStore } from 'react';
const key = 'nb.whatsapp.theme';
const event = 'nb:whatsapp-theme';
type Theme = 'light' | 'dark';
let fallback: Theme = 'light';
function snapshot(): Theme {
  try {
    return window.localStorage.getItem(key) === 'dark' ? 'dark' : 'light';
  } catch {
    return fallback;
  }
}
function subscribe(notify: () => void) {
  window.addEventListener(event, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(event, notify);
    window.removeEventListener('storage', notify);
  };
}
export function useWhatsAppTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'light' as Theme);
  useEffect(() => {
    document.documentElement.dataset.whatsappTheme = theme;
  }, [theme]);
  function setTheme(value: Theme) {
    fallback = value;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* Session-only theme when storage is unavailable. */
    }
    window.dispatchEvent(new Event(event));
  }
  return { theme, setTheme };
}
