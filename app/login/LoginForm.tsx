'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label } from '@/components/Field';
import { normalizeNigerianPhone } from '@/lib/phone';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { LAGOS_AREAS } from '@/lib/areas';

type Step = 'phone' | 'code' | 'profile';

export function LoginForm() {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const e164 = normalizeNigerianPhone(phone);
    if (!e164) return setError('Enter a Nigerian mobile number, e.g. 0803 123 4567.');
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) return setError(error.message);
    setPhone(e164);
    setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
    if (error || !data.user) {
      setBusy(false);
      return setError(error?.message ?? 'Could not verify code.');
    }
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', data.user.id).maybeSingle();
    setBusy(false);
    if (!profile?.display_name) return setStep('profile');
    router.replace(next);
    router.refresh();
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setError('Session expired. Sign in again.');
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), area: area || null })
      .eq('id', data.user.id);
    setBusy(false);
    if (error) return setError('Could not save. Names are 1 to 40 characters.');
    router.replace(next);
    router.refresh();
  }

  if (step === 'phone') {
    return (
      <form onSubmit={sendCode} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567"
            value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" block disabled={busy}>{busy ? 'Sending…' : 'Send code'}</Button>
      </form>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="mt-6 space-y-4">
        <p className="text-small text-muted">Code sent to {phone}.</p>
        <div>
          <Label htmlFor="code">6-digit code</Label>
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" block disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify'}</Button>
        <Button type="button" variant="ghost" block onClick={() => setStep('phone')}>Use a different number</Button>
      </form>
    );
  }

  return (
    <form onSubmit={saveProfile} className="mt-6 space-y-4">
      <p className="text-small text-muted">Last step. Other people see your first name as a seller only.</p>
      <div>
        <Label htmlFor="name">First name</Label>
        <Input id="name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="area">Your area</Label>
        <select id="area" value={area} onChange={(e) => setArea(e.target.value)}
          className="w-full rounded-card border border-line bg-surface px-3 py-2.5 text-body">
          <option value="">Choose…</option>
          {LAGOS_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" block disabled={busy}>Continue</Button>
    </form>
  );
}
