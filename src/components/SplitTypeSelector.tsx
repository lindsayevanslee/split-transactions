import React from 'react';
import {
  ToggleButton,
  ToggleButtonGroup,
  Box,
  TextField,
  Checkbox,
  FormControlLabel,
  Typography,
  InputAdornment,
} from '@mui/material';
import { SplitType, Member } from '../types';
import { SplitInput, validateSplits } from '../utils/splitCalculator';

interface SplitTypeSelectorProps {
  splitType: SplitType;
  onSplitTypeChange: (type: SplitType) => void;
  members: Member[];
  splitInputs: SplitInput[];
  onSplitInputsChange: (inputs: SplitInput[]) => void;
  totalAmount: number;
}

export const SplitTypeSelector: React.FC<SplitTypeSelectorProps> = ({
  splitType,
  onSplitTypeChange,
  members,
  splitInputs,
  onSplitInputsChange,
  totalAmount,
}) => {
  const validation = validateSplits(totalAmount, splitType, splitInputs);

  const handleSplitTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: SplitType | null
  ) => {
    if (newType) {
      onSplitTypeChange(newType);
    }
  };

  const handleInputChange = (memberId: string, value: number | boolean) => {
    const newInputs = splitInputs.map(input => {
      if (input.memberId !== memberId) return input;

      if (splitType === 'equal') {
        return { ...input, included: value as boolean };
      } else {
        return { ...input, value: value as number };
      }
    });
    onSplitInputsChange(newInputs);
  };

  const getMemberName = (memberId: string) => {
    return members.find(m => m.id === memberId)?.name || 'Unknown';
  };

  const renderInputsForType = () => {
    switch (splitType) {
      case 'equal':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {splitInputs.map(input => (
              <FormControlLabel
                key={input.memberId}
                control={
                  <Checkbox
                    checked={input.included !== false}
                    onChange={(e) => handleInputChange(input.memberId, e.target.checked)}
                  />
                }
                label={getMemberName(input.memberId)}
              />
            ))}
            {splitInputs.filter(i => i.included !== false).length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Each pays: ${(totalAmount / splitInputs.filter(i => i.included !== false).length).toFixed(2)}
              </Typography>
            )}
          </Box>
        );

      case 'percentage':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {splitInputs.map(input => (
              <TextField
                key={input.memberId}
                label={getMemberName(input.memberId)}
                type="number"
                size="small"
                value={input.value || ''}
                onChange={(e) => handleInputChange(input.memberId, parseFloat(e.target.value) || 0)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
            ))}
            <Typography variant="body2" color={validation.valid ? 'text.secondary' : 'error'}>
              Total: {splitInputs.reduce((sum, i) => sum + (i.value || 0), 0).toFixed(1)}%
              {!validation.valid && ` - ${validation.error}`}
            </Typography>
          </Box>
        );

      case 'exact':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {splitInputs.map(input => (
              <TextField
                key={input.memberId}
                label={getMemberName(input.memberId)}
                type="number"
                size="small"
                value={input.value || ''}
                onChange={(e) => handleInputChange(input.memberId, parseFloat(e.target.value) || 0)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                inputProps={{ min: 0, step: 0.01 }}
              />
            ))}
            <Typography variant="body2" color={validation.valid ? 'text.secondary' : 'error'}>
              Total: ${splitInputs.reduce((sum, i) => sum + (i.value || 0), 0).toFixed(2)} of ${totalAmount.toFixed(2)}
              {!validation.valid && ` - ${validation.error}`}
            </Typography>
          </Box>
        );

      case 'shares':
        const totalShares = splitInputs.reduce((sum, i) => sum + (i.value || 0), 0);
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {splitInputs.map(input => {
              const shareAmount = totalShares > 0
                ? (input.value / totalShares) * totalAmount
                : 0;
              return (
                <Box key={input.memberId} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TextField
                    label={getMemberName(input.memberId)}
                    type="number"
                    size="small"
                    value={input.value || ''}
                    onChange={(e) => handleInputChange(input.memberId, parseFloat(e.target.value) || 0)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">shares</InputAdornment>,
                    }}
                    inputProps={{ min: 0, step: 1 }}
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                    = ${shareAmount.toFixed(2)}
                  </Typography>
                </Box>
              );
            })}
            {!validation.valid && (
              <Typography variant="body2" color="error">
                {validation.error}
              </Typography>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2">Split Type</Typography>
      <ToggleButtonGroup
        value={splitType}
        exclusive
        onChange={handleSplitTypeChange}
        size="small"
        fullWidth
      >
        <ToggleButton value="equal">Equal</ToggleButton>
        <ToggleButton value="percentage">%</ToggleButton>
        <ToggleButton value="exact">Exact</ToggleButton>
        <ToggleButton value="shares">Shares</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ mt: 1 }}>
        {renderInputsForType()}
      </Box>
    </Box>
  );
};

export default SplitTypeSelector;
