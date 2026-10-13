'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  RefreshCw,
  CheckCheck,
  Check,
  Search,
  Plus,
  Phone,
  Info,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import styles from './whatsapp-inbox.module.css';
import { api } from '@/lib/api/browser';
import { Button } from '@/components/ui/button';
import { parseContactsCsv } from './csv';
import { WhatsAppCalls } from './whatsapp-calls';
import { useWhatsAppRuntime } from './whatsapp-runtime';
import { useWhatsAppTheme } from './use-whatsapp-theme';

const base = '/admin/whatsapp';
const field = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-navy';
type Contact = {
  id: number;
  phone: string;
  name: string | null;
  opt_in: boolean;
  consent_source: string | null;
  opt_out: boolean;
  suppressed: boolean;
  stage: string;
  tags: string | null;
  notes: string | null;
  assigned_to: number | null;
  unread: number;
  last_inbound_at: string | null;
  last_message_at?: string | null;
};
type Message = {
  id: number;
  direction: string;
  kind: string;
  body: string | null;
  status: string;
  mode: string;
  template: string | null;
  media_id: string | null;
  filename: string | null;
  error_code: string | null;
  error_details: string | null;
  occurred_at: string;
  actor_id: number | null;
  reactions?: string[];
};
type Overview = {
  confirmation_template?: string;
  confirmation_approved?: boolean;
  confirmation_pending?: number;
  configured: boolean;
  enabled: boolean;
  campaign_enabled: boolean;
  test_received: boolean;
  remaining: number;
  daily_limit: number;
  template: string;
  language: string;
  phone_number_id: string;
  waba_id: string;
  api_version: string;
  webhook_url: string;
  webhook_at: string | null;
  secret_configured: boolean;
  verify_configured: boolean;
  unread: number;
  contacts: number;
  whatsapp_confirmed?: number;
  whatsapp_unverified?: number;
  queued: number;
  recent_statuses: { status: string; total: number }[];
};
type Thread = {
  data: Message[];
  contact: Contact;
  reply_window_open: boolean;
  older_before: number | null;
};
const blank = {
  name: '',
  phone: '',
  opt_in: false,
  consent_source: '',
  opt_out: false,
  suppressed: false,
  stage: 'open',
  notes: '',
  tags: '',
  assigned_to: '',
};
const statusName: Record<string, string> = {
  queued: 'অপেক্ষায়',
  sending: 'পাঠানো হচ্ছে',
  accepted: 'Meta গ্রহণ করেছে',
  sent: 'পাঠানো হয়েছে',
  delivered: 'পৌঁছেছে',
  read: 'পড়েছে',
  received: 'প্রাপ্ত',
  uncertain: 'ফল অনিশ্চিত',
  failed: 'ব্যর্থ',
  cancelled: 'বাতিল',
};
function time(value: string | null) {
  if (!value) return '—';
  const date = new Date(/(Z|[+-]\d\d:\d\d)$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  return date.toLocaleString('bn-BD', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
function messageTime(value: string) {
  const date = new Date(/(Z|[+-]\d\d:\d\d)$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  return date
    .toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();
}

function MessageMedia({ message }: { message: Message }) {
  const [failed, setFailed] = useState(false);
  const href = '/api/v1' + base + '/messages/' + message.id + '/media';
  return (
    <div className={styles.media}>
      {message.kind === 'image' && !failed && (
        // The private session cookie must travel with this request; Next image optimization cannot forward it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={href}
          alt={message.filename || 'WhatsApp image'}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {failed && <p className="text-xs">Image preview unavailable. Open image to retry.</p>}
      <a
        className="flex items-center gap-1 text-sm font-semibold underline"
        href={href}
        target="_blank"
        rel="noopener"
      >
        <Paperclip size={14} />
        {message.kind === 'image' ? 'Open image' : message.filename || 'Download ' + message.kind}
      </a>
    </div>
  );
}

export function WhatsAppInbox({ superAdmin }: { superAdmin: boolean }) {
  const { theme, setTheme } = useWhatsAppTheme();
  const runtime = useWhatsAppRuntime();
  const [tab, setTab] = useState('inbox'),
    [overview, setOverview] = useState<Overview | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]),
    [page, setPage] = useState(1),
    [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [selected, setSelected] = useState<number | null>(null);
  const [thread, setThread] = useState<Thread | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false),
    [body, setBody] = useState(''),
    [attachment, setAttachment] = useState<{
      media_id: string;
      kind: string;
      filename: string;
    } | null>(null);
  const [picked, setPicked] = useState<number[]>([]),
    [editor, setEditor] = useState<(typeof blank & { id?: number }) | null>(null);
  const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
  const sendKey = useRef<string | null>(null);
  const messagesElement = useRef<HTMLDivElement | null>(null);
  const followLatest = useRef(true);
  const latestMessageId = thread?.data.at(-1)?.id;
  useEffect(() => {
    if (followLatest.current && messagesElement.current) {
      messagesElement.current.scrollTop = messagesElement.current.scrollHeight;
    }
  }, [thread?.contact.id, latestMessageId]);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    runtime?.setContact(thread?.contact ?? null);
    return () => runtime?.setContact(null);
  }, [runtime, thread?.contact]);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    const load = async () => {
      try {
        const [o, list] = await Promise.all([
          api<{ data: Overview }>(base + '/overview', { signal: controller.signal }),
          api<{ data: Contact[]; meta: { last_page: number } }>(base + '/contacts', {
            query: { q: search, filter, page },
            signal: controller.signal,
          }),
        ]);
        if (!live) return;
        if (selected === null) {
          const target = Number(new URLSearchParams(window.location.search).get('contact'));
          if (Number.isSafeInteger(target) && target > 0) setSelected(target);
        }
        setOverview(o.data);
        setContacts(list.data);
        setLastPage(list.meta.last_page);
        if (selected) {
          const t = await api<Thread>(base + '/contacts/' + selected + '/messages', {
            signal: controller.signal,
          });
          if (!live) return;
          setThread((prev) => {
            const older =
              prev?.contact.id === selected
                ? prev.data.filter((m) => !t.data.some((n) => n.id === m.id))
                : [];
            return {
              ...t,
              data: [...older, ...t.data].sort((a, b) => a.id - b.id),
              older_before:
                prev?.contact.id === selected && older.length ? prev.older_before : t.older_before,
            };
          });
          if (
            document.visibilityState === 'visible' &&
            document.hasFocus() &&
            t.data.length &&
            t.contact.unread
          ) {
            await api(base + '/contacts/' + selected + '/read', {
              method: 'POST',
              body: { through: t.data[t.data.length - 1].id },
              signal: controller.signal,
            });
          }
        }
      } catch (e) {
        if (live && !controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Inbox load failed.');
      }
    };
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15000);
    return () => {
      live = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [selected, search, filter, page, revision]);
  useEffect(() => {
    void api<{ data: { id: number; name: string }[] }>(base + '/staff')
      .then((r) => setStaff(r.data))
      .catch(() => undefined);
  }, []);

  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }
  async function send(kind: string, test = false) {
    if (!selected) return;
    await action(async () => {
      sendKey.current ??= crypto.randomUUID();
      const r = await api<{ data: Message }>(base + '/contacts/' + selected + '/send', {
        method: 'POST',
        body: {
          client_key: sendKey.current,
          test,
          body: body || null,
          ...(attachment ?? {}),
          kind,
          ...(kind === 'template'
            ? { template: 'nbconsultant_intro_v1', body: null, manual: true }
            : {}),
        },
      });
      if (['uncertain', 'sending'].includes(r.data.status)) {
        setError(
          'পাঠানোর ফল অনিশ্চিত। একই request আবার পাঠালে duplicate send হবে না; নতুন করে পাঠানোর আগে Meta logs দেখুন।',
        );
        return;
      }
      sendKey.current = null;
      setBody('');
      setAttachment(null);
      setNotice(statusName[r.data.status] ?? r.data.status);
    });
  }
  async function saveContact(e: FormEvent) {
    e.preventDefault();
    if (!editor) return;
    await action(async () => {
      await api(base + '/contacts' + (editor.id ? '/' + editor.id : ''), {
        method: editor.id ? 'PATCH' : 'POST',
        body: {
          ...editor,
          consent_source: editor.consent_source || null,
          assigned_to: editor.assigned_to ? Number(editor.assigned_to) : null,
        },
      });
      setEditor(null);
      setNotice('Contact saved.');
    });
  }
  function edit(c: Contact) {
    setEditor({
      ...blank,
      id: c.id,
      phone: c.phone,
      name: c.name ?? '',
      opt_in: Boolean(c.opt_in),
      consent_source: c.consent_source ?? '',
      opt_out: Boolean(c.opt_out),
      suppressed: Boolean(c.suppressed),
      stage: c.stage,
      notes: c.notes ?? '',
      tags: c.tags ?? '',
      assigned_to: c.assigned_to ? String(c.assigned_to) : '',
    });
  }
  async function older() {
    if (!thread?.older_before || !selected) return;
    await action(async () => {
      const t = await api<Thread>(base + '/contacts/' + selected + '/messages', {
        query: { before: thread.older_before },
      });
      setThread(
        (prev) =>
          prev && { ...prev, older_before: t.older_before, data: [...t.data, ...prev.data] },
      );
    });
  }
  return (
    <div
      className={styles.workspace + (theme === 'light' ? ' ' + styles.light : '')}
      data-theme={theme}
    >
      <header className={styles.topbar}>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <MessageSquare className="text-emerald-600" />
            WhatsApp ইনবক্স
          </h1>
          <p className="mt-1 text-xs text-muted">NB Consultant · মেসেজ, replies ও কল</p>
        </div>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.themeSwitch}
            role="switch"
            aria-label="Dark theme"
            aria-checked={theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun size={15} />
            <span className={styles.switchTrack}>
              <span />
            </span>
            <Moon size={15} />
            <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>
          <Button variant="secondary" onClick={refresh}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </header>
      {overview && (
        <div className={styles.metrics} aria-label="WhatsApp overview">
          {[
            ['Unread replies', overview.unread],
            ['Contacts', overview.contacts],
            ['WhatsApp confirmed', overview.whatsapp_confirmed ?? '—'],
            ['Template allowance / 24h', overview.remaining],
            ['Queued messages', overview.queued],
          ].map(([label, value]) => (
            <div
              key={label}
              title={
                label === 'WhatsApp confirmed'
                  ? `Received messages or delivered/read messages confirm these contacts. Unverified: ${overview.whatsapp_unverified ?? '—'}. Unverified does not mean no WhatsApp.`
                  : undefined
              }
            >
              <p className="text-xs text-muted">{label}</p>
              <p className="font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}
      {overview && (
        <p className="text-xs text-muted">
          WhatsApp যাচাই হয়নি: {overview.whatsapp_unverified ?? '—'} · শুধু message পাওয়া বা
          delivered/read হওয়া নম্বর নিশ্চিত হিসেবে গণনা হয়। যাচাই হয়নি মানে WhatsApp নেই নয়।
        </p>
      )}
      <details className={styles.guide}>
        <summary>
          <Info size={15} /> দরকারি তথ্য · Sending & account
        </summary>
        <div className={styles.infoGrid}>
          <p>
            <strong>Business WhatsApp</strong>
            <span>
              +8809638038318 · {overview?.enabled ? 'Sending enabled' : 'Sending disabled'}
            </span>
          </p>
          <p>
            <strong>প্রথম message</strong>
            <span>সম্মতিপ্রাপ্ত contact-কে nbconsultant_intro_v1 · bn পাঠান।</span>
          </p>
          <p>
            <strong>২৪ ঘণ্টার reply window</strong>
            <span>Contact-এর সর্বশেষ message-এর পর ২৪ ঘণ্টা text ও attachment reply করা যায়।</span>
          </p>
          <p>
            <strong>Campaign ও limit</strong>
            <span>
              সর্বোচ্চ ৫০ template attempt / rolling ২৪ ঘণ্টা। Campaign{' '}
              {overview?.campaign_enabled ? 'চালু' : 'বন্ধ'}; test number 01711945113 আলাদা।
            </span>
          </p>
          <p>
            <strong>Payment confirmation</strong>
            <span>
              Payment সফল/অনুমোদিত হলে সম্মতি অনুযায়ী একবার পাঠায়। Utility template{' '}
              {overview?.confirmation_approved ? 'approved' : 'approval যাচাইয়ের অপেক্ষায়'} ·
              Waiting: {overview?.confirmation_pending ?? 0}।
            </span>
          </p>
          <p>
            <strong>কল ও notification</strong>
            <span>
              যেকোনো admin পেজে call popup পাবেন। Calls খুলে Enable ringtone ও microphone Allow
              করুন। নতুন message notification bell-এ আসবে।
            </span>
          </p>
          <p>
            <strong>Delivery status</strong>
            <span>
              Meta গ্রহণ করেছে ≠ পৌঁছেছে। Delivered = পৌঁছেছে; Read = পড়েছে। অনিশ্চিত send নিজে থেকে
              retry হয় না।
            </span>
          </p>
          <p>
            <strong>Chat history</strong>
            <span>
              Webhook connect হওয়ার পরের replies জমা হয়। Meta পুরোনো সব WhatsApp chat ফিরিয়ে দেয় না।
            </span>
          </p>
        </div>
      </details>
      {!runtime && (
        <WhatsAppCalls contact={thread?.contact ?? null} enabled={overview?.enabled ?? false} />
      )}
      <nav className="flex flex-wrap gap-2" aria-label="WhatsApp sections">
        {[
          ['inbox', 'ইনবক্স'],
          ['contacts', 'Contacts'],
          ...(superAdmin
            ? [
                ['campaign', 'Campaign'],
                ['settings', 'Connection & settings'],
              ]
            : []),
        ].map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? 'primary' : 'secondary'}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="rounded-lg border border-danger bg-white p-3 text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"
        >
          {notice}
        </p>
      )}
      {overview && !overview.enabled && (
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
          WhatsApp sending বন্ধ আছে। Super admin Connection & settings থেকে চালু করতে পারবেন।
          Replies পেতে signed Meta webhook connect করুন।
        </p>
      )}
      {tab !== 'settings' && tab !== 'inbox' && (
        <div className="flex flex-wrap gap-3">
          <label className="grow text-sm">
            Search
            <input
              className={field}
              value={search}
              placeholder="নাম, phone অথবা tags"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="text-sm">
            Filter
            <select
              className={field}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              {[
                ['all', 'All contacts'],
                ['unread', 'Unread'],
                ['open', 'Open'],
                ['resolved', 'Resolved'],
                ['opted_out', 'Opted out'],
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" onClick={() => setEditor({ ...blank })}>
            Add contact
          </Button>
        </div>
      )}
      {editor && (
        <form
          onSubmit={saveContact}
          className="grid gap-3 rounded-xl border border-line bg-white p-5 sm:grid-cols-2"
          aria-label="Contact details"
        >
          <h2 className="font-bold sm:col-span-2">{editor.id ? 'Edit contact' : 'New contact'}</h2>
          {(['name', 'phone', 'tags', 'consent_source'] as const).map((key) => (
            <label key={key} className="text-sm">
              {key === 'consent_source' ? 'Consent source' : key}
              <input
                required={key === 'phone' || (key === 'consent_source' && editor.opt_in)}
                className={field}
                value={editor[key]}
                onChange={(e) => setEditor({ ...editor, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="text-sm">
            Assigned admin
            <select
              className={field}
              value={editor.assigned_to}
              onChange={(e) => setEditor({ ...editor, assigned_to: e.target.value })}
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Conversation status
            <select
              className={field}
              value={editor.stage}
              onChange={(e) => setEditor({ ...editor, stage: e.target.value })}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            Private notes
            <textarea
              className={field}
              value={editor.notes}
              onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            {(['opt_in', 'opt_out', 'suppressed'] as const).map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={editor[key]}
                  onChange={(e) => setEditor({ ...editor, [key]: e.target.checked })}
                />{' '}
                {key}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} type="submit">
              Save contact
            </Button>
            <Button variant="secondary" onClick={() => setEditor(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {tab === 'inbox' && (
        <div className={styles.chatShell}>
          <aside className={styles.chatList} aria-label="Conversations">
            <div className={styles.chatListHeader}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Chats</h2>
                <button
                  type="button"
                  aria-label="New chat"
                  title="Add contact"
                  className={styles.newChat}
                  onClick={() => setEditor({ ...blank })}
                >
                  <Plus size={19} />
                </button>
              </div>
              <label className={styles.search}>
                <Search size={17} />
                <input
                  aria-label="Search chats"
                  value={search}
                  placeholder="Search or start a new chat"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <div className={styles.filters} aria-label="Chat filters">
                {[
                  ['all', 'All'],
                  ['unread', 'Unread'],
                  ['open', 'Open'],
                  ['resolved', 'Resolved'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => {
                      setFilter(key);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.contactRows}>
              {!contacts.length && (
                <p className="p-5 text-sm text-muted">
                  এখনো conversation নেই। Contact যোগ করুন বা reply আসার অপেক্ষা করুন।
                </p>
              )}
              {contacts.map((c) => (
                <button
                  key={c.id}
                  className={styles.contactRow}
                  aria-pressed={selected === c.id}
                  onClick={() => {
                    setSelected(c.id);
                    followLatest.current = true;
                    setThread(null);
                    setBody('');
                    setAttachment(null);
                    sendKey.current = null;
                  }}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {(c.name || c.phone).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <strong>{c.name || c.phone}</strong>
                      {c.last_message_at && (
                        <time className={styles.listTime}>{time(c.last_message_at)}</time>
                      )}
                      {c.unread > 0 && (
                        <span className="rounded-full bg-emerald-600 px-2 text-xs text-white">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted">{c.phone}</p>
                    <p className="mt-1 text-xs text-muted">
                      {c.opt_out || c.suppressed
                        ? 'Sending blocked'
                        : c.opt_in
                          ? '✓ Consent recorded'
                          : 'No sending consent'}{' '}
                      · {c.stage} {c.tags ? '· ' + c.tags : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <section className={styles.conversation}>
            {!thread ? (
              <div className="m-auto p-8 text-center text-muted">
                <MessageSquare className="mx-auto mb-3" size={38} />
                <p>{selected ? 'Conversation loading…' : 'বাম পাশ থেকে conversation বেছে নিন'}</p>
              </div>
            ) : (
              <>
                <div className={styles.conversationHeader}>
                  <span className={styles.avatar} aria-hidden="true">
                    {(thread.contact.name || thread.contact.phone).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold">{thread.contact.name || thread.contact.phone}</h2>
                    <p className="text-xs text-muted">
                      {thread.contact.phone} ·{' '}
                      {thread.reply_window_open ? 'Reply window open' : 'Template required'}
                    </p>
                  </div>
                  {runtime && (
                    <button
                      type="button"
                      className={styles.callButton}
                      aria-label="Open voice call controls"
                      title="Voice call & permission"
                      onClick={runtime.openCalls}
                    >
                      <Phone size={20} />
                    </button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => edit(thread.contact)}>
                    Contact details
                  </Button>
                </div>
                <details className={styles.contactInfo}>
                  <summary>
                    <ShieldCheck size={14} />{' '}
                    {thread.contact.opt_out || thread.contact.suppressed
                      ? 'Sending blocked'
                      : thread.contact.opt_in
                        ? 'Consent recorded'
                        : 'No template consent'}{' '}
                    · {thread.reply_window_open ? 'Reply window open' : 'Template required'} ·
                    Contact information
                  </summary>
                  <div className={styles.infoGrid}>
                    <p>
                      <strong>Consent source</strong>
                      <span>{thread.contact.consent_source || 'সম্মতি এখনো রেকর্ড করা হয়নি'}</span>
                    </p>
                    <p>
                      <strong>Last incoming message</strong>
                      <span>{time(thread.contact.last_inbound_at)}</span>
                    </p>
                    <p>
                      <strong>Status / tags</strong>
                      <span>
                        {thread.contact.stage} · {thread.contact.tags || 'No tags'}
                      </span>
                    </p>
                    <p>
                      <strong>Private notes</strong>
                      <span>{thread.contact.notes || 'No notes'}</span>
                    </p>
                  </div>
                </details>
                <div
                  className={styles.messages}
                  ref={messagesElement}
                  onScroll={(event) => {
                    const pane = event.currentTarget;
                    followLatest.current =
                      pane.scrollHeight - pane.clientHeight - pane.scrollTop < 80;
                  }}
                  aria-label="Messages"
                  aria-live="polite"
                >
                  {thread.older_before && (
                    <Button variant="secondary" size="sm" disabled={busy} onClick={older}>
                      Load older messages
                    </Button>
                  )}
                  {!thread.data.length && (
                    <p className="text-center text-sm text-muted">
                      এই contact-এর কোনো message history নেই।
                    </p>
                  )}
                  {thread.data.map((m) => (
                    <article
                      key={m.id}
                      className={
                        (m.direction === 'outbound' ? styles.outbound : styles.inbound) +
                        (m.reactions?.length ? ' ' + styles.reacted : '')
                      }
                    >
                      <span className={styles.messageText}>
                        {m.body ||
                          (m.template
                            ? 'Template · ' + m.template
                            : m.media_id
                              ? ''
                              : m.kind === 'interactive'
                                ? 'Interactive response'
                                : m.kind)}
                      </span>
                      {m.media_id && <MessageMedia message={m} />}
                      <span
                        className={styles.messageStamp}
                        title={time(m.occurred_at) + ' · ' + (statusName[m.status] || m.status)}
                      >
                        <time dateTime={m.occurred_at}>{messageTime(m.occurred_at)}</time>
                        <span
                          className="inline-flex items-center"
                          aria-label={statusName[m.status] || m.status}
                        >
                          {['read', 'delivered'].includes(m.status) && (
                            <CheckCheck
                              className={m.status === 'read' ? styles.read : ''}
                              size={12}
                            />
                          )}
                          {m.direction === 'outbound' &&
                            ['accepted', 'sent'].includes(m.status) && <Check size={12} />}
                          {['failed', 'uncertain', 'cancelled'].includes(m.status) && (
                            <span>!</span>
                          )}
                        </span>
                      </span>
                      <details className={styles.messageDetails}>
                        <summary aria-label="Message details" title="Message details">
                          ···
                        </summary>
                        <p>
                          {m.direction === 'inbound' ? 'Contact' : 'Team'} · {m.kind}
                          {m.mode === 'test' ? ' · TEST' : ''} · {time(m.occurred_at)} ·{' '}
                          {statusName[m.status] || m.status}
                          {m.template ? ' · ' + m.template + ' · bn' : ''}
                        </p>
                      </details>
                      {m.error_code && (
                        <p className="mt-2 text-xs text-danger">
                          Error {m.error_code}: {m.error_details}
                        </p>
                      )}
                      {!!m.reactions?.length && (
                        <span className={styles.reactions} aria-label="Message reactions">
                          {m.reactions.join(' ')}
                        </span>
                      )}
                    </article>
                  ))}
                </div>
                <div className={styles.composer}>
                  {thread.contact.opt_out || thread.contact.suppressed ? (
                    <p className="text-sm text-danger">
                      এই contact opted out অথবা suppressed; sending বন্ধ।
                    </p>
                  ) : (
                    <>
                      {!thread.reply_window_open && (
                        <p className="text-xs text-muted">
                          Text/attachment reply দিতে contact-এর গত ২৪ ঘণ্টার মধ্যে message থাকতে
                          হবে।
                        </p>
                      )}
                      <label className="sr-only" htmlFor="wa-reply">
                        Reply message
                      </label>
                      <textarea
                        id="wa-reply"
                        className={field}
                        rows={1}
                        value={body}
                        disabled={!thread.reply_window_open || busy}
                        placeholder="Type a message · Reply লিখুন…"
                        onChange={(e) => setBody(e.target.value)}
                      />
                      {attachment && (
                        <p className="text-xs">
                          {attachment.filename}{' '}
                          <button className="underline" onClick={() => setAttachment(null)}>
                            Remove
                          </button>
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          disabled={
                            busy ||
                            !overview?.enabled ||
                            !thread.reply_window_open ||
                            (!body.trim() && !attachment)
                          }
                          onClick={() => send(attachment?.kind || 'text')}
                        >
                          <Send size={14} /> Send reply
                        </Button>
                        <label className="cursor-pointer rounded-lg border border-line px-3 py-2 text-sm">
                          Attach file
                          <input
                            className="sr-only"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf,.mp3,.ogg,.mp4"
                            disabled={busy || !thread.reply_window_open}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              void action(async () => {
                                if (f.size > 10000000) throw new Error('File must be under 10 MB.');
                                const encoded = await new Promise<string>((resolve, reject) => {
                                  const reader = new FileReader();
                                  reader.onload = () =>
                                    resolve(String(reader.result).split(',')[1]);
                                  reader.onerror = reject;
                                  reader.readAsDataURL(f);
                                });
                                const r = await api<{
                                  data: { media_id: string; kind: string; filename: string };
                                }>(base + '/media', {
                                  method: 'POST',
                                  body: { base64: encoded, filename: f.name },
                                });
                                setAttachment(r.data);
                              });
                            }}
                          />
                        </label>
                        <Button
                          variant="secondary"
                          disabled={busy || !overview?.enabled || !thread.contact.opt_in}
                          onClick={() => send('template', thread.contact.phone === '8801711945113')}
                        >
                          প্রথম message · Send template
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {(tab === 'contacts' || tab === 'campaign') && (
        <>
          {tab === 'campaign' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="font-bold">Campaign · সর্বোচ্চ ৫০ / rolling 24 hours</h2>
              <p className="mt-1 text-sm">
                শুধু opt-in, unique, non-suppressed contacts; test phone campaign-এর বাইরে।
                Queued/unknown sends-ও allowance ব্যবহার করে।
              </p>
              <p className="mt-2 text-sm">
                Selected: {picked.length} · Remaining: {overview?.remaining ?? '—'} ·{' '}
                {overview?.campaign_enabled ? 'Enabled' : 'Disabled'}
              </p>
              <Button
                className="mt-3"
                disabled={busy || !picked.length || !overview?.campaign_enabled}
                onClick={() =>
                  action(async () => {
                    const r = await api<{ data: { queued: number } }>(base + '/campaign', {
                      method: 'POST',
                      body: { contact_ids: picked },
                    });
                    setPicked([]);
                    setNotice(
                      r.data.queued +
                        ' messages queued. Delivery history will update as they are sent.',
                    );
                  })
                }
              >
                Queue selected contacts
              </Button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Contact', 'Consent', 'Status', 'Actions'].map((label) => (
                    <th key={label} className="p-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="p-3">
                      {tab === 'campaign' && (
                        <input
                          aria-label={'Select ' + c.phone}
                          type="checkbox"
                          className="mr-2"
                          checked={picked.includes(c.id)}
                          disabled={
                            !c.opt_in || c.opt_out || c.suppressed || c.phone === '8801711945113'
                          }
                          onChange={(e) =>
                            setPicked((prev) =>
                              e.target.checked
                                ? [...prev, c.id].slice(0, 50)
                                : prev.filter((id) => id !== c.id),
                            )
                          }
                        />
                      )}
                      <strong>{c.name || c.phone}</strong>
                      <p className="text-muted">{c.phone}</p>
                    </td>
                    <td className="p-3">
                      {c.opt_in ? 'Opt-in YES' : 'No opt-in'}
                      {c.opt_out ? ' · Opted out' : ''}
                      {c.suppressed ? ' · Suppressed' : ''}
                    </td>
                    <td className="p-3">
                      {c.stage} · {c.unread} unread
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => edit(c)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelected(c.id);
                            setTab('inbox');
                          }}
                        >
                          Open chat
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!contacts.length && <p className="p-5 text-muted">No matching contacts.</p>}
          </div>
          {tab === 'contacts' && (
            <label className="block rounded-xl border border-line bg-white p-4 text-sm">
              Import Contacts CSV (Phone/Mobile, Name, Opt_In, Opt_In_Source, Opt_Out, Suppressed)
              <span className="mt-1 block text-xs text-muted">
                Google Contacts-এর Phone 1 - Value-ও গ্রহণ করে। সম্মতি থাকলে Opt_In=YES এবং
                Opt_In_Source লিখুন; শুধু নাম/নম্বর import করলে sending consent যোগ হবে না।
              </span>
              <input
                className="mt-2 block"
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  void action(async () => {
                    if (f.size > 2000000) throw new Error('CSV must be under 2 MB.');
                    const rows = parseContactsCsv(await f.text());
                    const r = await api<{
                      data: {
                        imported: number;
                        skipped: number;
                        invalid: number;
                        invalid_rows: number[];
                      };
                    }>(base + '/contacts/import', { method: 'POST', body: { contacts: rows } });
                    setNotice(
                      r.data.imported +
                        ' imported; ' +
                        r.data.skipped +
                        ' existing contacts preserved; ' +
                        r.data.invalid +
                        ' invalid phone rows skipped' +
                        (r.data.invalid
                          ? ' (CSV rows: ' + r.data.invalid_rows.join(', ') + ')'
                          : '') +
                        '.',
                    );
                  });
                }}
              />
              <p className="mt-2 text-muted">
                Import কোনো message send করে না; blank Opt_In consent হিসেবে ধরা হয় না।
              </p>
            </label>
          )}
        </>
      )}
      {tab !== 'settings' && (
        <div className="flex justify-between text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} / {lastPage}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {tab === 'settings' && superAdmin && overview && (
        <Connection settings={overview} busy={busy} run={action} />
      )}
    </div>
  );
}

function Connection({
  settings,
  busy,
  run,
}: {
  settings: Overview;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [token, setToken] = useState(''),
    [secret, setSecret] = useState(''),
    [verify, setVerify] = useState('');
  const [enabled, setEnabled] = useState(settings.enabled),
    [campaign, setCampaign] = useState(settings.campaign_enabled),
    [received, setReceived] = useState(settings.test_received),
    [limit, setLimit] = useState(settings.daily_limit);
  const [result, setResult] = useState('');
  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-5">
      <h2 className="text-xl font-bold">Super admin · WhatsApp connection</h2>
      <p className="rounded-lg bg-slate-50 p-2 text-sm">
        Payment confirmation: {settings.confirmation_template ?? 'nb_order_confirmation_v1'} ·{' '}
        {settings.confirmation_approved ? 'Approved' : 'Awaiting Meta approval'} · Waiting:{' '}
        {settings.confirmation_pending ?? 0}
      </p>
      <p className="text-sm text-muted">
        API secrets server-এ encrypted থাকে; admin inbox-এ প্রকাশ হয় না। Blank field saved secret
        রাখে।
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt>Phone Number ID</dt>
          <dd className="font-mono">{settings.phone_number_id}</dd>
        </div>
        <div>
          <dt>WABA ID</dt>
          <dd className="font-mono">{settings.waba_id}</dd>
        </div>
        <div>
          <dt>Template</dt>
          <dd>{settings.template} · bn</dd>
        </div>
        <div>
          <dt>Last webhook</dt>
          <dd>{time(settings.webhook_at)}</dd>
        </div>
      </dl>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api(base + '/settings', {
              method: 'PUT',
              body: {
                enabled,
                campaign_enabled: campaign,
                test_received: received,
                daily_limit: limit,
                access_token: token || null,
                app_secret: secret || null,
                verify_token: verify || null,
              },
            });
            setToken('');
            setSecret('');
            setVerify('');
            setResult('Settings saved.');
          });
        }}
      >
        <label className="block text-sm">
          Meta access token {settings.configured ? '(saved)' : '(required)'}
          <input
            className={field}
            type="password"
            autoComplete="new-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Meta App Secret {settings.secret_configured ? '(saved)' : '(required for replies)'}
          <input
            className={field}
            type="password"
            autoComplete="new-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Webhook verify token {settings.verify_configured ? '(saved)' : '(choose 16+ characters)'}
          <input
            className={field}
            type="password"
            autoComplete="new-password"
            minLength={16}
            value={verify}
            onChange={(e) => setVerify(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Rolling 24-hour campaign limit
          <input
            className={field}
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{' '}
          Enable WhatsApp sending
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={received}
            onChange={(e) => setReceived(e.target.checked)}
          />{' '}
          Dashboard test আমার ফোনে পৌঁছেছে
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={campaign}
            onChange={(e) => setCampaign(e.target.checked)}
          />{' '}
          Enable campaign after test
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            Save connection settings
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api<{
                  data: { display_phone_number: string; template_approved: boolean };
                }>(base + '/connection', { method: 'POST' });
                setResult(
                  r.data.display_phone_number +
                    ' · template ' +
                    (r.data.template_approved ? 'APPROVED' : 'not approved; check Meta'),
                );
              })
            }
          >
            Check Meta connection
          </Button>
        </div>
      </form>
      {result && (
        <p role="status" className="text-emerald-700">
          {result}
        </p>
      )}
      <div className="rounded-lg bg-slate-50 p-4 text-sm">
        <p className="font-semibold">Meta webhook callback</p>
        <p className="mt-1 break-all font-mono">{settings.webhook_url}</p>
        <p className="mt-2">
          Meta App → WhatsApp → Configuration-এ callback ও আপনার verify token দিন; messages field
          subscribe করুন। পুরোনো n8n bulk sender বন্ধ রাখুন।
        </p>
        <p className="mt-2 text-muted">
          Connect করার পর থেকে replies/history জমা হবে। Meta API পুরোনো সব chat history ফিরিয়ে দেয়
          না। বাইরে পাঠানো message-এর status দেখা যাবে; original message body dashboard-এর কাছে
          থাকবে না।
        </p>
      </div>
    </section>
  );
}
