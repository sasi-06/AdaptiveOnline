import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Timer({ duration, onExpire }) {
    const { theme: t } = useTheme();
    const total = duration * 60;
    const [seconds, setSeconds] = useState(total);

    useEffect(() => {
        if (seconds <= 0) { onExpire?.(); return; }
        const id = setInterval(() => setSeconds(s => s - 1), 1000);
        return () => clearInterval(id);
    }, [seconds]);

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = n => String(n).padStart(2, '0');
    const pct = (seconds / total) * 100;
    const warning = seconds <= 300;
    const danger = seconds <= 60;
    const color = danger ? '#ef4444' : warning ? '#f59e0b' : t.accent;

    const css = `
        .timer-wrap {
            background: ${t.surface}; border: 1px solid ${t.border};
            border-radius: 14px; padding: 18px; text-align: center;
            transition: background 0.4s, border-color 0.4s;
        }
        .timer-label { font-size: 11px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: ${t.textSub}; margin-bottom: 10px; }
        .timer-display {
            font-family: 'Outfit', sans-serif; font-size: 38px; font-weight: 800;
            letter-spacing: 2px; line-height: 1; transition: color 0.3s;
        }
        .timer-display.danger { animation: tblink 1s infinite; }
        @keyframes tblink { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .timer-bar-bg { height: 6px; background: ${t.surfaceAlt}; border-radius: 99px; overflow: hidden; margin-top: 12px; }
        .timer-bar-fill { height: 100%; border-radius: 99px; transition: width 1s linear, background 0.5s; }
    `;

    return (
        <>
            <style>{css}</style>
            <div className="timer-wrap">
                <div className="timer-label">⏱ Time Remaining</div>
                <div className={`timer-display ${danger ? 'danger' : ''}`} style={{ color }}>
                    {pad(mins)}:{pad(secs)}
                </div>
                <div className="timer-bar-bg">
                    <div className="timer-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
            </div>
        </>
    );
}
