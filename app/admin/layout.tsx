import { notFound } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/Sidebar';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Admin shell (PDF p.15). Non-admins get a 404, not a hint that the page exists. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', auth.user.id).maybeSingle();
  if (!profile?.is_admin) notFound();
  const { data: overview } = await supabase.rpc('admin_overview');
  const count = ((overview as { disputes?: unknown[] } | null)?.disputes ?? []).length;

  return (
    <div className="gap-8 md:grid md:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="mb-6 md:sticky md:top-24 md:mb-0 md:self-start">
        <p className="mb-3 hidden text-title-sm md:block">Admin</p>
        <AdminSidebar openDisputes={count} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
