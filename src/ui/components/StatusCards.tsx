'use client';
import { useMemo, useState } from 'react';
import type { StatusCardItem } from '../types';

interface StatusCardsProps {
  cards: StatusCardItem[];
}

export function StatusCards({ cards }: StatusCardsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const orderedCards = useMemo(() => {
    if (!selected) return cards;
    const picked = cards.find((c) => c.label === selected);
    const rest = cards.filter((c) => c.label !== selected);
    return picked ? [picked, ...rest] : cards;
  }, [cards, selected]);

  return (
    <div className={`status-row${selected ? ' selected' : ''}`}>
      {orderedCards.map((card) => (
        <div
          key={card.label}
          className={`status-card${card.variant === 'gold' ? ' gold' : ''}${card.variant === 'danger' ? ' danger' : ''}${selected === card.label ? ' selected' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setSelected((prev) => (prev === card.label ? null : card.label))}
        >
          <div className="status-num">{card.value}</div>
          <div>
            <div className="status-label">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
