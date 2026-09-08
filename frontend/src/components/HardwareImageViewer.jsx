import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ZoomIn, ZoomOut, Maximize2, Cpu } from 'lucide-react';

export default function HardwareImageViewer({ 
    imageUrl, 
    title = "Hardware Schematic & Pinout Analysis",
    caption = "Inspect component connections, IC pinouts, and signal paths to write your hardware control solution."
}) {
    const { theme: t } = useTheme();
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Fallback default SVG Hardware Diagram if no external image URL provided
    const defaultHardwareSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 320" width="100%" height="100%" style="background:#0f172a;">
            <rect x="20" y="20" width="560" height="280" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2"/>
            
            <!-- Microcontroller IC -->
            <rect x="200" y="80" width="200" height="160" rx="8" fill="#090d16" stroke="#3b82f6" stroke-width="2"/>
            <text x="300" y="155" text-anchor="middle" fill="#60a5fa" font-family="monospace" font-size="14" font-weight="bold">ATmega328P / ARM</text>
            <text x="300" y="175" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="11">MCU PINOUT</text>

            {/* Pins Left */}
            <circle cx="180" cy="100" r="5" fill="#10b981"/><text x="140" y="104" fill="#10b981" font-size="10" font-family="monospace">PB0 (PWM)</text>
            <circle cx="180" cy="130" r="5" fill="#10b981"/><text x="140" y="134" fill="#10b981" font-size="10" font-family="monospace">PB1 (OC1A)</text>
            <circle cx="180" cy="160" r="5" fill="#f59e0b"/><text x="140" y="164" fill="#f59e0b" font-size="10" font-family="monospace">ADC0 (Vin)</text>
            <circle cx="180" cy="190" r="5" fill="#ef4444"/><text x="140" y="194" fill="#ef4444" font-size="10" font-family="monospace">VCC (5V)</text>

            {/* Pins Right */}
            <circle cx="420" cy="100" r="5" fill="#38bdf8"/><text x="430" y="104" fill="#38bdf8" font-size="10" font-family="monospace">SDA (I2C)</text>
            <circle cx="420" cy="130" r="5" fill="#38bdf8"/><text x="430" y="134" fill="#38bdf8" font-size="10" font-family="monospace">SCL (I2C)</text>
            <circle cx="420" cy="160" r="5" fill="#a855f7"/><text x="430" y="164" fill="#a855f7" font-size="10" font-family="monospace">Rx (UART)</text>
            <circle cx="420" cy="190" r="5" fill="#a855f7"/><text x="430" y="194" fill="#a855f7" font-size="10" font-family="monospace">Tx (UART)</text>

            {/* Traces */}
            <line x1="80" y1="100" x2="180" y2="100" stroke="#10b981" stroke-width="2" stroke-dasharray="4"/>
            <line x1="80" y1="160" x2="180" y2="160" stroke="#f59e0b" stroke-width="2"/>
            <line x1="420" y1="100" x2="520" y2="100" stroke="#38bdf8" stroke-width="2"/>
        </svg>
    `)}`;

    const imgSrc = imageUrl || defaultHardwareSvg;

    const css = `
        .hw-img-container {
            background: ${t.inputBg};
            border: 1px solid ${t.border};
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
        }
        .hw-img-header {
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
        .hw-img-viewport {
            width: 100%;
            height: 240px;
            background: #090d16;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            border: 1px solid ${t.border};
        }
        .hw-img-element {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            transition: transform 0.2s ease-out;
        }
        .hw-img-controls {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            gap: 6px;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            padding: 4px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .hw-img-btn {
            background: transparent;
            border: none;
            color: #fff;
            padding: 6px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s;
        }
        .hw-img-btn:hover {
            background: rgba(255,255,255,0.2);
        }
    `;

    return (
        <div className="hw-img-container">
            <style>{css}</style>
            <div className="hw-img-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={16} color={t.accent} /> {title}
                </span>
                <span style={{ fontSize: '11px', color: t.textMuted }}>Zoom: {Math.round(zoom * 100)}%</span>
            </div>

            <div className="hw-img-viewport">
                <img 
                    src={imgSrc} 
                    alt="Hardware Schematic" 
                    className="hw-img-element"
                    style={{ transform: `scale(${zoom})` }}
                />
                <div className="hw-img-controls">
                    <button className="hw-img-btn" title="Zoom In" onClick={() => setZoom(z => Math.min(z + 0.25, 2.5))}>
                        <ZoomIn size={14} />
                    </button>
                    <button className="hw-img-btn" title="Zoom Out" onClick={() => setZoom(z => Math.max(z - 0.25, 0.75))}>
                        <ZoomOut size={14} />
                    </button>
                    <button className="hw-img-btn" title="Reset Zoom" onClick={() => setZoom(1)}>
                        <Maximize2 size={14} />
                    </button>
                </div>
            </div>
            <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '10px', lineHeight: 1.5 }}>
                {caption}
            </div>
        </div>
    );
}
