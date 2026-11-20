import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { AdminPanel, type CalendarDrop, type Overview } from './AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await getServerSupabase();
  const [{ data, error }, { data: calendar }] = await Promise.all([
    supabase.rpc('admin_overview'),
    supabase.rpc('admin_drops_calendar', { p_days: 14 }),
  ]);
  if (error || !data) notFound();
  return <AdminPanel overview={data as unknown as Overview} calendar={(calendar ?? []) as CalendarDrop[]} />;
}
