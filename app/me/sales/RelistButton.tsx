'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorText } from '@/components/Field';
import { messageFor } from '@/lib/errors';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatLagosDateTime } from '@/lib/time';

export function RelistButton({ auctionId, drops }: { auctionId: string; drops: { id: string; title: string; opens_at: string }[] }) {
  const router = useRouter();
  const [dropId, setDropId] = useState(drops[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select aria-label="Drop to relist into" value={dropId} onChange={(e) => setDropId(e.target.value)}
        className="min-h-11 rounded-pill border border-line bg-surface px-3 text-body">
        {drops.map((d) => <option key={d.id} value={d.id}>{formatLagosDateTime(d.opens_at)}</option>)}
      </select>
      <button type="button" disabled={busy} className="min-h-11 rounded-pill bg-ink px-4 font-semibold text-white disabled:opacity-40"
        onClick={async () => {
          setBusy(true);
          const { data, error: e } = await getBrowserSupabase().rpc('relist_auction', { p_auction_id: auctionId, p_drop_id: dropId });
          setBusy(false);
          if (e) return setError(messageFor(e.message));
          router.push(`/lot/${data}`);
        }}>
        Relist
      </button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
