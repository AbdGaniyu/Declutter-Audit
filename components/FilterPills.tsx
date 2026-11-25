'use client';

// DESIGN.md › Segmented control and filter pills: plain text pills; the active
// one is a glass capsule. Scrolls sideways on small screens.
export type FilterOption = { key: string; label: string };

export function FilterPills({
  options,
  value,
  onChange,
  label,
}: {
  options: FilterOption[];
  value: string;
  onChange: (key: string) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.key)}
            className={`pressable min-h-11 shrink-0 rounded-pill px-4 text-subhead transition-colors duration-300 ease-spring
              ${on ? 'glass-chip font-semibold text-label' : 'text-secondary hover:text-label'}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
