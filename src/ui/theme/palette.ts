import { PaletteOptions } from '@mui/material';

export const lightPalette: PaletteOptions = {
  mode: 'light',
  primary: {
    main: '#BFE530',
    light: '#D1FA94',
    dark: '#464C3D',
    contrastText: '#1a1d17',
  },
  secondary: {
    main: '#9AA981',
    light: '#DEF3BC',
    dark: '#464C3D',
  },
  error: {
    main: '#FC5B3E',
  },
  warning: {
    main: '#FFE388',
    contrastText: '#5a4b00',
  },
  success: {
    main: '#BFE530',
  },
  background: {
    default: '#F7F8F3',
    paper: '#FFFFFF',
  },
  text: {
    primary: '#2D2F2A',
    secondary: '#6B6E65',
    disabled: '#A3A69D',
  },
  divider: '#E0E3D8',
};

export const darkPalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#BFE530',
    light: '#D1FA94',
    dark: '#8fb020',
    contrastText: '#1a1d17',
  },
  secondary: {
    main: '#9AA981',
    light: '#464C3D',
    dark: '#2a2d25',
  },
  error: {
    main: '#FC5B3E',
  },
  warning: {
    main: '#FFE388',
    contrastText: '#5a4b00',
  },
  success: {
    main: '#BFE530',
  },
  background: {
    default: '#141714',
    paper: '#1E211E',
  },
  text: {
    primary: '#E8EAE3',
    secondary: '#A0A39A',
    disabled: '#6B6E65',
  },
  divider: '#2B2E28',
};
