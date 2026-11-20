'use client';
import { useEffect } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

export function MarkRead() {
  useEffect(() => {
    void getBrowserSupabase().rpc('mark_notifications_read');
  }, []);
  return null;
}
