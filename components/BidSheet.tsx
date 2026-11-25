'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { formatNaira, parseNairaInput } from '@/lib/money';

export type Rejection = { key: number; message: string } | null;

/**
 * DESIGN.md › Bid sheet: quick picks min, +1 step, +2 steps, plus a custom
 * amount. One tap confirms (no second dialog). On rejection the sheet shakes
 * once, gently, shows the reason, and the new minimum is prefilled.
 */
export function BidSheet({ open, minNext, step, busy, rejection, onClose, onConfirm }: {
  open: boolean;
  minNext: number;
  step: number;
  busy: boolean;
  rejection: Rejection;
  onClose: () => void;
  onConfirm: (amountKobo: number) => void;
}) {
  const [amount, setAmount] = useState(minNext);
  const [typed, setTyped] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (open) {
      setAmount(minNext);
      setTyped('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Someone else bid: never leave a now-invalid amount selected.
  useEffect(() => {
    setAmount((a) => (a < minNext ? minNext : a));
  }, [minNext]);

  // Rejected: shake once and prefill the new minimum.
  useEffect(() => {
    if (!rejection) return;
    setShakeKey(rejection.key);
    setAmount(minNext);
    setTyped('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejection?.key]);

  const picks = [
    { label: 'Min', value: minNext },
    { label: '+1 step', value: minNext + step },
    { label: '+2 steps', value: minNext + 2 * step },
  ];
  const valid = amount >= minNext && amount % 100 === 0;

  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title="Place your bid">
      <div key={shakeKey} className={shakeKey ? 'gentle-shake' : ''}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Quick picks">
          {picks.map((p) => {
            const on = amount === p.value && !typed;
            return (
              <button key={p.label} type="button" role="radio" aria-checked={on}
                onClick={() => { setAmount(p.value); setTyped(''); }}
                className={`flex min-h-14 flex-col items-center justify-center rounded-card border ${
                  on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink'}`}>
                <span className="text-eyebrow uppercase">{p.label}</span>
                <span className="font-num text-[17px] font-semibold tabular-nums">{formatNaira(p.value)}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <Label htmlFor="custom-bid">Custom amount (₦)</Label>
          <Input id="custom-bid" inputMode="numeric" placeholder={formatNaira(minNext).slice(1)}
            className="font-num tabular-nums" value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              const k = parseNairaInput(e.target.value);
              if (k !== null) setAmount(k);
            }} />
          {typed && !valid && <p className="mt-1 text-body text-ink-muted">At least {formatNaira(minNext)}, in whole naira.</p>}
        </div>
        <ErrorText>{rejection?.message}</ErrorText>
        <Button variant="live" tall block className="mt-4" busy={busy} disabled={!valid} onClick={() => onConfirm(amount)}>
          Bid {formatNaira(amount)}
        </Button>
        <p className="mt-3 text-center text-body text-ink-muted">Pay within 30 minutes if you win, or it goes to the next bidder.</p>
      </div>
    </Sheet>
  );
}
