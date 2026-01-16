import { describe, it, expect } from 'vitest';
import {
  calculateSplits,
  validateSplits,
  getDefaultSplitInputs,
  SplitInput,
} from './splitCalculator';

describe('calculateSplits', () => {
  describe('equal split', () => {
    it('splits amount equally among all included members', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 0, included: true },
        { memberId: 'b', value: 0, included: true },
        { memberId: 'c', value: 0, included: true },
      ];
      const result = calculateSplits(90, 'equal', inputs);

      expect(result).toHaveLength(3);
      expect(result[0].amount).toBeCloseTo(30);
      expect(result[1].amount).toBeCloseTo(30);
      expect(result[2].amount).toBeCloseTo(30);
    });

    it('excludes members marked as not included', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 0, included: true },
        { memberId: 'b', value: 0, included: false },
        { memberId: 'c', value: 0, included: true },
      ];
      const result = calculateSplits(100, 'equal', inputs);

      expect(result[0].amount).toBeCloseTo(50);
      expect(result[1].amount).toBe(0);
      expect(result[2].amount).toBeCloseTo(50);
    });

    it('handles single member', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 0, included: true },
      ];
      const result = calculateSplits(100, 'equal', inputs);

      expect(result[0].amount).toBe(100);
    });

    it('returns zero amounts when no members included', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 0, included: false },
        { memberId: 'b', value: 0, included: false },
      ];
      const result = calculateSplits(100, 'equal', inputs);

      expect(result[0].amount).toBe(0);
      expect(result[1].amount).toBe(0);
    });
  });

  describe('percentage split', () => {
    it('calculates amounts based on percentages', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 50 },
        { memberId: 'b', value: 30 },
        { memberId: 'c', value: 20 },
      ];
      const result = calculateSplits(100, 'percentage', inputs);

      expect(result[0].amount).toBe(50);
      expect(result[0].percentage).toBe(50);
      expect(result[1].amount).toBe(30);
      expect(result[1].percentage).toBe(30);
      expect(result[2].amount).toBe(20);
      expect(result[2].percentage).toBe(20);
    });

    it('handles fractional percentages', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 33.33 },
        { memberId: 'b', value: 33.33 },
        { memberId: 'c', value: 33.34 },
      ];
      const result = calculateSplits(100, 'percentage', inputs);

      expect(result[0].amount).toBeCloseTo(33.33);
      expect(result[1].amount).toBeCloseTo(33.33);
      expect(result[2].amount).toBeCloseTo(33.34);
    });

    it('handles zero percentage', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 100 },
        { memberId: 'b', value: 0 },
      ];
      const result = calculateSplits(50, 'percentage', inputs);

      expect(result[0].amount).toBe(50);
      expect(result[1].amount).toBe(0);
    });
  });

  describe('exact split', () => {
    it('uses exact amounts as specified', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 25 },
        { memberId: 'b', value: 50 },
        { memberId: 'c', value: 25 },
      ];
      const result = calculateSplits(100, 'exact', inputs);

      expect(result[0].amount).toBe(25);
      expect(result[1].amount).toBe(50);
      expect(result[2].amount).toBe(25);
    });

    it('handles zero and decimal amounts', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 99.99 },
        { memberId: 'b', value: 0.01 },
      ];
      const result = calculateSplits(100, 'exact', inputs);

      expect(result[0].amount).toBe(99.99);
      expect(result[1].amount).toBe(0.01);
    });
  });

  describe('shares split', () => {
    it('splits proportionally based on shares', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 2 },
        { memberId: 'b', value: 1 },
      ];
      const result = calculateSplits(90, 'shares', inputs);

      expect(result[0].amount).toBeCloseTo(60); // 2/3 of 90
      expect(result[0].shares).toBe(2);
      expect(result[1].amount).toBeCloseTo(30); // 1/3 of 90
      expect(result[1].shares).toBe(1);
    });

    it('handles equal shares', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 1 },
        { memberId: 'b', value: 1 },
        { memberId: 'c', value: 1 },
      ];
      const result = calculateSplits(90, 'shares', inputs);

      expect(result[0].amount).toBeCloseTo(30);
      expect(result[1].amount).toBeCloseTo(30);
      expect(result[2].amount).toBeCloseTo(30);
    });

    it('handles zero total shares', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 0 },
        { memberId: 'b', value: 0 },
      ];
      const result = calculateSplits(100, 'shares', inputs);

      expect(result[0].amount).toBe(0);
      expect(result[1].amount).toBe(0);
    });

    it('handles large share ratios', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 10 },
        { memberId: 'b', value: 90 },
      ];
      const result = calculateSplits(100, 'shares', inputs);

      expect(result[0].amount).toBe(10);
      expect(result[1].amount).toBe(90);
    });
  });
});

describe('validateSplits', () => {
  describe('equal split validation', () => {
    it('validates when at least one member included', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 0, included: true },
        { memberId: 'b', value: 0, included: false },
      ];
      const result = validateSplits(100, 'equal', inputs);

      expect(result.valid).toBe(true);
    });

    it('fails when no members included', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 0, included: false },
        { memberId: 'b', value: 0, included: false },
      ];
      const result = validateSplits(100, 'equal', inputs);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one member');
    });
  });

  describe('percentage split validation', () => {
    it('validates when percentages total 100', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 60 },
        { memberId: 'b', value: 40 },
      ];
      const result = validateSplits(100, 'percentage', inputs);

      expect(result.valid).toBe(true);
    });

    it('validates with small floating point differences', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 33.33 },
        { memberId: 'b', value: 33.33 },
        { memberId: 'c', value: 33.34 },
      ];
      const result = validateSplits(100, 'percentage', inputs);

      expect(result.valid).toBe(true);
    });

    it('fails when percentages do not total 100', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 50 },
        { memberId: 'b', value: 40 },
      ];
      const result = validateSplits(100, 'percentage', inputs);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('100%');
      expect(result.error).toContain('90.0%');
    });
  });

  describe('exact split validation', () => {
    it('validates when amounts total the transaction', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 60 },
        { memberId: 'b', value: 40 },
      ];
      const result = validateSplits(100, 'exact', inputs);

      expect(result.valid).toBe(true);
    });

    it('fails when amounts do not match total', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 50 },
        { memberId: 'b', value: 40 },
      ];
      const result = validateSplits(100, 'exact', inputs);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('$100.00');
      expect(result.error).toContain('$90.00');
    });
  });

  describe('shares split validation', () => {
    it('validates when total shares greater than 0', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 1 },
        { memberId: 'b', value: 2 },
      ];
      const result = validateSplits(100, 'shares', inputs);

      expect(result.valid).toBe(true);
    });

    it('fails when total shares is 0', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 0 },
        { memberId: 'b', value: 0 },
      ];
      const result = validateSplits(100, 'shares', inputs);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('greater than 0');
    });

    it('fails when any share is negative', () => {
      const inputs: SplitInput[] = [
        { memberId: 'a', value: 2 },
        { memberId: 'b', value: -1 },
      ];
      const result = validateSplits(100, 'shares', inputs);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('negative');
    });
  });

  it('fails when inputs array is empty', () => {
    const result = validateSplits(100, 'equal', []);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('At least one member');
  });
});

describe('getDefaultSplitInputs', () => {
  const memberIds = ['a', 'b', 'c'];

  it('creates equal split inputs with all members included', () => {
    const inputs = getDefaultSplitInputs(memberIds, 'equal');

    expect(inputs).toHaveLength(3);
    inputs.forEach(input => {
      expect(input.included).toBe(true);
      expect(input.value).toBe(0);
    });
  });

  it('creates percentage inputs with equal default percentages', () => {
    const inputs = getDefaultSplitInputs(memberIds, 'percentage');

    expect(inputs).toHaveLength(3);
    inputs.forEach(input => {
      expect(input.value).toBeCloseTo(33.33, 1);
    });
  });

  it('creates exact inputs with zero amounts', () => {
    const inputs = getDefaultSplitInputs(memberIds, 'exact');

    expect(inputs).toHaveLength(3);
    inputs.forEach(input => {
      expect(input.value).toBe(0);
    });
  });

  it('creates shares inputs with 1 share each', () => {
    const inputs = getDefaultSplitInputs(memberIds, 'shares');

    expect(inputs).toHaveLength(3);
    inputs.forEach(input => {
      expect(input.value).toBe(1);
    });
  });

  it('handles empty member list', () => {
    const inputs = getDefaultSplitInputs([], 'equal');

    expect(inputs).toHaveLength(0);
  });
});
