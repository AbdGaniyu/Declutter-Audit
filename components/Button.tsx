import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { iconProps } from '@/components/icons';

// DESIGN.md › Buttons. Capsules, no borders. Crimson is only for the bid action,
// which is SlideToBid, plus "Bid ₦X" shortcuts (variant "bid").
type Variant = 'primary' | 'secondary' | 'text' | 'bid' | /* TEMPORARY v1 aliases */ 'live' | 'link';

const styles: Record<Variant, string> = {
  primary: 'bg-label text-on-label font-semibold',
  secondary: 'bg-fill text-label font-semibold',
  text: 'bg-transparent text-label font-semibold underline-offset-2 hover:underline',
  bid: 'bg-accent text-white font-semibold',
  live: 'bg-accent text-white font-semibold',
  link: 'bg-transparent text-label font-semibold underline-offset-2 hover:underline',
};

export function Button({
  variant = 'primary',
  block = false,
  busy = false,
  tall = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean; busy?: boolean; tall?: boolean }) {
  const flat = variant === 'text' || variant === 'link';
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`pressable inline-flex items-center justify-center gap-2 rounded-pill text-[17px] leading-[22px]
        ${flat ? 'min-h-11 px-2' : `px-6 ${tall ? 'min-h-14' : 'min-h-12'}`}
        disabled:cursor-not-allowed ${flat ? 'disabled:text-secondary' : 'disabled:bg-fill disabled:text-secondary'}
        ${styles[variant]} ${block ? 'w-full' : ''} ${className}`}
    >
      {busy && <Loader2 {...iconProps} size={18} className="animate-spin" />}
      {children}
    </button>
  );
}
