'use client';
import { VerifiedUser as VerifiedUserIcon } from '@mui/icons-material';
import type { NavGroup } from '../../types';

interface SidebarProps {
  navGroups: NavGroup[];
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  logo?: React.ReactNode;
  footerText?: string;
  open?: boolean;
}

export function Sidebar({
  navGroups,
  activeRoute,
  onNavigate,
  logo,
  footerText = 'v1.0.0 -- Veritas',
  open = true,
}: SidebarProps) {
  const handleNav = (route?: string) => {
    if (route && onNavigate) {
      onNavigate(route);
    }
  };

  return (
    <aside className="sidebar" style={{ display: open ? undefined : 'none' }}>
      <div className="sidebar-logo">
        {logo ?? <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '1px' }}>VERITAS</span>}
      </div>
      <div className="sidebar-cult">
        <VerifiedUserIcon />
        Quality System
      </div>
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="nav-group">
            <div className="nav-group-title">{group.title}</div>
            {group.items.map((item) => {
              const isActive = item.route ? activeRoute === item.route : false;
              return (
                <div
                  key={item.id}
                  className={`nav-link${isActive ? ' active' : ''}`}
                  onClick={() => handleNav(item.route)}
                >
                  {item.icon}
                  {item.label}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">{footerText}</div>
    </aside>
  );
}
