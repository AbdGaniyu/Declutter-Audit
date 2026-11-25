'use client';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label } from '@/components/Field';
import { iconProps } from '@/components/icons';
import { messageFor } from '@/lib/errors';
import { getBrowserSupabase } from '@/lib/supabase/client';

// Admin mutations all go through security-definer RPCs that check is_admin().
type AdminRpc =
  | 'admin_cancel_auction' | 'admin_cancel_drop' | 'admin_release_order'
  | 'admin_review_user' | 'admin_suspend_user' | 'admin_retry_payout';

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const { error: e } = await fn();
    setBusy(false);
    if (e) setError(messageFor(e.message));
    else router.refresh();
  }
  return { busy, error, run };
}

/** A button that calls one admin RPC, with an optional confirm. */
export function RpcButton({ rpc, args, confirm, variant = 'secondary', children }: {
  rpc: AdminRpc;
  args: Record<string, unknown>;
  confirm?: string;
  variant?: 'primary' | 'secondary' | 'text';
  children: React.ReactNode;
}) {
  const { busy, error, run } = useRun();
  const supabase = getBrowserSupabase();
  return (
    <span className="inline-flex flex-col items-end">
      <Button variant={variant} busy={busy} className={variant === 'text' ? '' : '!min-h-11 !px-4 text-subhead'}
        onClick={() => run(() => supabase.rpc(rpc, args as never), confirm)}>
        {children}
      </Button>
      {error && <span role="alert" className="text-footnote text-secondary">{error}</span>}
    </span>
  );
}

export function RefundButton({ orderId }: { orderId: string }) {
  const { busy, error, run } = useRun();
  const supabase = getBrowserSupabase();
  return (
    <span className="inline-flex flex-col">
      <Button variant="secondary" busy={busy} className="!min-h-11 !px-4 text-subhead"
        onClick={() => run(async () => {
          const { error: e } = await supabase.functions.invoke('admin-refund', { body: { order_id: orderId } });
          return { error: e ? { message: 'payment_provider_error' } : null };
        }, 'Refund the buyer in full through Paystack?')}>
        Refund buyer
      </Button>
      {error && <span role="alert" className="text-footnote text-secondary">{error}</span>}
    </span>
  );
}

export function DismissAlert({ id }: { id: string }) {
  const { busy, run } = useRun();
  const supabase = getBrowserSupabase();
  return (
    <Button variant="text" busy={busy}
      onClick={() => run(() => supabase.from('ops_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', id))}>
      Dismiss
    </Button>
  );
}

/** datetime-local value (Lagos wall time) → ISO UTC. Lagos is UTC+1 all year. */
function lagosLocalToIso(v: string): string {
  return new Date(`${v}:00+01:00`).toISOString();
}

/** "+ New drop" opens the create form. */
export function NewDrop() {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useRun();
  const supabase = getBrowserSupabase();
  const [drop, setDrop] = useState({ title: '', opens: '', closesAfter: '30', interval: '60', maxLots: '60' });
  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="!min-h-11 !px-4 text-subhead">
        <Plus {...iconProps} size={18} /> New drop
      </Button>
    );
  }
  return (
    <form className="squircle grid w-full grid-cols-2 gap-3 rounded-group bg-surface p-4 md:grid-cols-6" onSubmit={(e) => {
      e.preventDefault();
      const opens = lagosLocalToIso(drop.opens);
      const firstClose = new Date(Date.parse(opens) + Number(drop.closesAfter) * 60_000).toISOString();
      void run(() => supabase.rpc('admin_create_drop', {
        p_title: drop.title, p_opens_at: opens, p_first_close_at: firstClose,
        p_close_interval_seconds: Number(drop.interval), p_max_lots: Number(drop.maxLots),
      }));
    }}>
      <div className="col-span-2"><Label htmlFor="dt">New drop title</Label>
        <Input id="dt" required value={drop.title} onChange={(e) => setDrop({ ...drop, title: e.target.value })} /></div>
      <div className="col-span-2"><Label htmlFor="do">Opens (Lagos time)</Label>
        <Input id="do" type="datetime-local" required value={drop.opens} onChange={(e) => setDrop({ ...drop, opens: e.target.value })} /></div>
      <div><Label htmlFor="dc">First close (min)</Label>
        <Input id="dc" inputMode="numeric" className="tnum" value={drop.closesAfter} onChange={(e) => setDrop({ ...drop, closesAfter: e.target.value })} /></div>
      <div><Label htmlFor="di">Every (s)</Label>
        <Input id="di" inputMode="numeric" className="tnum" value={drop.interval} onChange={(e) => setDrop({ ...drop, interval: e.target.value })} /></div>
      <div><Label htmlFor="dm">Max lots</Label>
        <Input id="dm" inputMode="numeric" className="tnum" value={drop.maxLots} onChange={(e) => setDrop({ ...drop, maxLots: e.target.value })} /></div>
      <div className="col-span-2 flex items-end gap-2 md:col-span-5">
        <Button type="submit" busy={busy}>Create drop</Button>
        <Button type="button" variant="text" onClick={() => setOpen(false)}>Cancel</Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
