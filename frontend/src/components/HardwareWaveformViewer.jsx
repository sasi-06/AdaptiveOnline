import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function HardwareWaveformViewer({ title = "Digital Timing Diagram", signals = [] }) {
    const { theme: t } = useTheme();

    const defaultSignals = [
        { name: 'CLK', values: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1] },
        { name: 'RESET', values: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        { name: 'COUNT[3:0]', values: ['0', '0', '1', '1', '2', '2', '3', '3', '4', '4', '5', '5'] },
        { name: 'OVERFLOW', values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] }
    ];

    const displaySignals = signals.length > 0 ? signals : defaultSignals;

    const css = `
        .waveform-container {
            background: ${t.inputBg};
            border: 1px solid ${t.border};
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
            font-family: 'Fira Code', 'Courier New', monospace;
        }
        .waveform-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 13px;
            font-weight: 700;
            color: ${t.accent};
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .waveform-row {
            display: flex;
            align-items: center;
            height: 36px;
            border-bottom: 1px dashed ${t.border};
        }
        .waveform-row:last-child {
            border-bottom: none;
        }
        .waveform-label {
            width: 110px;
            font-size: 12px;
            font-weight: 600;
            color: ${t.text};
            flex-shrink: 0;
        }
        .waveform-grid {
            display: flex;
            flex-grow: 1;
            align-items: center;
            height: 100%;
        }
        .waveform-cell {
            flex: 1;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .signal-high {
            width: 100%;
            height: 2px;
            background: #10b981;
            position: absolute;
            top: 6px;
        }
        .signal-low {
            width: 100%;
            height: 2px;
            background: #10b981;
            position: absolute;
            bottom: 6px;
        }
        .signal-edge {
            width: 2px;
            height: 24px;
            background: #10b981;
            position: absolute;
        }
        .bus-box {
            width: 90%;
            height: 20px;
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid #3b82f6;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
            color: #60a5fa;
        }
    `;

    return (
        <div className="waveform-container">
            <style>{css}</style>
            <div className="waveform-header">
                <span>⚡ ECE Verilog Hardware Logic Simulator — {title}</span>
                <span style={{ fontSize: '11px', color: t.textMuted }}>Cycle 0 → 12</span>
            </div>
            {displaySignals.map((sig, idx) => (
                <div key={idx} className="waveform-row">
                    <div className="waveform-label">{sig.name}</div>
                    <div className="waveform-grid">
                        {sig.values.map((val, cIdx) => {
                            const isBus = typeof val === 'string';
                            const isHigh = val === 1;

                            return (
                                <div key={cIdx} className="waveform-cell">
                                    {isBus ? (
                                        <div className="bus-box">0x{val}</div>
                                    ) : (
                                        <>
                                            <div className={isHigh ? "signal-high" : "signal-low"} />
                                            {cIdx > 0 && sig.values[cIdx - 1] !== val && (
                                                <div className="signal-edge" />
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
