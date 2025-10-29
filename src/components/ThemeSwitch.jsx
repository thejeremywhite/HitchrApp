import React from 'react';

export default function ThemeSwitch({ checked, onCheckedChange, label, ariaLabel }) {
  return (
    <button
      onClick={() => onCheckedChange(!checked)}
      className="relative inline-flex items-center rounded-full transition-all duration-200 flex-shrink-0"
      style={{
        width: '44px',
        height: '24px',
        backgroundColor: checked ? '#14b8a6' : '#e5e7eb',
        border: 'none',
        cursor: 'pointer'
      }}
      aria-label={ariaLabel || `${label} ${checked ? 'On' : 'Off'}`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className="inline-block rounded-full bg-white transition-transform duration-200 shadow-sm"
        style={{
          width: '20px',
          height: '20px',
          transform: checked ? 'translateX(22px)' : 'translateX(2px)',
        }}
      />
      <span
        className="absolute text-[9px] font-bold transition-opacity duration-200"
        style={{
          left: checked ? '6px' : 'auto',
          right: checked ? 'auto' : '6px',
          color: '#FFFFFF',
          opacity: 1
        }}
      >
        {checked ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}