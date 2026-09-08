import React, { createContext, useContext, useState, useEffect } from 'react';

export const themes = {
  pastel: {
    name: 'Pastel',
    bg: '#ebe3fa', // Soft purple background matching image
    surface: '#ffffff', // Crisp white cards
    surfaceAlt: '#f3ebff',
    border: '#e4dcf1', // Light border
    accent: '#a78bfa',
    accentGlow: 'rgba(167, 139, 250, 0.25)',
    accentHover: '#8b5cf6',
    text: '#1e293b', // Deep navy/gray text
    textMuted: '#64748b',
    textSub: '#94a3b8',
    inputBg: '#ffffff',
    errorBg: '#fce7f3', // Soft pink like the "ENDED/Disconnect" tags
    errorBorder: '#fbcfe8',
    errorText: '#be123c',
    gradient: 'linear-gradient(to right, #a5f3fc, #c4b5fd)', // Cyan to purple progress bar gradient
    tabActiveBg: '#ede4fc',
    cardShadow: 'rgba(0,0,0,0.03)',
    isDark: false,
  },
  obsidian: {
    name: 'Obsidian',
    bg: '#0a0a0f',
    surface: '#13131a',
    surfaceAlt: '#1c1c28',
    border: '#2a2a3d',
    accent: '#6c63ff',
    accentGlow: 'rgba(108,99,255,0.35)',
    accentHover: '#8b85ff',
    text: '#f0f0ff',
    textMuted: '#7a7a9a',
    textSub: '#4a4a6a',
    inputBg: '#1c1c28',
    errorBg: 'rgba(255,69,90,0.12)',
    errorBorder: '#ff455a',
    errorText: '#ff8090',
    gradient: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)',
    tabActiveBg: 'rgba(108,99,255,0.15)',
    cardShadow: 'rgba(0,0,0,0.5)',
    isDark: true,
  },
  arctic: {
    name: 'Arctic',
    bg: '#f0f4ff',
    surface: '#ffffff',
    surfaceAlt: '#f7f9ff',
    border: '#dde3f5',
    accent: '#2563eb',
    accentGlow: 'rgba(37,99,235,0.2)',
    accentHover: '#1d4ed8',
    text: '#0f172a',
    textMuted: '#64748b',
    textSub: '#94a3b8',
    inputBg: '#f7f9ff',
    errorBg: 'rgba(239,68,68,0.08)',
    errorBorder: '#ef4444',
    errorText: '#dc2626',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
    tabActiveBg: 'rgba(37,99,235,0.08)',
    cardShadow: 'rgba(0,0,0,0.08)',
    isDark: false,
  },
  ember: {
    name: 'Ember',
    bg: '#0f0a08',
    surface: '#1a1008',
    surfaceAlt: '#231508',
    border: '#3d2a18',
    accent: '#f97316',
    accentGlow: 'rgba(249,115,22,0.35)',
    accentHover: '#fb923c',
    text: '#fff7ed',
    textMuted: '#9a7a5a',
    textSub: '#5a4a3a',
    inputBg: '#231508',
    errorBg: 'rgba(239,68,68,0.12)',
    errorBorder: '#ef4444',
    errorText: '#fca5a5',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
    tabActiveBg: 'rgba(249,115,22,0.12)',
    cardShadow: 'rgba(0,0,0,0.5)',
    isDark: true,
  },
  jade: {
    name: 'Jade',
    bg: '#f0fdf6',
    surface: '#ffffff',
    surfaceAlt: '#f0fdf6',
    border: '#bbf7d0',
    accent: '#059669',
    accentGlow: 'rgba(5,150,105,0.2)',
    accentHover: '#047857',
    text: '#052e16',
    textMuted: '#4b7a5c',
    textSub: '#86b89a',
    inputBg: '#f0fdf6',
    errorBg: 'rgba(239,68,68,0.08)',
    errorBorder: '#ef4444',
    errorText: '#dc2626',
    gradient: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
    tabActiveBg: 'rgba(5,150,105,0.08)',
    cardShadow: 'rgba(0,0,0,0.08)',
    isDark: false,
  },
};

export const themeAccentColors = {
  pastel: '#c084fc',
  obsidian: '#6c63ff',
  arctic: '#2563eb',
  ember: '#f97316',
  jade: '#059669',
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    const saved = localStorage.getItem('adaptexam-theme');
    if (!saved || saved === 'obsidian') return 'pastel';
    return saved;
  });

  const theme = themes[themeKey];

  // Persist choice & apply CSS variables to :root whenever theme changes
  useEffect(() => {
    localStorage.setItem('adaptexam-theme', themeKey);
    const r = document.documentElement;
    r.style.setProperty('--bg',          theme.bg);
    r.style.setProperty('--surface',     theme.surface);
    r.style.setProperty('--surface-alt', theme.surfaceAlt);
    r.style.setProperty('--border',      theme.border);
    r.style.setProperty('--accent',      theme.accent);
    r.style.setProperty('--accent-glow', theme.accentGlow);
    r.style.setProperty('--accent-hover',theme.accentHover);
    r.style.setProperty('--text',        theme.text);
    r.style.setProperty('--text-muted',  theme.textMuted);
    r.style.setProperty('--text-sub',    theme.textSub);
    r.style.setProperty('--input-bg',    theme.inputBg);
    r.style.setProperty('--gradient',    theme.gradient);
    r.style.setProperty('--card-shadow', theme.cardShadow);
    r.style.setProperty('--error-bg',    theme.errorBg);
    r.style.setProperty('--error-border',theme.errorBorder);
    r.style.setProperty('--error-text',  theme.errorText);
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;
  }, [themeKey, theme]);

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, theme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Main hook — use this in every page/component
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
