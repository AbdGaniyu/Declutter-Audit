'use client';
import { Bell, BellRing } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { iconProps } from '@/components/icons';
import { enablePush } from '@/lib/push';
import { getBrowserSupabase } from '@/lib/supabase/client';

/** "Remind me" for a drop: saves a reminder and turns on push for this phone. */
export function RemindMe({ dropId, reminded, signedIn }: { dropId: string; reminded: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(reminded);
  const [busy, setBusy] = useState(false);
  const cls = 'inline-flex min-h-11 items-center gap-2 rounded-pill border border-line bg-surface px-4 font-semibold text-ink disabled:opacity-40';

  if (!signedIn) {
    return <Link href="/login?next=/" className={cls}><Bell {...iconProps} size={18} /> Remind me</Link>;
  }
  return (
    <button type="button" className={cls} disabled={busy} aria-pressed={on} onClick={async () => {
      setBusy(true);
      const { error } = await getBrowserSupabase().rpc('set_drop_reminder', { p_drop_id: dropId, p_on: !on });
      if (!error) {
        setOn(!on);
        if (!on) await enablePush().catch(() => false);
      }
      setBusy(false);
    }}>
      {on ? <BellRing {...iconProps} size={18} /> : <Bell {...iconProps} size={18} />}
      {on ? "We'll remind you" : 'Remind me'}
    </button>
  );
}
