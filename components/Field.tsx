import { CircleAlert } from 'lucide-react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { iconProps } from '@/components/icons';

const base =
  'w-full min-h-11 rounded-card border border-line bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-muted focus:border-focus';

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-label uppercase text-ink-muted">
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

/** Errors: --live-soft panel with an icon, text stays --ink for contrast. */
export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 flex items-start gap-2 rounded-card bg-live-soft px-3 py-2 text-body text-ink">
      <CircleAlert {...iconProps} size={18} className="mt-0.5 shrink-0 text-live" />
      <span>{children}</span>
    </p>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-card bg-surface p-4 shadow-elev ${className}`}>{children}</div>;
}
