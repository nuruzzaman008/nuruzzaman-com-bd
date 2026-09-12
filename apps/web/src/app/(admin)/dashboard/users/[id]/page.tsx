import { ProfileEditor, type ProfileUser } from '@/features/account/profile-editor';
import { RoleEditor } from '@/features/dashboard/role-editor';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';
export const metadata = privateMetadata('Profile');
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await sessionApi<{ data: ProfileUser }>(`/admin/users/${encodeURIComponent(id)}`);
  return (
    <>
      <ProfileEditor initial={data} admin />
      {/* Decides for itself whether to draw anything: a super admin looking at
          somebody else's account. The API refuses the rest regardless. */}
      <RoleEditor userId={data.id} userName={data.name} initialRoles={data.roles} />
    </>
  );
}
