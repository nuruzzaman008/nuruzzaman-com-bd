'use client';

import type { NotificationEmailLog } from '@nuruzzaman/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { api } from '@/lib/api/browser';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n/locale-provider';

import { fullTime } from './time';

type Status = 'all' | 'pending' | 'sent' | 'failed';
type Source = 'all' | 'notification' | 'mail';

const BASE = '/dashboard/notifications/emails';

function href(values: { status?: Status; source?: Source; page?: number }) {
  const params = new URLSearchParams();
  if (values.status && values.status !== 'all') params.set('status', values.status);
  if (values.source && values.source !== 'all') params.set('source', values.source);
  if (values.page && values.page > 1) params.set('page', String(values.page));
  const search = params.toString();

  return search ? `${BASE}?${search}` : BASE;
}

const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  pending: 'bg-amber-soft text-amber-900',
  failed: 'bg-red-100 text-red-800',
};

/** Dashboard -> Notifications -> Email log. Administrators only. */
export function EmailLog({
  initial,
  status,
  source,
}: {
  initial: NotificationEmailLog;
  status: Status;
  source: Source;
}) {
  const { locale, t } = useLocale();
  const copy = t.notifications.log;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const { data: rows, meta, failed_jobs: failedJobs } = initial;
  const summary = meta.summary;
  const statusLabel: Record<string, string> = {
    sent: copy.sent,
    pending: copy.pending,
    failed: copy.failed,
  };

  function run(action: () => Promise<string>) {
    setMessage(null);
    startTransition(async () => {
      try {
        setMessage(await action());
        router.refresh();
      } catch {
        setMessage(t.notifications.actionFailed);
      }
    });
  }

  const queued = (count: number) => `${count}${copy.queued}`;

  const pill = (active: boolean) =>
    cn(
      'rounded-full border px-3 py-1.5 text-sm font-semibold',
      active
        ? 'border-navy bg-navy text-white'
        : 'border-line bg-white text-navy hover:border-blue',
    );

  return (
    <div>
      <p className="mt-2 text-sm text-muted">{copy.intro}</p>

      {!summary.mail_delivers ? (
        <p className="mt-4 rounded-lg border border-amber/40 bg-amber-soft px-3 py-2 text-sm text-navy">
          {copy.notDelivering.replace('{mailer}', summary.mailer)}
        </p>
      ) : null}

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          [copy.sentWeek, summary.sent_last_7_days],
          [copy.pending, summary.pending],
          [copy.failed, summary.failed],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-line bg-white p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-latin mt-1 text-2xl font-bold text-navy">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'failed', 'pending', 'sent'] as Status[]).map((name) => (
            <Link
              key={name}
              href={href({ status: name, source })}
              className={pill(status === name)}
            >
              {name === 'all' ? copy.sourceAll : statusLabel[name]}
            </Link>
          ))}
          <span aria-hidden="true" className="mx-1 self-center text-line">
            |
          </span>
          {(['all', 'notification', 'mail'] as Source[]).map((name) => (
            <Link
              key={name}
              href={href({ status, source: name })}
              className={pill(source === name)}
            >
              {name === 'all'
                ? copy.sourceAll
                : name === 'notification'
                  ? copy.sourceNotification
                  : copy.sourceMail}
            </Link>
          ))}
        </div>
        {summary.failed + summary.pending > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const response = await api<{ data: { queued: number } }>(
                  '/admin/notification-emails/retry-failed',
                  { method: 'POST' },
                );
                return queued(response.data.queued);
              })
            }
            className="text-sm font-semibold text-blue hover:underline disabled:opacity-40"
          >
            {copy.retryAll}
          </button>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="mt-3 text-sm text-muted">
          {message}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-surface text-start text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-start">
                {copy.time}
              </th>
              <th scope="col" className="px-3 py-2 text-start">
                {copy.recipient}
              </th>
              <th scope="col" className="px-3 py-2 text-start">
                {copy.type}
              </th>
              <th scope="col" className="px-3 py-2 text-start">
                {copy.status}
              </th>
              <th scope="col" className="px-3 py-2 text-start">
                {copy.attempts}
              </th>
              <th scope="col" className="px-3 py-2 text-start">
                {copy.action}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  {t.notifications.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted">
                    {fullTime(row.created_at, locale)}
                  </td>
                  <td className="px-3 py-2 break-all">{row.recipient}</td>
                  <td className="px-3 py-2">
                    <span className="block font-semibold text-navy">{row.label}</span>
                    {row.subject && row.subject !== row.label ? (
                      <span className="block text-xs text-muted">{row.subject}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        STATUS_STYLE[row.status],
                      )}
                    >
                      {statusLabel[row.status] ?? row.status}
                    </span>
                    {row.status === 'failed' && row.failure_reason ? (
                      <span className="mt-1 block max-w-xs text-xs break-words text-red-700">
                        {row.failure_reason}
                      </span>
                    ) : null}
                  </td>
                  <td className="font-latin px-3 py-2">{row.attempts}</td>
                  <td className="px-3 py-2">
                    {row.can_retry ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            await api(`/admin/notification-emails/${row.id}/retry`, {
                              method: 'POST',
                            });
                            return queued(1);
                          })
                        }
                        className="font-semibold text-blue hover:underline disabled:opacity-40"
                      >
                        {copy.retry}
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta.last_page > 1 ? (
        <nav
          aria-label={t.notifications.page}
          className="mt-4 flex items-center justify-center gap-4 text-sm font-semibold"
        >
          {meta.current_page > 1 ? (
            <Link
              className="text-blue hover:underline"
              href={href({ status, source, page: meta.current_page - 1 })}
            >
              {t.notifications.previous}
            </Link>
          ) : null}
          <span className="font-latin text-muted">
            {meta.current_page} / {meta.last_page}
          </span>
          {meta.current_page < meta.last_page ? (
            <Link
              className="text-blue hover:underline"
              href={href({ status, source, page: meta.current_page + 1 })}
            >
              {t.notifications.next}
            </Link>
          ) : null}
        </nav>
      ) : null}

      {failedJobs.length > 0 ? (
        <section aria-labelledby="failed-mail-jobs" className="mt-8">
          <h2 id="failed-mail-jobs" className="text-lg font-bold text-navy">
            {copy.failedJobs}
          </h2>
          <p className="mt-1 text-sm text-muted">{copy.failedJobsIntro}</p>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
            {failedJobs.map((job) => (
              <li
                key={job.uuid}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-navy">{job.job}</span>
                  <span className="block text-xs break-words text-red-700">{job.reason}</span>
                  <span className="block text-xs text-muted">
                    {fullTime(job.failed_at, locale)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      await api(`/admin/notification-emails/jobs/${job.uuid}/retry`, {
                        method: 'POST',
                      });
                      return queued(1);
                    })
                  }
                  className="font-semibold text-blue hover:underline disabled:opacity-40"
                >
                  {copy.retry}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 rounded-xl border border-line bg-white p-5">
        <p className="text-sm text-muted">{copy.pruneHint}</p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const response = await api<{ data: { notifications: number; emails: number } }>(
                '/admin/notifications/prune',
                { method: 'POST' },
              );
              return `${response.data.notifications + response.data.emails}${copy.pruned}`;
            })
          }
          className="mt-3 text-sm font-semibold text-blue hover:underline disabled:opacity-40"
        >
          {copy.prune}
        </button>
      </section>
    </div>
  );
}
