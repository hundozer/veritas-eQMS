import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Card system
// ---------------------------------------------------------------------------

export interface CardAction {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'dark' | 'green' | 'outline' | 'danger';
  onClick?: () => void;
}

export interface CardMeta {
  label: string;
  value: string;
}

export interface CardData {
  id: string;
  groupId: string;
  title: string;
  subtitle: string;
  date: string;
  status: string;
  meta: CardMeta[];
  notes?: string;
  actions: CardAction[];
}

// ---------------------------------------------------------------------------
// Status cards
// ---------------------------------------------------------------------------

export interface StatusCardItem {
  label: string;
  value: number | string;
  variant?: 'default' | 'gold' | 'danger';
}

// ---------------------------------------------------------------------------
// Column / Group
// ---------------------------------------------------------------------------

export interface ColumnGroup {
  id: string;
  name: string;
  count: number | null;
  pct1: number;
  pct2: number;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export interface NavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  route?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Command Palette
// ---------------------------------------------------------------------------

export interface PaletteResult {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineStep {
  label: string;
}
