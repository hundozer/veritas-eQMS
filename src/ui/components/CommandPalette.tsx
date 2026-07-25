'use client';
import { useState } from 'react';
import { Search as SearchIcon, Science as DefaultIcon } from '@mui/icons-material';
import type { PaletteResult } from '../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => PaletteResult[];
  onSelect: (result: PaletteResult) => void;
  placeholder?: string;
}

export function CommandPalette({
  open,
  onClose,
  onSearch,
  onSelect,
  placeholder = 'Search...',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = query.trim() ? onSearch(query) : [];

  const handleSelect = (result: PaletteResult) => {
    onSelect(result);
    setQuery('');
  };

  return (
    <div
      className={`cmd-overlay${open ? ' open' : ''}`}
      onClick={() => {
        setQuery('');
        onClose();
      }}
    >
      <div
        className="cmd-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cmd-input-wrap">
          <SearchIcon />
          <input
            className="cmd-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((prev) => Math.max(prev - 1, 0));
              } else if (e.key === 'Enter' && results[activeIndex]) {
                handleSelect(results[activeIndex]);
              }
            }}
            autoFocus
          />
          <span className="cmd-esc">ESC</span>
        </div>
        <div className="cmd-results">
          {results.length > 0 && results.map((result, idx) => (
            <div
              key={result.id}
              className={`cmd-item${idx === activeIndex ? ' selected' : ''}`}
              onClick={() => handleSelect(result)}
            >
              <div className="cmd-item-icon">
                {result.icon ?? <DefaultIcon />}
              </div>
              <div>
                <div className="cmd-item-title">{result.title}</div>
                <div className="cmd-item-desc">{result.description}</div>
              </div>
            </div>
          ))}
          {query.trim() && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: '.84rem' }}>
              No results found for &quot;{query}&quot;
            </div>
          )}
          {!query.trim() && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: '.84rem' }}>
              Type to search...
            </div>
          )}
        </div>
        <div className="cmd-footer">
          Press <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
