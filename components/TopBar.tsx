import { getServerSupabase } from '@/lib/supabase/server';
import { TopBarNav } from '@/components/TopBarNav';
import { TabBar } from '@/components/TabBar';

/** Server half: who's signed in and whether they're an admin. */
export async function TopBar() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    isAdmin = Boolean(profile?.is_admin);
  }
  return (
    <>
      <TopBarNav userId={user?.id ?? null} isAdmin={isAdmin} />
      <TabBar />
    </>
  );
}
