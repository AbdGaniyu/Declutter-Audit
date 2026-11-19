'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Textarea } from '@/components/Field';
import { messageFor } from '@/lib/errors';
import { getBrowserSupabase } from '@/lib/supabase/client';

/** Buyer or seller flags a problem with a paid order. Admins resolve it. */
export function DisputeButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return <Button block variant="ghost" onClick={() => setOpen(true)}>Report a problem</Button>;
  }
  return (
    <div className="space-y-2 rounded-card border border-line bg-surface p-4">
      <p className="text-small font-semibold">What went wrong?</p>
      <Textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. item not as described, seller unreachable" />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button variant="danger" block disabled={busy || reason.trim().length < 5} onClick={async () => {
          setBusy(true);
          const { error: e } = await getBrowserSupabase().rpc('open_dispute', { p_order_id: orderId, p_reason: reason });
          setBusy(false);
          if (e) return setError(messageFor(e.message));
          router.refresh();
        }}>Open dispute</Button>
      </div>
      <p className="text-small text-muted">Payouts are paused while we review. Don't share your code until it's resolved.</p>
    </div>
  );
}
