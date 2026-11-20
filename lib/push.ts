'use client';
import { getBrowserSupabase } from '@/lib/supabase/client';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Ask permission and register this device. Returns false if declined or unsupported. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: data.user.id, endpoint: sub.endpoint, keys: sub.toJSON().keys ?? {},
  });
  return !error;
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await getBrowserSupabase().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  return Boolean(await reg.pushManager.getSubscription());
}
