'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { getBrowserSupabase } from '@/lib/supabase/client';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'unsupported' | 'denied' | 'off' | 'on' | 'busy';

/** Opt in to "you've been outbid" / "you won" push notifications on this device. */
export function PushToggle() {
  const [state, setState] = useState<State>('busy');
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (!vapid || !('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, [vapid]);

  async function enable() {
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setState(permission === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid!),
      });
      const j = sub.toJSON();
      const supabase = getBrowserSupabase();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setState('off');
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      const { error } = await supabase.from('push_subscriptions').insert({
        user_id: data.user.id,
        endpoint: sub.endpoint,
        keys: j.keys ?? {},
      });
      setState(error ? 'off' : 'on');
    } catch {
      setState('off');
    }
  }

  async function disable() {
    setState('busy');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await getBrowserSupabase().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    setState('off');
  }

  if (state === 'unsupported') {
    return <p className="text-small text-muted">Push alerts aren't supported in this browser. Add the app to your home screen to get them.</p>;
  }
  if (state === 'denied') {
    return <p className="text-small text-muted">Notifications are blocked. Allow them in your browser settings to get outbid alerts.</p>;
  }
  return state === 'on' ? (
    <Button variant="secondary" onClick={disable}>Turn off alerts on this phone</Button>
  ) : (
    <Button onClick={enable} disabled={state === 'busy'}>Get outbid and win alerts</Button>
  );
}
