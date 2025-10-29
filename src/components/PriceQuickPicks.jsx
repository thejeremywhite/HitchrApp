import React from 'react';
import { DollarSign } from 'lucide-react';

export default function PriceQuickPicks({ suggestedPrice, onSelect, className = '' }) {
  const picks = [];
  
  if (suggestedPrice) {
    picks.push({ label: `Suggested: $${suggestedPrice}`, value: suggestedPrice, highlight: true });
    
    const lower = Math.max(5, Math.round((suggestedPrice * 0.8) / 5) * 5);
    const higher = Math.round((suggestedPrice * 1.2) / 5) * 5;
    
    if (lower !== suggestedPrice) {
      picks.push({ label: `$${lower}`, value: lower });
    }
    if (higher !== suggestedPrice) {
      picks.push({ label: `$${higher}`, value: higher });
    }
  } else {
    picks.push({ label: '$15', value: 15 });
    picks.push({ label: '$25', value: 25 });
    picks.push({ label: '$40', value: 40 });
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-semibold text-[var(--text-secondary)]">Quick picks</p>
      <div className="flex flex-wrap gap-2">
        {picks.map((pick, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(pick.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors border flex items-center gap-1 ${
              pick.highlight
                ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)] font-semibold'
                : 'bg-[var(--subtle-bg)] border-[var(--border)] hover:bg-[var(--primary-light)]'
            }`}
          >
            <DollarSign className="w-3 h-3" />
            {pick.label}
          </button>
        ))}
      </div>
    </div>
  );
}