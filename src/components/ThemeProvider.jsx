import React, { createContext, useContext, useEffect } from 'react';

const ThemeProviderContext = createContext({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }) {
  useEffect(() => {
    // Force light theme on mount and whenever theme might change
    const root = window.document.documentElement;
    root.classList.remove('dark', 'system');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }, []);

  const value = {
    theme: 'light',
    setTheme: () => {}, // No-op - theme is locked to light
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};