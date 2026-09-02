import type { Metadata } from 'next';
import type { User } from '@nuruzzaman/contracts';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('ব্যবহারকারী');

export default async function DashboardUsersPage(props: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const searchParams = await props.searchParams;

  const users = await sessionApi<{ data: User[] }>('/admin/users', {
    query: { q: searchParams.q, role: searchParams.role },
  });

  return (
    <div>
      <h1 className="text-[length:var(--step-h1)] font-bold text-navy">ব্যবহারকারী</h1>
      <p className="mt-2 text-muted">
        রোল পরিবর্তন শুধু super admin করতে পারেন এবং নিজের অ্যাকাউন্টে নয়। পরিবর্তনের আগে
        পাসওয়ার্ড নিশ্চিতকরণ লাগে।
      </p>

      <form method="get" role="search" className="mt-5 flex max-w-md gap-2">
        <label htmlFor="user-search" className="sr-only">
          নাম বা ইমেইল দিয়ে খুঁজুন
        </label>
        <input
          id="user-search"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="নাম বা ইমেইল"
          className="h-11 w-full rounded-lg border border-line px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-lg bg-blue px-4 text-sm font-semibold text-white hover:bg-navy"
        >
          খুঁজুন
        </button>
      </form>

      <div className="mt-6">
        <DataTable
          caption="ব্যবহারকারীর তালিকা"
          rows={users.data}
          getRowKey={(user) => String(user.id)}
          empty={<EmptyState title="কোনো ব্যবহারকারী পাওয়া যায়নি" />}
          columns={[
            {
              key: 'name',
              header: 'নাম',
              render: (user) => (
                <span>
                  <span className="block font-medium text-navy">{user.name}</span>
                  <span className="font-latin block text-xs text-muted">{user.email}</span>
                </span>
              ),
            },
            {
              key: 'roles',
              header: 'রোল',
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
              header: 'অবস্থা',
              render: (user) => (
                <Badge tone={user.status === 'active' ? 'success' : 'danger'}>{user.status}</Badge>
              ),
            },
            {
              key: 'verified',
              header: 'ইমেইল',
              render: (user) =>
                user.email_verified ? (
                  <Badge tone="success">যাচাই হয়েছে</Badge>
                ) : (
                  <Badge tone="warning">যাচাই হয়নি</Badge>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
