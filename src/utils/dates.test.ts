import { describe, it, expect } from 'vitest';
import { toDateInputValue, fromDateInputValue } from './dates';

describe('toDateInputValue', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(toDateInputValue(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateInputValue(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
});

describe('fromDateInputValue', () => {
  it('returns local noon on that day', () => {
    const date = fromDateInputValue('2026-03-08');
    expect(date).toEqual(new Date(2026, 2, 8, 12));
  });

  it('round-trips with toDateInputValue', () => {
    expect(toDateInputValue(fromDateInputValue('2024-02-29')!)).toBe('2024-02-29');
  });

  it('rejects empty, malformed and impossible dates', () => {
    expect(fromDateInputValue('')).toBeNull();
    expect(fromDateInputValue('2026-3-8')).toBeNull();
    expect(fromDateInputValue('2026-02-30')).toBeNull();
    expect(fromDateInputValue('2026-13-01')).toBeNull();
  });
});
