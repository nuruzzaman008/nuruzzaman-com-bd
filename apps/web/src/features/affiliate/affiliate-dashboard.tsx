'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/form';
import {
  COMMISSION_TONE,
  PAYOUT_METHODS,
  commissionStateLabel,
  payoutMethodLabel,
  percent,
  type AffiliateAccount,
} from '@/features/affiliate/affiliate-shared';
import { ApiError, api } from '@/lib/api/browser';
import { date, price } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';
import { referralLink } from '@/lib/referral';

const LANDING_PAGES = [
  { path: '/', bn: 'হোম পেজ', en: 'Home page' },
  {
    path: '/products/nb-engineering-tools',
    bn: 'NB Engineering Tools',
    en: 'NB Engineering Tools',
  },
  { path: '/courses', bn: 'সব কোর্স', en: 'All courses' },
  { path: '/products', bn: 'সব প্রোডাক্ট', en: 'All products' },
];

/** A page on this site, from a pasted address or a path; anything else is refused. */
function sitePath(value: string, siteUrl: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed, siteUrl);

    return url.origin === new URL(siteUrl).origin ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

type Notice = { tone: 'success' | 'danger'; text: string };

/**
 * The customer's affiliate page: joining, their link (to any page, with a code
 * they choose), what it has earned, and where to send their payouts.
 *
 * Every save returns the whole page's data, so the figures shown are always
 * the server's, never a local guess.
 */
export function AffiliateDashboard({
  account: initial,
  siteUrl,
}: {
  account: AffiliateAccount;
  siteUrl: string;
}) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const [account, setAccount] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [landing, setLanding] = useState('/');
  const [customPath, setCustomPath] = useState('');
  const [copied, setCopied] = useState(false);

  const { program, affiliate } = account;
  const money = (minor: number) => price(minor, program.currency, locale) ?? '';
  const rate = percent(affiliate?.rate ?? program.default_rate, bn);

  async function send(
    action: string,
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>,
    success: string,
  ) {
    setBusy(action);
    setErrors({});
    setNotice(null);

    try {
      const response = await api<{ data: AffiliateAccount }>('/account/affiliate', {
        method,
        body,
      });
      setAccount(response.data);
      setNotice({ tone: 'success', text: success });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fields ?? {});

        if (!caught.isValidation) {
          setNotice({ tone: 'danger', text: caught.message });
        }
      } else {
        setNotice({
          tone: 'danger',
          text: bn ? 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।' : 'Could not save. Please try again.',
        });
      }
    } finally {
      setBusy(null);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const noticeBox = notice ? (
    <Callout tone={notice.tone} role={notice.tone === 'danger' ? 'alert' : 'status'}>
      {notice.text}
    </Callout>
  ) : null;

  const terms = (
    <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-muted">
      <li>
        {bn
          ? `আপনার লিংক থেকে কেউ কোর্স, লাইসেন্স বা ক্রেডিট কিনলে পেমেন্ট যাচাইয়ের পর অর্ডারের ${rate} আপনার ব্যালান্সে যোগ হবে।`
          : `When someone buys a course, licence or credits through your link, ${rate} of the order is added to your balance once the payment is verified.`}
      </li>
      <li>
        {bn
          ? `লিংকে ক্লিকের পর ${program.cookie_days} দিনের মধ্যে কেনাকাটা করলেও কমিশন পাবেন।`
          : `A purchase up to ${program.cookie_days} days after the click still counts.`}
      </li>
      <li>
        {program.hold_days > 0
          ? bn
            ? `রিফান্ডের সুযোগ রাখতে কমিশন ${program.hold_days} দিন হোল্ডে থাকে, তারপর প্রদেয় হয়।`
            : `Commission is held for ${program.hold_days} days in case of a refund, then becomes payable.`
          : bn
            ? 'পেমেন্ট যাচাই হলেই কমিশন প্রদেয় হয়।'
            : 'Commission becomes payable as soon as the payment is verified.'}
      </li>
      <li>
        {bn
          ? `ব্যালান্স ${money(program.min_payout_minor)} হলে bKash, Nagad, Rocket বা ব্যাংকে পেমেন্ট করা হয়। নিজের লিংক থেকে কেনাকাটায় কমিশন হয় না।`
          : `Payouts go by bKash, Nagad, Rocket or bank once your balance reaches ${money(program.min_payout_minor)}. Your own purchases do not earn commission.`}
      </li>
    </ul>
  );

  if (!affiliate) {
    return (
      <div className="mt-6 space-y-6">
        {noticeBox}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-navy">
            {bn
              ? `লিংক শেয়ার করুন, প্রতিটি বিক্রিতে ${rate} কমিশন পান`
              : `Share your link and earn ${rate} on every sale`}
          </h2>
          {terms}

          {program.enabled ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();

                void send(
                  'join',
                  'POST',
                  code ? { code } : {},
                  bn
                    ? 'স্বাগতম! আপনার affiliate link তৈরি হয়েছে।'
                    : 'Welcome! Your affiliate link is ready.',
                );
              }}
            >
              <Field
                label={bn ? 'আপনার কোড (ঐচ্ছিক)' : 'Your code (optional)'}
                hint={
                  bn
                    ? 'খালি রাখলে আপনার নাম থেকে একটি কোড তৈরি হবে; পরে বদলানো যাবে।'
                    : 'Leave it empty for one made from your name; you can change it later.'
                }
                error={errors.code?.[0]}
              >
                {(props) => (
                  <Input name="code" maxLength={32} placeholder="karim-civil" {...props} />
                )}
              </Field>
              <Button type="submit" disabled={busy !== null}>
                {bn ? 'অ্যাফিলিয়েট প্রোগ্রামে যোগ দিন' : 'Join the affiliate program'}
              </Button>
            </form>
          ) : (
            <Callout tone="warning" className="mt-6">
              {bn
                ? 'এই মুহূর্তে নতুন সদস্য নেওয়া হচ্ছে না। পরে আবার দেখুন।'
                : 'The program is not taking new members right now. Please check back later.'}
            </Callout>
          )}
        </Card>
      </div>
    );
  }

  const path = landing === 'custom' ? (sitePath(customPath, siteUrl) ?? '/') : landing;
  const link = referralLink(siteUrl, path, affiliate.code);
  const { stats } = affiliate;

  const figures = [
    {
      label: bn ? 'লিংকে ভিজিট' : 'Link visits',
      value: stats.visits.toLocaleString(bn ? 'bn-BD' : 'en-US'),
    },
    {
      label: bn ? 'রেফার করা অর্ডার' : 'Referred orders',
      value: stats.orders.toLocaleString(bn ? 'bn-BD' : 'en-US'),
    },
    { label: bn ? 'মোট আয়' : 'Total earned', value: money(stats.earned_minor) },
    { label: bn ? 'হোল্ডে আছে' : 'On hold', value: money(stats.pending_minor) },
    { label: bn ? 'পেমেন্ট পেয়েছেন' : 'Paid to you', value: money(stats.paid_minor) },
    { label: bn ? 'প্রদেয় ব্যালান্স' : 'Payable balance', value: money(stats.balance_minor) },
  ];

  return (
    <div className="mt-6 space-y-6">
      {noticeBox}

      {affiliate.status === 'suspended' ? (
        <Callout tone="warning" title={bn ? 'অ্যাকাউন্ট স্থগিত' : 'Account suspended'}>
          {bn
            ? 'আপনার affiliate অ্যাকাউন্ট এখন স্থগিত, তাই নতুন অর্ডারে কমিশন যোগ হচ্ছে না। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।'
            : 'Your affiliate account is suspended, so new orders do not earn commission. Please contact support for details.'}
        </Callout>
      ) : null}

      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-navy">
            {bn ? 'আপনার affiliate link' : 'Your affiliate link'}
          </h2>
          <p className="text-sm text-muted">
            {bn ? 'আপনার কমিশন:' : 'Your commission:'} <strong className="text-navy">{rate}</strong>
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={bn ? 'কোন পেজের লিংক' : 'Page to link to'}>
            {(props) => (
              <Select
                value={landing}
                onChange={(event) => setLanding(event.target.value)}
                {...props}
              >
                {LANDING_PAGES.map((page) => (
                  <option key={page.path} value={page.path}>
                    {bn ? page.bn : page.en}
                  </option>
                ))}
                <option value="custom">{bn ? 'অন্য কোনো পেজ…' : 'Another page…'}</option>
              </Select>
            )}
          </Field>

          {landing === 'custom' ? (
            <Field
              label={bn ? 'পেজের ঠিকানা' : 'Page address'}
              hint={
                bn
                  ? 'এই সাইটের যেকোনো পেজের লিংক পেস্ট করুন।'
                  : 'Paste the address of any page on this site.'
              }
            >
              {(props) => (
                <Input
                  value={customPath}
                  onChange={(event) => setCustomPath(event.target.value)}
                  placeholder={`${siteUrl}/courses/…`}
                  {...props}
                />
              )}
            </Field>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field className="min-w-0 flex-1" label={bn ? 'আপনার লিংক' : 'Your affiliate link'}>
            {(props) => (
              <Input
                readOnly
                value={link}
                className="font-latin"
                onFocus={(event) => event.currentTarget.select()}
                {...props}
              />
            )}
          </Field>
          <Button type="button" variant="secondary" onClick={() => void copy(link)}>
            {copied ? (bn ? 'কপি হয়েছে ✓' : 'Copied ✓') : bn ? 'লিংক কপি করুন' : 'Copy link'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-navy">
          {bn ? 'লিংক কাস্টমাইজ করুন' : 'Customise your link'}
        </h2>
        <form
          key={affiliate.code}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(event) => {
            event.preventDefault();
            const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();

            void send(
              'code',
              'PATCH',
              { code },
              bn ? 'নতুন কোড সংরক্ষণ হয়েছে।' : 'Your new code is saved.',
            );
          }}
        >
          <Field
            className="min-w-0 flex-1"
            label={bn ? 'লিংকের কোড' : 'Code in your link'}
            hint={
              bn
                ? 'ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন, ৩–৩২ অক্ষর। কোড বদলালে পুরনো লিংক আর কাজ করবে না।'
                : 'Lowercase English letters, digits and hyphens, 3–32 characters. Changing it stops your old link working.'
            }
            error={errors.code?.[0]}
          >
            {(props) => (
              <Input
                name="code"
                defaultValue={affiliate.code}
                maxLength={32}
                className="font-latin"
                {...props}
              />
            )}
          </Field>
          <Button
            type="submit"
            className="sm:mt-7"
            disabled={busy !== null || affiliate.status !== 'active'}
          >
            {bn ? 'কোড সংরক্ষণ' : 'Save code'}
          </Button>
        </form>
      </Card>

      <section aria-label={bn ? 'আয়ের হিসাব' : 'Earnings'}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {figures.map((figure) => (
            <li key={figure.label}>
              <Card className="p-4">
                <p className="text-sm text-muted">{figure.label}</p>
                <p className="mt-1 text-xl font-bold text-navy">{figure.value}</p>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          {bn
            ? `ব্যালান্স ${money(program.min_payout_minor)} বা বেশি হলে নিচের পেমেন্ট তথ্যে টাকা পাঠানো হয়।`
            : `Once your balance reaches ${money(program.min_payout_minor)}, it is sent to the payout details below.`}
        </p>
      </section>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-navy">
          {bn ? 'পেমেন্ট নেওয়ার তথ্য' : 'Where to send your payouts'}
        </h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);

            void send(
              'payout',
              'PATCH',
              {
                payout_method: String(form.get('payout_method') || '') || null,
                payout_account: String(form.get('payout_account') || '').trim() || null,
                payout_name: String(form.get('payout_name') || '').trim() || null,
              },
              bn ? 'পেমেন্ট তথ্য সংরক্ষণ হয়েছে।' : 'Payout details saved.',
            );
          }}
        >
          <Field label={bn ? 'মাধ্যম' : 'Method'} error={errors.payout_method?.[0]}>
            {(props) => (
              <Select name="payout_method" defaultValue={affiliate.payout_method ?? ''} {...props}>
                <option value="">{bn ? 'বাছাই করুন' : 'Choose'}</option>
                {PAYOUT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {payoutMethodLabel(method, bn)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label={bn ? 'নম্বর / অ্যাকাউন্ট' : 'Number / account'}
            error={errors.payout_account?.[0]}
          >
            {(props) => (
              <Input
                name="payout_account"
                defaultValue={affiliate.payout_account ?? ''}
                maxLength={100}
                {...props}
              />
            )}
          </Field>
          <Field label={bn ? 'অ্যাকাউন্টের নাম' : 'Account name'} error={errors.payout_name?.[0]}>
            {(props) => (
              <Input
                name="payout_name"
                defaultValue={affiliate.payout_name ?? ''}
                maxLength={100}
                {...props}
              />
            )}
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary" disabled={busy !== null}>
              {bn ? 'পেমেন্ট তথ্য সংরক্ষণ' : 'Save payout details'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-navy">{bn ? 'কমিশনের তালিকা' : 'Commissions'}</h2>
        {affiliate.commissions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {bn
              ? 'এখনো কোনো অর্ডার আসেনি। লিংকটি শেয়ার করা শুরু করুন।'
              : 'No referred orders yet. Start sharing your link.'}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-start text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pe-3 text-start font-medium">{bn ? 'তারিখ' : 'Date'}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {bn ? 'কী কেনা হয়েছে' : 'What was bought'}
                  </th>
                  <th className="py-2 pe-3 text-end font-medium">{bn ? 'অর্ডার' : 'Order'}</th>
                  <th className="py-2 pe-3 text-end font-medium">{bn ? 'কমিশন' : 'Commission'}</th>
                  <th className="py-2 text-start font-medium">{bn ? 'অবস্থা' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {affiliate.commissions.map((commission) => (
                  <tr key={commission.id} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pe-3 whitespace-nowrap">
                      {date(commission.created_at, locale)}
                    </td>
                    <td className="py-2 pe-3">{commission.items.join(', ')}</td>
                    <td className="py-2 pe-3 text-end whitespace-nowrap">
                      {money(commission.base_minor)}
                    </td>
                    <td className="py-2 pe-3 text-end whitespace-nowrap">
                      <span className="font-bold text-navy">{money(commission.amount_minor)}</span>
                      <span className="block text-xs text-muted">
                        {percent(commission.rate, bn)}
                      </span>
                    </td>
                    <td className="py-2">
                      <Badge tone={COMMISSION_TONE[commission.state]}>
                        {commissionStateLabel(commission.state, bn)}
                      </Badge>
                      {commission.state === 'pending' && commission.available_at ? (
                        <span className="mt-1 block text-xs text-muted">
                          {bn ? 'প্রদেয় হবে' : 'Payable from'}{' '}
                          {date(commission.available_at, locale)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-navy">
          {bn ? 'পেমেন্টের ইতিহাস' : 'Payout history'}
        </h2>
        {affiliate.payouts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {bn ? 'এখনো কোনো পেমেন্ট হয়নি।' : 'No payouts yet.'}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pe-3 text-start font-medium">{bn ? 'তারিখ' : 'Date'}</th>
                  <th className="py-2 pe-3 text-start font-medium">{bn ? 'মাধ্যম' : 'Method'}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {bn ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}
                  </th>
                  <th className="py-2 text-end font-medium">{bn ? 'পরিমাণ' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody>
                {affiliate.payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pe-3 whitespace-nowrap">{date(payout.paid_at, locale)}</td>
                    <td className="py-2 pe-3">{payoutMethodLabel(payout.method, bn)}</td>
                    <td className="font-latin py-2 pe-3">
                      {payout.reference ?? '—'}
                      {payout.note ? (
                        <span className="block font-sans text-xs text-muted">{payout.note}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-end font-bold whitespace-nowrap text-navy">
                      {money(payout.amount_minor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-navy">
          {bn ? 'প্রোগ্রামের নিয়ম' : 'How the program works'}
        </h2>
        {terms}
      </Card>
    </div>
  );
}
