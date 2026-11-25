'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { getBrowserSupabase } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button variant="text" onClick={async () => {
      await getBrowserSupabase().auth.signOut();
      router.replace('/');
      router.refresh();
    }}>
      Sign out
    </Button>
  );
}
