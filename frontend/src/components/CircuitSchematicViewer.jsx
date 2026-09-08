import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function CircuitSchematicViewer({ title = "Circuit Analysis Diagram", circuitType = "RLC_SERIES" }) {
    const { theme: t } = useTheme();
    const [selectedNode, setSelectedNode] = useState('N1');

    const css = `
        .circuit-container {
            background: ${t.inputBg};
            border: 1px solid ${t.border};
            border-radius: 12px;
            padding: 18px;
            margin-top: 16px;
        }
        .circuit-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
            font-size: 13px;
            font-weight: 700;
            color: ${t.accent};
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .circuit-canvas {
            width: 100%;
            height: 180px;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            border: 1px solid ${t.border};
        }
        .circuit-badge {
            position: absolute;
            bottom: 10px;
            left: 12px;
            background: rgba(0, 0, 0, 0.6);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            color: #38bdf8;
        }
    `;

    return (
        <div className="circuit-container">
            <style>{css}</style>
            <div className="circuit-header">
                <span>🔌 EEE Circuit & System Schematic — {title}</span>
                <span style={{ fontSize: '11px', color: t.textMuted }}>Node: {selectedNode}</span>
            </div>

            <div className="circuit-canvas">
                <svg width="100%" height="100%" viewBox="0 0 500 160">
                    {/* AC Source */}
                    <circle cx="60" cy="80" r="22" stroke="#38bdf8" strokeWidth="2" fill="none" />
                    <path d="M 50 80 Q 55 70, 60 80 T 70 80" stroke="#38bdf8" strokeWidth="2" fill="none" />
                    <text x="50" y="120" fill="#94a3b8" fontSize="11" fontWeight="600">Vs (AC)</text>

                    {/* Wires */}
                    <line x1="60" y1="58" x2="60" y2="30" stroke="#64748b" strokeWidth="2" />
                    <line x1="60" y1="30" x2="140" y2="30" stroke="#64748b" strokeWidth="2" />

                    {/* Resistor R */}
                    <path d="M 140 30 L 150 20 L 160 40 L 170 20 L 180 40 L 190 20 L 200 30" stroke="#f59e0b" strokeWidth="2" fill="none" />
                    <text x="160" y="15" fill="#f59e0b" fontSize="11" fontWeight="700">R = 50 Ω</text>

                    <line x1="200" y1="30" x2="260" y2="30" stroke="#64748b" strokeWidth="2" />

                    {/* Inductor L */}
                    <path d="M 260 30 Q 270 15, 280 30 Q 290 15, 300 30 Q 310 15, 320 30" stroke="#10b981" strokeWidth="2" fill="none" />
                    <text x="275" y="15" fill="#10b981" fontSize="11" fontWeight="700">L = 10 mH</text>

                    <line x1="320" y1="30" x2="380" y2="30" stroke="#64748b" strokeWidth="2" />

                    {/* Capacitor C */}
                    <line x1="380" y1="15" x2="380" y2="45" stroke="#ec4899" strokeWidth="3" />
                    <line x1="390" y1="15" x2="390" y2="45" stroke="#ec4899" strokeWidth="3" />
                    <line x1="390" y1="30" x2="440" y2="30" stroke="#64748b" strokeWidth="2" />
                    <text x="375" y="60" fill="#ec4899" fontSize="11" fontWeight="700">C = 100 µF</text>

                    {/* Ground & Return Loop */}
                    <line x1="440" y1="30" x2="440" y2="130" stroke="#64748b" strokeWidth="2" />
                    <line x1="440" y1="130" x2="60" y2="130" stroke="#64748b" strokeWidth="2" />
                    <line x1="60" y1="130" x2="60" y2="102" stroke="#64748b" strokeWidth="2" />

                    {/* Node Markers */}
                    <circle cx="230" cy="30" r="5" fill="#38bdf8" style={{ cursor: 'pointer' }} onClick={() => setSelectedNode('N1 (V_resistor)')} />
                    <circle cx="350" cy="30" r="5" fill="#38bdf8" style={{ cursor: 'pointer' }} onClick={() => setSelectedNode('N2 (V_inductor)')} />
                </svg>

                <div className="circuit-badge">
                    Series RLC Resonance: f_0 = 159.15 Hz | Phase Angle φ = 0°
                </div>
            </div>
        </div>
    );
}
