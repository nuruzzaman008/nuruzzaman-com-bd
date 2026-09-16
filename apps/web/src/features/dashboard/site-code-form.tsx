'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Setting } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';
import { SITE_CODE_KEYS } from '@/lib/site-code';

/**
 * Header and footer code: the boxes a site owner needs for Google Search
 * Console, AdSense, Analytics, a tag manager or a chat widget.
 *
 * Saved as public settings, so the public shell can read them with the rest of
 * the site settings it already fetches, and served to the pages at once - the
 * API revalidates the `settings` tag on save.
 */
const BOXES = [
  { key: SITE_CODE_KEYS.head, field: 'head' },
  { key: SITE_CODE_KEYS.bodyStart, field: 'bodyStart' },
  { key: SITE_CODE_KEYS.bodyEnd, field: 'bodyEnd' },
  { key: SITE_CODE_KEYS.adsTxt, field: 'adsTxt' },
] as const;

function valueOf(settings: Setting[], key: string): string {
  const value = settings.find((setting) => setting.key === key)?.value;

  return typeof value === 'string' ? value : '';
}

export function SiteCodeForm({ settings }: { settings: Setting[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const words = t.admin.siteCode;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(BOXES.map((box) => [box.key, valueOf(settings, box.key)])),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'danger'>('success');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: {
          settings: BOXES.map((box) => ({
            key: box.key,
            group: 'code',
            value: values[box.key] ?? '',
            // Read by the public pages that render it, so it travels with the
            // site settings they already ask for.
            is_public: true,
          })),
        },
      });
      setTone('success');
      setMessage(words.saved);
      router.refresh();
    } catch (caught) {
      setTone('danger');
      setMessage(caught instanceof ApiError ? caught.message : words.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={save} className="space-y-5" aria-label={words.title}>
        <div>
          <h2 className="text-lg font-bold text-navy">{words.title}</h2>
          <p className="mt-1 text-sm text-muted">{words.intro}</p>
        </div>

        <Callout tone="warning">{words.warning}</Callout>

        {message ? (
          <Callout tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
            {message}
          </Callout>
        ) : null}

        {BOXES.map((box) => (
          <Field key={box.key} label={words[box.field]} hint={words[`${box.field}Hint`] as string}>
            {(props) => (
              <Textarea
                {...props}
                name={box.key}
                spellCheck={false}
                className="font-latin min-h-28 text-xs"
                value={values[box.key] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [box.key]: event.target.value }))
                }
              />
            )}
          </Field>
        ))}

        <Button type="submit" disabled={busy}>
          {busy ? t.admin.common.saving : t.admin.common.save}
        </Button>
      </form>
    </Card>
  );
}
