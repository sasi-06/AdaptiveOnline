import React, { useState } from 'react';
import { useTheme, themeAccentColors } from '../context/ThemeContext';

export default function ThemeSwitcher() {
  const { themeKey, setThemeKey, theme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const t = theme;

  const css = `
    .ts-wrap {
      position: fixed;
      top: 20px; right: 20px;
      z-index: 9999;
    }
    .ts-btn {
      width: 40px; height: 40px;
      border-radius: 10px;
      background: ${t.surface};
      border: 1px solid ${t.border};
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px;
      box-shadow: 0 4px 16px ${t.cardShadow};
      transition: all 0.2s ease;
      color: ${t.text};
    }
    .ts-btn:hover {
      transform: scale(1.07);
      box-shadow: 0 6px 20px ${t.accentGlow};
      border-color: ${t.accent};
    }
    .ts-panel {
      position: absolute;
      top: 48px; right: 0;
      background: ${t.surface};
      border: 1px solid ${t.border};
      border-radius: 14px;
      padding: 8px;
      display: flex; flex-direction: column; gap: 3px;
      box-shadow: 0 16px 48px ${t.cardShadow};
      min-width: 148px;
      animation: tsPopIn 0.18s ease;
    }
    @keyframes tsPopIn {
      from { opacity: 0; transform: scale(0.93) translateY(-6px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .ts-opt {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 12px;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      background: transparent;
      font-size: 13.5px;
      font-weight: 500;
      color: ${t.textMuted};
      width: 100%;
      text-align: left;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .ts-opt:hover { background: ${t.surfaceAlt}; color: ${t.text}; }
    .ts-opt.ts-active { background: ${t.tabActiveBg}; color: ${t.accent}; }
    .ts-dot {
      width: 11px; height: 11px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="ts-wrap">
        <button className="ts-btn" onClick={() => setOpen(o => !o)} title="Change theme">
          🎨
        </button>
        {open && (
          <div className="ts-panel">
            {Object.entries(themes).map(([key, th]) => (
              <button
                key={key}
                className={`ts-opt ${themeKey === key ? 'ts-active' : ''}`}
                onClick={() => { setThemeKey(key); setOpen(false); }}
              >
                <span className="ts-dot" style={{ background: themeAccentColors[key] }} />
                {th.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
