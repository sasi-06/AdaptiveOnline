/**
 * ComponentPalette.jsx
 * Left sidebar showing draggable circuit components filtered by visible_palette.
 */

import React from 'react';
import ComponentRenderer from './ComponentRenderer';
import { COMP_DEFS, CATEGORIES } from './constants';

const PALETTE_PREVIEW_SCALE = 0.8;

export default function ComponentPalette({ visiblePalette = [], maxInstances = {}, placedCounts = {} }) {
    const grouped = {};
    for (const type of visiblePalette) {
        const def = COMP_DEFS[type];
        if (!def) continue;
        const cat = def.category;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(type);
    }

    const handleDragStart = (e, type) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ componentType: type }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div style={styles.palette}>
            <div style={styles.paletteTitle}>
                <span style={{ fontSize: 14, marginRight: 6 }}>🔌</span>
                Component Palette
            </div>
            <div style={styles.hint}>Drag components onto the canvas</div>

            {Object.entries(grouped).map(([cat, types]) => {
                const catDef = CATEGORIES[cat] || { label: cat, color: '#94a3b8' };
                return (
                    <div key={cat} style={styles.category}>
                        <div style={{ ...styles.catLabel, color: catDef.color }}>
                            {catDef.label}
                        </div>
                        {types.map(type => {
                            const def    = COMP_DEFS[type];
                            const placed = placedCounts[type] || 0;
                            const max    = maxInstances[type];
                            const atMax  = max !== undefined && placed >= max;
                            const pw     = Math.round(def.width  * PALETTE_PREVIEW_SCALE);
                            const ph     = Math.max(Math.round(def.height * PALETTE_PREVIEW_SCALE), 40);

                            return (
                                <div
                                    key={type}
                                    draggable={!atMax}
                                    onDragStart={atMax ? undefined : (e) => handleDragStart(e, type)}
                                    style={{
                                        ...styles.item,
                                        opacity:   atMax ? 0.4 : 1,
                                        cursor:    atMax ? 'not-allowed' : 'grab',
                                        borderColor: def.color + '44',
                                    }}
                                    title={atMax ? `Max ${max} instance(s) reached` : `Drag to add ${def.label}`}
                                >
                                    <svg
                                        width={pw + 10}
                                        height={ph + 10}
                                        viewBox={`-5 -5 ${def.width + 10} ${def.height + 10}`}
                                        style={{ flexShrink: 0 }}
                                    >
                                        <ComponentRenderer type={type} />
                                        {/* Pin dots */}
                                        {Object.values(COMP_DEFS[type]?.pins || {}).map((p, i) => (
                                            <circle key={i} cx={p.x} cy={p.y} r="2.5"
                                                    fill={def.color} opacity="0.8" />
                                        ))}
                                    </svg>
                                    <div style={styles.itemMeta}>
                                        <span style={{ ...styles.itemName, color: def.color }}>{def.label}</span>
                                        {max !== undefined && (
                                            <span style={styles.counter}>{placed}/{max}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

const styles = {
    palette: {
        width: 190,
        background: 'rgba(22, 24, 39, 0.95)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflowY: 'auto',
        flexShrink: 0,
        padding: '12px 8px',
    },
    paletteTitle: {
        color: '#f0f0ff',
        fontWeight: 700,
        fontSize: 13,
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
    },
    hint: {
        color: '#6b7280',
        fontSize: 10,
        marginBottom: 12,
        padding: '0 4px',
    },
    category: {
        marginBottom: 12,
    },
    catLabel: {
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 6,
        padding: '0 4px',
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 8,
        border: '1px solid transparent',
        marginBottom: 4,
        background: 'rgba(255,255,255,0.03)',
        transition: 'all 0.15s ease',
        userSelect: 'none',
    },
    itemMeta: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    itemName: {
        fontSize: 11,
        fontWeight: 600,
    },
    counter: {
        fontSize: 10,
        color: '#6b7280',
        fontFamily: 'monospace',
    }
};
