import { describe, expect, it } from 'vitest';
import { maskPhone, normalizeNigerianPhone } from '@/lib/phone';

describe('normalizeNigerianPhone', () => {
  it('normalises common formats to E.164', () => {
    expect(normalizeNigerianPhone('08031234567')).toBe('+2348031234567');
    expect(normalizeNigerianPhone('0803 123 4567')).toBe('+2348031234567');
    expect(normalizeNigerianPhone('+234 803 123 4567')).toBe('+2348031234567');
    expect(normalizeNigerianPhone('2349031234567')).toBe('+2349031234567');
    expect(normalizeNigerianPhone('7031234567')).toBe('+2347031234567');
  });
  it('rejects invalid numbers', () => {
    expect(normalizeNigerianPhone('0123')).toBeNull();
    expect(normalizeNigerianPhone('01234567890')).toBeNull();
    expect(normalizeNigerianPhone('+14155552671')).toBeNull();
  });
});

describe('maskPhone (Verify phone, PDF p.10)', () => {
  it('shows the prefix and last four digits of a Nigerian number', () => {
    expect(maskPhone('2348032212211')).toBe('0803 ••• 2211');
    expect(maskPhone('+2348032212211')).toBe('0803 ••• 2211');
  });
  it('leaves anything else alone', () => {
    expect(maskPhone('12345')).toBe('12345');
  });
});
