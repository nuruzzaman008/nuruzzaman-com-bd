'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PostComment } from '@nuruzzaman/contracts';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * Approve, reject or spam one comment.
 *
 * Three buttons rather than a dropdown and a save: the queue is read one row at
 * a time, and the decision is one click either way. The server audits each one,
 * so a wrong click is recoverable and traceable rather than silent.
 */
export function CommentModeration({ comment }: { comment: PostComment }) {
  const { t } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function moderate(status: 'approved' | 'rejected' | 'spam') {
    setBusy(status);
    setFailed(false);

    try {
      await api(`/admin/comments/${comment.id}/moderate`, {
        method: 'POST',
        body: { status },
      });

      router.refresh();
    } catch {
      // The message is the same either way: the row is still in the queue and
      // the click can be repeated.
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy !== null || comment.status === 'approved'}
          onClick={() => void moderate('approved')}
        >
          {busy === 'approved' ? t.admin.commentQueue.working : t.admin.commentQueue.approve}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null || comment.status === 'rejected'}
          onClick={() => void moderate('rejected')}
        >
          {busy === 'rejected' ? t.admin.commentQueue.working : t.admin.commentQueue.reject}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy !== null || comment.status === 'spam'}
          onClick={() => void moderate('spam')}
        >
          {busy === 'spam' ? t.admin.commentQueue.working : t.admin.commentQueue.spam}
        </Button>
      </div>

      {failed ? (
        <Callout tone="danger" className="mt-2" role="alert">
          {t.admin.commentQueue.failed}
        </Callout>
      ) : null}
    </div>
  );
}
