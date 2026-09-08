/**
 * constants.js — Shared circuit board constants
 * Used by CircuitBoard, ComponentRenderer, ComponentPalette
 */

export const SNAP = 20; // grid snap size in px

// ── Component definitions: dimensions + pin offsets (local space) ────────────
export const COMP_DEFS = {
    resistor: {
        width: 60, height: 20,
        label: 'Resistor', category: 'passive', color: '#f59e0b',
        pins: { '1': { x: 0, y: 10 }, '2': { x: 60, y: 10 } }
    },
    capacitor: {
        width: 60, height: 30,
        label: 'Capacitor', category: 'passive', color: '#ec4899',
        pins: { '1': { x: 0, y: 15 }, '2': { x: 60, y: 15 } }
    },
    inductor: {
        width: 60, height: 20,
        label: 'Inductor', category: 'passive', color: '#10b981',
        pins: { '1': { x: 0, y: 10 }, '2': { x: 60, y: 10 } }
    },
    diode: {
        width: 50, height: 20,
        label: 'Diode', category: 'active', color: '#8b5cf6',
        pins: { anode: { x: 0, y: 10 }, cathode: { x: 50, y: 10 } }
    },
    bjt_npn: {
        width: 50, height: 60,
        label: 'NPN Transistor', category: 'active', color: '#06b6d4',
        pins: { base: { x: 0, y: 30 }, collector: { x: 50, y: 10 }, emitter: { x: 50, y: 50 } }
    },
    op_amp: {
        width: 80, height: 60,
        label: 'Op-Amp', category: 'ic', color: '#38bdf8',
        pins: {
            non_inverting: { x: 0,  y: 20 },
            inverting:     { x: 0,  y: 40 },
            output:        { x: 80, y: 30 },
            vcc:           { x: 40, y: 0  },
            vee:           { x: 40, y: 60 }
        }
    },
    voltage_source: {
        width: 40, height: 60,
        label: 'Voltage Source', category: 'source', color: '#f97316',
        pins: { positive: { x: 20, y: 0 }, negative: { x: 20, y: 60 } }
    },
    ground: {
        width: 40, height: 30,
        label: 'Ground', category: 'source', color: '#94a3b8',
        pins: { '1': { x: 20, y: 0 } }
    },
    voltmeter: {
        width: 40, height: 60,
        label: 'Voltmeter', category: 'measurement', color: '#22c55e',
        pins: { positive: { x: 20, y: 0 }, negative: { x: 20, y: 60 } }
    },
    ammeter: {
        width: 60, height: 30,
        label: 'Ammeter', category: 'measurement', color: '#22c55e',
        pins: { '1': { x: 0, y: 15 }, '2': { x: 60, y: 15 } }
    },
    logic_gate_and: {
        width: 60, height: 40,
        label: 'AND Gate', category: 'digital', color: '#a78bfa',
        pins: { in1: { x: 0, y: 10 }, in2: { x: 0, y: 30 }, out: { x: 60, y: 20 } }
    }
};

export const CATEGORIES = {
    passive:     { label: 'Passive',     color: '#f59e0b' },
    active:      { label: 'Active',      color: '#8b5cf6' },
    ic:          { label: 'ICs',         color: '#38bdf8' },
    source:      { label: 'Sources',     color: '#f97316' },
    measurement: { label: 'Measurement', color: '#22c55e' },
    digital:     { label: 'Digital',     color: '#a78bfa' }
};

// Editable properties for each component type
export const EDITABLE_PROPS = {
    resistor:       [{ key: 'resistance_ohm',   label: 'Resistance (Ω)',    type: 'number',   default: 1000,    min: 1,    max: 10000000 }],
    capacitor:      [{ key: 'capacitance_farad',label: 'Capacitance (F)',   type: 'number',   default: 0.000001 }],
    inductor:       [{ key: 'inductance_henry',  label: 'Inductance (H)',   type: 'number',   default: 0.001 }],
    diode:          [{ key: 'model',             label: 'Diode Type',       type: 'select',   default: 'ideal', options: ['ideal','1N4148','1N4007','zener'] }],
    bjt_npn:        [{ key: 'model',             label: 'Model',            type: 'select',   default: '2N2222',options: ['2N2222','BC547','ideal'] }],
    op_amp:         [{ key: 'model',             label: 'Op-Amp Model',     type: 'select',   default: 'ideal', options: ['ideal','LM741','LM358'] }],
    voltage_source: [
        { key: 'voltage',      label: 'Voltage (V)',   type: 'number', default: 5 },
        { key: 'waveform',     label: 'Waveform',      type: 'select', default: 'DC', options: ['DC','sine','square','pulse'] },
        { key: 'frequency_hz', label: 'Frequency (Hz)',type: 'number', default: 0 }
    ],
    ground:         [],
    voltmeter:      [],
    ammeter:        [],
    logic_gate_and: []
};

// Counter for auto-labelling (R1, R2, C1, OA1 etc.)
const TYPE_PREFIX = {
    resistor:       'R',
    capacitor:      'C',
    inductor:       'L',
    diode:          'D',
    bjt_npn:        'Q',
    op_amp:         'OA',
    voltage_source: 'V',
    ground:         'GND',
    voltmeter:      'VM',
    ammeter:        'AM',
    logic_gate_and: 'AND'
};

export function nextCompId(type, existingComponents) {
    const prefix = TYPE_PREFIX[type] || type.toUpperCase().slice(0, 3);
    const nums = existingComponents
        .filter(c => c.type === type)
        .map(c => parseInt(c.comp_id.replace(prefix, ''), 10))
        .filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `${prefix}${next}`;
}

/** Snap a coordinate to the nearest grid point */
export function snap(v) {
    return Math.round(v / SNAP) * SNAP;
}

/** Rotate a pin position around a component center */
export function rotatePinPos(pinPos, compDef, rotDeg) {
    const cx = compDef.width  / 2;
    const cy = compDef.height / 2;
    const rad = (rotDeg * Math.PI) / 180;
    const dx = pinPos.x - cx;
    const dy = pinPos.y - cy;
    return {
        x: Math.round(cx + dx * Math.cos(rad) - dy * Math.sin(rad)),
        y: Math.round(cy + dx * Math.sin(rad) + dy * Math.cos(rad))
    };
}

/** Get world-space position of a pin for a placed component */
export function getPinWorldPos(comp) {
    // Returns { pinId: {x, y} } in world (SVG) coordinates
    const def = COMP_DEFS[comp.type];
    if (!def) return {};
    const result = {};
    for (const [pinId, localPos] of Object.entries(def.pins)) {
        const rotated = rotatePinPos(localPos, def, comp.rotation || 0);
        result[pinId] = { x: comp.position.x + rotated.x, y: comp.position.y + rotated.y };
    }
    return result;
}

/** Build an orthogonal SVG path string between two world points */
export function orthogonalPath(x1, y1, x2, y2) {
    const midX = Math.round((x1 + x2) / 2 / SNAP) * SNAP;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
}
