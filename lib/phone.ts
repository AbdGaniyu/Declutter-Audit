/**
 * Normalise a Nigerian phone number to E.164 (+234XXXXXXXXXX).
 * Accepts 08012345678, 8012345678, 2348012345678, +234 801 234 5678.
 */
export function normalizeNigerianPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '').replace(/^\+/, '');
  let national: string;
  if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  else return null;
  if (!/^[789]\d{9}$/.test(national)) return null;
  return `+234${national}`;
}

/** "2348032212211" → "0803 ••• 2211" (shown on the code step). */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (!/^234\d{10}$/.test(digits)) return e164;
  const local = `0${digits.slice(3)}`;
  return `${local.slice(0, 4)} ••• ${local.slice(-4)}`;
}
