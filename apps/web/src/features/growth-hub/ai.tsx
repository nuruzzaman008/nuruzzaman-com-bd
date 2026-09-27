'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api/browser';
import { Button } from '@/components/ui/button';
import { base, box, input, Field, Select, type Row } from './records';

type Provider = {
  id: number;
  provider: string;
  display_name: string;
  model: string;
  enabled: boolean;
  is_default: boolean;
  priority: number;
  purpose: string;
  connection_status: string;
  masked_key: string | null;
  base_url?: string;
  monthly_budget?: number;
  input_rate?: number;
  output_rate?: number;
};
export function AISettings() {
  const [rows, setRows] = useState<Provider[]>([]);
  const [edit, setEdit] = useState<Provider | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setRows((await api<{ data: Provider[] }>(`${base}/providers`)).data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load providers.');
    }
  }
  useEffect(() => {
    let live = true;
    api<{ data: Provider[] }>(`${base}/providers`)
      .then((r) => {
        if (live) setRows(r.data);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not load providers.');
      });
    return () => {
      live = false;
    };
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = e.currentTarget;
    const f = new FormData(form);
    const body: Record<string, unknown> = Object.fromEntries(f);
    for (const key of ['enabled', 'is_default', 'clear_key']) body[key] = f.has(key);
    for (const key of ['priority', 'monthly_budget', 'input_rate', 'output_rate'])
      body[key] = f.get(key) === '' ? null : Number(f.get(key));
    try {
      await api(`${base}/providers${edit ? `/${edit.id}` : ''}`, {
        method: edit ? 'PUT' : 'POST',
        body,
      });
      form.reset();
      setEdit(null);
      setNotice('Provider saved. Keys remain on the server.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }
  async function test(id: number) {
    setBusy(true);
    setError('');
    try {
      await api(`${base}/providers/${id}/test`, { method: 'POST' });
      setNotice('Connection succeeded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed.');
    } finally {
      setBusy(false);
      await load();
    }
  }
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">AI Providers</h2>
      <p className="text-sm text-muted">
        No provider is connected by default. Test Connection sends a small paid request when
        configured. Budget estimates require current USD prices per million tokens; provider billing
        remains authoritative.
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((p) => (
          <article className={box} key={p.id}>
            <h3 className="font-bold">{p.display_name}</h3>
            <p>
              {p.provider} / {p.model} · {p.connection_status} · {p.masked_key ?? 'No key'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEdit(p)}>
                Edit
              </Button>
              <Button size="sm" disabled={busy || !p.masked_key} onClick={() => void test(p.id)}>
                Test Connection
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm('Delete this provider configuration?')) return;
                  setBusy(true);
                  try {
                    await api(`${base}/providers/${p.id}`, { method: 'DELETE' });
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Delete failed.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
      <form
        key={edit?.id ?? 'new'}
        onSubmit={save}
        className={`${box} space-y-4`}
        autoComplete="off"
      >
        <h3 className="font-bold">{edit ? 'Edit provider' : 'Add provider'}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            name="provider"
            label="Provider"
            values={['openai', 'gemini', 'anthropic', 'openrouter', 'custom']}
            value={edit?.provider}
          />
          <Field name="display_name" label="Display name" value={edit?.display_name} required />
          <Field name="model" label="Model ID (from your provider)" value={edit?.model} required />
          <Field name="api_key" label="API key (blank keeps saved key)" type="password" />
          <Field
            name="base_url"
            label="Custom base URL (server allowlist required)"
            value={edit?.base_url ?? ''}
          />
          <Select
            name="purpose"
            label="Purpose"
            values={[
              'general',
              'email',
              'bnbc',
              'content',
              'technology',
              'business',
              'research',
              'knowledge',
            ]}
            value={edit?.purpose}
          />
          <Field
            name="priority"
            label="Fallback priority (lower first)"
            type="number"
            value={edit?.priority ?? 10}
          />
          <Field
            name="monthly_budget"
            label="Monthly budget USD (optional)"
            value={edit?.monthly_budget ?? ''}
          />
          <Field
            name="input_rate"
            label="Input USD / million tokens"
            value={edit?.input_rate ?? ''}
          />
          <Field
            name="output_rate"
            label="Output USD / million tokens"
            value={edit?.output_rate ?? ''}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <label>
            <input type="checkbox" name="enabled" defaultChecked={edit?.enabled} /> Enabled
          </label>
          <label>
            <input type="checkbox" name="is_default" defaultChecked={edit?.is_default} /> Default
            for purpose
          </label>
          <label>
            <input type="checkbox" name="clear_key" /> Remove saved key
          </label>
        </div>
        <div className="flex gap-2">
          <Button disabled={busy}>{busy ? 'Working…' : 'Save provider'}</Button>
          {edit && (
            <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
              New provider
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

type Message = { id: number; role: string; content: string; provider: string; model: string };
export function Chat({ onPlan }: { onPlan?: (text: string) => void }) {
  const [chats, setChats] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function load() {
    try {
      setChats(
        (
          await api<{ data: Row[] }>(`${base}/conversations`, {
            query: { q: query, archived: archived ? 1 : 0 },
          })
        ).data,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load chats.');
    }
  }
  useEffect(() => {
    let live = true;
    api<{ data: Row[] }>(`${base}/conversations`, { query: { archived: archived ? 1 : 0 } })
      .then((r) => {
        if (live) setChats(r.data);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not load chats.');
      });
    return () => {
      live = false;
    };
  }, [archived]);
  async function open(row: Row) {
    setSelected(row);
    setMessages([]);
    setLoading(true);
    try {
      setMessages(
        (await api<{ data: Message[] }>(`${base}/conversations/${row.id}/messages`)).data,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load conversation.');
    } finally {
      setLoading(false);
    }
  }
  async function change(action: 'rename' | 'archive' | 'delete') {
    if (!selected) return;
    const title =
      action === 'rename' ? window.prompt('Conversation title', selected.title) : selected.title;
    if (!title) return;
    if (action === 'delete' && !window.confirm('Delete this conversation and messages?')) return;
    setBusy(true);
    try {
      await api(`${base}/conversations/${selected.id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        body:
          action === 'delete'
            ? undefined
            : { title, archived: action === 'archive' ? !archived : archived },
      });
      setSelected(null);
      setMessages([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ data: Message[] }>(`${base}/conversations/${selected.id}/messages`, {
        method: 'POST',
        body: { content: prompt, context: contexts },
      });
      setMessages(r.data);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI unavailable. Configure a provider.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Ask My AI</h2>
      <p className="rounded-lg bg-amber-soft p-3 text-sm">
        AI suggestions require your review. No verified BNBC source is connected in Phase 1. AI
        cannot write to your goals or tasks. Review a proposed roadmap, then save the approved steps
        yourself.
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className={`${box} space-y-3`}>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ data: Row }>(`${base}/conversations`, {
                  method: 'POST',
                  body: { title: 'New conversation' },
                });
                await load();
                await open(r.data);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Create failed.');
              } finally {
                setBusy(false);
              }
            }}
          >
            New Chat
          </Button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <input
              aria-label="Search conversations"
              className={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button size="sm" variant="secondary">
              Search
            </Button>
          </form>
          <label>
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => {
                setArchived(e.target.checked);
                setSelected(null);
                setMessages([]);
              }}
            />{' '}
            Archived
          </label>
          {!chats.length && <p className="text-sm">No conversations yet.</p>}
          {chats.map((c) => (
            <button
              disabled={busy || loading}
              className={`block w-full rounded-lg p-2 text-left ${c.id === selected?.id ? 'bg-blue-soft' : 'hover:bg-surface'}`}
              key={c.id}
              onClick={() => void open(c)}
            >
              {c.title}
            </button>
          ))}
        </aside>
        <div className={`${box} min-w-0 space-y-4`}>
          {selected ? (
            <>
              <h3 className="font-bold">{selected.title}</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void change('rename')}
                >
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void change('archive')}
                >
                  {archived ? 'Unarchive' : 'Archive'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void change('delete')}
                >
                  Delete
                </Button>
              </div>
              {loading ? (
                <p role="status">Loading conversation…</p>
              ) : (
                <div className="max-h-[480px] space-y-4 overflow-y-auto">
                  {messages.map((m) => (
                    <article key={m.id} className="rounded-lg bg-surface p-3">
                      <p className="text-xs font-bold">
                        {m.role === 'assistant'
                          ? `AI suggestion · ${m.provider} / ${m.model}`
                          : 'You'}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words">{m.content}</p>
                      {m.role === 'assistant' && onPlan && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onPlan(m.content)}
                        >
                          Review as goal draft
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <form onSubmit={send} className="space-y-3">
                <fieldset>
                  <legend className="text-sm font-semibold">
                    Share selected context with configured providers (optional)
                  </legend>
                  <p className="text-xs text-muted">
                    This conversation’s recent messages are also sent. Start a new chat to leave
                    earlier context behind.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {['goals', 'tasks', 'ideas'].map((c) => (
                      <label key={c}>
                        <input
                          type="checkbox"
                          checked={contexts.includes(c)}
                          onChange={(e) =>
                            setContexts(
                              e.target.checked ? [...contexts, c] : contexts.filter((x) => x !== c),
                            )
                          }
                        />{' '}
                        {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  Message
                  <textarea
                    className={input}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={4000}
                    required
                    rows={4}
                  />
                </label>
                <Button disabled={busy || loading || archived}>
                  {busy ? 'Generating…' : 'Send'}
                </Button>
              </form>
            </>
          ) : (
            <p>
              Select a conversation or start a new chat. Configure an AI provider in Settings first.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
