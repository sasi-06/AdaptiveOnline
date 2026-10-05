/**
 * CircuitBoard.jsx — Interactive drag-and-drop SVG circuit canvas
 *
 * Features:
 * • Drag components from palette → drop onto canvas (snapped to 20px grid)
 * • Drag components on canvas to reposition (wires follow automatically)
 * • Click a pin → click another pin → wire is drawn (orthogonal routing)
 * • Right-click: context menu (rotate, delete, edit properties)
 * • Double-click: property editor modal
 * • Delete key: remove selected component/wire
 * • Ctrl+Z / Ctrl+Y: undo / redo (50-state stack)
 * • Mouse wheel: zoom (0.5×–3×)
 * • Middle-mouse / Space+drag: pan
 * • Live validation: floating pins (orange), short circuit (red)
 * • Toolbar: Save Draft, Submit, Clear, Undo, Redo, Zoom+/-, Check Circuit
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import ComponentRenderer from './ComponentRenderer';
import PropertyEditor from './PropertyEditor';
import {
    COMP_DEFS, EDITABLE_PROPS, snap, nextCompId,
    getPinWorldPos, orthogonalPath
} from './constants';

const CANVAS_W = 1200;
const CANVAS_H = 800;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.0;
const PIN_SNAP_R = 14; // px — radius for pin click snapping

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
    return crypto.randomUUID ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function screenToWorld(clientX, clientY, svgRect, vt) {
    return {
        x: (clientX - svgRect.left - vt.x) / vt.scale,
        y: (clientY - svgRect.top - vt.y) / vt.scale
    };
}

function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Find the nearest pin within snap radius from worldPos */
function findNearestPin(worldPos, components, excludeCompId = null, maxDist = PIN_SNAP_R) {
    let best = null, bestD = maxDist;
    for (const comp of components) {
        if (comp.comp_id === excludeCompId) continue;
        const pins = getPinWorldPos(comp);
        for (const [pinId, pos] of Object.entries(pins)) {
            const d = dist(worldPos, pos);
            if (d < bestD) { bestD = d; best = { comp, pinId, pos }; }
        }
    }
    return best;
}

/** Check if a connection already exists between two pins */
function connectionExists(connections, fromComp, fromPin, toComp, toPin) {
    return connections.some(c =>
        (c.from.comp_id === fromComp && c.from.pin === fromPin && c.to.comp_id === toComp && c.to.pin === toPin) ||
        (c.from.comp_id === toComp && c.from.pin === toPin && c.to.comp_id === fromComp && c.to.pin === fromPin)
    );
}

/** Determine if a component has any floating (unconnected) pins */
function getFloatingPins(components, connections) {
    const floating = new Set();
    for (const comp of components) {
        if (comp.type === 'ground') continue; // ground single pin is intentionally "unconnected"
        const criticals = getCritical(comp.type);
        for (const pin of criticals) {
            const pinPos = getPinWorldPos(comp)[pin];
            if (!pinPos) continue;
            const connected = connections.some(c =>
                (c.from.comp_id === comp.comp_id && c.from.pin === pin) ||
                (c.to.comp_id === comp.comp_id && c.to.pin === pin)
            );
            if (!connected) floating.add(`${comp.comp_id}::${pin}`);
        }
    }
    return floating;
}

function getCritical(type) {
    const MAP = {
        resistor: ['1','2'], capacitor: ['1','2'], inductor: ['1','2'],
        voltage_source: ['positive','negative'], op_amp: ['non_inverting','inverting','output'],
        diode: ['anode','cathode'], voltmeter: ['positive','negative'], ammeter: ['1','2']
    };
    return MAP[type] || [];
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CircuitBoard({
    initialComponents = [],
    initialConnections = [],
    visiblePalette = [],
    onSave,
    onSubmit,
    readOnly = false,
    highlightedComps = [],
    submitting = false,
}) {
    const svgRef = useRef(null);
    const wrapRef = useRef(null);

    // ── Canvas state
    const [components, setComponents] = useState(initialComponents);
    const [connections, setConnections] = useState(initialConnections);
    const [vt, setVt] = useState({ x: 60, y: 40, scale: 1 }); // view transform

    // ── Interaction state
    const [selected, setSelected] = useState(null); // { type: 'comp'|'wire', id }
    const [dragging, setDragging] = useState(null); // { comp_id, ox, oy }
    const [wiringFrom, setWiringFrom] = useState(null); // { comp_id, pinId, worldPos }
    const [mouseWorld, setMouseWorld] = useState({ x: 0, y: 0 });
    const [panning, setPanning] = useState(null); // { startX, startY, startVtX, startVtY }
    const [contextMenu, setContextMenu] = useState(null); // { x, y, comp_id }
    const [propEditor, setPropEditor] = useState(null); // comp object
    const [floatingPins, setFloatingPins] = useState(new Set());
    const [feedback, setFeedback] = useState(''); // quick validation message
    const [spaceDown, setSpaceDown] = useState(false);

    // ── Undo stack
    const [history, setHistory] = useState([{ components: [], connections: [] }]);
    const [histIdx, setHistIdx] = useState(0);

    // ─ Auto-center view on components
    const autoCenterView = useCallback((comps) => {
        const targetComps = comps || components;
        if (!targetComps || targetComps.length === 0) {
            setVt({ x: 60, y: 40, scale: 1 });
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        targetComps.forEach(c => {
            const x = Number(c.position?.x) || 0;
            const y = Number(c.position?.y) || 0;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + 70);
            maxY = Math.max(maxY, y + 70);
        });

        if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
            setVt({ x: 60, y: 40, scale: 1 });
            return;
        }

        const rect = svgRef.current?.getBoundingClientRect();
        const width = (rect?.width && rect.width > 0) ? rect.width : 600;
        const height = (rect?.height && rect.height > 0) ? rect.height : 400;

        const bboxW = Math.max(140, maxX - minX);
        const bboxH = Math.max(140, maxY - minY);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        let scale = Math.min((width - 80) / bboxW, (height - 80) / bboxH);
        scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));

        if (!Number.isFinite(scale) || scale <= 0) scale = 1;

        const vtX = width / 2 - centerX * scale;
        const vtY = height / 2 - centerY * scale;

        if (Number.isFinite(vtX) && Number.isFinite(vtY) && Number.isFinite(scale)) {
            setVt({ x: Math.round(vtX), y: Math.round(vtY), scale: Number(scale.toFixed(2)) });
        }
    }, [components]);

    // ─ Sync initial props → state & frame circuit (on mount)
    useEffect(() => {
        const comps = Array.isArray(initialComponents) ? initialComponents : [];
        const conns = Array.isArray(initialConnections) ? initialConnections : [];
        setComponents(comps);
        setConnections(conns);
        if (comps.length > 0) {
            const timer = setTimeout(() => autoCenterView(comps), 100);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialComponents, initialConnections]);

    // ─ Live floating-pin validation (debounced)
    useEffect(() => {
        const t = setTimeout(() => {
            setFloatingPins(getFloatingPins(components, connections));
        }, 1500);
        return () => clearTimeout(t);
    }, [components, connections]);

    // ─ Keyboard
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code === 'Space') setSpaceDown(true);
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
                deleteSelected();
            }
            if (e.key === 'r' || e.key === 'R') {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
                if (selected && selected.type === 'comp') {
                    rotateComponent(selected.id);
                }
            }
            if (e.key === 'c' || e.key === 'C') {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
                if (selected && selected.type === 'comp' && !readOnly) {
                    const compToEdit = components.find(c => c.comp_id === selected.id);
                    if (compToEdit) setPropEditor(compToEdit);
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
            if (e.key === 'Escape') { setWiringFrom(null); setContextMenu(null); }
        };
        const onKeyUp = (e) => { if (e.code === 'Space') setSpaceDown(false); };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
    // eslint-disable-next-line
    }, [selected, histIdx, history, components]);

    // ─── History helpers ────────────────────────────────────────────────────
    const pushHistory = useCallback((comps, conns) => {
        setHistory(prev => {
            const sliced = prev.slice(0, histIdx + 1);
            const next = [...sliced, { components: comps, connections: conns }].slice(-50);
            return next;
        });
        setHistIdx(prev => Math.min(prev + 1, 49));
    }, [histIdx]);

    const undo = useCallback(() => {
        if (histIdx <= 0) return;
        const state = history[histIdx - 1];
        setComponents(state.components);
        setConnections(state.connections);
        setHistIdx(histIdx - 1);
        setSelected(null);
    }, [history, histIdx]);

    const redo = useCallback(() => {
        if (histIdx >= history.length - 1) return;
        const state = history[histIdx + 1];
        setComponents(state.components);
        setConnections(state.connections);
        setHistIdx(histIdx + 1);
        setSelected(null);
    }, [history, histIdx]);

    // ─── Component operations ───────────────────────────────────────────────
    const addComponent = (type, worldPos) => {
        const def = COMP_DEFS[type];
        if (!def) return;
        const comp = {
            comp_id: nextCompId(type, components),
            type,
            properties: Object.fromEntries(
                (EDITABLE_PROPS[type] || []).map(p => [p.key, p.default])
            ),
            position: { x: snap(worldPos.x - def.width / 2), y: snap(worldPos.y - def.height / 2) },
            rotation: 0
        };
        const newComps = [...components, comp];
        setComponents(newComps);
        pushHistory(newComps, connections);
    };

    const moveComponent = (comp_id, dx, dy) => {
        setComponents(prev => prev.map(c =>
            c.comp_id === comp_id
                ? { ...c, position: { x: snap(c.position.x + dx), y: snap(c.position.y + dy) } }
                : c
        ));
    };

    const rotateComponent = (comp_id) => {
        const newComps = components.map(c =>
            c.comp_id === comp_id ? { ...c, rotation: ((c.rotation || 0) + 90) % 360 } : c
        );
        setComponents(newComps);
        pushHistory(newComps, connections);
    };

    const deleteComponent = (comp_id) => {
        const newComps = components.filter(c => c.comp_id !== comp_id);
        const newConns = connections.filter(c => c.from.comp_id !== comp_id && c.to.comp_id !== comp_id);
        setComponents(newComps);
        setConnections(newConns);
        pushHistory(newComps, newConns);
        setSelected(null);
    };

    const deleteWire = (wireId) => {
        const newConns = connections.filter(c => c.id !== wireId);
        setConnections(newConns);
        pushHistory(components, newConns);
        setSelected(null);
    };

    const deleteSelected = () => {
        if (!selected) return;
        if (selected.type === 'comp') deleteComponent(selected.id);
        if (selected.type === 'wire') deleteWire(selected.id);
    };

    const updateProperties = (comp_id, newProps) => {
        const newComps = components.map(c =>
            c.comp_id === comp_id ? { ...c, properties: { ...c.properties, ...newProps } } : c
        );
        setComponents(newComps);
        pushHistory(newComps, connections);
    };

    // ─── Wiring ─────────────────────────────────────────────────────────────
    const handlePinClick = (e, comp, pinId) => {
        e.stopPropagation();
        if (readOnly) return;
        const worldPins = getPinWorldPos(comp);
        const worldPos = worldPins[pinId];

        if (!wiringFrom) {
            // Start wiring
            setWiringFrom({ comp_id: comp.comp_id, pinId, worldPos });
            setFeedback(`Wiring from ${comp.comp_id}:${pinId}. Click a destination pin.`);
        } else {
            // Complete wire
            if (wiringFrom.comp_id === comp.comp_id) {
                setWiringFrom(null);
                setFeedback('Cannot connect a pin to itself.');
                return;
            }
            if (connectionExists(connections, wiringFrom.comp_id, wiringFrom.pinId, comp.comp_id, pinId)) {
                setWiringFrom(null);
                setFeedback('Connection already exists between those pins.');
                return;
            }
            const newConn = { id: uuid(), from: { comp_id: wiringFrom.comp_id, pin: wiringFrom.pinId }, to: { comp_id: comp.comp_id, pin: pinId } };
            const newConns = [...connections, newConn];
            setConnections(newConns);
            pushHistory(components, newConns);
            setWiringFrom(null);
            setFeedback('');
        }
    };

    // ─── Drag-from-canvas ───────────────────────────────────────────────────
    const handleCompMouseDown = (e, comp_id) => {
        if (e.button !== 0 || wiringFrom || readOnly) return;
        e.stopPropagation();
        const rect = svgRef.current.getBoundingClientRect();
        const wx = (e.clientX - rect.left - vt.x) / vt.scale;
        const wy = (e.clientY - rect.top - vt.y) / vt.scale;
        const comp = components.find(c => c.comp_id === comp_id);
        setDragging({ comp_id, ox: wx - comp.position.x, oy: wy - comp.position.y });
        setSelected({ type: 'comp', id: comp_id });
        setContextMenu(null);
    };

    // ─── SVG mouse events ───────────────────────────────────────────────────
    const handleSVGMouseMove = (e) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const world = screenToWorld(e.clientX, e.clientY, rect, vt);
        setMouseWorld(world);

        if (dragging) {
            setComponents(prev => prev.map(c =>
                c.comp_id === dragging.comp_id
                    ? { ...c, position: { x: snap(world.x - dragging.ox), y: snap(world.y - dragging.oy) } }
                    : c
            ));
        }

        if (panning) {
            setVt(prev => ({
                ...prev,
                x: panning.startVtX + (e.clientX - panning.startX),
                y: panning.startVtY + (e.clientY - panning.startY)
            }));
        }
    };

    const handleSVGMouseUp = (e) => {
        if (dragging) {
            pushHistory(components, connections);
            setDragging(null);
        }
        if (panning) setPanning(null);
    };

    const handleSVGMouseDown = (e) => {
        // Middle mouse or Space+left → pan
        if (e.button === 1 || (spaceDown && e.button === 0)) {
            e.preventDefault();
            setPanning({ startX: e.clientX, startY: e.clientY, startVtX: vt.x, startVtY: vt.y });
            return;
        }
        if (e.button === 0) {
            setSelected(null);
            setContextMenu(null);
            if (wiringFrom) { setWiringFrom(null); setFeedback(''); }
        }
    };

    // ─── Wheel zoom ─────────────────────────────────────────────────────────
    useEffect(() => {
        const svgEl = svgRef.current;
        if (!svgEl) return;
        const handleWheel = (e) => {
            e.preventDefault();
            const rect = svgEl.getBoundingClientRect();
            if (!rect || rect.width === 0) return;

            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.15 : 0.85;

            setVt(prev => {
                const currentScale = Number.isFinite(prev.scale) && prev.scale > 0 ? prev.scale : 1;
                const currentX = Number.isFinite(prev.x) ? prev.x : 60;
                const currentY = Number.isFinite(prev.y) ? prev.y : 40;

                const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, currentScale * factor));
                if (Math.abs(newScale - currentScale) < 0.001) return prev;

                const ratio = newScale / currentScale;
                const newX = mx - (mx - currentX) * ratio;
                const newY = my - (my - currentY) * ratio;

                if (!Number.isFinite(newX) || !Number.isFinite(newY) || !Number.isFinite(newScale)) {
                    return prev;
                }

                return {
                    scale: Number(newScale.toFixed(2)),
                    x: Math.round(newX),
                    y: Math.round(newY),
                };
            });
        };
        svgEl.addEventListener('wheel', handleWheel, { passive: false });
        return () => svgEl.removeEventListener('wheel', handleWheel);
    }, []);

    // ─── Drop from palette ───────────────────────────────────────────────────
    const handleDrop = (e) => {
        e.preventDefault();
        if (readOnly) return;
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const rect = svgRef.current.getBoundingClientRect();
            const world = screenToWorld(e.clientX, e.clientY, rect, vt);
            addComponent(data.componentType, world);
        } catch (_) {}
    };

    // ─── Context menu ────────────────────────────────────────────────────────
    const handleRightClick = (e, comp_id) => {
        e.preventDefault();
        e.stopPropagation();
        if (readOnly) return;
        setSelected({ type: 'comp', id: comp_id });
        setContextMenu({ x: e.clientX, y: e.clientY, comp_id });
    };

    // ─── Validation ─────────────────────────────────────────────────────────
    const handleValidate = () => {
        const floating = getFloatingPins(components, connections);
        const gnd = components.find(c => c.type === 'ground');
        const msgs = [];
        if (!gnd) msgs.push(' No ground component placed.');
        if (floating.size > 0) msgs.push(` ${floating.size} floating pin(s) detected (shown in orange).`);
        if (msgs.length === 0) msgs.push(' Basic validation passed. Circuit looks connected.');
        setFeedback(msgs.join(' '));
    };

    // ─── Computed per-frame ──────────────────────────────────────────────────
    const placedCounts = {};
    for (const c of components) placedCounts[c.type] = (placedCounts[c.type] || 0) + 1;

    const allPinPositions = {};
    for (const comp of components) {
        allPinPositions[comp.comp_id] = getPinWorldPos(comp);
    }

    const safeX = Number.isFinite(vt.x) ? vt.x : 60;
    const safeY = Number.isFinite(vt.y) ? vt.y : 40;
    const safeScale = (Number.isFinite(vt.scale) && vt.scale > 0) ? vt.scale : 1;
    const gridX = ((safeX % 20) + 20) % 20;
    const gridY = ((safeY % 20) + 20) % 20;

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <div style={styles.root} ref={wrapRef}>
            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div style={styles.toolbar}>
                <div style={styles.toolbarLeft}>
                    {!readOnly ? (
                        <>
                            <ToolBtn disabled={submitting} icon="" label="Save Draft"
                                     accent onClick={() => onSave?.({ components, connections })} />
                            <ToolBtn disabled={submitting} icon="" label="Submit"
                                     primary submitting={submitting}
                                     onClick={() => onSubmit?.({ components, connections })} />
                            <div style={styles.divider} />
                            <ToolBtn icon="↩" onClick={undo} disabled={histIdx <= 0} title="Undo (Ctrl+Z)" />
                            <ToolBtn icon="↪" onClick={redo} disabled={histIdx >= history.length - 1} title="Redo (Ctrl+Y)" />
                            <ToolBtn icon="" label="Check" onClick={handleValidate} />
                            <ToolBtn icon="" label="Clear" onClick={() => {
                                if (window.confirm('Clear all components and wires?')) {
                                    setComponents([]); setConnections([]);
                                    pushHistory([], []); setSelected(null);
                                }
                            }} />
                        </>
                    ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
                             Read-Only Circuit View
                        </span>
                    )}
                </div>
                <div style={styles.toolbarRight}>
                    <ToolBtn icon="＋" onClick={() => setVt(p => ({ ...p, scale: Math.min(ZOOM_MAX, p.scale * 1.2) }))} />
                    <span style={styles.zoomLabel}>{Math.round(vt.scale * 100)}%</span>
                    <ToolBtn icon="－" onClick={() => setVt(p => ({ ...p, scale: Math.max(ZOOM_MIN, p.scale * 0.8) }))} />
                    <ToolBtn icon="⊞" title="Reset / Center View"
                             onClick={() => autoCenterView(components)} />
                </div>
            </div>

            {/* ── Shortcut Quick Guide Banner ─────────────────────────────── */}
            {!readOnly && (
                <div style={styles.shortcutGuideStrip}>
                    <span>
                         <b>Shortcuts:</b> Select component & press <kbd style={styles.kbd}>R</kbd> to rotate &bull; Press <kbd style={styles.kbd}>C</kbd> (or double-click) to edit Voltage / Values &bull; Press <kbd style={styles.kbd}>Delete</kbd> to remove
                    </span>
                </div>
            )}

            {/* ── Feedback strip ──────────────────────────────────────── */}
            {feedback && (
                <div style={styles.feedbackStrip}>
                    <span>{feedback}</span>
                    <button style={styles.fbClose} onClick={() => setFeedback('')}></button>
                </div>
            )}

            {/* ── Canvas ──────────────────────────────────────────────── */}
            <div style={{ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
                 onDragOver={e => e.preventDefault()}
                 onDrop={handleDrop}>
                <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    style={{ cursor: wiringFrom ? 'crosshair' : spaceDown ? 'grab' : 'default', display: 'block', width: '100%', height: '100%' }}
                    onMouseMove={handleSVGMouseMove}
                    onMouseUp={handleSVGMouseUp}
                    onMouseDown={handleSVGMouseDown}
                    onContextMenu={e => e.preventDefault()}
                >
                    <defs>
                        {/* Grid dot pattern */}
                        <pattern id="dotgrid" width="20" height="20" patternUnits="userSpaceOnUse"
                                 patternTransform={`translate(${gridX},${gridY})`}>
                            <circle cx="10" cy="10" r="1" fill="rgba(255,255,255,0.12)" />
                        </pattern>
                        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="#6c63ff" />
                        </marker>
                    </defs>

                    {/* Background */}
                    <rect width="100%" height="100%" fill="#0d0f1a" />
                    <rect width="100%" height="100%" fill="url(#dotgrid)" />

                    {/* World-space group */}
                    <g transform={`translate(${safeX},${safeY}) scale(${safeScale})`}>
                        {/* ── Wires ────────────────────────────────── */}
                        {connections.map(conn => {
                            const fromComp = components.find(c => c.comp_id === conn.from.comp_id);
                            const toComp = components.find(c => c.comp_id === conn.to.comp_id);
                            if (!fromComp || !toComp) return null;
                            const fromPins = getPinWorldPos(fromComp);
                            const toPins = getPinWorldPos(toComp);
                            const fp = fromPins[conn.from.pin];
                            const tp = toPins[conn.to.pin];
                            if (!fp || !tp) return null;
                            const isSelected = selected?.type === 'wire' && selected?.id === conn.id;
                            return (
                                <path
                                    key={conn.id}
                                    d={orthogonalPath(fp.x, fp.y, tp.x, tp.y)}
                                    fill="none"
                                    stroke={isSelected ? '#6c63ff' : '#4b5563'}
                                    strokeWidth={isSelected ? 3 : 2}
                                    strokeLinecap="round"
                                    style={{ cursor: 'pointer', filter: isSelected ? 'drop-shadow(0 0 4px #6c63ff)' : 'none' }}
                                    onClick={(e) => { e.stopPropagation(); setSelected({ type: 'wire', id: conn.id }); }}
                                />
                            );
                        })}

                        {/* ── Wire preview while wiring ────────────── */}
                        {wiringFrom && (() => {
                            const fp = wiringFrom.worldPos;
                            return (
                                <path
                                    d={orthogonalPath(fp.x, fp.y, mouseWorld.x, mouseWorld.y)}
                                    fill="none" stroke="#6c63ff" strokeWidth="1.5"
                                    strokeDasharray="6 4" opacity="0.8"
                                    style={{ pointerEvents: 'none' }}
                                />
                            );
                        })()}

                        {/* ── Components ───────────────────────────── */}
                        {components.map(comp => {
                            const def = COMP_DEFS[comp.type];
                            if (!def) return null;
                            const isSelected = selected?.type === 'comp' && selected?.id === comp.comp_id;
                            const isHighlighted = highlightedComps.includes(comp.comp_id);
                            const pinPositions = allPinPositions[comp.comp_id] || {};
                            const cx = def.width / 2;
                            const cy = def.height / 2;

                            return (
                                <g
                                    key={comp.comp_id}
                                    transform={`translate(${comp.position.x},${comp.position.y}) rotate(${comp.rotation || 0},${cx},${cy})`}
                                    onMouseDown={e => handleCompMouseDown(e, comp.comp_id)}
                                    onContextMenu={e => handleRightClick(e, comp.comp_id)}
                                    onDoubleClick={e => { e.stopPropagation(); if (!readOnly) setPropEditor(comp); }}
                                    style={{ cursor: readOnly ? 'default' : 'move' }}
                                >
                                    {/* Hit area */}
                                    <rect
                                        x={-6} y={-6}
                                        width={def.width + 12}
                                        height={def.height + 12}
                                        fill="transparent"
                                        rx="4"
                                    />

                                    {/* Selection / highlight ring */}
                                    {(isSelected || isHighlighted) && (
                                        <rect
                                            x={-6} y={-6}
                                            width={def.width + 12}
                                            height={def.height + 12}
                                            fill="none"
                                            stroke={isHighlighted ? '#ef4444' : '#6c63ff'}
                                            strokeWidth="2"
                                            rx="4"
                                            opacity="0.9"
                                            style={{ filter: `drop-shadow(0 0 5px ${isHighlighted ? '#ef4444' : '#6c63ff'})` }}
                                        />
                                    )}

                                    {/* Component body */}
                                    <ComponentRenderer type={comp.type} properties={comp.properties} />

                                    {/* Component label */}
                                    <text
                                        x={def.width / 2} y={def.height + 14}
                                        textAnchor="middle"
                                        fontSize="10" fontWeight="700"
                                        fill={def.color || '#94a3b8'}
                                        fontFamily="Outfit, monospace"
                                    >
                                        {comp.comp_id}
                                    </text>
                                </g>
                            );
                        })}

                        {/* ── Pins (rendered above components for interaction) ── */}
                        {components.map(comp => {
                            const def = COMP_DEFS[comp.type];
                            if (!def) return null;
                            const pinPositions = allPinPositions[comp.comp_id] || {};
                            return (
                                <g key={`pins-${comp.comp_id}`}>
                                    {Object.entries(pinPositions).map(([pinId, worldPos]) => {
                                        const isWiringStart = wiringFrom?.comp_id === comp.comp_id && wiringFrom?.pinId === pinId;
                                        const isFloating = floatingPins.has(`${comp.comp_id}::${pinId}`);
                                        const pinColor = isWiringStart ? '#6c63ff'
                                                            : isFloating ? '#f59e0b'
                                                            : wiringFrom ? '#22c55e'
                                                            : def.color;
                                        const pinR = wiringFrom ? 7 : 4;
                                        return (
                                            <g
                                                key={pinId}
                                                style={{ cursor: readOnly ? 'default' : 'crosshair' }}
                                                onMouseDown={e => e.stopPropagation()}
                                                onClick={e => handlePinClick(e, comp, pinId)}
                                            >
                                                <circle
                                                    cx={worldPos.x} cy={worldPos.y} r={14}
                                                    fill="transparent"
                                                />
                                                <circle
                                                    cx={worldPos.x} cy={worldPos.y} r={pinR}
                                                    fill={pinColor}
                                                    opacity={wiringFrom ? 0.9 : 0.7}
                                                    stroke={isWiringStart ? '#fff' : 'transparent'}
                                                    strokeWidth="1.5"
                                                    style={{ transition: 'r 0.1s, opacity 0.1s' }}
                                                />
                                                <title>{comp.comp_id}:{pinId}</title>
                                            </g>
                                        );
                                    })}
                                </g>
                            );
                        })}
                    </g>
                </svg>

                {/* ── Context Menu ───────────────────────────────────────── */}
                {contextMenu && (
                    <div style={{ ...styles.ctxMenu, left: contextMenu.x, top: contextMenu.y }}>
                        <CtxItem icon="" label="Rotate 90°" onClick={() => { rotateComponent(contextMenu.comp_id); setContextMenu(null); }} />
                        <CtxItem icon="" label="Edit Properties" onClick={() => { setPropEditor(components.find(c => c.comp_id === contextMenu.comp_id)); setContextMenu(null); }} />
                        <div style={styles.ctxDivider} />
                        <CtxItem icon="" label="Delete" danger onClick={() => { deleteComponent(contextMenu.comp_id); setContextMenu(null); }} />
                    </div>
                )}
            </div>

            {/* ── Property Editor Modal ───────────────────────────────── */}
            {propEditor && (
                <PropertyEditor
                    comp={propEditor}
                    onSave={updateProperties}
                    onClose={() => setPropEditor(null)}
                />
            )}
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolBtn({ icon, label, onClick, disabled, title, accent, primary, submitting }) {
    return (
        <button
            style={{
                ...styles.toolBtn,
                ...(primary ? styles.toolBtnPrimary : {}),
                ...(accent ? styles.toolBtnAccent : {}),
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            onClick={disabled ? undefined : onClick}
            title={title || label}
            disabled={disabled}
        >
            {submitting ? <span style={styles.spinner} /> : icon}
            {label && <span style={{ marginLeft: 4, fontSize: 11 }}>{label}</span>}
        </button>
    );
}

function CtxItem({ icon, label, onClick, danger }) {
    return (
        <button
            style={{ ...styles.ctxItem, ...(danger ? styles.ctxItemDanger : {}) }}
            onClick={onClick}
        >
            <span>{icon}</span>
            <span>{label}</span>
        </button>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
    root: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#0d0f1a',
        overflow: 'hidden',
        position: 'relative',
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'rgba(22, 24, 39, 0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        gap: 8,
        flexShrink: 0,
        zIndex: 10,
    },
    toolbarLeft: { display: 'flex', alignItems: 'center', gap: 6 },
    toolbarRight: { display: 'flex', alignItems: 'center', gap: 6 },
    toolBtn: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 7,
        color: '#94a3b8',
        fontSize: 14,
        padding: '5px 10px',
        fontFamily: 'Outfit, sans-serif',
        fontWeight: 600,
        transition: 'all 0.15s',
        minWidth: 32,
        justifyContent: 'center',
        whiteSpace: 'nowrap',
    },
    toolBtnPrimary: {
        background: 'linear-gradient(135deg,#6c63ff,#4b44cc)',
        border: '1px solid transparent',
        color: '#fff',
        boxShadow: '0 3px 10px rgba(108,99,255,0.4)',
    },
    toolBtnAccent: {
        background: 'rgba(34,197,94,0.12)',
        border: '1px solid rgba(34,197,94,0.3)',
        color: '#22c55e',
    },
    divider: {
        width: 1, height: 24,
        background: 'rgba(255,255,255,0.1)',
        margin: '0 4px',
    },
    zoomLabel: {
        color: '#6b7280',
        fontSize: 11,
        fontFamily: 'monospace',
        minWidth: 38,
        textAlign: 'center',
    },
    feedbackStrip: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        background: 'rgba(108,99,255,0.12)',
        borderBottom: '1px solid rgba(108,99,255,0.25)',
        fontSize: 12,
        color: '#c4b5fd',
        flexShrink: 0,
    },
    fbClose: {
        background: 'none', border: 'none',
        color: '#6b7280', cursor: 'pointer',
        fontSize: 12, padding: '0 4px',
    },
    ctxMenu: {
        position: 'fixed',
        background: '#1e2136',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 500,
        overflow: 'hidden',
        minWidth: 170,
    },
    ctxItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        background: 'none',
        border: 'none',
        color: '#f0f0ff',
        padding: '9px 14px',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'Outfit, sans-serif',
        textAlign: 'left',
        transition: 'background 0.12s',
    },
    ctxItemDanger: { color: '#ef4444' },
    ctxDivider: {
        height: 1,
        background: 'rgba(255,255,255,0.07)',
        margin: '2px 0',
    },
    spinner: {
        display: 'inline-block',
        width: 12, height: 12,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
    },
    shortcutGuideStrip: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 14px',
        background: 'rgba(56, 189, 248, 0.08)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
        fontSize: 12,
        color: '#38bdf8',
        fontFamily: 'Outfit, sans-serif',
        flexShrink: 0,
        textAlign: 'center',
    },
    kbd: {
        background: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: 4,
        padding: '1px 5px',
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        color: '#ffffff',
    }
};
