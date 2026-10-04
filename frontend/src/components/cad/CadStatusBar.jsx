import React from 'react';

export default function CadStatusBar({
    coords = { x: 0, y: 0 },
    activeSnap = null,
    isSnapped = false,
    activeTool = 'select',
    gridEnabled = true,
    gridSpacing = 10,
    snapEnabled = true,
    orthoEnabled = false,
    osnapEnabled = true,
    angleEnabled = false,
    angleIncrement = 45,
    zoom = 1,
    onToggleGrid,
    onChangeGridSpacing,
    onToggleSnap,
    onToggleOrtho,
    onToggleOsnap,
    onToggleAngle,
    onChangeAngleIncrement,
    onResetView,
    theme: t
}) {
    const formattedX = (coords.x || 0).toFixed(2);
    const formattedY = (coords.y || 0).toFixed(2);
    const zoomPct = Math.round((zoom || 1) * 100);

    let snapLabel = null;
    if (activeSnap) {
        if (activeSnap.type === 'grid') {
            snapLabel = '[GRID SNAPPED]';
        } else {
            snapLabel = `[OSNAP: ${activeSnap.type.toUpperCase()}]`;
        }
    } else if (isSnapped) {
        snapLabel = '[SNAPPED]';
    }

    return (
        <div style={{
            height: 38,
            background: '#18181c',
            borderTop: '1px solid #2e2e38',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            padding: '0 16px',
            fontSize: 12,
            fontFamily: 'Outfit, monospace, sans-serif',
            color: '#a0a0b0',
            userSelect: 'none',
            gap: 12,
            overflowX: 'auto'
        }}>
            {/* Left: Live Coordinates & Tool Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#22222a',
                    padding: '3px 10px',
                    borderRadius: 6,
                    border: '1px solid #333340',
                    fontWeight: 600,
                    color: '#00f0ff'
                }}>
                    <span>X: {formattedX} mm</span>
                    <span style={{ color: '#555566' }}>|</span>
                    <span>Y: {formattedY} mm</span>
                    {snapLabel && (
                        <span style={{ color: '#10b981', fontSize: 10, fontWeight: 800, marginLeft: 4 }}>
                            {snapLabel}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d0d0e0' }}>
                    <span style={{ color: '#777788' }}>Tool:</span>
                    <span style={{ textTransform: 'uppercase', fontWeight: 700, color: '#38bdf8' }}>{activeTool}</span>
                </div>
            </div>

            {/* Right: Quick CAD Toggles & View Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* GRID Toggle & Spacing */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#22222a', borderRadius: 6, border: `1px solid ${gridEnabled ? '#3b82f6' : '#333340'}` }}>
                    <button
                        onClick={onToggleGrid}
                        title="Toggle Grid (F9)"
                        style={{
                            padding: '4px 8px',
                            background: 'transparent',
                            border: 'none',
                            color: gridEnabled ? '#60a5fa' : '#777788',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700
                        }}
                    >
                        GRID {gridEnabled ? 'ON' : 'OFF'}
                    </button>
                    {gridEnabled && (
                        <select
                            value={gridSpacing}
                            onChange={e => onChangeGridSpacing?.(+e.target.value)}
                            title="Grid Spacing (mm)"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderLeft: '1px solid #333340',
                                color: '#60a5fa',
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: '2px 4px',
                                outline: 'none'
                            }}
                        >
                            <option value={10}>10mm</option>
                            <option value={25}>25mm</option>
                            <option value={50}>50mm</option>
                            <option value={100}>100mm</option>
                            <option value={500}>500mm</option>
                        </select>
                    )}
                </div>

                {/* SNAP Toggle */}
                <button
                    onClick={onToggleSnap}
                    title="Toggle Grid Snap"
                    style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: snapEnabled ? '#10b981' : '#333340',
                        background: snapEnabled ? 'rgba(16, 185, 129, 0.2)' : '#22222a',
                        color: snapEnabled ? '#34d399' : '#777788',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        transition: 'all 0.15s ease'
                    }}
                >
                    SNAP {snapEnabled ? 'ON' : 'OFF'}
                </button>

                {/* ORTHO Toggle */}
                <button
                    onClick={onToggleOrtho}
                    title="Toggle Ortho Mode (F8)"
                    style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: orthoEnabled ? '#f59e0b' : '#333340',
                        background: orthoEnabled ? 'rgba(245, 158, 11, 0.2)' : '#22222a',
                        color: orthoEnabled ? '#fbbf24' : '#777788',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        transition: 'all 0.15s ease'
                    }}
                >
                    ORTHO {orthoEnabled ? 'ON' : 'OFF'}
                </button>

                {/* OSNAP Toggle */}
                <button
                    onClick={onToggleOsnap}
                    title="Toggle Object Snap (F3)"
                    style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: osnapEnabled ? '#ec4899' : '#333340',
                        background: osnapEnabled ? 'rgba(236, 72, 153, 0.2)' : '#22222a',
                        color: osnapEnabled ? '#f472b6' : '#777788',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        transition: 'all 0.15s ease'
                    }}
                >
                    OSNAP {osnapEnabled ? 'ON' : 'OFF'}
                </button>

                {/* ANGLE SNAP Toggle & Increment */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#22222a', borderRadius: 6, border: `1px solid ${angleEnabled ? '#a855f7' : '#333340'}` }}>
                    <button
                        onClick={onToggleAngle}
                        title="Toggle Angle Snap"
                        style={{
                            padding: '4px 8px',
                            background: 'transparent',
                            border: 'none',
                            color: angleEnabled ? '#c084fc' : '#777788',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700
                        }}
                    >
                        ANGLE {angleEnabled ? 'ON' : 'OFF'}
                    </button>
                    {angleEnabled && (
                        <select
                            value={angleIncrement}
                            onChange={e => onChangeAngleIncrement?.(+e.target.value)}
                            title="Angle Increment (°)"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderLeft: '1px solid #333340',
                                color: '#c084fc',
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: '2px 4px',
                                outline: 'none'
                            }}
                        >
                            <option value={15}>15°</option>
                            <option value={30}>30°</option>
                            <option value={45}>45°</option>
                            <option value={90}>90°</option>
                        </select>
                    )}
                </div>

                <div style={{ width: 1, height: 16, background: '#333340', margin: '0 2px' }} />

                {/* FIT EXTENTS */}
                <button
                    onClick={onResetView}
                    title="Fit All Drawing Objects to Screen"
                    style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #333340',
                        background: '#22222a',
                        color: '#d0d0e0',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700
                    }}
                >
                    Fit Extents
                </button>

                <div style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#22222a',
                    border: '1px solid #333340',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#888899'
                }}>
                    {zoomPct}% | mm
                </div>
            </div>
        </div>
    );
}
