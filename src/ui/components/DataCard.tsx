'use client';
import { useState } from 'react';
import type { CardData } from '../types';
import { formatDateTime } from '../utils/formatters';

interface DataCardProps {
  data: CardData;
  animDelay?: number;
}

export function DataCard({ data, animDelay = 0 }: DataCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isDanger = data.status === 'CONTAMINATED' || data.status === 'WASTE';
  const isWarn = data.status === 'ARCHIVED' || data.status === 'INACTIVE';
  const statusClass = isDanger ? 'status-danger' : isWarn ? 'status-warn' : '';
  const indicatorClass = isDanger ? 'red' : isWarn ? 'yellow' : 'green';

  return (
    <div
      className={`batch-card ${statusClass}${expanded ? ' expanded' : ''}`}
      onClick={() => setExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="card-top">
        <div className="card-date">{formatDateTime(data.date)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className={`card-indicator ${indicatorClass}`} />
          <div className={`card-status-tag${isDanger ? ' danger' : ''}`}>
            {data.status}
          </div>
        </div>
      </div>
      <div className="card-name">{data.title}</div>
      <div className="card-code">{data.subtitle}</div>
      <div className="card-actions">
        {data.actions.map((action) => {
          const variantClass = action.variant === 'danger' ? 'danger-btn' : action.variant ?? 'outline';
          return (
            <button
              key={`${action.id}-${action.label}`}
              className={`card-btn ${variantClass}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick?.();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          );
        })}
      </div>

      <div className="card-details">
        <div className="card-details-inner">
          <div className="details-content">
            <div className="detail-grid">
              {data.meta.map((item) => (
                <div key={item.label} className="detail-item">
                  <div className="detail-label">{item.label}</div>
                  <div className="detail-value">{item.value}</div>
                </div>
              ))}
            </div>

            {data.notes && data.notes.trim() && (
              <div className="detail-notes">
                <span className="note-title">Notes</span>
                {data.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
