import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AdminSearchForm } from '@/features/admin/admin-search-form';
import { AffiliateSettingsForm } from '@/features/affiliate/affiliate-settings-form';
import {
  percent,
  type AdminAffiliateRow,
  type AffiliateSettings,
} from '@/features/affiliate/affiliate-shared';
import { sessionApi } from '@/lib/api/server';
import { price } from '@/lib/format';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

type AffiliateList = {
  data: AdminAffiliateRow[];
  meta: { current_page: number; last_page: number; total: number };
  totals: { pending_minor: number; balance_minor: number; paid_minor: number };
  settings: AffiliateSettings;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.affiliates);
}

function one(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default async function DashboardAffiliatesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t } = await adminDictionary();
  const bn = locale === 'bn';
  const params = await props.searchParams;
  const q = one(params.q).trim();
  const status = ['active', 'suspended'].includes(one(params.status)) ? one(params.status) : '';
  const page = Math.max(1, Number(one(params.page)) || 1);

  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (status) query.set('status', status);
  if (page > 1) query.set('page', String(page));

  let list: AffiliateList;

  try {
    list = await sessionApi<AffiliateList>(`/admin/affiliates${query.size ? `?${query}` : ''}`);
  } catch (error) {
    if (error instanceof ApiError && error.isForbidden) {
      notFound();
    }

    throw error;
  }

  const money = (minor: number) => price(minor, 'BDT', locale) ?? '';

  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(query);

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    return `/dashboard/affiliates${next.size ? `?${next}` : ''}`;
  };

  const totals = [
    {
      label: bn ? 'এখন প্রদেয় (মোট বাকি)' : 'Payable now (owed)',
      value: money(list.totals.balance_minor),
    },
    { label: bn ? 'হোল্ডে আছে' : 'On hold', value: money(list.totals.pending_minor) },
    { label: bn ? 'মোট পরিশোধিত' : 'Paid out so far', value: money(list.totals.paid_minor) },
  ];

  const filters = [
    { value: '', label: bn ? 'সব' : 'All' },
    { value: 'active', label: bn ? 'সক্রিয়' : 'Active' },
    { value: 'suspended', label: bn ? 'স্থগিত' : 'Suspended' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[length:var(--step-h1)] font-bold text-navy">
          {t.admin.nav.affiliates}
        </h1>
        <p className="mt-2 text-muted">
          {bn
            ? 'গ্রাহকরা অ্যাকাউন্ট থেকে affiliate link নেন। সেই লিংক থেকে আসা অর্ডারের পেমেন্ট যাচাই হলে কমিশন যোগ হয়, রিফান্ড হলে বাতিল হয়।'
            : 'Customers take an affiliate link from their account. A referred order earns commission once its payment is verified, and loses it if refunded.'}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {totals.map((total) => (
          <li key={total.label}>
            <Card className="p-4">
              <p className="text-sm text-muted">{total.label}</p>
              <p className="mt-1 text-xl font-bold text-navy">{total.value}</p>
            </Card>
          </li>
        ))}
      </ul>

      <AffiliateSettingsForm settings={list.settings} />

      <section>
        <h2 className="text-lg font-bold text-navy">{bn ? 'সদস্যরা' : 'Members'}</h2>

        <AdminSearchForm
          id="affiliate-search"
          basePath="/dashboard/affiliates"
          value={q}
          label={bn ? 'Affiliate খুঁজুন' : 'Search affiliates'}
          placeholder={bn ? 'কোড, নাম বা ইমেইল' : 'Code, name or email'}
          searchLabel={bn ? 'খুঁজুন' : 'Search'}
          locale={locale}
          total={list.meta.total}
          keep={{ status: status || undefined }}
        />

        <nav
          aria-label={bn ? 'অবস্থা অনুযায়ী' : 'By status'}
          className="mt-4 flex flex-wrap gap-2 text-sm"
        >
          {filters.map((filter) => (
            <Link
              key={filter.value || 'all'}
              href={href({ status: filter.value || null, page: null })}
              aria-current={status === filter.value ? 'page' : undefined}
              className={
                status === filter.value
                  ? 'rounded-full bg-navy px-3 py-1 font-semibold text-white'
                  : 'rounded-full border border-line px-3 py-1 text-navy hover:bg-blue-soft'
              }
            >
              {filter.label}
            </Link>
          ))}
        </nav>

        {list.data.length === 0 ? (
          <p className="mt-6 text-muted">
            {q || status
              ? bn
                ? 'কোনো affiliate মেলেনি।'
                : 'No affiliates match.'
              : bn
                ? 'এখনো কেউ যোগ দেননি। গ্রাহকরা অ্যাকাউন্ট → অ্যাফিলিয়েট প্রোগ্রাম থেকে যোগ দিতে পারেন।'
                : 'No one has joined yet. Customers join from Account → Affiliate program.'}
          </p>
        ) : (
          <Card className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-start font-medium">
                    {bn ? 'Affiliate' : 'Affiliate'}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">{bn ? 'কমিশন' : 'Rate'}</th>
                  <th className="px-4 py-3 text-end font-medium">{bn ? 'ভিজিট' : 'Visits'}</th>
                  <th className="px-4 py-3 text-end font-medium">{bn ? 'অর্ডার' : 'Orders'}</th>
                  <th className="px-4 py-3 text-end font-medium">{bn ? 'মোট আয়' : 'Earned'}</th>
                  <th className="px-4 py-3 text-end font-medium">{bn ? 'পরিশোধিত' : 'Paid'}</th>
                  <th className="px-4 py-3 text-end font-medium">{bn ? 'প্রদেয়' : 'Payable'}</th>
                  <th className="px-4 py-3 text-start font-medium">{bn ? 'অবস্থা' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((row) => (
                  <tr key={row.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/affiliates/${row.id}`}
                        className="font-semibold text-blue hover:underline"
                      >
                        {row.user?.name ?? row.code}
                      </Link>
                      <span className="font-latin block text-xs text-muted">
                        {row.code}
                        {row.user ? ` · ${row.user.email}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      {percent(row.rate, bn)}
                      {row.commission_rate !== null ? (
                        <span className="block text-xs text-muted">
                          {bn ? 'নিজস্ব রেট' : 'own rate'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {row.stats.visits.toLocaleString(bn ? 'bn-BD' : 'en-US')}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {row.stats.orders.toLocaleString(bn ? 'bn-BD' : 'en-US')}
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      {money(row.stats.earned_minor)}
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      {money(row.stats.paid_minor)}
                    </td>
                    <td
                      className={`px-4 py-3 text-end font-bold whitespace-nowrap ${row.stats.balance_minor < 0 ? 'text-danger' : 'text-navy'}`}
                    >
                      {money(row.stats.balance_minor)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status === 'active' ? 'success' : 'warning'}>
                        {row.status === 'active'
                          ? bn
                            ? 'সক্রিয়'
                            : 'Active'
                          : bn
                            ? 'স্থগিত'
                            : 'Suspended'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {list.meta.last_page > 1 ? (
          <nav aria-label={bn ? 'পাতা' : 'Pages'} className="mt-4 flex items-center gap-4 text-sm">
            {list.meta.current_page > 1 ? (
              <Link
                href={href({ page: String(list.meta.current_page - 1) })}
                className="text-blue hover:underline"
              >
                {bn ? '← আগের পাতা' : '← Previous'}
              </Link>
            ) : null}
            <span className="text-muted">
              {list.meta.current_page} / {list.meta.last_page}
            </span>
            {list.meta.current_page < list.meta.last_page ? (
              <Link
                href={href({ page: String(list.meta.current_page + 1) })}
                className="text-blue hover:underline"
              >
                {bn ? 'পরের পাতা →' : 'Next →'}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
