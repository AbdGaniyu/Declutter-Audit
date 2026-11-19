'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label, Select } from '@/components/Field';
import { getBrowserSupabase } from '@/lib/supabase/client';

export function BankForm({ hasBank }: { hasBank: boolean }) {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void supabase.functions.invoke('seller-bank', { method: 'GET' }).then(({ data, error: e }) => {
      if (e || !data?.banks) setError("Couldn't load banks. Check your connection.");
      else setBanks(data.banks);
    });
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const bankName = banks.find((b) => b.code === bankCode)?.name;
    const { data, error: fnError } = await supabase.functions.invoke('seller-bank', {
      body: { bank_code: bankCode, account_number: account, bank_name: bankName },
    });
    setBusy(false);
    if (fnError || !data?.account_name) {
      return setError('We could not verify that account. Check the number and bank.');
    }
    setSaved(data.account_name as string);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="bank">Bank</Label>
        <Select id="bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)} required>
          <option value="">{banks.length ? 'Choose your bank…' : 'Loading banks…'}</option>
          {banks.map((b) => <option key={`${b.code}-${b.name}`} value={b.code}>{b.name}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="acct">Account number (NUBAN)</Label>
        <Input id="acct" inputMode="numeric" maxLength={10} value={account}
          onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))} required />
      </div>
      {saved && <p className="text-small text-success">Saved: {saved}</p>}
      <ErrorText>{error}</ErrorText>
      <Button type="submit" block disabled={busy || !bankCode || account.length !== 10}>
        {busy ? 'Verifying…' : hasBank ? 'Update account' : 'Verify and save'}
      </Button>
    </form>
  );
}
