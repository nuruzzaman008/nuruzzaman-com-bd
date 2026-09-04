import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Post } from '@nuruzzaman/contracts';

import { PostEditor } from '@/features/dashboard/post-editor';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { sessionApi } from '@/lib/api/server';
import { adminDictionary } from '@/lib/i18n/admin-page';
import { privateMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await adminDictionary();

  return privateMetadata(t.admin.editPost);
}

export default async function EditPostPage(props: { params: Promise<{ id: string }> }) {
  const { t } = await adminDictionary();
  const { id } = await props.params;

  let post: Post;

  try {
    const response = await sessionApi<{ data: Post }>(`/admin/posts/${encodeURIComponent(id)}`);
    post = response.data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.isForbidden)) {
      notFound();
    }

    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        trail={[
          { name: t.admin.nav.dashboard, path: '/dashboard' },
          { name: t.admin.nav.posts, path: '/dashboard/posts' },
          { name: post.title, path: `/dashboard/posts/${post.id}` },
        ]}
      />

      <h1 className="mt-4 text-[length:var(--step-h1)] font-bold text-navy">{post.title}</h1>

      <div className="mt-6">
        <PostEditor post={post} />
      </div>
    </div>
  );
}
