'use client';
import { useState, useEffect, type FormEvent } from 'react';
import { api } from '@/lib/api/browser';
import { Button } from '@/components/ui/button';

export const base = '/admin/growth-hub';
export const input = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy';
export const box = 'rounded-xl border border-line bg-white p-5';
export type Row = {
  id: number;
  title: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
};
export function Field({
  name,
  label,
  value = '',
  type = 'text',
  required = false,
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className={input} name={name} type={type} defaultValue={value} required={required} />
    </label>
  );
}
export function Select({
  name,
  label,
  values,
  value,
}: {
  name: string;
  label: string;
  values: string[];
  value?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select name={name} className={input} defaultValue={value ?? values[0]}>
        {values.map((v) => (
          <option key={v} value={v}>
            {v.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Records({ kind, draft }: { kind: 'goals' | 'tasks' | 'ideas'; draft?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [open, setOpen] = useState(Boolean(draft));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [view, setView] = useState('list');
  async function load(p = 1, search = q) {
    setLoading(true);
    try {
      const r = await api<{ data: Row[]; meta: { last_page: number } }>(`${base}/${kind}`, {
        query: { q: search, page: p },
      });
      setRows(r.data);
      setPage(p);
      setLast(r.meta.last_page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load records.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    api<{ data: Row[]; meta: { last_page: number } }>(`${base}/${kind}`, { query: { page: 1 } })
      .then((r) => {
        if (live) {
          setRows(r.data);
          setPage(1);
          setLast(r.meta.last_page);
        }
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not load records.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [kind]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data: Record<string, unknown> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      data[k] = v === '' ? null : v;
    });
    for (const k of ['parent_id', 'goal_id', 'progress', 'focus_rank'])
      if (data[k] != null) data[k] = Number(data[k]);
    try {
      await api(`${base}/${kind}${edit ? `/${edit.id}` : ''}`, {
        method: edit ? 'PUT' : 'POST',
        body: data,
      });
      setOpen(false);
      setNotice('Saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: Row) {
    if (!window.confirm(`Delete “${row.title}”?`)) return;
    setBusy(true);
    try {
      await api(`${base}/${kind}/${row.id}`, { method: 'DELETE' });
      await load();
      setNotice('Deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }
  const text = (key: string) =>
    String(edit?.[key] ?? (draft && key === 'description' ? draft : ''));
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-xl font-bold capitalize">
          {kind === 'goals'
            ? 'Future Plan & Goals'
            : kind === 'tasks'
              ? 'Daily focus & tasks'
              : 'Idea Inbox'}
        </h2>
        <Button
          onClick={() => {
            setEdit(null);
            setOpen(true);
          }}
        >
          Add {kind.slice(0, -1)}
        </Button>
        {kind === 'goals' && (
          <Button variant="secondary" onClick={() => setView(view === 'list' ? 'board' : 'list')}>
            {view === 'list' ? 'Kanban' : 'List'}
          </Button>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          aria-label="Search records"
          className={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title"
        />
        <Button disabled={loading}>Search</Button>
      </form>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {open && (
        <form key={`${edit?.id ?? 'new'}-${kind}`} onSubmit={save} className={`${box} space-y-4`}>
          <h3 className="font-bold">
            {edit ? 'Edit' : 'New'} {kind.slice(0, -1)}
          </h3>
          <Field name="title" label="Title" value={text('title')} required />
          <label className="block">
            Description
            <textarea
              className={input}
              name="description"
              defaultValue={text('description')}
              maxLength={12000}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="category" label="Category" value={text('category') || 'Other'} />
            <Select
              name="status"
              label="Status"
              values={['pending', 'in_progress', 'completed', 'skipped', 'archived']}
              value={text('status') || 'pending'}
            />
            {kind !== 'ideas' && (
              <Select
                name="priority"
                label="Priority"
                values={['medium', 'low', 'high', 'critical']}
                value={text('priority') || 'medium'}
              />
            )}{' '}
            {kind === 'goals' && (
              <>
                <Select
                  name="horizon"
                  label="Planning horizon"
                  values={[
                    'vision',
                    'long_term',
                    'annual',
                    'quarterly',
                    'monthly',
                    'weekly',
                    'daily',
                  ]}
                  value={text('horizon') || 'annual'}
                />
                <Field
                  name="parent_id"
                  label="Parent goal ID (optional)"
                  type="number"
                  value={text('parent_id')}
                />
                <Field
                  name="progress"
                  label="Progress % (0–100)"
                  type="number"
                  value={text('progress') || 0}
                />
                <Field
                  name="start_date"
                  label="Start date"
                  type="date"
                  value={text('start_date')}
                />
                <Field
                  name="target_date"
                  label="Target date"
                  type="date"
                  value={text('target_date')}
                />
                <Field name="why" label="Why it matters" value={text('why')} />
                <Field name="notes" label="Notes" value={text('notes')} />
              </>
            )}
            {kind === 'tasks' && (
              <>
                <Field
                  name="goal_id"
                  label="Linked goal ID"
                  type="number"
                  value={text('goal_id')}
                />
                <Field
                  name="due_at"
                  label="Due date/time (UTC)"
                  type="datetime-local"
                  value={text('due_at').replace(' ', 'T').slice(0, 16)}
                />
                <Field name="source" label="Source" value={text('source') || 'manual'} />
                <Field
                  name="focus_date"
                  label="Top 3 date (optional)"
                  type="date"
                  value={text('focus_date')}
                />
                <Field
                  name="focus_rank"
                  label="Top 3 slot (1, 2 or 3)"
                  type="number"
                  value={text('focus_rank')}
                />
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {loading ? (
        <p role="status">Loading…</p>
      ) : rows.length === 0 ? (
        <p className={box}>No {kind} yet. Add your first item.</p>
      ) : (
        <div className={view === 'board' ? 'grid gap-4 md:grid-cols-3' : 'space-y-3'}>
          {(view === 'board' ? ['pending', 'in_progress', 'completed'] : ['all']).map((status) => (
            <div key={status} className="space-y-3">
              {view === 'board' && (
                <h3 className="font-semibold capitalize">{status.replace('_', ' ')}</h3>
              )}
              {rows
                .filter((r) => status === 'all' || r.status === status)
                .map((row) => (
                  <article key={row.id} className={box}>
                    <div className="flex flex-wrap gap-2">
                      <h3 className="mr-auto font-semibold">
                        #{row.id} {row.title}
                      </h3>
                      <span className="text-sm">{row.status?.replace('_', ' ')}</span>
                    </div>
                    {row.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
                        {row.description}
                      </p>
                    )}
                    {kind === 'goals' && (
                      <>
                        <p className="mt-2 text-sm">
                          {String(row.horizon)} · {Number(row.progress)}% · Parent:{' '}
                          {String(row.parent_id ?? 'None')} · Target:{' '}
                          {String(row.target_date ?? 'Not set')}
                        </p>
                        <progress className="mt-2 w-full" max={100} value={Number(row.progress)} />
                      </>
                    )}
                    {kind === 'tasks' && (
                      <p className="mt-2 text-sm">
                        Due: {String(row.due_at ?? 'Not set')} · Focus:{' '}
                        {String(row.focus_date ?? 'Not selected')}{' '}
                        {row.focus_rank ? `#${row.focus_rank}` : ''}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEdit(row);
                          setOpen(true);
                        }}
                      >
                        View / Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void remove(row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={page <= 1 || loading}
          onClick={() => void load(page - 1)}
        >
          Previous
        </Button>
        <span>
          {page} / {last}
        </span>
        <Button
          variant="secondary"
          disabled={page >= last || loading}
          onClick={() => void load(page + 1)}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
