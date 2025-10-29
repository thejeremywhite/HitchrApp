import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const MAX_SUGGESTIONS = 10;
const DISPLAY_LIMIT = 3;

export default function SmartSuggestions({ field, onSelect, className = '' }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`hitchr.recents.${field}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSuggestions(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse suggestions:', e);
        setSuggestions([]);
      }
    }
  }, [field]);

  const handleSelect = (value) => {
    onSelect(value);
    // Move selected to front
    const updated = [value, ...suggestions.filter(s => s !== value)].slice(0, MAX_SUGGESTIONS);
    localStorage.setItem(`hitchr.recents.${field}`, JSON.stringify(updated));
    setSuggestions(updated);
  };

  const handleClear = () => {
    localStorage.removeItem(`hitchr.recents.${field}`);
    setSuggestions([]);
  };

  if (suggestions.length === 0) return null;

  const displayedSuggestions = showAll ? suggestions : suggestions.slice(0, DISPLAY_LIMIT);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">Recent entries</p>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {displayedSuggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelect(suggestion)}
            className="px-3 py-1.5 text-sm bg-[var(--subtle-bg)] hover:bg-[var(--primary-light)] rounded-lg transition-colors border border-[var(--border)]"
          >
            {suggestion.length > 30 ? suggestion.substring(0, 30) + '...' : suggestion}
          </button>
        ))}
        {suggestions.length > DISPLAY_LIMIT && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="px-3 py-1.5 text-sm text-[var(--primary)] font-semibold hover:underline"
          >
            +{suggestions.length - DISPLAY_LIMIT} more
          </button>
        )}
      </div>
    </div>
  );
}

export function saveToRecents(field, value) {
  if (!value || value.trim().length < 3) return;
  
  try {
    const stored = localStorage.getItem(`hitchr.recents.${field}`);
    const existing = stored ? JSON.parse(stored) : [];
    const updated = [value, ...existing.filter(s => s !== value)].slice(0, MAX_SUGGESTIONS);
    localStorage.setItem(`hitchr.recents.${field}`, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save to recents:', e);
  }
}