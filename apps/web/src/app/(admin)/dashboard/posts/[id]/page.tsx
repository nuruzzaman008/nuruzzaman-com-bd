import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, type Post } from '@nuruzzaman/contracts';

import { PostEditor } from '@/features/dashboard/post-editor';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { sessionApi } from '@/lib/api/server';
import { privateMetadata } from '@/lib/seo';

export const metadata: Metadata = privateMetadata('আর্টিকেল সম্পাদনা');

export default async function EditPostPage(props: { params: Promise<{ id: string }> }) {
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
          { name: 'ড্যাশবোর্ড', path: '/dashboard' },
          { name: 'আর্টিকেল', path: '/dashboard/posts' },
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
