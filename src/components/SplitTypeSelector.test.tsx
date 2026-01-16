import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitTypeSelector } from './SplitTypeSelector';
import { Member } from '../types';
import { SplitInput } from '../utils/splitCalculator';

const mockMembers: Member[] = [
  { id: '1', name: 'Alice', balance: 0, status: 'active' },
  { id: '2', name: 'Bob', balance: 0, status: 'active' },
  { id: '3', name: 'Charlie', balance: 0, status: 'active' },
];

describe('SplitTypeSelector', () => {
  it('renders all split type buttons', () => {
    const inputs: SplitInput[] = [
      { memberId: '1', value: 0, included: true },
      { memberId: '2', value: 0, included: true },
    ];

    render(
      <SplitTypeSelector
        splitType="equal"
        onSplitTypeChange={vi.fn()}
        members={mockMembers}
        splitInputs={inputs}
        onSplitInputsChange={vi.fn()}
        totalAmount={100}
      />
    );

    expect(screen.getByRole('button', { name: /equal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exact/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /shares/i })).toBeInTheDocument();
  });

  it('calls onSplitTypeChange when a different type is selected', () => {
    const onSplitTypeChange = vi.fn();
    const inputs: SplitInput[] = [
      { memberId: '1', value: 0, included: true },
    ];

    render(
      <SplitTypeSelector
        splitType="equal"
        onSplitTypeChange={onSplitTypeChange}
        members={mockMembers}
        splitInputs={inputs}
        onSplitInputsChange={vi.fn()}
        totalAmount={100}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /%/i }));
    expect(onSplitTypeChange).toHaveBeenCalledWith('percentage');
  });

  describe('equal split', () => {
    it('shows checkboxes for each member', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 0, included: true },
        { memberId: '2', value: 0, included: true },
        { memberId: '3', value: 0, included: false },
      ];

      render(
        <SplitTypeSelector
          splitType="equal"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={100}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('shows calculated equal amount per person', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 0, included: true },
        { memberId: '2', value: 0, included: true },
      ];

      render(
        <SplitTypeSelector
          splitType="equal"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={100}
        />
      );

      expect(screen.getByText(/each pays.*\$50\.00/i)).toBeInTheDocument();
    });

    it('calls onSplitInputsChange when checkbox toggled', () => {
      const onSplitInputsChange = vi.fn();
      const inputs: SplitInput[] = [
        { memberId: '1', value: 0, included: true },
        { memberId: '2', value: 0, included: true },
      ];

      render(
        <SplitTypeSelector
          splitType="equal"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={onSplitInputsChange}
          totalAmount={100}
        />
      );

      const aliceCheckbox = screen.getByRole('checkbox', { name: /alice/i });
      fireEvent.click(aliceCheckbox);

      expect(onSplitInputsChange).toHaveBeenCalled();
      const newInputs = onSplitInputsChange.mock.calls[0][0];
      expect(newInputs.find((i: SplitInput) => i.memberId === '1').included).toBe(false);
    });
  });

  describe('percentage split', () => {
    it('shows percentage input fields for each member', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 50 },
        { memberId: '2', value: 50 },
      ];

      render(
        <SplitTypeSelector
          splitType="percentage"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={100}
        />
      );

      expect(screen.getByLabelText('Alice')).toBeInTheDocument();
      expect(screen.getByLabelText('Bob')).toBeInTheDocument();
    });

    it('shows total percentage', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 60 },
        { memberId: '2', value: 40 },
      ];

      render(
        <SplitTypeSelector
          splitType="percentage"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={100}
        />
      );

      expect(screen.getByText(/total.*100\.0%/i)).toBeInTheDocument();
    });

    it('shows error when percentages do not total 100', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 50 },
        { memberId: '2', value: 30 },
      ];

      render(
        <SplitTypeSelector
          splitType="percentage"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={100}
        />
      );

      expect(screen.getByText(/80\.0%/)).toBeInTheDocument();
      expect(screen.getByText(/must total 100%/i)).toBeInTheDocument();
    });
  });

  describe('exact split', () => {
    it('shows dollar input fields for each member', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 60 },
        { memberId: '2', value: 40 },
      ];

      render(
        <SplitTypeSelector
          splitType="exact"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={100}
        />
      );

      expect(screen.getByLabelText('Alice')).toBeInTheDocument();
      expect(screen.getByLabelText('Bob')).toBeInTheDocument();
    });

    it('shows error when amounts do not match total', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 50 },
        { memberId: '2', value: 30 },
      ];

      render(
        <SplitTypeSelector
          splitType="exact"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={100}
        />
      );

      expect(screen.getByText(/\$80\.00.*of.*\$100\.00/)).toBeInTheDocument();
      expect(screen.getByText(/must total/i)).toBeInTheDocument();
    });
  });

  describe('shares split', () => {
    it('shows share input fields with calculated amounts', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 2 },
        { memberId: '2', value: 1 },
      ];

      render(
        <SplitTypeSelector
          splitType="shares"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={90}
        />
      );

      expect(screen.getByLabelText('Alice')).toBeInTheDocument();
      expect(screen.getByLabelText('Bob')).toBeInTheDocument();
      // Alice has 2 shares, Bob has 1 share, total 3 shares
      // Alice: 2/3 * 90 = 60, Bob: 1/3 * 90 = 30
      expect(screen.getByText(/= \$60\.00/)).toBeInTheDocument();
      expect(screen.getByText(/= \$30\.00/)).toBeInTheDocument();
    });

    it('shows error when total shares is 0', () => {
      const inputs: SplitInput[] = [
        { memberId: '1', value: 0 },
        { memberId: '2', value: 0 },
      ];

      render(
        <SplitTypeSelector
          splitType="shares"
          onSplitTypeChange={vi.fn()}
          members={mockMembers}
          splitInputs={inputs}
          onSplitInputsChange={vi.fn()}
          totalAmount={100}
        />
      );

      expect(screen.getByText(/greater than 0/i)).toBeInTheDocument();
    });
  });
});
