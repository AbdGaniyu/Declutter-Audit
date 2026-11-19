'use client';
import { useEffect } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { needsResync, syncServerClock } from '@/lib/time-sync';

/** Syncs the server clock offset on load, on focus and when coming back online. */
export function ClockSync() {
  useEffect(() => {
    const supabase = getBrowserSupabase();
    void syncServerClock(supabase);
    const resync = () => {
      if (document.visibilityState === 'visible' && needsResync(15_000)) void syncServerClock(supabase);
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    const id = setInterval(() => void syncServerClock(supabase, 1), 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
      clearInterval(id);
    };
  }, []);
  return null;
}
