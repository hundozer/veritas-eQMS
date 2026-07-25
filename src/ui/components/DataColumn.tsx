'use client';
import { useState, useRef, useEffect } from 'react';
import type { ColumnGroup, CardData } from '../types';
import { DataCard } from './DataCard';

interface DataColumnProps {
  group: ColumnGroup;
  items: CardData[];
  emptyLabel?: string;
  defaultCollapsed?: boolean;
}

export function DataColumn({ group, items, emptyLabel = 'No items', defaultCollapsed }: DataColumnProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const listRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (listRef.current) {
      setListHeight(listRef.current.scrollHeight);
    }
  }, [items.length, collapsed]);

  const statusCounts = items.reduce(
    (acc, item) => {
      const s = item.status;
      if (s === 'ACTIVE') acc.active++;
      else if (s === 'CONTAMINATED' || s === 'WASTE') acc.danger++;
      else if (s === 'ARCHIVED' || s === 'INACTIVE') acc.warn++;
      else acc.other++;
      return acc;
    },
    { active: 0, danger: 0, warn: 0, other: 0 },
  );

  return (
    <div className={`room${collapsed ? ' collapsed' : ''}`}>
      <div
        className="room-header"
        onClick={() => setCollapsed((prev) => !prev)}
        role="button"
        tabIndex={0}
      >
        <div className="room-title-row">
          <div className={`room-chevron${collapsed ? '' : ' open'}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="room-title">{group.name}</div>
          <span className="room-count">{items.length}</span>
        </div>
        <div className="room-meta">
          {collapsed && items.length > 0 && (
            <div className="room-collapsed-stats">
              {statusCounts.active > 0 && (
                <span className="room-stat green">{statusCounts.active} active</span>
              )}
              {statusCounts.danger > 0 && (
                <span className="room-stat red">{statusCounts.danger} issues</span>
              )}
              {statusCounts.warn > 0 && (
                <span className="room-stat yellow">{statusCounts.warn} archived</span>
              )}
              {statusCounts.other > 0 && (
                <span className="room-stat">{statusCounts.other} other</span>
              )}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="room-check">ok</div>
              <span className="room-badge">{group.count ?? 0} plants</span>
              <span className="room-badge green">Load {group.pct1}%</span>
            </>
          )}
        </div>
      </div>
      <div
        className="room-body"
        ref={listRef}
        style={{
          maxHeight: collapsed ? 0 : listHeight !== undefined ? listHeight + 16 : 'none',
          opacity: collapsed ? 0 : 1,
        }}
      >
        <div className="batch-list">
          {items.length === 0 ? (
            <div className="room-empty">{emptyLabel}</div>
          ) : (
            items.map((item, idx) => (
              <DataCard key={item.id} data={item} animDelay={idx * 40} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
