'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api/browser';
import { useLocale } from '@/lib/i18n/locale-provider';

/**
 * The number beside "Student questions" in the dashboard menu: questions
 * still waiting for an answer. Checked when the menu appears and every two
 * minutes while the tab is open; nothing is drawn at zero, or for staff who
 * cannot see course questions.
 */
export function UnansweredQuestionsBadge() {
  const { t } = useLocale();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (document.visibilityState === 'hidden') return;

      try {
        const response = await api<{ data: { count: number } }>(
          '/admin/course-questions/unanswered-count',
        );
        if (!cancelled) setCount(response.data.count);
      } catch {
        // Not allowed, or offline: show nothing rather than a wrong number.
      }
    }

    void load();
    const timer = setInterval(() => void load(), 120_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className="font-latin ms-2 inline-grid min-w-5 place-items-center rounded-full bg-amber px-1.5 text-xs font-bold text-navy"
      aria-label={`${count} ${t.admin.questions.tabUnanswered}`}
    >
      {count}
    </span>
  );
}
