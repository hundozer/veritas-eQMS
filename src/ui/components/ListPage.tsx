'use client';
import { useState, useMemo } from 'react';
import { StatusCards } from './StatusCards';
import { DataCard } from './DataCard';
import type { StatusCardItem, ColumnGroup, CardData } from '../types';

interface ListPageProps {
  title: string;
  breadcrumb: string;
  subtitle: string;
  statusCards: StatusCardItem[];
  groups: ColumnGroup[];
  itemsByGroup: Map<string, CardData[]>;
  activeGroupId: string | null;
  onGroupChange: (groupId: string | null) => void;
  onCreate?: () => void;
  gridColumns?: number;
  showCreate?: boolean;
  emptyLabel?: string;
}

function StatusBar({ items }: { items: CardData[] }) {
  if (items.length === 0) return <div className="rp-bar empty" />;
  const counts = { active: 0, danger: 0, warn: 0, other: 0 };
  for (const item of items) {
    const s = item.status;
    if (s === 'ACTIVE') counts.active++;
    else if (s === 'CONTAMINATED' || s === 'WASTE') counts.danger++;
    else if (s === 'ARCHIVED' || s === 'INACTIVE') counts.warn++;
    else counts.other++;
  }
  const total = items.length;
  return (
    <div className="rp-bar">
      {counts.active > 0 && <div className="rp-bar-seg green" style={{ width: `${(counts.active / total) * 100}%` }} />}
      {counts.other > 0 && <div className="rp-bar-seg olive" style={{ width: `${(counts.other / total) * 100}%` }} />}
      {counts.warn > 0 && <div className="rp-bar-seg yellow" style={{ width: `${(counts.warn / total) * 100}%` }} />}
      {counts.danger > 0 && <div className="rp-bar-seg red" style={{ width: `${(counts.danger / total) * 100}%` }} />}
    </div>
  );
}

export function ListPage({
  title,
  breadcrumb,
  subtitle,
  statusCards,
  groups,
  itemsByGroup,
  activeGroupId,
  onGroupChange,
  onCreate,
  showCreate = false,
  emptyLabel = 'No items in this room',
}: ListPageProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedRoomId) ?? null,
    [groups, selectedRoomId],
  );
  const selectedItems = useMemo(
    () => (selectedRoomId ? itemsByGroup.get(selectedRoomId) ?? [] : []),
    [itemsByGroup, selectedRoomId],
  );

  const totalItems = useMemo(() => {
    let n = 0;
    for (const arr of itemsByGroup.values()) n += arr.length;
    return n;
  }, [itemsByGroup]);

  const handleSelectRoom = (id: string) => {
    setSelectedRoomId((prev) => (prev === id ? null : id));
  };

  // Filter by active tab group
  const visibleGroups = activeGroupId !== null
    ? groups.filter((g) => g.id === activeGroupId)
    : groups;

  return (
    <div className="page active">
      <div className="breadcrumb">
        Simpleafied / Cultivation / <b>{breadcrumb}</b>
      </div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="page-header-right">
          <div
            className="search-pill"
            onClick={() => window.dispatchEvent(new Event('cmd:open'))}
            role="button"
            tabIndex={0}
          >
            <span>Search</span>
            <input type="text" placeholder="Search batch..." readOnly />
            <span className="kbd">Ctrl K</span>
          </div>
          {showCreate && (
            <button className="create-btn" type="button" onClick={onCreate}>
              + Create
            </button>
          )}
        </div>
      </div>

      <StatusCards cards={statusCards} />

      {/* Tab filter for facility rooms */}
      {groups.length > 5 && (
        <div className="controls">
          <div className="tabs-wrap">
            {['all', ...groups.map((g) => g.id)].map((id, idx) => (
              <button
                key={id}
                className={`tab-btn${(activeGroupId ?? 'all') === id ? ' active' : ''}`}
                onClick={() => onGroupChange(id === 'all' ? null : id)}
                type="button"
              >
                {idx === 0 ? 'All' : groups[idx - 1]?.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Master-Detail Split */}
      <div className="md-layout">
        {/* LEFT — Room panel */}
        <div className="md-rooms">
          <div className="md-rooms-head">
            <span className="md-rooms-title">Rooms</span>
            <span className="md-rooms-count">{visibleGroups.length}</span>
          </div>
          <div className="md-rooms-list">
            {visibleGroups.map((group, idx) => {
              const items = itemsByGroup.get(group.id) ?? [];
              const isActive = selectedRoomId === group.id;
              return (
                <div
                  key={group.id}
                  className={`rp-card${isActive ? ' active' : ''}`}
                  onClick={() => handleSelectRoom(group.id)}
                  role="button"
                  tabIndex={0}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="rp-top">
                    <div className="rp-name">{group.name}</div>
                    <div className="rp-num">{items.length}</div>
                  </div>
                  <StatusBar items={items} />
                  <div className="rp-bottom">
                    <span className="rp-load">
                      <span className="rp-load-fill" style={{ width: `${group.pct1}%` }} />
                    </span>
                    <span className="rp-pct">{group.pct1}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="md-rooms-footer">
            {totalItems} total items
          </div>
        </div>

        {/* RIGHT — Detail panel */}
        <div className="md-detail">
          {selectedGroup ? (
            <div className="md-detail-inner" key={selectedRoomId}>
              <div className="md-detail-head">
                <div className="md-detail-info">
                  <h3 className="md-detail-name">{selectedGroup.name}</h3>
                  <div className="md-detail-stats">
                    <span className="md-tag">{selectedItems.length} items</span>
                    <span className="md-tag green">{selectedGroup.pct1}%</span>
                  </div>
                </div>
                <button
                  className="md-detail-close"
                  type="button"
                  onClick={() => setSelectedRoomId(null)}
                  aria-label="Close"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {selectedItems.length === 0 ? (
                <div className="md-empty">{emptyLabel}</div>
              ) : (
                <div className="md-cards">
                  {selectedItems.map((item, idx) => (
                    <DataCard key={item.id} data={item} animDelay={idx * 35} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="md-overview" key="overview">
              <div className="md-overview-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9L12 2L21 9V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 21V12H15V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="md-overview-text">Select a room to view its contents</p>
              <div className="md-overview-grid">
                {visibleGroups.map((group, idx) => {
                  const items = itemsByGroup.get(group.id) ?? [];
                  const counts = { active: 0, danger: 0, warn: 0 };
                  for (const item of items) {
                    if (item.status === 'ACTIVE') counts.active++;
                    else if (item.status === 'CONTAMINATED' || item.status === 'WASTE') counts.danger++;
                    else if (item.status === 'ARCHIVED' || item.status === 'INACTIVE') counts.warn++;
                  }
                  return (
                    <div
                      key={group.id}
                      className="md-ov-tile"
                      onClick={() => handleSelectRoom(group.id)}
                      role="button"
                      tabIndex={0}
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <div className="md-ov-tile-name">{group.name}</div>
                      <div className="md-ov-tile-num">{items.length}</div>
                      <div className="md-ov-tile-tags">
                        {counts.active > 0 && <span className="md-ov-tag green">{counts.active}</span>}
                        {counts.danger > 0 && <span className="md-ov-tag red">{counts.danger}</span>}
                        {counts.warn > 0 && <span className="md-ov-tag yellow">{counts.warn}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
