import { formatNaira } from '@/lib/money';

export function Price({ kobo, className = '' }: { kobo: number | null | undefined; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatNaira(kobo)}</span>;
}
