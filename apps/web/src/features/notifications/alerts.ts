/**
 * Browser-side alerts for new notifications: a desktop notification and a
 * short chime. Both are per-browser choices, kept in localStorage, because a
 * desktop permission belongs to one browser and not to the account.
 */

const KEYS = { desktop: 'nb-notify-desktop', sound: 'nb-notify-sound' } as const;
const CHANGE_EVENT = 'nb-notify-settings';

export type AlertKind = keyof typeof KEYS;
export type DesktopSupport = 'unsupported' | NotificationPermission;

export function readAlertSetting(kind: AlertKind): boolean {
  try {
    return window.localStorage.getItem(KEYS[kind]) === 'on';
  } catch {
    return false;
  }
}

export function writeAlertSetting(kind: AlertKind, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(KEYS[kind], 'on');
    else window.localStorage.removeItem(KEYS[kind]);
  } catch {
    // Storage blocked (private mode): the setting simply does not stick.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: another tab, or this one, changed a setting. */
export function subscribeAlertSettings(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function desktopSupport(): DesktopSupport {
  return typeof window !== 'undefined' && 'Notification' in window
    ? window.Notification.permission
    : 'unsupported';
}

export async function requestDesktopPermission(): Promise<DesktopSupport> {
  if (desktopSupport() === 'unsupported') return 'unsupported';
  try {
    const result = await window.Notification.requestPermission();
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return result;
  } catch {
    return desktopSupport();
  }
}

/** Shows a desktop notification that opens `href` when clicked. */
export function showDesktopNotification(input: {
  title: string;
  body: string;
  href: string;
  tag: string;
}): void {
  if (desktopSupport() !== 'granted') return;
  try {
    const notification = new window.Notification(input.title, {
      body: input.body,
      tag: input.tag,
    });
    notification.onclick = () => {
      window.focus();
      window.location.assign(input.href);
      notification.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}

/** A soft two-tone chime, synthesised so no audio file has to be shipped. */
export function playChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const start = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
    gain.connect(context.destination);

    [880, 1320].forEach((frequency, index) => {
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(frequency, start + index * 0.14);
      tone.connect(gain);
      tone.start(start + index * 0.14);
      tone.stop(start + 0.6);
      if (index === 1) tone.onended = () => void context.close();
    });
  } catch {
    // Audio blocked until the page has had a user gesture: stay silent.
  }
}
