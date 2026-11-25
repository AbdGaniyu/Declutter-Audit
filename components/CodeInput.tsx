'use client';
import { useRef } from 'react';

/** Six-box numeric code input with auto-advance, backspace and paste. */
export function CodeInput({ value, onChange, label, idPrefix }: {
  value: string; onChange: (v: string) => void; label: string; idPrefix: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  function setAt(i: number, d: string) {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, 6));
  }

  return (
    <fieldset>
      <legend className="mb-1 text-eyebrow uppercase text-ink-muted">{label}</legend>
      <div className="flex justify-between gap-2">
        {digits.map((d, i) => (
          <input key={i} id={`${idPrefix}-${i}`} ref={(el) => { refs.current[i] = el; }}
            aria-label={`${label} digit ${i + 1}`} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
            value={d}
            className="h-14 w-full min-w-0 rounded-card border border-line bg-surface text-center font-num text-countdown tabular-nums focus:border-focus"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              if (v.length > 1) {
                // Pasted or autofilled the whole code.
                onChange(v.slice(0, 6));
                refs.current[Math.min(v.length, 6) - 1]?.focus();
                return;
              }
              setAt(i, v);
              if (v && i < 5) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) {
                setAt(i - 1, '');
                refs.current[i - 1]?.focus();
              }
            }}
            onPaste={(e) => {
              const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
              if (v) {
                e.preventDefault();
                onChange(v);
                refs.current[Math.min(v.length, 6) - 1]?.focus();
              }
            }} />
        ))}
      </div>
    </fieldset>
  );
}
