export const LAGOS_AREAS = [
  'Ajah', 'Apapa', 'Festac', 'Gbagada', 'Ikeja', 'Ikorodu', 'Ikoyi', 'Ilupeju', 'Isolo',
  'Ketu', 'Lekki', 'Magodo', 'Maryland', 'Ogba', 'Ojodu', 'Ojota', 'Oshodi', 'Sangotedo',
  'Surulere', 'Victoria Island', 'Yaba',
] as const;

export const CATEGORIES = [
  'Electronics', 'Phones', 'Furniture', 'Home', 'Kitchen', 'Fashion', 'Baby & Kids',
  'Books', 'Sports', 'Beauty', 'Other',
] as const;

export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'for_parts', label: 'For parts' },
] as const;

export function conditionLabel(value: string): string {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}
