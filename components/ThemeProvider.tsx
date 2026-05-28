"use client";

import * as React from "react";

const THEMES = ["purple", "blue", "green", "amber", "light-purple", "light-blue", "light-green", "light-amber"];
const DEFAULT_THEME = "purple";
const LS_KEY = "dashboard-theme";

interface ThemeContextValue {
  theme: string;
  setTheme: (theme: string) => void;
  themes: string[];
}

export const ThemeContext = React.createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  themes?: string[];
  attribute?: string;
}

export function ThemeProvider({ children, defaultTheme = DEFAULT_THEME }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<string>(DEFAULT_THEME);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) || defaultTheme;
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);
    setMounted(true);
  }, [defaultTheme]);

  const setTheme = React.useCallback((t: string) => {
    setThemeState(t);
    localStorage.setItem(LS_KEY, t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
