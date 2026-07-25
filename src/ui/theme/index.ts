import { createTheme, Theme } from '@mui/material';
import { lightPalette, darkPalette } from './palette';
import { typography } from './typography';
import { components } from './components';

export const createAppTheme = (mode: 'light' | 'dark'): Theme =>
  createTheme({
    palette: mode === 'light' ? lightPalette : darkPalette,
    typography,
    components,
    shape: {
      borderRadius: 12,
    },
  });
