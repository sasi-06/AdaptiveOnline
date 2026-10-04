import React from 'react';

export default function CadToolbar({
    activeTool = 'select',
    onSelectTool,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    onClearSelected,
    hasSelection = false,
    cadLevel = 'Level 1 — Basic',
    layers = [],
    currentLayerId = 'layer_walls',
    onSelectCurrentLayer,
    showLayersPanel = false,
    onToggleLayersPanel,
    selectedCount = 0,
    onReassignSelectedLayer
}) {
    const tools = [
        { id: 'select', label: 'Select', icon: '↖', category: 'draw' },
        { id: 'line', label: 'Line', icon: '╱', category: 'draw' },
        { id: 'circle', label: 'Circle', icon: '◯', category: 'draw' },
        { id: 'rectangle', label: 'Rectangle', icon: '▭', category: 'draw' },
        { id: 'polyline', label: 'Polyline', icon: '⚡', category: 'draw' },
        { id: 'arc', label: 'Arc', icon: '⌒', category: 'draw' },
        { id: 'text', label: 'Text', icon: 'T', category: 'draw' },
        { id: 'hatch', label: 'Hatch', icon: '▒', category: 'draw' },
        
        { id: 'sep1', isSep: true },

        { id: 'move', label: 'Move', icon: '✥', category: 'modify' },
        { id: 'copy', label: 'Copy', icon: '⧉', category: 'modify' },
        { id: 'rotate', label: 'Rotate', icon: '↻', category: 'modify' },
        { id: 'mirror', label: 'Mirror', icon: '🪞', category: 'modify' },
        { id: 'offset', label: 'Offset', icon: '║', category: 'modify' },
        { id: 'trim', label: 'Trim', icon: '✂️', category: 'modify' },
        { id: 'extend', label: 'Extend', icon: '⤇', category: 'modify' },
        { id: 'fillet', label: 'Fillet', icon: '╭', category: 'modify' },
        { id: 'chamfer', label: 'Chamfer', icon: '◣', category: 'modify' },
        { id: 'sep2', isSep: true },

        { id: 'dim_linear', label: 'Linear', icon: '📏', category: 'dim' },
        { id: 'dim_aligned', label: 'Aligned', icon: '📐', category: 'dim' },
        { id: 'dim_angular', label: 'Angular', icon: '∠', category: 'dim' },
        { id: 'dim_radius', label: 'Radius', icon: 'ⓦ', category: 'dim' },
        { id: 'dim_diameter', label: 'Diameter', icon: '⌀', category: 'dim' },

        { id: 'sep3', isSep: true },

        { id: 'measure_distance', label: 'Dist (M)', icon: '📏', category: 'measure' },
        { id: 'measure_angle', label: 'Angle (M)', icon: '📐', category: 'measure' },
        { id: 'measure_radius', label: 'Radius (M)', icon: 'ⓦ', category: 'measure' },
        { id: 'measure_area', label: 'Area (M)', icon: '▧', category: 'measure' },

        { id: 'sep4', isSep: true },

        { id: 'pan', label: 'Pan', icon: '✋', category: 'view' },
    ];

    return (
        <div style={{
            minHeight: 48,
            background: '#1a1a20',
            borderBottom: '1px solid #2e2e38',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            userSelect: 'none',
            overflowX: 'auto',
            gap: 12,
            zIndex: 10
        }}>
            {/* Left: Tools List & Current Layer Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', flexShrink: 0 }}>
                {tools.map((t) => {
                    if (t.isSep) {
                        return <div key={t.id} style={{ width: 1, height: 24, background: '#333340', margin: '0 4px', flexShrink: 0 }} />;
                    }

                    const isActive = activeTool === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => onSelectTool(t.id)}
                            title={`${t.label} Tool`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 7,
                                border: '1px solid',
                                borderColor: isActive ? '#38bdf8' : 'transparent',
                                background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                color: isActive ? '#38bdf8' : '#c0c0d0',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: isActive ? 700 : 500,
                                fontFamily: 'Outfit, sans-serif',
                                transition: 'all 0.15s ease',
                                flexShrink: 0
                            }}
                            onMouseEnter={e => {
                                if (!isActive) e.currentTarget.style.background = '#282834';
                            }}
                            onMouseLeave={e => {
                                if (!isActive) e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <span style={{ fontSize: 14 }}>{t.icon}</span>
                            <span>{t.label}</span>
                        </button>
                    );
                })}

                {/* Current Active Layer Selector Dropdown */}
                {layers && layers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8, paddingLeft: 8, borderLeft: '1px solid #333340' }}>
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Layer:</span>
                        <select
                            value={currentLayerId}
                            onChange={e => onSelectCurrentLayer && onSelectCurrentLayer(e.target.value)}
                            title="Current Active Layer for new drawing objects"
                            style={{
                                background: '#13131c',
                                border: '1px solid #38bdf8',
                                color: '#38bdf8',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: 'Outfit, sans-serif',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            {layers.map(l => (
                                <option key={l.id} value={l.id}>
                                    {l.name} {l.locked ? '🔒' : (l.visible === false ? '🙈' : '👁')}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Right: History, Layers Panel Toggle & Layer Reassignment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {selectedCount > 0 && layers && layers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1e293b', padding: '3px 8px', borderRadius: 6, border: '1px solid #3b82f6' }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Move {selectedCount} to:</span>
                        <select
                            onChange={e => {
                                if (e.target.value && onReassignSelectedLayer) {
                                    onReassignSelectedLayer(e.target.value);
                                    e.target.value = '';
                                }
                            }}
                            defaultValue=""
                            style={{
                                background: '#0f172a',
                                border: 'none',
                                color: '#38bdf8',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            <option value="" disabled>Select Layer...</option>
                            {layers.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <button
                    onClick={onToggleLayersPanel}
                    title="Toggle Layers Manager Panel"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: showLayersPanel ? '#38bdf8' : '#333340',
                        background: showLayersPanel ? 'rgba(56, 189, 248, 0.2)' : '#22222a',
                        color: showLayersPanel ? '#38bdf8' : '#c0c0d0',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: 'Outfit, sans-serif',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <span>🥞</span>
                    <span>Layers</span>
                </button>

                {hasSelection && (
                    <button
                        onClick={onClearSelected}
                        title="Deselect object (Esc)"
                        style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: '1px solid #ef444455',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600
                        }}
                    >
                        Deselect
                    </button>
                )}

                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #333340',
                        background: '#22222a',
                        color: canUndo ? '#e0e0f0' : '#555566',
                        cursor: canUndo ? 'pointer' : 'not-allowed',
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: canUndo ? 1 : 0.5
                    }}
                >
                    ↶ Undo
                </button>

                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Y)"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #333340',
                        background: '#22222a',
                        color: canRedo ? '#e0e0f0' : '#555566',
                        cursor: canRedo ? 'pointer' : 'not-allowed',
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: canRedo ? 1 : 0.5
                    }}
                >
                    ↷ Redo
                </button>

                <div style={{
                    marginLeft: 8,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.3
                }}>
                    {cadLevel}
                </div>
            </div>
        </div>
    );
}
