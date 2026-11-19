import { describe, expect, it } from 'vitest';
import { formatNaira, parseNairaInput, previewStep } from '@/lib/money';

describe('formatNaira', () => {
  it('formats whole naira from kobo', () => {
    expect(formatNaira(2_500_000)).toBe('₦25,000');
    expect(formatNaira(50_000)).toBe('₦500');
    expect(formatNaira(0)).toBe('₦0');
  });
  it('shows kobo only when present', () => {
    expect(formatNaira(2_500_050)).toBe('₦25,000.50');
  });
  it('handles bigint, negatives and missing values', () => {
    expect(formatNaira(10_000_000n)).toBe('₦100,000');
    expect(formatNaira(-50_000)).toBe('-₦500');
    expect(formatNaira(null)).toBe('—');
  });
});

describe('parseNairaInput', () => {
  it('accepts common inputs', () => {
    expect(parseNairaInput('25,000')).toBe(2_500_000);
    expect(parseNairaInput('₦ 25000')).toBe(2_500_000);
    expect(parseNairaInput('25000.00')).toBe(2_500_000);
  });
  it('rejects fractions, zero and junk', () => {
    expect(parseNairaInput('25000.50')).toBeNull();
    expect(parseNairaInput('0')).toBeNull();
    expect(parseNairaInput('abc')).toBeNull();
    expect(parseNairaInput('')).toBeNull();
  });
});

describe('previewStep (mirror of public.step_for)', () => {
  it('matches the step table', () => {
    expect(previewStep(1_999_900)).toBe(50_000);
    expect(previewStep(2_000_000)).toBe(100_000);
    expect(previewStep(9_999_900)).toBe(100_000);
    expect(previewStep(10_000_000)).toBe(250_000);
  });
});
