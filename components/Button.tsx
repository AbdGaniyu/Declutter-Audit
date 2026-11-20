import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { iconProps } from '@/components/icons';

type Variant = 'primary' | 'live' | 'secondary' | 'link';

const styles: Record<Variant, string> = {
  // Primary buttons are --ink (DESIGN.md › Color tokens).
  primary: 'bg-ink text-white font-semibold',
  // The main bid button is --live; white text only at 16px semibold or larger.
  live: 'bg-live text-white text-[16px] font-semibold',
  secondary: 'bg-surface text-ink border border-line font-semibold',
  link: 'bg-transparent text-focus font-semibold underline-offset-2 hover:underline',
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
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-pill px-6 transition-opacity
        disabled:cursor-not-allowed disabled:opacity-40 ${tall ? 'min-h-14' : 'min-h-11'}
        ${styles[variant]} ${block ? 'w-full' : ''} ${className}`}
    >
      {busy && <Loader2 {...iconProps} size={18} className="animate-spin" />}
      {children}
    </button>
  );
}
