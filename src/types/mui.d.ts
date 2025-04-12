import { GridProps } from '@mui/material/Grid';

declare module '@mui/material/Grid' {
  interface GridProps {
    xs?: number | 'auto' | true;
    sm?: number | 'auto' | true;
    md?: number | 'auto' | true;
    lg?: number | 'auto' | true;
    xl?: number | 'auto' | true;
  }
} 