import type { Metadata } from 'next';
import type { User } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.nav.users);
}

export default async function DashboardUsersPage(props: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { t } = await adminDictionary();
  const searchParams = await props.searchParams;

  const users = await sessionApi<{ data: User[] }>('/admin/users', {
    query: { q: searchParams.q, role: searchParams.role },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">{t.admin.nav.users}</h1>
      <p className="mt-2 text-muted">{t.admin.users.roleRule}</p>

      <form method="get" role="search" className="mt-5 flex max-w-md gap-2">
        <label htmlFor="user-search" className="sr-only">
          {t.admin.users.searchLabel}
        </label>
        <input
          id="user-search"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder={t.admin.users.searchPlaceholder}
          className="h-11 w-full rounded-lg border border-line px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-lg bg-blue px-4 text-sm font-semibold text-white hover:bg-navy"
        >
          {t.admin.common.search}
        </button>
      </form>

      <div className="mt-6">
        <DataTable
          caption={t.admin.users.caption}
          rows={users.data}
          getRowKey={(user) => String(user.id)}
          empty={<EmptyState title={t.admin.users.empty} />}
          columns={[
            {
              key: 'name',
              header: t.admin.common.name,
              render: (user) => (
                <span>
                  <span className="block font-medium text-navy">{user.name}</span>
                  <span className="font-latin block text-xs text-muted">{user.email}</span>
                </span>
              ),
            },
            {
              key: 'roles',
              header: t.admin.common.role,
              render: (user) => (
                <span className="flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <Badge key={role} tone="info">
                      {role}
                    </Badge>
                  ))}
                </span>
              ),
            },
            {
              key: 'status',
              header: t.admin.common.status,
              render: (user) => (
                <Badge tone={user.status === 'active' ? 'success' : 'danger'}>{user.status}</Badge>
              ),
            },
            {
              key: 'verified',
              header: t.admin.common.email,
              render: (user) =>
                user.email_verified ? (
                  <Badge tone="success">{t.admin.users.verified}</Badge>
                ) : (
                  <Badge tone="warning">{t.admin.users.unverified}</Badge>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
