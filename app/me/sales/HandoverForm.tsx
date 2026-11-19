'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label } from '@/components/Field';
import { messageFor } from '@/lib/errors';
import { getBrowserSupabase } from '@/lib/supabase/client';

/** Seller enters the buyer's 6-digit code at pickup. That releases the payout. */
export function HandoverForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await getBrowserSupabase().rpc('confirm_handover', { p_order_id: orderId, p_code: code });
    setBusy(false);
    if (rpcError) return setError(messageFor(rpcError.message));
    if (data === 'ok' || data === 'already_confirmed') return router.refresh();
    setError(messageFor(data as string));
    if (data === 'wrong_code') setCode('');
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor={`code-${orderId}`}>Buyer's handover code</Label>
      <div className="flex gap-2">
        <Input id={`code-${orderId}`} inputMode="numeric" autoComplete="off" maxLength={6} placeholder="6 digits"
          className="font-mono tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        <Button type="submit" disabled={busy || code.length !== 6}>Confirm</Button>
      </div>
      <p className="text-small text-muted">Ask for the code only when you hand over the item.</p>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
