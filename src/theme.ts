import { createTheme } from '@mui/material/styles';

// Retro Bank/Ledger Theme
// Inspired by vintage checkbooks, balance sheets, and banker's documents

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1a472a', // Banker's green
      light: '#2d5a3d',
      dark: '#0d2818',
      contrastText: '#f5f0e1',
    },
    secondary: {
      main: '#8b0000', // Deep red for debits/negative
      light: '#a52a2a',
      dark: '#5c0000',
    },
    background: {
      default: '#f5f0e1', // Aged paper
      paper: '#faf6eb', // Slightly lighter paper
    },
    text: {
      primary: '#2c2416', // Dark sepia ink
      secondary: '#5c4d3a', // Faded ink
    },
    success: {
      main: '#1a472a', // Green for credits
    },
    error: {
      main: '#8b0000', // Red for debits
    },
    divider: '#c4b89b', // Ruled line color
  },
  typography: {
    // Cormorant Garamond: elegant display serif for headings (classic banking/finance feel)
    // Crimson Pro: readable text serif for body (maintains vintage consistency)
    // IBM Plex Mono: monospace for numbers/currency
    fontFamily: '"Crimson Pro", "Georgia", "Times New Roman", serif',
    h1: {
      fontFamily: '"Merriweather", Georgia, serif',
      fontWeight: 600,
      fontSize: '2.75rem',
      letterSpacing: '0.02em',
    },
    h2: {
      fontFamily: '"Merriweather", Georgia, serif',
      fontWeight: 600,
      fontSize: '2.25rem',
    },
    h3: {
      fontFamily: '"Merriweather", Georgia, serif',
      fontWeight: 600,
      fontSize: '1.85rem',
    },
    h4: {
      fontFamily: '"Merriweather", Georgia, serif',
      fontWeight: 600,
      fontSize: '1.5rem',
      letterSpacing: '0.01em',
    },
    h5: {
      fontFamily: '"Merriweather", Georgia, serif',
      fontWeight: 600,
      fontSize: '1.3rem',
    },
    h6: {
      fontFamily: '"Merriweather", Georgia, serif',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      fontSize: '0.9rem',
    },
    body1: {
      fontFamily: '"Crimson Pro", "Georgia", serif',
      fontSize: '1.1rem',
      lineHeight: 1.65,
    },
    body2: {
      fontFamily: '"Crimson Pro", "Georgia", serif',
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    button: {
      fontFamily: '"Crimson Pro", "Georgia", serif',
      fontWeight: 600,
      fontSize: '1rem',
      letterSpacing: '0.03em',
    },
    caption: {
      fontFamily: '"Crimson Pro", "Georgia", serif',
      fontSize: '0.85rem',
      letterSpacing: '0.02em',
    },
    overline: {
      fontFamily: '"Merriweather", Georgia, serif',
      fontWeight: 600,
      letterSpacing: '0.15em',
    },
  },
  shape: {
    borderRadius: 2, // Sharp corners for that ledger feel
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100% 28px',
          position: 'relative',
          cursor: 'url(/split-transactions/cursor-pen.svg) 4 4, auto',
          '&::before, &::after': {
            content: '""',
            position: 'fixed',
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: 'rgba(139, 0, 0, 0.2)',
            pointerEvents: 'none',
            zIndex: 0,
          },
          '&::before': {
            left: 'max(16px, calc((100vw - 1200px) / 2 - 24px))',
          },
          '&::after': {
            right: 'max(16px, calc((100vw - 1200px) / 2 - 24px))',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 2,
          boxShadow: 'none',
          border: '1px solid',
          '&:hover': {
            boxShadow: '2px 2px 0px rgba(0,0,0,0.15)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '2px 2px 0px rgba(0,0,0,0.2)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '3px 3px 0px rgba(0,0,0,0.1)',
          border: '1px solid #c4b89b',
        },
        elevation1: {
          boxShadow: '2px 2px 0px rgba(0,0,0,0.08)',
        },
        elevation2: {
          boxShadow: '3px 3px 0px rgba(0,0,0,0.1)',
        },
        elevation3: {
          boxShadow: '4px 4px 0px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 0 rgba(0,0,0,0.1)',
          borderBottom: '2px solid #0d2818',
          border: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #c4b89b',
          fontFamily: '"Crimson Pro", Georgia, serif',
        },
        head: {
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '0.85rem',
          backgroundColor: '#efe9d9',
          borderBottom: '2px solid #1a472a',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          border: '2px solid #1a472a',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          fontFamily: '"Crimson Pro", Georgia, serif',
          fontWeight: 600,
        },
        outlined: {
          borderWidth: '1.5px',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
          minWidth: 120,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            backgroundColor: '#faf6eb',
            '& fieldset': {
              borderColor: '#c4b89b',
              borderWidth: '1.5px',
            },
            '&:hover fieldset': {
              borderColor: '#1a472a',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#1a472a',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: '2px solid #1a472a',
          boxShadow: '6px 6px 0px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: '"Merriweather", Georgia, serif',
          fontWeight: 600,
          fontSize: '1.25rem',
          borderBottom: '1px solid #c4b89b',
          backgroundColor: '#efe9d9',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderBottom: '1px dashed #c4b89b',
          '&:last-child': {
            borderBottom: 'none',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          border: '1.5px solid',
        },
        standardSuccess: {
          backgroundColor: '#e8f0e8',
          borderColor: '#1a472a',
        },
        standardError: {
          backgroundColor: '#f8e8e8',
          borderColor: '#8b0000',
        },
        standardWarning: {
          backgroundColor: '#f5f0e1',
          borderColor: '#b8860b',
        },
        standardInfo: {
          backgroundColor: '#e8eff5',
          borderColor: '#2c5282',
        },
      },
    },
  },
});

export default theme; 