'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { disablePush, enablePush, pushEnabled, pushSupported } from '@/lib/push';

type State = 'unsupported' | 'denied' | 'off' | 'on' | 'busy';

/** Opt in to "you've been outbid" / "you won" push on this phone. */
export function PushToggle() {
  const [state, setState] = useState<State>('busy');

  useEffect(() => {
    if (!pushSupported()) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    void pushEnabled().then((on) => setState(on ? 'on' : 'off')).catch(() => setState('unsupported'));
  }, []);

  if (state === 'unsupported') {
    return <p className="text-body text-secondary">Alerts aren&apos;t supported in this browser. Add the app to your home screen to get them.</p>;
  }
  if (state === 'denied') {
    return <p className="text-body text-secondary">Notifications are blocked. Allow them in your browser settings to get outbid alerts.</p>;
  }
  return state === 'on' ? (
    <Button variant="secondary" onClick={async () => { setState('busy'); await disablePush(); setState('off'); }}>
      Turn off alerts on this phone
    </Button>
  ) : (
    <Button busy={state === 'busy'} onClick={async () => {
      setState('busy');
      const ok = await enablePush().catch(() => false);
      setState(ok ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off');
    }}>
      Get outbid and win alerts
    </Button>
  );
}
