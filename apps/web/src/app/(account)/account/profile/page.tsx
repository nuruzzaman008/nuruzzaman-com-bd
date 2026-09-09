import { ProfileEditor, type ProfileUser } from '@/features/account/profile-editor';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';
export const metadata = privateMetadata('Profile');
export default async function ProfilePage() {
  const { data } = await sessionApi<{ data: ProfileUser }>('/me');
  return <ProfileEditor initial={data} />;
}
