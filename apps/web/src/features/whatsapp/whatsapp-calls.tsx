'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { api } from '@/lib/api/browser';
import { Button } from '@/components/ui/button';

type Call = {
  id: number;
  phone: string;
  name: string | null;
  direction: string;
  status: string;
  ended_at: string | null;
  duration: number | null;
  created_at: string;
  remote_sdp: string | null;
  sdp_type: 'offer' | 'answer' | null;
  mine: boolean;
  owned: boolean;
  claimable: boolean;
  error: string | null;
};
type Permission = {
  contact_id?: number;
  permission?: { status: string };
  actions?: { action_name: string; can_perform_action: boolean }[];
};
const root = '/admin/whatsapp';
const terminal = (call: Call) => !!call.ended_at;
export function WhatsAppCalls({
  contact,
  enabled,
}: {
  contact: {
    id: number;
    name: string | null;
    phone: string;
    opt_out: boolean;
    suppressed: boolean;
  } | null;
  enabled: boolean;
}) {
  const [calls, setCalls] = useState<Call[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [muted, setMuted] = useState(false),
    [history, setHistory] = useState(false),
    [permission, setPermission] = useState<Permission | null>(null),
    [active, setActive] = useState<number | null>(null),
    [audioState, setAudioState] = useState('');
  const key = useRef(''),
    peer = useRef<RTCPeerConnection | null>(null),
    stream = useRef<MediaStream | null>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    activeRef = useRef<number | null>(null),
    sending = useRef(false),
    alive = useRef(true),
    permissionKey = useRef<{ contact: number; key: string } | null>(null);
  const closeAudio = useCallback(() => {
    peer.current?.close();
    peer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (audio.current) {
      audio.current.srcObject = null;
    }
    activeRef.current = null;
    setActive(null);
    setMuted(false);
    setAudioState('');
  }, []);
  const action = useCallback(
    (id: number, command: string, sdp?: string) =>
      api<{ data?: { sdp: string; sdp_type: 'offer' | 'answer' } }>(
        root + '/calls/' + id + '/action',
        {
          method: 'POST',
          body: { session_key: key.current, action: command, ...(sdp ? { sdp } : {}) },
        },
      ),
    [],
  );
  useEffect(() => {
    alive.current = true;
    key.current = crypto.randomUUID();
    let disposed = false,
      polling = false;
    const controller = new AbortController();
    async function load() {
      if (polling) return;
      polling = true;
      try {
        const response = await api<{ data: Call[] }>(root + '/calls', {
          query: { session_key: key.current },
          signal: controller.signal,
        });
        if (disposed) return;
        setCalls(response.data);
        const current = response.data.find((c) => c.id === activeRef.current);
        if (current && terminal(current)) {
          closeAudio();
        } else if (
          current?.remote_sdp &&
          current.sdp_type === 'answer' &&
          peer.current?.signalingState === 'have-local-offer'
        ) {
          await peer.current.setRemoteDescription({ type: 'answer', sdp: current.remote_sdp });
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : 'Call history unavailable');
      } finally {
        polling = false;
      }
    }
    const leave = () => {
      if (!activeRef.current) return;
      const cookie = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
      if (!cookie) return;
      void fetch('/api/v1' + root + '/calls/' + activeRef.current + '/action', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-XSRF-TOKEN': decodeURIComponent(cookie[1]),
        },
        body: JSON.stringify({ session_key: key.current, action: 'terminate' }),
      }).catch(() => undefined);
    };
    window.addEventListener('pagehide', leave);
    void load();
    const interval = setInterval(() => void load(), 3000);
    return () => {
      disposed = true;
      alive.current = false;
      controller.abort();
      clearInterval(interval);
      window.removeEventListener('pagehide', leave);
      if (activeRef.current) {
        void action(activeRef.current, 'terminate').catch(() => undefined);
      }
      peer.current?.close();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [action, closeAudio]);
  async function run(fn: () => Promise<void>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Call action failed');
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function prepare() {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection)
      throw new Error('এই browser-এ microphone calling সমর্থিত নয়। Chrome/Edge ব্যবহার করুন।');
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    stream.current = media;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peer.current = pc;
    media.getTracks().forEach((t) => pc.addTrack(t, media));
    pc.ontrack = (e) => {
      if (audio.current) {
        audio.current.srcObject = e.streams[0] || new MediaStream([e.track]);
        void audio.current.play().catch(() => setAudioState('Audio শুনতে Play audio চাপুন।'));
      }
    };
    pc.onconnectionstatechange = () => {
      if (!alive.current) return;
      setAudioState(
        pc.connectionState === 'connected'
          ? 'সংযুক্ত'
          : pc.connectionState === 'connecting'
            ? 'Audio সংযোগ হচ্ছে…'
            : pc.connectionState,
      );
      if (pc.connectionState === 'failed') {
        setError('Audio সংযোগ হয়নি। Network/firewall পরীক্ষা করুন।');
        if (activeRef.current) {
          void action(activeRef.current, 'terminate').catch(() => undefined);
        }
        closeAudio();
      }
    };
    return pc;
  }
  async function localSdp(pc: RTCPeerConnection, description: RTCSessionDescriptionInit) {
    await pc.setLocalDescription(description);
    if (pc.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        };
        const check = () => {
          if (pc.iceGatheringState === 'complete') done();
        };
        const timer = setTimeout(done, 8000);
        pc.addEventListener('icegatheringstatechange', check);
      });
    }
    if (!pc.localDescription?.sdp) throw new Error('Audio session তৈরি হয়নি।');
    return pc.localDescription.sdp;
  }
  async function start() {
    if (!contact) return;
    await run(async () => {
      let id: number | null = null;
      try {
        const pc = await prepare(),
          sdp = await localSdp(pc, await pc.createOffer());
        const response = await api<{ data: { id: number } }>(
          root + '/contacts/' + contact.id + '/call',
          {
            method: 'POST',
            body: { client_key: crypto.randomUUID(), session_key: key.current, sdp },
          },
        );
        id = response.data.id;
        activeRef.current = id;
        setActive(id);
        setAudioState('কল যাচ্ছে…');
      } catch (e) {
        if (id) await action(id, 'terminate').catch(() => undefined);
        closeAudio();
        throw e;
      }
    });
  }
  async function answer(c: Call) {
    await run(async () => {
      try {
        const pc = await prepare();
        const claimed = await action(c.id, 'claim');
        activeRef.current = c.id;
        setActive(c.id);
        if (!claimed.data?.sdp) throw new Error('Incoming audio offer পাওয়া যায়নি।');
        await pc.setRemoteDescription({ type: 'offer', sdp: claimed.data.sdp });
        const sdp = await localSdp(pc, await pc.createAnswer());
        await action(c.id, 'pre_accept', sdp);
        await action(c.id, 'accept', sdp);
        setAudioState('Audio সংযোগ হচ্ছে…');
      } catch (e) {
        if (activeRef.current === c.id) await action(c.id, 'terminate').catch(() => undefined);
        closeAudio();
        throw e;
      }
    });
  }
  async function reject(c: Call) {
    await run(async () => {
      await action(c.id, 'claim');
      await action(c.id, 'reject');
      setNotice('Call declined');
    });
  }
  async function end(id: number) {
    await run(async () => {
      await action(id, 'terminate');
      closeAudio();
      setNotice('Call ended');
    });
  }
  async function checkPermission() {
    if (!contact) return;
    await run(async () => {
      const r = await api<{ data: Permission }>(
        root + '/contacts/' + contact.id + '/call-permission',
      );
      setPermission({ ...r.data, contact_id: contact.id });
    });
  }
  async function requestPermission() {
    if (!contact) return;
    await run(async () => {
      if (permissionKey.current?.contact !== contact.id)
        permissionKey.current = { contact: contact.id, key: crypto.randomUUID() };
      const r = await api<{ data: { status: string } }>(
        root + '/contacts/' + contact.id + '/call-permission',
        { method: 'POST', body: { client_key: permissionKey.current.key } },
      );
      setNotice(
        r.data.status === 'accepted'
          ? 'Call permission request পাঠানো হয়েছে। Contact Allow calls চাপলে আবার Check permission দিন।'
          : 'Request status: ' + r.data.status,
      );
      setPermission(null);
    });
  }
  const can = (name: string) =>
    permission?.contact_id === contact?.id &&
    (permission?.actions?.some((a) => a.action_name === name && a.can_perform_action) ?? false);
  const incoming = calls.filter((c) => c.claimable && !terminal(c));
  const mine = calls.filter((c) => (c.owned || c.mine) && !terminal(c));
  return (
    <section
      className="space-y-3 rounded-xl border border-line bg-white p-4"
      aria-label="WhatsApp calls"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Phone size={18} />
          WhatsApp voice call
        </h2>
        <Button variant="secondary" onClick={() => setHistory(!history)}>
          Call history
        </Button>
      </div>
      <p className="text-sm text-muted">
        কল receive করতে এই dashboard খোলা রাখুন। Outgoing call-এর আগে contact-এর WhatsApp permission
        লাগবে। Voice call-এ Meta charge প্রযোজ্য হতে পারে।
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {incoming.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 p-3">
          <span>
            Incoming call: {c.name || c.phone} · {c.phone}
          </span>
          <Button disabled={busy || !!active || !enabled} onClick={() => void answer(c)}>
            Answer call
          </Button>
          <Button variant="secondary" disabled={busy || !!active} onClick={() => void reject(c)}>
            Decline call
          </Button>
        </div>
      ))}
      {mine.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3">
          <span>
            {c.name || c.phone} · {c.status}{' '}
            {active === c.id && audioState ? ' · ' + audioState : ''}
          </span>
          {active === c.id && (
            <Button
              variant="secondary"
              onClick={() => {
                const value = !muted;
                stream.current?.getAudioTracks().forEach((t) => {
                  t.enabled = !value;
                });
                setMuted(value);
              }}
            >
              {muted ? <MicOff size={16} /> : <Mic size={16} />} {muted ? 'Unmute' : 'Mute'}
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => void end(c.id)}>
            <PhoneOff size={16} />
            Hang up
          </Button>
        </div>
      ))}
      <audio
        ref={audio}
        autoPlay
        controls
        className={active ? 'w-full max-w-sm' : 'hidden'}
        aria-label="Call audio"
      />
      {contact && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{contact.name || contact.phone}</span>
          <Button
            variant="secondary"
            disabled={busy || !enabled || contact.opt_out || contact.suppressed}
            onClick={() => void checkPermission()}
          >
            Check call permission
          </Button>
          {permission && (
            <span className="text-sm">{permission.permission?.status || 'No permission'}</span>
          )}
          {can('send_call_permission_request') && (
            <Button
              variant="secondary"
              disabled={busy || !!active || !enabled}
              onClick={() => void requestPermission()}
            >
              Request call permission
            </Button>
          )}
          <Button
            disabled={
              busy ||
              !!active ||
              mine.length > 0 ||
              !enabled ||
              !can('start_call') ||
              contact.opt_out ||
              contact.suppressed
            }
            onClick={() => void start()}
          >
            <Phone size={16} />
            Call contact
          </Button>
        </div>
      )}
      {history && (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Call</th>
                <th>Status</th>
                <th>Time</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-2">
                    {c.name || c.phone}
                    <br />
                    {c.phone}
                  </td>
                  <td>{c.direction}</td>
                  <td>
                    {c.status}
                    {c.error && <p>{c.error}</p>}
                  </td>
                  <td>
                    {new Date(
                      c.created_at.replace(' ', 'T') + (/Z$/.test(c.created_at) ? '' : 'Z'),
                    ).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })}
                  </td>
                  <td>{c.duration === null ? '—' : c.duration + 's'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!calls.length && <p className="py-3">এখনো call নেই।</p>}
        </div>
      )}
    </section>
  );
}
