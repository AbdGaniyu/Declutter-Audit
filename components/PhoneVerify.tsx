'use client';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { CodeInput } from '@/components/CodeInput';
import { ErrorText, Input, Label, Select } from '@/components/Field';
import { LAGOS_AREAS } from '@/lib/areas';
import { maskPhone, normalizeNigerianPhone } from '@/lib/phone';
import { getBrowserSupabase } from '@/lib/supabase/client';

type Step = 'phone' | 'code' | 'profile';

/**
 * DESIGN.md › Verify phone: OTP, shown the first time someone tries to bid or
 * sell. Used full-page (/login) and as a bottom sheet on the lot page.
 */
export function PhoneVerify({ onDone }: { onDone: () => void }) {
  const supabase = getBrowserSupabase();
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
    if (!e164) return setError('Enter a Nigerian mobile number, like 0803 123 4567.');
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
      return setError(error?.message ?? "That code didn't work. Try again.");
    }
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', data.user.id).maybeSingle();
    setBusy(false);
    if (!profile?.display_name) return setStep('profile');
    onDone();
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setError('Your session expired. Verify your phone again.');
    setBusy(true);
    const { error } = await supabase.from('profiles')
      .update({ display_name: name.trim(), area: area || null }).eq('id', data.user.id);
    setBusy(false);
    if (error) return setError('Names are 1 to 40 characters.');
    onDone();
  }

  if (step === 'phone') {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567"
            value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" block tall busy={busy}>Send code</Button>
      </form>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="text-body text-secondary">
          Enter the 6-digit code we sent to <span className="tnum font-semibold text-label">{maskPhone(phone)}</span>.{' '}
          <button type="button" className="font-semibold text-label underline underline-offset-2" onClick={() => { setCode(''); setStep('phone'); }}>
            Change number
          </button>
        </p>
        <CodeInput value={code} onChange={setCode} label="6-digit code" idPrefix="otp" />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" block tall busy={busy} disabled={code.length !== 6}>Verify</Button>
      </form>
    );
  }

  return (
    <form onSubmit={saveProfile} className="space-y-4">
      <p className="text-body text-secondary">Last step. Buyers see your first name if you sell.</p>
      <div>
        <Label htmlFor="name">First name</Label>
        <Input id="name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="area">Your area</Label>
        <Select id="area" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Choose…</option>
          {LAGOS_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" block tall busy={busy}>Continue</Button>
    </form>
  );
}
