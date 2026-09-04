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

/**
 * Site settings editor.
 *
 * Values are stored as JSON, so the field accepts JSON and reports a parse
 * error inline rather than silently saving a string where an array was meant.
 */
export function SettingsForm({ settings }: { settings: Setting[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'danger'>('success');
  const [parseErrors, setParseErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setParseErrors({});

    const form = new FormData(event.currentTarget);
    const payload: { key: string; group: string; value: unknown; is_public: boolean }[] = [];
    const errors: Record<string, string> = {};

    for (const setting of settings) {
      const raw = String(form.get(`value:${setting.key}`) ?? '');

      try {
        payload.push({
          key: setting.key,
          group: setting.group,
          value: JSON.parse(raw),
          is_public: setting.is_public,
        });
      } catch {
        errors[setting.key] = t.admin.settingsForm.invalidJson;
      }
    }

    if (Object.keys(errors).length > 0) {
      setParseErrors(errors);
      setBusy(false);

      return;
    }

    try {
      await api('/admin/settings', { method: 'PUT', body: { settings: payload } });
      setTone('success');
      setMessage(t.admin.settingsForm.saved);
      router.refresh();
    } catch (caught) {
      setTone('danger');
      setMessage(
        caught instanceof ApiError ? caught.message : t.admin.settingsForm.failed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {message ? (
        <Callout tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
          {message}
        </Callout>
      ) : null}

      {settings.map((setting) => (
        <Card key={setting.key} className="p-5">
          <p className="font-latin text-sm font-semibold text-navy">{setting.key}</p>
          <p className="text-xs text-muted">
            {t.admin.settingsForm.group}: {setting.group} ·{' '}
            {setting.is_public
              ? t.admin.settingsForm.public
              : t.admin.settingsForm.internal}
          </p>

          <div data-authored="true" className="mt-3">
            <Field label={t.admin.settingsForm.valueLabel} error={parseErrors[setting.key]}>
              {(props) => (
                <Textarea
                  name={`value:${setting.key}`}
                  defaultValue={JSON.stringify(setting.value, null, 2)}
                  className="font-latin min-h-32 text-xs"
                  spellCheck={false}
                  {...props}
                />
              )}
            </Field>
          </div>
        </Card>
      ))}

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? t.admin.common.saving : t.admin.settingsForm.saveAll}
      </Button>
    </form>
  );
}
