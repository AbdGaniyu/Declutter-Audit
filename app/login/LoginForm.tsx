'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhoneVerify } from '@/components/PhoneVerify';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/';
  return (
    <PhoneVerify onDone={() => {
      router.replace(next);
      router.refresh();
    }} />
  );
}
