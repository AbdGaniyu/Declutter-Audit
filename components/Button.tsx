import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const styles: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink',
  secondary: 'bg-surface text-ink border border-line',
  ghost: 'bg-transparent text-brand',
  danger: 'bg-danger text-brand-ink',
};

export function Button({
  variant = 'primary',
  block = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-5 text-body font-semibold
        transition-opacity disabled:opacity-50 active:opacity-80 ${styles[variant]} ${block ? 'w-full' : ''} ${className}`}
    />
  );
}
