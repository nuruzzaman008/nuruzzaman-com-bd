'use client';

import type { NotificationPreference } from '@nuruzzaman/contracts';
import { useState, useSyncExternalStore, useTransition } from 'react';

import { api } from '@/lib/api/browser';
import type { Dictionary } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';

import {
  desktopSupport,
  playChime,
  readAlertSetting,
  requestDesktopPermission,
  showDesktopNotification,
  subscribeAlertSettings,
  writeAlertSetting,
  type DesktopSupport,
} from './alerts';

type Category = keyof Dictionary['notifications']['categories'];

const serverFalse = () => false;
const serverSupport = (): DesktopSupport => 'default';
const readDesktop = () => readAlertSetting('desktop');
const readSound = () => readAlertSetting('sound');

const section = 'rounded-xl border border-line bg-white p-5';
const row = 'flex cursor-pointer items-start gap-3 border-b border-line py-3 last:border-b-0';
const box = 'mt-1 size-4 shrink-0 accent-navy';

/** Which categories also arrive by email (saved to the account). */
export function EmailPreferences({ initial }: { initial: NotificationPreference[] }) {
  const { t } = useLocale();
  const copy = t.notifications;
  const [choices, setChoices] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await api<{ data: NotificationPreference[] }>(
          '/me/notification-preferences',
          {
            method: 'PUT',
            body: {
              email: Object.fromEntries(choices.map((choice) => [choice.category, choice.email])),
            },
          },
        );
        setChoices(response.data);
        setMessage(copy.saved);
      } catch {
        setMessage(copy.actionFailed);
      }
    });
  }

  return (
    <section aria-labelledby="notification-email" className={section}>
      <h2 id="notification-email" className="text-lg font-bold text-navy">
        {copy.emailTitle}
      </h2>
      <p className="mt-1 text-sm text-muted">{copy.emailIntro}</p>
      <div className="mt-3">
        {choices.map((choice) => (
          <label key={choice.category} className={row}>
            <input
              type="checkbox"
              className={box}
              checked={choice.email}
              onChange={(event) =>
                setChoices((current) =>
                  current.map((item) =>
                    item.category === choice.category
                      ? { ...item, email: event.target.checked }
                      : item,
                  ),
                )
              }
            />
            <span>
              <span className="block font-semibold text-navy">
                {copy.categories[choice.category as Category] ?? choice.category}
              </span>
              <span className="block text-sm text-muted">
                {copy.categoryHints[choice.category as Category] ?? ''}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-60"
        >
          {copy.save}
        </button>
        {message ? (
          <p role="status" className="text-sm text-muted">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Desktop notification and sound, per browser (see alerts.ts). */
export function BrowserAlerts({ allHref }: { allHref: string }) {
  const { t } = useLocale();
  const copy = t.notifications;
  const desktop = useSyncExternalStore(subscribeAlertSettings, readDesktop, serverFalse);
  const sound = useSyncExternalStore(subscribeAlertSettings, readSound, serverFalse);
  const support = useSyncExternalStore(subscribeAlertSettings, desktopSupport, serverSupport);
  const [asking, setAsking] = useState(false);

  async function toggleDesktop(on: boolean) {
    if (!on) {
      writeAlertSetting('desktop', false);
      return;
    }
    setAsking(true);
    const permission = support === 'granted' ? 'granted' : await requestDesktopPermission();
    setAsking(false);
    writeAlertSetting('desktop', permission === 'granted');
  }

  function test() {
    if (desktop) {
      showDesktopNotification({
        title: copy.testTitle,
        body: copy.testBody,
        href: allHref,
        tag: 'nb-test',
      });
    }
    if (sound) playChime();
  }

  return (
    <section aria-labelledby="notification-browser" className={section}>
      <h2 id="notification-browser" className="text-lg font-bold text-navy">
        {copy.browserTitle}
      </h2>
      <p className="mt-1 text-sm text-muted">{copy.browserIntro}</p>
      <div className="mt-3">
        <label className={row}>
          <input
            type="checkbox"
            className={box}
            checked={desktop && support === 'granted'}
            disabled={asking || support === 'unsupported' || support === 'denied'}
            onChange={(event) => void toggleDesktop(event.target.checked)}
          />
          <span>
            <span className="block font-semibold text-navy">{copy.desktopToggle}</span>
            {support === 'denied' ? (
              <span className="block text-sm text-muted">{copy.denied}</span>
            ) : null}
            {support === 'unsupported' ? (
              <span className="block text-sm text-muted">{copy.unsupported}</span>
            ) : null}
          </span>
        </label>
        <label className={row}>
          <input
            type="checkbox"
            className={box}
            checked={sound}
            onChange={(event) => writeAlertSetting('sound', event.target.checked)}
          />
          <span className="block font-semibold text-navy">{copy.soundToggle}</span>
        </label>
      </div>
      <button
        type="button"
        onClick={test}
        disabled={!sound && !(desktop && support === 'granted')}
        className="mt-3 text-sm font-semibold text-blue hover:underline disabled:opacity-40 disabled:hover:no-underline"
      >
        {copy.test}
      </button>
    </section>
  );
}
