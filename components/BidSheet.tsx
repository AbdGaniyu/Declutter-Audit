'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Input } from '@/components/Field';
import { formatNaira, parseNairaInput } from '@/lib/money';

/** Bottom sheet: min next bid preselected, quick +step buttons, confirm. */
export function BidSheet({
  open,
  minNext,
  step,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  minNext: number;
  step: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (amountKobo: number) => void;
}) {
  const [amount, setAmount] = useState(minNext);
  const [typed, setTyped] = useState('');

  // When someone else bids, never leave a now-invalid amount selected.
  useEffect(() => {
    setAmount((a) => (a < minNext ? minNext : a));
  }, [minNext]);
  useEffect(() => {
    if (open) {
      setAmount(minNext);
      setTyped('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const quick = [0, 1, 2, 5].map((n) => minNext + n * step);

  function onType(v: string) {
    setTyped(v);
    const k = parseNairaInput(v);
    if (k !== null) setAmount(k);
  }

  const valid = amount >= minNext && amount % 100 === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label="Place a bid"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="w-full max-w-3xl rounded-t-card bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-pill bg-line" aria-hidden />
        <p className="text-small text-muted">Minimum bid {formatNaira(minNext)}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => { setAmount(q); setTyped(''); }}
              className={`min-h-11 rounded-pill border text-small font-semibold tabular-nums ${
                amount === q ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface text-ink'}`}>
              {formatNaira(q)}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Input inputMode="numeric" aria-label="Custom amount in naira" placeholder="Or type an amount (₦)"
            value={typed} onChange={(e) => onType(e.target.value)} />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button block disabled={busy || !valid} onClick={() => onConfirm(amount)}>
            {busy ? 'Placing bid…' : `Bid ${formatNaira(amount)}`}
          </Button>
        </div>
        <p className="mt-3 text-center text-small text-muted">
          If you win, you have 30 minutes to pay. Unpaid wins get a strike.
        </p>
      </div>
    </div>
  );
}
