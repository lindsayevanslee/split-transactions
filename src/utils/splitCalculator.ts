import { SplitType, Split } from '../types';

export interface SplitInput {
  memberId: string;
  value: number;  // percentage, exact amount, or shares count (ignored for equal)
  included?: boolean;  // for equal splits - whether member is included
}

export function calculateSplits(
  totalAmount: number,
  splitType: SplitType,
  inputs: SplitInput[]
): Split[] {
  switch (splitType) {
    case 'equal': {
      const includedMembers = inputs.filter(i => i.included !== false);
      const equalAmount = includedMembers.length > 0
        ? totalAmount / includedMembers.length
        : 0;
      return inputs.map(input => ({
        memberId: input.memberId,
        amount: input.included !== false ? equalAmount : 0,
      }));
    }

    case 'percentage':
      return inputs.map(input => ({
        memberId: input.memberId,
        amount: ((input.value || 0) / 100) * totalAmount,
        percentage: input.value || 0,
      }));

    case 'exact':
      return inputs.map(input => ({
        memberId: input.memberId,
        amount: input.value || 0,
      }));

    case 'shares': {
      const totalShares = inputs.reduce((sum, i) => sum + (i.value || 0), 0);
      return inputs.map(input => ({
        memberId: input.memberId,
        amount: totalShares > 0 ? ((input.value || 0) / totalShares) * totalAmount : 0,
        shares: input.value || 0,
      }));
    }

    default:
      return [];
  }
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSplits(
  totalAmount: number,
  splitType: SplitType,
  inputs: SplitInput[]
): ValidationResult {
  if (inputs.length === 0) {
    return { valid: false, error: 'At least one member must be included in the split' };
  }

  switch (splitType) {
    case 'equal': {
      const includedCount = inputs.filter(i => i.included !== false).length;
      if (includedCount === 0) {
        return { valid: false, error: 'At least one member must be included in the split' };
      }
      return { valid: true };
    }

    case 'percentage': {
      const totalPercent = inputs.reduce((sum, i) => sum + (i.value || 0), 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        return {
          valid: false,
          error: `Percentages must total 100% (currently ${totalPercent.toFixed(1)}%)`
        };
      }
      return { valid: true };
    }

    case 'exact': {
      const totalExact = inputs.reduce((sum, i) => sum + (i.value || 0), 0);
      if (Math.abs(totalExact - totalAmount) > 0.01) {
        return {
          valid: false,
          error: `Amounts must total $${totalAmount.toFixed(2)} (currently $${totalExact.toFixed(2)})`
        };
      }
      return { valid: true };
    }

    case 'shares': {
      const totalShares = inputs.reduce((sum, i) => sum + (i.value || 0), 0);
      if (totalShares <= 0) {
        return { valid: false, error: 'Total shares must be greater than 0' };
      }
      if (inputs.some(i => i.value < 0)) {
        return { valid: false, error: 'Shares cannot be negative' };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: 'Invalid split type' };
  }
}

// Helper to get default split inputs for a split type
export function getDefaultSplitInputs(
  memberIds: string[],
  splitType: SplitType
): SplitInput[] {
  switch (splitType) {
    case 'equal':
      return memberIds.map(memberId => ({
        memberId,
        value: 0,
        included: true,
      }));

    case 'percentage':
      const equalPercent = memberIds.length > 0 ? 100 / memberIds.length : 0;
      return memberIds.map(memberId => ({
        memberId,
        value: equalPercent,
      }));

    case 'exact':
      return memberIds.map(memberId => ({
        memberId,
        value: 0,
      }));

    case 'shares':
      return memberIds.map(memberId => ({
        memberId,
        value: 1,
      }));

    default:
      return [];
  }
}
