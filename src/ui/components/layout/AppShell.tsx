'use client';
import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { NavGroup } from '../../types';

interface AppShellProps {
  navGroups: NavGroup[];
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  headerTitle?: string;
  headerActions?: ReactNode;
  themeMode?: 'light' | 'dark';
  onThemeToggle?: () => void;
  logo?: ReactNode;
  footerText?: string;
  overlay?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  navGroups,
  activeRoute,
  onNavigate,
  headerTitle = 'Dashboard',
  headerActions,
  themeMode,
  onThemeToggle,
  logo,
  footerText,
  overlay,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar
        navGroups={navGroups}
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        logo={logo}
        footerText={footerText}
        open
      />

      <div className="main">
        <Header
          title={headerTitle}
          onMenuClick={() => setMobileOpen((prev) => !prev)}
          menuOpen={mobileOpen}
          themeMode={themeMode}
          onThemeToggle={onThemeToggle}
          actions={headerActions}
        />

        <div className="content">
          {children}
        </div>
      </div>

      <div className={`mobile-overlay${mobileOpen ? ' open' : ''}`}>
        <div className="mobile-menu-header">
          {logo ?? <img src="/logo.svg" alt="Logo" />}
          <button className="mobile-menu-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            x
          </button>
        </div>
        <div className="mobile-menu-content">
          {navGroups.map((group) => (
            <div key={group.title} className="mobile-nav-group">
              <div className="mobile-nav-title">{group.title}</div>
              {group.items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`mobile-nav-link${activeRoute === item.route ? ' active' : ''}`}
                  style={{ transitionDelay: `${idx * 40}ms` }}
                  onClick={() => {
                    if (item.route && onNavigate) {
                      onNavigate(item.route);
                      setMobileOpen(false);
                    }
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mobile-menu-footer">{footerText ?? 'v2.4.0 -- Showcase'}</div>
      </div>

      {overlay}
    </div>
  );
}
