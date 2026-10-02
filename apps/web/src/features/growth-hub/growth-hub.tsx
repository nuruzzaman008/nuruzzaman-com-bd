'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api/browser';
import { Button } from '@/components/ui/button';
import { base, box, input, Field, Records, type Row } from './records';
import { AISettings, Chat } from './ai';
import { GmailConnection } from './gmail';

type Dashboard = {
  name: string;
  date: string;
  hour: number;
  focus: Row[];
  overdue: Row[];
  goals: Row[];
  ideas: Row[];
  counts: { tasks: number; completed: number; goals: number; ideas: number };
  gmail: string;
  ai_configured: boolean;
  preferences: Preference | null;
};
type Preference = {
  display_name: string;
  profession: string;
  timezone: string;
  interests: string;
  cards: string | null;
};
const tabs = [
  'Dashboard',
  'Today',
  'Future Plan',
  'Idea Inbox',
  'Ask My AI',
  'AI History',
  'Settings',
];
const cards = ['focus', 'goals', 'tasks', 'ideas', 'ai', 'gmail'];
export function GrowthHub() {
  const [goalDraft, setGoalDraft] = useState<string>();
  const [tab, setTab] = useState('Dashboard');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (tab !== 'Dashboard' && tab !== 'Today') return;
    let live = true;
    api<{ data: Dashboard }>(`${base}/dashboard`)
      .then((r) => {
        if (live) {
          setData(r.data);
          setError('');
        }
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Growth Hub could not load.');
      });
    return () => {
      live = false;
    };
  }, [tab]);
  const enabled = data?.preferences?.cards
    ? (JSON.parse(data.preferences.cards) as string[])
    : cards;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue">PRIVATE · SUPER ADMIN</p>
        <h1 className="mt-1 text-3xl font-bold">My Growth Hub</h1>
        <p className="mt-2 text-muted">Your goals, daily focus, ideas and AI workspace.</p>
      </header>
      <nav
        aria-label="Growth Hub sections"
        className="flex flex-wrap gap-2 border-b border-line pb-4"
      >
        {tabs.map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'secondary'} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="rounded-lg border border-danger p-4 text-danger">
          {error}
        </p>
      )}
      {tab === 'Dashboard' &&
        (!data ? (
          error ? null : (
            <p role="status">Loading your workspace…</p>
          )
        ) : (
          <>
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-xl font-bold">
                Good {data.hour < 12 ? 'morning' : data.hour < 18 ? 'afternoon' : 'evening'},{' '}
                {data.name}
              </h2>
              <span>{data.date}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {enabled.includes('focus') && (
                <article className={box}>
                  <h3 className="font-bold">Today’s Top 3</h3>
                  {data.focus.length ? (
                    data.focus.map((r) => (
                      <p key={r.id} className="mt-2">
                        {String(r.focus_rank)}. {r.title} — {r.status}
                      </p>
                    ))
                  ) : (
                    <p className="mt-2 text-muted">Choose up to three tasks in Today.</p>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setTab('Today')}>
                    Open Today
                  </Button>
                </article>
              )}
              {enabled.includes('goals') && (
                <article className={box}>
                  <h3 className="font-bold">Future Plan</h3>
                  <p>{data.counts.goals} goals</p>
                  {data.goals.slice(0, 3).map((g) => (
                    <div key={g.id} className="mt-2">
                      <p>
                        {g.title} · {Number(g.progress)}%
                      </p>
                      <progress max={100} value={Number(g.progress)} className="w-full" />
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setTab('Future Plan')}>
                    View goals
                  </Button>
                </article>
              )}
              {enabled.includes('tasks') && (
                <article className={box}>
                  <h3 className="font-bold">Task progress</h3>
                  <p className="my-3 text-2xl font-bold">
                    {data.counts.completed} / {data.counts.tasks}
                  </p>
                  <p>Completed tasks</p>
                  <Button size="sm" variant="ghost" onClick={() => setTab('Today')}>
                    Manage tasks
                  </Button>
                </article>
              )}
              {enabled.includes('ideas') && (
                <article className={box}>
                  <h3 className="font-bold">Latest ideas</h3>
                  {data.ideas.length ? (
                    data.ideas.map((i) => (
                      <p className="mt-2" key={i.id}>
                        {i.title}
                      </p>
                    ))
                  ) : (
                    <p className="mt-2 text-muted">Your next idea starts here.</p>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setTab('Idea Inbox')}>
                    Open inbox
                  </Button>
                </article>
              )}
              {enabled.includes('ai') && (
                <article className={box}>
                  <h3 className="font-bold">Ask My AI</h3>
                  <p className="my-2">
                    {data.ai_configured
                      ? 'Provider configured. Connection can be tested in Settings.'
                      : 'Not configured. Add a provider in Settings.'}
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => setTab('Ask My AI')}>
                    Open chat
                  </Button>
                </article>
              )}
              {enabled.includes('gmail') && (
                <article className={box}>
                  <h3 className="font-bold">Email Intelligence</h3>
                  <GmailConnection />
                </article>
              )}
            </div>
            <section className={box}>
              <h3 className="font-bold">Overdue tasks</h3>
              {data.overdue.length ? (
                data.overdue.map((t) => (
                  <p className="mt-2" key={t.id}>
                    {t.title} · {String(t.due_at)}
                  </p>
                ))
              ) : (
                <p className="mt-2 text-muted">No overdue tasks.</p>
              )}
            </section>
            <p className="text-sm text-muted">
              Learning, verified BNBC sources, projects and CRM arrive in the following phases. No
              demo engineering requirements are presented as verified.
            </p>
          </>
        ))}
      {tab === 'Today' && (
        <>
          <Records kind="tasks" />
          <DailyReview date={data?.date ?? ''} />
        </>
      )}
      {tab === 'Future Plan' && <Records kind="goals" draft={goalDraft} />}
      {tab === 'Idea Inbox' && <Records kind="ideas" />}
      {tab === 'Ask My AI' && (
        <Chat
          onPlan={(text) => {
            setGoalDraft(text);
            setTab('Future Plan');
          }}
        />
      )}
      {tab === 'AI History' && <AIHistory />}
      {tab === 'Settings' && (
        <>
          <Preferences />
          <AISettings />
        </>
      )}
    </div>
  );
}
function DailyReview({ date }: { date: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setRows((await api<{ data: Row[] }>(`${base}/reviews`)).data);
  }
  useEffect(() => {
    let live = true;
    api<{ data: Row[] }>(`${base}/reviews`)
      .then((r) => {
        if (live) setRows(r.data);
      })
      .catch(() => {
        if (live) setStatus('Could not load reviews.');
      });
    return () => {
      live = false;
    };
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`${base}/reviews`, {
        method: 'PUT',
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      setStatus('Review saved.');
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Review failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`${box} space-y-4`}>
      <h2 className="text-xl font-bold">End of day review</h2>
      <form onSubmit={save} className="space-y-3">
        <Field name="review_date" label="Review date" type="date" value={date} required />
        {[
          ['completed', 'What did I complete?'],
          ['learned', 'What did I learn?'],
          ['pending', 'What is pending?'],
          ['tomorrow', 'What moves to tomorrow?'],
          ['lesson', 'Lessons or mistakes'],
        ].map(([name, label]) => (
          <label className="block" key={name}>
            {label}
            <textarea className={input} name={name} maxLength={5000} />
          </label>
        ))}
        <Button disabled={busy}>Save daily review</Button>
      </form>
      <p role="status">{status}</p>
      <h3 className="font-bold">Previous reviews</h3>
      {rows.length ? (
        rows.map((r) => (
          <details key={r.id}>
            <summary>{String(r.review_date)}</summary>
            {['completed', 'learned', 'pending', 'tomorrow', 'lesson'].map((k) => (
              <p key={k} className="whitespace-pre-wrap">
                {k}: {String(r[k] ?? '—')}
              </p>
            ))}
          </details>
        ))
      ) : (
        <p>No reviews yet.</p>
      )}
    </section>
  );
}
function Preferences() {
  const [pref, setPref] = useState<Preference | null>(null);
  const [selected, setSelected] = useState(cards);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ data: Preference | null }>(`${base}/preferences`)
      .then((r) => {
        setPref(r.data);
        if (r.data?.cards) setSelected(JSON.parse(r.data.cards));
      })
      .catch(() => setStatus('Could not load preferences.'));
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`${base}/preferences`, {
        method: 'PUT',
        body: { ...Object.fromEntries(new FormData(e.currentTarget)), cards: selected },
      });
      setStatus('Preferences saved. Open Dashboard to see changes.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      key={pref ? JSON.stringify(pref) : 'default'}
      className={`${box} space-y-4`}
    >
      <h2 className="text-xl font-bold">Preferences</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="display_name" label="Preferred name" value={pref?.display_name ?? ''} />
        <Field name="profession" label="Profession" value={pref?.profession ?? ''} />
        <Field name="timezone" label="Timezone" value={pref?.timezone ?? 'Asia/Dhaka'} required />
        <Field name="interests" label="Primary goals and interests" value={pref?.interests ?? ''} />
      </div>
      <fieldset>
        <legend>Dashboard cards</legend>
        <div className="flex flex-wrap gap-4">
          {cards.map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={selected.includes(c)}
                onChange={(e) =>
                  setSelected(e.target.checked ? [...selected, c] : selected.filter((v) => v !== c))
                }
              />{' '}
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <Button disabled={busy}>Save preferences</Button>
      <p role="status">{status}</p>
    </form>
  );
}
function AIHistory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    api<{ data: Row[]; meta: { last_page: number } }>(`${base}/ai-history`, { query: { page } })
      .then((r) => {
        if (live) {
          setRows(r.data);
          setLast(r.meta.last_page);
        }
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'History unavailable.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [page]);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">AI usage & history</h2>
      <p>
        Cost is estimated when rates are configured. No secrets or raw provider errors are logged
        here.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading…</p>
      ) : !rows.length ? (
        <p className={box}>No AI requests yet.</p>
      ) : (
        rows.map((r) => (
          <article className={box} key={r.id}>
            <p>
              {String(r.created_at)} · {String(r.provider)} / {String(r.model)}
            </p>
            <p>
              {String(r.feature)} · {r.status} · {String(r.duration_ms)} ms
            </p>
            <p>
              Tokens: {String(r.input_tokens ?? 'unknown')} in /{' '}
              {String(r.output_tokens ?? 'unknown')} out · USD:{' '}
              {String(r.estimated_cost ?? 'not available')}
            </p>
          </article>
        ))
      )}
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={page >= last} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </section>
  );
}
