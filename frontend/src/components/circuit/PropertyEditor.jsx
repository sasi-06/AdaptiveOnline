/**
 * PropertyEditor.jsx
 * Modal panel to edit a component's properties (resistance, voltage, model etc.)
 * Triggered by double-clicking a component on the canvas.
 */

import React, { useState, useEffect } from 'react';
import { COMP_DEFS, EDITABLE_PROPS } from './constants';

export default function PropertyEditor({ comp, onSave, onClose }) {
    const [values, setValues] = useState({});

    useEffect(() => {
        if (!comp) return;
        // Seed initial values from component properties
        const props = EDITABLE_PROPS[comp.type] || [];
        const init = {};
        for (const p of props) {
            init[p.key] = comp.properties?.[p.key] ?? p.default;
        }
        setValues(init);
    }, [comp]);

    if (!comp) return null;

    const def   = COMP_DEFS[comp.type];
    const props = EDITABLE_PROPS[comp.type] || [];

    const handleChange = (key, val) => {
        setValues(prev => ({ ...prev, [key]: val }));
    };

    const handleSave = () => {
        onSave(comp.comp_id, values);
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div style={styles.backdrop} onClick={onClose} />

            {/* Modal */}
            <div style={styles.modal}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <div style={{ ...styles.compName, color: def?.color || '#38bdf8' }}>
                            {comp.comp_id}
                        </div>
                        <div style={styles.compType}>{def?.label || comp.type}</div>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* Properties */}
                <div style={styles.body}>
                    {props.length === 0 ? (
                        <p style={{ color: '#6b7280', fontSize: 13 }}>
                            This component has no editable properties.
                        </p>
                    ) : (
                        props.map(p => {
                            const show = !p.showIf ||
                                p.showIf.split('!=').reduce((acc, part, i) => {
                                    if (i === 0) return part.trim();
                                    const k = acc.trim(), v = part.trim();
                                    return values[k] !== v;
                                }, true);
                            if (!show) return null;

                            return (
                                <div key={p.key} style={styles.fieldRow}>
                                    <label style={styles.label}>{p.label}</label>
                                    {p.type === 'select' ? (
                                        <select
                                            style={styles.select}
                                            value={values[p.key] ?? p.default}
                                            onChange={e => handleChange(p.key, e.target.value)}
                                        >
                                            {(p.options || []).map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div style={styles.inputWrap}>
                                            <input
                                                style={styles.input}
                                                type="number"
                                                value={values[p.key] ?? p.default}
                                                min={p.min}
                                                max={p.max}
                                                step="any"
                                                onChange={e => handleChange(p.key, parseFloat(e.target.value))}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Actions */}
                <div style={styles.footer}>
                    <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <button style={styles.saveBtn}   onClick={handleSave}>Apply</button>
                </div>
            </div>
        </>
    );
}

const styles = {
    backdrop: {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
    },
    modal: {
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 1001,
        background: 'linear-gradient(135deg, #161827, #1e2136)',
        border: '1px solid rgba(108,99,255,0.3)',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        width: 340,
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '18px 20px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(108,99,255,0.08)',
    },
    compName: {
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: '0.02em',
    },
    compType: {
        color: '#8b8fa8',
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 6,
        color: '#8b8fa8',
        cursor: 'pointer',
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
    },
    body: {
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
    },
    fieldRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    label: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: 600,
    },
    inputWrap: {
        position: 'relative',
    },
    input: {
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#f0f0ff',
        fontSize: 14,
        padding: '8px 12px',
        outline: 'none',
        fontFamily: 'Outfit, sans-serif',
        transition: 'border-color 0.2s',
    },
    select: {
        width: '100%',
        background: '#1e2136',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#f0f0ff',
        fontSize: 13,
        padding: '8px 12px',
        outline: 'none',
        fontFamily: 'Outfit, sans-serif',
        cursor: 'pointer',
    },
    footer: {
        padding: '12px 20px 18px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 10,
    },
    cancelBtn: {
        padding: '8px 18px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#94a3b8',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'Outfit, sans-serif',
    },
    saveBtn: {
        padding: '8px 22px',
        background: 'linear-gradient(135deg, #6c63ff, #4b44cc)',
        border: 'none',
        borderRadius: 8,
        color: '#fff',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Outfit, sans-serif',
        boxShadow: '0 4px 12px rgba(108,99,255,0.4)',
    },
};
