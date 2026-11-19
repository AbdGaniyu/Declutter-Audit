import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { AdminPanel, type Overview } from './AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc('admin_overview');
  if (error || !data) notFound();
  return <AdminPanel overview={data as unknown as Overview} />;
}
