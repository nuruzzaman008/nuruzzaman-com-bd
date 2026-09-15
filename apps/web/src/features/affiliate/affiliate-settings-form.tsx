'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Checkbox, Field, Input } from '@/components/ui/form';
import { POISHA_PER_TAKA, type AffiliateSettings } from '@/features/affiliate/affiliate-shared';
import { ApiError, api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

/** The program's terms: the commission rate every affiliate gets unless given their own. */
export function AffiliateSettingsForm({ settings }: { settings: AffiliateSettings }) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setBusy(true);
    setErrors({});
    setNotice(null);

    try {
      await api('/admin/affiliate-settings', {
        method: 'PUT',
        body: {
          enabled: form.get('enabled') === 'on',
          default_rate: Number(form.get('default_rate')),
          cookie_days: Number(form.get('cookie_days')),
          hold_days: Number(form.get('hold_days')),
          // Taka on screen, poisha in the API.
          min_payout_minor: Math.round(Number(form.get('min_payout')) * POISHA_PER_TAKA),
        },
      });

      setNotice({ tone: 'success', text: bn ? 'সেটিংস সংরক্ষণ হয়েছে।' : 'Settings saved.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fields ?? {});
      }

      setNotice({
        tone: 'danger',
        text:
          caught instanceof Error ? caught.message : bn ? 'সংরক্ষণ করা যায়নি।' : 'Could not save.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-navy">
        {bn ? 'প্রোগ্রাম সেটিংস' : 'Program settings'}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {bn
          ? 'রেট বদলালে শুধু নতুন অর্ডারে প্রযোজ্য হবে; আগের কমিশন বদলাবে না। কোনো affiliate-এর আলাদা রেট তার পেজ থেকে দেওয়া যায়।'
          : 'A new rate applies to new orders only; commissions already earned keep theirs. One affiliate can be given their own rate from their page.'}
      </p>

      <form onSubmit={save} className="mt-5 space-y-4">
        {notice ? (
          <Callout tone={notice.tone} role={notice.tone === 'danger' ? 'alert' : 'status'}>
            {notice.text}
          </Callout>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label={bn ? 'ডিফল্ট কমিশন (%)' : 'Default commission (%)'}
            error={errors.default_rate?.[0]}
            required
          >
            {(props) => (
              <Input
                name="default_rate"
                type="number"
                min={0}
                max={90}
                step={0.01}
                defaultValue={settings.default_rate}
                {...props}
              />
            )}
          </Field>
          <Field
            label={bn ? 'লিংক মনে রাখবে (দিন)' : 'Link remembered for (days)'}
            error={errors.cookie_days?.[0]}
            required
          >
            {(props) => (
              <Input
                name="cookie_days"
                type="number"
                min={1}
                max={365}
                defaultValue={settings.cookie_days}
                {...props}
              />
            )}
          </Field>
          <Field
            label={bn ? 'রিফান্ড হোল্ড (দিন)' : 'Refund hold (days)'}
            error={errors.hold_days?.[0]}
            required
          >
            {(props) => (
              <Input
                name="hold_days"
                type="number"
                min={0}
                max={90}
                defaultValue={settings.hold_days}
                {...props}
              />
            )}
          </Field>
          <Field
            label={bn ? 'সর্বনিম্ন পেমেন্ট (৳)' : 'Minimum payout (৳)'}
            error={errors.min_payout_minor?.[0]}
            required
          >
            {(props) => (
              <Input
                name="min_payout"
                type="number"
                min={0}
                step={1}
                defaultValue={settings.min_payout_minor / POISHA_PER_TAKA}
                {...props}
              />
            )}
          </Field>
        </div>

        <Checkbox
          name="enabled"
          defaultChecked={settings.enabled}
          label={
            bn
              ? 'প্রোগ্রাম চালু — নতুন সদস্য ও নতুন রেফারেল নেওয়া হবে'
              : 'Program open — new members and new referrals are accepted'
          }
        />

        <Button type="submit" disabled={busy}>
          {bn ? 'সেটিংস সংরক্ষণ' : 'Save settings'}
        </Button>
      </form>
    </Card>
  );
}
