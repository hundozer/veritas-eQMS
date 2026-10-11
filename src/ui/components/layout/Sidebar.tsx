'use client';
import type { NavGroup } from '../../types';
import { Wordmark } from './Wordmark';

interface SidebarProps {
  navGroups: NavGroup[];
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  logo?: React.ReactNode;
  footerText?: string;
  open?: boolean;
}

// The workspace index: numbered tabs like the sections of a binder.
export function Sidebar({
  navGroups,
  activeRoute,
  onNavigate,
  logo,
  footerText = 'Veritas',
  open = true,
}: SidebarProps) {
  const items = navGroups.flatMap((group) => group.items);

  return (
    <aside className="sidebar" style={{ display: open ? undefined : 'none' }}>
      <div className="sidebar-logo">
        {logo ?? <Wordmark />}
      </div>
      <nav className="sidebar-nav" aria-label="Workspace">
        {items.map((item, index) => {
          const isActive = item.route ? activeRoute === item.route : false;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-link${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => item.route && onNavigate?.(item.route)}
            >
              <span className="nav-index">{index + 1}.0</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">{footerText}</div>
    </aside>
  );
}
