'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import {
  COMMISSION_TONE,
  PAYOUT_METHODS,
  POISHA_PER_TAKA,
  commissionStateLabel,
  payoutMethodLabel,
  percent,
  type AdminAffiliateDetail,
} from '@/features/affiliate/affiliate-shared';
import { ApiError, api } from '@/lib/api/browser';
import { date, price } from '@/lib/format';
import { useLocale } from '@/lib/i18n/locale-provider';

type Notice = { tone: 'success' | 'danger'; text: string };

/**
 * One affiliate from the owner's side: what they earned, recording a payout
 * already sent, their own rate or suspension, and voiding a commission.
 *
 * The site never moves money. A payout is sent by bKash or bank first and
 * recorded here, which takes it off the balance the affiliate sees.
 */
export function AffiliateAdminDetail({ affiliate: initial }: { affiliate: AdminAffiliateDetail }) {
  const { locale } = useLocale();
  const bn = locale === 'bn';
  const [affiliate, setAffiliate] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [voiding, setVoiding] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const money = (minor: number) => price(minor, 'BDT', locale) ?? '';
  const { stats, settings } = affiliate;

  async function send(
    action: string,
    path: string,
    body: Record<string, unknown>,
    success: string,
    method: 'POST' | 'PATCH' = 'POST',
  ): Promise<boolean> {
    setBusy(action);
    setErrors({});
    setNotice(null);

    try {
      const response = await api<{ data: AdminAffiliateDetail }>(path, { method, body });
      setAffiliate(response.data);
      setNotice({ tone: 'success', text: success });

      return true;
    } catch (caught) {
      const fields = caught instanceof ApiError ? (caught.fields ?? {}) : {};
      setErrors(fields);

      // A refused payout has a message and no field to hang it on.
      if (Object.keys(fields).length === 0) {
        setNotice({
          tone: 'danger',
          text:
            caught instanceof Error && caught.message
              ? caught.message
              : bn
                ? 'সংরক্ষণ করা যায়নি।'
                : 'Could not save.',
        });
      }

      return false;
    } finally {
      setBusy(null);
    }
  }

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
    { label: bn ? 'পরিশোধিত' : 'Paid', value: money(stats.paid_minor) },
    { label: bn ? 'প্রদেয় ব্যালান্স' : 'Payable balance', value: money(stats.balance_minor) },
  ];

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
        <Badge tone={affiliate.status === 'active' ? 'success' : 'warning'}>
          {affiliate.status === 'active'
            ? bn
              ? 'সক্রিয়'
              : 'Active'
            : bn
              ? 'স্থগিত'
              : 'Suspended'}
        </Badge>
        <span className="font-latin">{affiliate.user?.email}</span>
        {affiliate.phone ? <span className="font-latin">{affiliate.phone}</span> : null}
        <span>
          {bn ? 'কোড' : 'Code'}: <strong className="font-latin text-navy">{affiliate.code}</strong>
        </span>
        <span>
          {bn ? 'কমিশন' : 'Rate'}:{' '}
          <strong className="text-navy">{percent(affiliate.rate, bn)}</strong>
        </span>
        {affiliate.joined_at ? (
          <span>
            {bn ? 'যোগ দিয়েছেন' : 'Joined'} {date(affiliate.joined_at, locale)}
          </span>
        ) : null}
      </div>

      {notice ? (
        <Callout tone={notice.tone} role={notice.tone === 'danger' ? 'alert' : 'status'}>
          {notice.text}
        </Callout>
      ) : null}

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">
            {bn ? 'পেমেন্ট রেকর্ড করুন' : 'Record a payout'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {bn
              ? 'আগে bKash/Nagad/ব্যাংকে টাকা পাঠান, তারপর এখানে রেকর্ড করুন। সাইট নিজে টাকা পাঠায় না; রেকর্ড করলে ব্যালান্স থেকে কমে এবং affiliate তার পেজে দেখতে পান।'
              : 'Send the money by bKash, Nagad or bank first, then record it here. The site never sends money itself; recording it takes it off the balance and shows it on the affiliate’s page.'}
          </p>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-surface p-3 text-sm">
            <dt className="text-muted">{bn ? 'মাধ্যম' : 'Method'}</dt>
            <dd>{payoutMethodLabel(affiliate.payout_method, bn)}</dd>
            <dt className="text-muted">{bn ? 'নম্বর' : 'Number'}</dt>
            <dd className="font-latin">{affiliate.payout_account ?? '—'}</dd>
            <dt className="text-muted">{bn ? 'নাম' : 'Name'}</dt>
            <dd>{affiliate.payout_name ?? '—'}</dd>
          </dl>

          {stats.balance_minor > 0 && stats.balance_minor < settings.min_payout_minor ? (
            <Callout tone="info" className="mt-4">
              {bn
                ? `ব্যালান্স সর্বনিম্ন পেমেন্ট ${money(settings.min_payout_minor)}-এর কম। চাইলে তবুও পাঠাতে পারেন।`
                : `The balance is below the ${money(settings.min_payout_minor)} minimum payout. You can still pay it if you choose.`}
            </Callout>
          ) : null}

          <form
            key={`${stats.balance_minor}-${affiliate.payouts.length}`}
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const formElement = event.currentTarget;
              const form = new FormData(formElement);

              const saved = await send(
                'payout',
                `/admin/affiliates/${affiliate.id}/payouts`,
                {
                  amount_minor: Math.round(Number(form.get('amount')) * POISHA_PER_TAKA),
                  method: String(form.get('method')),
                  reference: String(form.get('reference') ?? '').trim() || null,
                  note: String(form.get('note') ?? '').trim() || null,
                  paid_at: String(form.get('paid_at') ?? '') || null,
                },
                bn ? 'পেমেন্ট রেকর্ড হয়েছে।' : 'Payout recorded.',
              );

              if (saved) formElement.reset();
            }}
          >
            <Field
              label={bn ? 'পরিমাণ (৳)' : 'Amount (৳)'}
              error={errors.amount_minor?.[0]}
              required
            >
              {(props) => (
                <Input
                  name="amount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  defaultValue={
                    stats.balance_minor > 0 ? stats.balance_minor / POISHA_PER_TAKA : ''
                  }
                  {...props}
                />
              )}
            </Field>
            <Field
              label={bn ? 'যেভাবে পাঠানো হয়েছে' : 'Paid by'}
              error={errors.method?.[0]}
              required
            >
              {(props) => (
                <Select name="method" defaultValue={affiliate.payout_method ?? 'bkash'} {...props}>
                  {PAYOUT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {payoutMethodLabel(method, bn)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={bn ? 'ট্রানজেকশন আইডি' : 'Transaction ID'} error={errors.reference?.[0]}>
              {(props) => (
                <Input name="reference" maxLength={100} className="font-latin" {...props} />
              )}
            </Field>
            <Field
              label={bn ? 'পেমেন্টের তারিখ' : 'Payment date'}
              hint={bn ? 'খালি রাখলে আজকের তারিখ' : 'Leave empty for today'}
              error={errors.paid_at?.[0]}
            >
              {(props) => <Input name="paid_at" type="date" {...props} />}
            </Field>
            <Field className="sm:col-span-2" label={bn ? 'নোট' : 'Note'} error={errors.note?.[0]}>
              {(props) => <Input name="note" maxLength={500} {...props} />}
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy !== null || stats.balance_minor <= 0}>
                {bn ? 'পেমেন্ট রেকর্ড করুন' : 'Record payout'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-navy">
            {bn ? 'Affiliate সেটিংস' : 'Affiliate settings'}
          </h2>
          <form
            key={`${affiliate.code}-${affiliate.status}-${affiliate.commission_rate}-${affiliate.admin_note}`}
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const rate = String(form.get('commission_rate') ?? '').trim();

              void send(
                'settings',
                `/admin/affiliates/${affiliate.id}`,
                {
                  status: String(form.get('status')),
                  commission_rate: rate === '' ? null : Number(rate),
                  code: String(form.get('code') ?? '').trim(),
                  admin_note: String(form.get('admin_note') ?? '').trim() || null,
                },
                bn ? 'পরিবর্তন সংরক্ষণ হয়েছে।' : 'Changes saved.',
                'PATCH',
              );
            }}
          >
            <Field label={bn ? 'অবস্থা' : 'Status'} error={errors.status?.[0]}>
              {(props) => (
                <Select name="status" defaultValue={affiliate.status} {...props}>
                  <option value="active">{bn ? 'সক্রিয়' : 'Active'}</option>
                  <option value="suspended">
                    {bn ? 'স্থগিত (নতুন কমিশন বন্ধ)' : 'Suspended (no new commission)'}
                  </option>
                </Select>
              )}
            </Field>
            <Field
              label={bn ? 'এই affiliate-এর কমিশন (%)' : 'Commission rate for this affiliate (%)'}
              hint={
                bn
                  ? `খালি রাখলে প্রোগ্রামের ডিফল্ট ${percent(settings.default_rate, bn)} প্রযোজ্য। শুধু নতুন অর্ডারে কাজ করবে।`
                  : `Leave empty for the program default of ${percent(settings.default_rate, bn)}. Applies to new orders only.`
              }
              error={errors.commission_rate?.[0]}
            >
              {(props) => (
                <Input
                  name="commission_rate"
                  type="number"
                  min={0}
                  max={90}
                  step={0.01}
                  defaultValue={affiliate.commission_rate ?? ''}
                  {...props}
                />
              )}
            </Field>
            <Field
              label={bn ? 'লিংকের কোড' : 'Link code'}
              hint={
                bn ? 'বদলালে পুরনো লিংক আর কাজ করবে না।' : 'Changing it stops the old link working.'
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
            <Field
              label={bn ? 'ব্যক্তিগত নোট (শুধু অ্যাডমিন দেখবে)' : 'Private note (admins only)'}
              error={errors.admin_note?.[0]}
            >
              {(props) => (
                <Textarea
                  name="admin_note"
                  rows={3}
                  maxLength={500}
                  defaultValue={affiliate.admin_note ?? ''}
                  {...props}
                />
              )}
            </Field>
            <Button type="submit" variant="secondary" disabled={busy !== null}>
              {bn ? 'পরিবর্তন সংরক্ষণ' : 'Save changes'}
            </Button>
          </form>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-navy">{bn ? 'কমিশন' : 'Commissions'}</h2>
        {affiliate.commissions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {bn ? 'এখনো কোনো রেফার করা অর্ডার নেই।' : 'No referred orders yet.'}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pe-3 text-start font-medium">{bn ? 'তারিখ' : 'Date'}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {bn ? 'অর্ডার ও ক্রেতা' : 'Order & buyer'}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">{bn ? 'প্রোডাক্ট' : 'Items'}</th>
                  <th className="py-2 pe-3 text-end font-medium">
                    {bn ? 'অর্ডারের মূল্য' : 'Order value'}
                  </th>
                  <th className="py-2 pe-3 text-end font-medium">{bn ? 'কমিশন' : 'Commission'}</th>
                  <th className="py-2 pe-3 text-start font-medium">{bn ? 'অবস্থা' : 'Status'}</th>
                  <th className="py-2 text-start font-medium">
                    <span className="sr-only">{bn ? 'কার্যক্রম' : 'Actions'}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {affiliate.commissions.map((commission) => (
                  <tr key={commission.id} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pe-3 whitespace-nowrap">
                      {date(commission.created_at, locale)}
                    </td>
                    <td className="py-2 pe-3">
                      {commission.order_number ? (
                        <Link
                          href={`/dashboard/orders/${commission.order_number}`}
                          className="font-latin font-semibold text-blue hover:underline"
                        >
                          {commission.order_number}
                        </Link>
                      ) : null}
                      <span className="block text-xs text-muted">
                        {commission.buyer_name}
                        {commission.buyer_email ? ` · ${commission.buyer_email}` : ''}
                      </span>
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
                    <td className="py-2 pe-3">
                      <Badge tone={COMMISSION_TONE[commission.state]}>
                        {commissionStateLabel(commission.state, bn)}
                      </Badge>
                      {commission.state === 'pending' && commission.available_at ? (
                        <span className="mt-1 block text-xs text-muted">
                          {bn ? 'প্রদেয় হবে' : 'Payable from'}{' '}
                          {date(commission.available_at, locale)}
                        </span>
                      ) : null}
                      {commission.void_reason ? (
                        <span className="mt-1 block text-xs text-muted">
                          {commission.void_reason}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {commission.state === 'void' ? null : voiding === commission.id ? (
                        <form
                          className="flex min-w-48 flex-col gap-2"
                          onSubmit={async (event) => {
                            event.preventDefault();

                            const saved = await send(
                              'void',
                              `/admin/affiliate-commissions/${commission.id}/void`,
                              { reason: reason.trim() },
                              bn ? 'কমিশন বাতিল হয়েছে।' : 'Commission voided.',
                            );

                            if (saved) {
                              setVoiding(null);
                              setReason('');
                            }
                          }}
                        >
                          <label
                            htmlFor={`void-reason-${commission.id}`}
                            className="text-xs text-muted"
                          >
                            {bn ? 'কারণ' : 'Reason'}
                          </label>
                          <Input
                            id={`void-reason-${commission.id}`}
                            value={reason}
                            maxLength={250}
                            onChange={(event) => setReason(event.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              size="sm"
                              variant="danger"
                              disabled={busy !== null || !reason.trim()}
                            >
                              {bn ? 'বাতিল নিশ্চিত করুন' : 'Confirm void'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setVoiding(null)}
                            >
                              {bn ? 'থাক' : 'Keep'}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setVoiding(commission.id);
                            setReason('');
                          }}
                        >
                          {bn ? 'বাতিল করুন' : 'Void'}
                        </Button>
                      )}
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
            {bn ? 'এখনো কোনো পেমেন্ট রেকর্ড হয়নি।' : 'No payouts recorded yet.'}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pe-3 text-start font-medium">{bn ? 'তারিখ' : 'Date'}</th>
                  <th className="py-2 pe-3 text-start font-medium">{bn ? 'মাধ্যম' : 'Method'}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {bn ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {bn ? 'রেকর্ড করেছেন' : 'Recorded by'}
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
                    <td className="py-2 pe-3">{payout.recorded_by ?? '—'}</td>
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
    </div>
  );
}
