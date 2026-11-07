import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'bright';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isBright: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('sheetsql_theme');
      if (saved === 'bright' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Fallback to default
    }
    return 'dark';
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem('sheetsql_theme', mode);
    } catch {
      // Ignore localStorage errors
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'bright' : 'dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'bright') {
      root.classList.add('theme-bright');
      root.classList.remove('theme-dark');
      root.classList.remove('dark');
    } else {
      root.classList.add('theme-dark');
      root.classList.add('dark');
      root.classList.remove('theme-bright');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isBright: theme === 'bright' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
