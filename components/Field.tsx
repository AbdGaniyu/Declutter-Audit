import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const base =
  'w-full rounded-card border border-line bg-surface px-3 py-2.5 text-body text-ink placeholder:text-muted focus:border-brand focus:outline-none';

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-small font-semibold text-ink">
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

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-small text-danger">
      {children}
    </p>
  );
}
