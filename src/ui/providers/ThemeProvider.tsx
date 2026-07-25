'use client';
import { ReactNode, useMemo, useState, createContext, useContext, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from '../theme';

interface ThemeContextValue {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ mode: 'light', toggleTheme: () => {} });

export function useThemeMode() {
  return useContext(ThemeContext);
}

interface UIThemeProviderProps {
  children: ReactNode;
  defaultMode?: 'light' | 'dark';
  storageKey?: string;
}

export function UIThemeProvider({
  children,
  defaultMode = 'light',
  storageKey = 'theme-mode',
}: UIThemeProviderProps) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return (saved === 'dark' || saved === 'light') ? saved : defaultMode;
    }
    return defaultMode;
  });

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, next);
      }
      return next;
    });
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.dataset.theme = mode;
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
