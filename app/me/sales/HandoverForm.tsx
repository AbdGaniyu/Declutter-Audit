'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { CodeInput } from '@/components/CodeInput';
import { ErrorText } from '@/components/Field';
import { messageFor } from '@/lib/errors';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatLagosTime } from '@/lib/time';

type Result = { result: 'ok' | 'already_confirmed' | 'wrong_code' | 'locked'; tries_left?: number; retry_at?: string };

/** Seller enters the buyer's code at pickup. That releases the payout. 5 tries per hour. */
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
    const r = data as unknown as Result;
    if (r.result === 'ok' || r.result === 'already_confirmed') return router.refresh();
    setCode('');
    if (r.result === 'wrong_code') {
      setError(`That code doesn't match. ${r.tries_left} ${r.tries_left === 1 ? 'try' : 'tries'} left this hour.`);
    } else {
      setError(`Too many wrong codes. Try again after ${r.retry_at ? formatLagosTime(r.retry_at) : 'an hour'}.`);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <CodeInput value={code} onChange={setCode} label="Buyer's handover code" idPrefix={`code-${orderId}`} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" block tall busy={busy} disabled={code.length !== 6}>Confirm handover</Button>
      <p className="text-body text-ink-muted">Ask for the code only when you hand over the item.</p>
    </form>
  );
}
