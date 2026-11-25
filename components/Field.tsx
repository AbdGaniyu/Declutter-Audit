import { CircleAlert } from 'lucide-react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { iconProps } from '@/components/icons';

const base =
  'squircle w-full min-h-12 rounded-control bg-surface px-4 py-3 text-body text-label placeholder:text-secondary outline-none focus:shadow-[0_0_0_2px_var(--label)]';

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-subhead font-semibold text-label">
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${base} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} ${props.className ?? ''}`} />;
}

/** Errors: a --fill panel with an icon. Monochrome: crimson is only for ending soon and the bid. */
export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="squircle mt-2 flex items-start gap-2 rounded-control bg-fill px-4 py-3 text-subhead text-label">
      <CircleAlert {...iconProps} size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`squircle rounded-group bg-surface p-4 ${className}`}>{children}</div>;
}
