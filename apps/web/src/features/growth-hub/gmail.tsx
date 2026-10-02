'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/browser';
import { Button } from '@/components/ui/button';

type Connection = {
  configured: boolean;
  status: 'disconnected' | 'connected' | 'verification_failed';
  email: string | null;
  checked_at: string | null;
  callback_url: string;
};
const endpoint = '/admin/growth-hub/gmail';

export function GmailConnection() {
  const [connection, setConnection] = useState<Connection>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const outcome = new URLSearchParams(window.location.search).get('gmail');
    api<{ data: Connection }>(endpoint)
      .then((r) => {
        if (!active) return;
        setConnection(r.data);
        if (outcome === 'failed')
          setMessage(
            'Google connection failed. Check Gmail API, redirect URI and granted permission, then retry.',
          );
        if (outcome === 'cancelled')
          setMessage('Google consent was cancelled. No new Gmail connection was saved.');
      })
      .catch(() => {
        if (active) setMessage('Could not load Gmail connection. Reload to retry.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function connect() {
    setBusy(true);
    setMessage('');
    try {
      const r = await api<{ data: { url: string } }>(endpoint + '/connect', { method: 'POST' });
      const url = new URL(r.data.url);
      if (url.origin !== 'https://accounts.google.com')
        throw new Error('Invalid authorization URL');
      window.location.assign(url.href);
    } catch {
      setMessage('Could not start Gmail connection. Check Google OAuth configuration and retry.');
      setBusy(false);
    }
  }
  async function update(disconnect: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const r = await api<{ data: Connection }>(endpoint + (disconnect ? '' : '/check'), {
        method: disconnect ? 'DELETE' : 'POST',
      });
      setConnection(r.data);
      if (disconnect)
        setMessage('Disconnected. Saved Gmail credentials were removed from this website.');
    } catch {
      setMessage('Gmail connection could not be updated. Please retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-3">
      <p className="text-sm text-muted">
        Gemini powers Ask My AI. Gmail needs a separate Google account connection.
      </p>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {!connection && !message && <p>Loading Gmail connection…</p>}
      {connection && (
        <>
          <p>
            {connection.status === 'connected'
              ? 'Gmail connected.'
              : connection.status === 'verification_failed'
                ? 'Gmail verification failed. Retry the check or reconnect.'
                : 'Gmail is not connected.'}
          </p>
          {connection.email && <p className="break-all">{connection.email}</p>}
          {connection.checked_at && (
            <p className="text-sm">Last verified: {connection.checked_at} UTC</p>
          )}
          <p className="text-sm">
            Read-only email metadata permission. No sending, deleting, email body access or
            automatic sharing with Gemini.
          </p>
          {connection.configured ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={connect}>
                {connection.email ? 'Reconnect Gmail' : 'Connect Gmail'}
              </Button>
              {connection.email && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => update(false)}
                  >
                    Check connection
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => update(true)}>
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          ) : (
            <p>
              Google OAuth Client ID and Client Secret must be configured on the server. A Gemini
              API key cannot replace these.
            </p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer">Google Cloud setup</summary>
            <ol className="list-decimal space-y-1 pl-5 mt-2">
              <li>Enable Gmail API in the Google Cloud project used for website Google sign-in.</li>
              <li>
                Add this Authorized redirect URI to the Web application OAuth client:{' '}
                <code className="break-all">{connection.callback_url}</code>
              </li>
              <li>
                Allow Gmail metadata scope on the consent screen. In Testing mode, add your Gmail as
                a test user.
              </li>
              <li>Click Connect Gmail, select your account and grant Google permission.</li>
            </ol>
          </details>
        </>
      )}
    </div>
  );
}
