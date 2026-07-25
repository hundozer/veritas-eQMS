'use client';
import {
  DarkMode as DarkIcon,
  LightMode as LightIcon,
} from '@mui/icons-material';
import type { ReactNode } from 'react';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  menuOpen?: boolean;
  themeMode?: 'light' | 'dark';
  onThemeToggle?: () => void;
  actions?: ReactNode;
}

export function Header({
  title,
  onMenuClick,
  menuOpen,
  themeMode = 'light',
  onThemeToggle,
  actions,
}: HeaderProps) {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className={`menu-btn${menuOpen ? ' open' : ''}`} onClick={onMenuClick} aria-label="Open menu">
          <div className="hamburger">
            <span />
            <span />
            <span />
          </div>
        </button>
        <div className="header-title">
          <span>{title}</span>
        </div>
      </div>
      <div className="header-actions">
        {actions}
        {onThemeToggle && (
          <button className="hdr-btn accent" onClick={onThemeToggle}>
            {themeMode === 'dark' ? <LightIcon /> : <DarkIcon />}
          </button>
        )}
      </div>
    </header>
  );
}
