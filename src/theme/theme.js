'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#8B7355', // Warm brown
      light: '#A69076',
      dark: '#6B5344',
    },
    secondary: {
      main: '#C4A77D', // Soft golden tan
      light: '#D4BC9A',
      dark: '#A68B5B',
    },
    background: {
      default: '#FAF8F5', // Warm off-white
      paper: '#FFFFFF',
    },
    text: {
      primary: '#3D3D3D',
      secondary: '#6B6B6B',
    },
    error: {
      main: '#C67B7B', // Muted terracotta
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
      '@media (max-width:600px)': {
        fontSize: '2.2rem',
      },
    },
    h2: {
      fontSize: '2.2rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      '@media (max-width:600px)': {
        fontSize: '1.8rem',
      },
    },
    h3: {
      fontSize: '1.8rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.7,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontSize: '1rem',
          padding: '12px 32px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        },
      },
    },
  },
});

export default theme;
