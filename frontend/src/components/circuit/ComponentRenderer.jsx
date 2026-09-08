/**
 * ComponentRenderer.jsx
 * Renders each circuit component type as an SVG symbol.
 * Used inside CircuitBoard for all canvas components.
 */

import React from 'react';
import { COMP_DEFS } from './constants';

// ── Individual SVG bodies ────────────────────────────────────────────────────

const Resistor = ({ color }) => (
    <>
        <line x1="0" y1="10" x2="10" y2="10" stroke={color} strokeWidth="2" />
        <rect x="10" y="4" width="40" height="12" rx="2"
              fill="rgba(0,0,0,0.3)" stroke={color} strokeWidth="1.8" />
        <line x1="50" y1="10" x2="60" y2="10" stroke={color} strokeWidth="2" />
    </>
);

const Capacitor = ({ color }) => (
    <>
        <line x1="0"  y1="15" x2="25" y2="15" stroke={color} strokeWidth="2" />
        <line x1="25" y1="5"  x2="25" y2="25" stroke={color} strokeWidth="3" />
        <line x1="30" y1="5"  x2="30" y2="25" stroke={color} strokeWidth="3" />
        <line x1="30" y1="15" x2="60" y2="15" stroke={color} strokeWidth="2" />
    </>
);

const Inductor = ({ color }) => (
    <>
        <line x1="0" y1="10" x2="8" y2="10" stroke={color} strokeWidth="2" />
        {[8, 18, 28, 38].map((x, i) => (
            <path key={i}
                d={`M ${x} 10 Q ${x + 5} 2 ${x + 10} 10`}
                fill="none" stroke={color} strokeWidth="2" />
        ))}
        <line x1="48" y1="10" x2="60" y2="10" stroke={color} strokeWidth="2" />
    </>
);

const Diode = ({ color }) => (
    <>
        <line x1="0" y1="10" x2="15" y2="10" stroke={color} strokeWidth="2" />
        <polygon points="15,3 15,17 32,10" fill={color} opacity="0.8" />
        <line x1="32" y1="3" x2="32" y2="17" stroke={color} strokeWidth="2.5" />
        <line x1="32" y1="10" x2="50" y2="10" stroke={color} strokeWidth="2" />
    </>
);

const BJT_NPN = ({ color }) => (
    <>
        {/* Base */}
        <line x1="0"  y1="30" x2="20" y2="30" stroke={color} strokeWidth="2" />
        <line x1="20" y1="15" x2="20" y2="45" stroke={color} strokeWidth="3" />
        {/* Collector */}
        <line x1="20" y1="20" x2="50" y2="10" stroke={color} strokeWidth="2" />
        <polygon points="42,10 50,10 50,17" fill={color} />
        {/* Emitter */}
        <line x1="20" y1="40" x2="50" y2="50" stroke={color} strokeWidth="2" />
        <polygon points="38,46 46,50 38,54" fill={color} />
        {/* Labels */}
        <text x="2"  y="28" fontSize="8" fill={color} opacity="0.9">B</text>
        <text x="42" y="10" fontSize="8" fill={color} opacity="0.9">C</text>
        <text x="42" y="60" fontSize="8" fill={color} opacity="0.9">E</text>
    </>
);

const OpAmp = ({ color }) => (
    <>
        {/* Triangle body */}
        <polygon points="10,5 10,55 70,30"
                 fill="rgba(56,189,248,0.1)" stroke={color} strokeWidth="2" />
        {/* Input leads */}
        <line x1="0"  y1="20" x2="10" y2="20" stroke={color} strokeWidth="2" />
        <line x1="0"  y1="40" x2="10" y2="40" stroke={color} strokeWidth="2" />
        {/* Output lead */}
        <line x1="70" y1="30" x2="80" y2="30" stroke={color} strokeWidth="2" />
        {/* VCC/VEE leads */}
        <line x1="40" y1="0"  x2="40" y2="5"  stroke={color} strokeWidth="1.5" strokeDasharray="2,2" />
        <line x1="40" y1="55" x2="40" y2="60" stroke={color} strokeWidth="1.5" strokeDasharray="2,2" />
        {/* Labels */}
        <text x="13" y="23" fontSize="8" fill={color}>+</text>
        <text x="13" y="43" fontSize="8" fill={color}>−</text>
        <text x="60" y="28" fontSize="7" fill={color}>out</text>
    </>
);

const VoltageSource = ({ color, properties = {} }) => {
    const wave = properties.waveform || 'DC';
    const v = properties.voltage || 5;
    return (
        <>
            <line x1="20" y1="0"  x2="20" y2="15" stroke={color} strokeWidth="2" />
            <circle cx="20" cy="30" r="15" fill="rgba(0,0,0,0.25)" stroke={color} strokeWidth="2" />
            <line x1="20" y1="45" x2="20" y2="60" stroke={color} strokeWidth="2" />
            {wave === 'DC' ? (
                <>
                    <text x="20" y="27" textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">+</text>
                    <text x="20" y="37" textAnchor="middle" fontSize="8" fill={color}>−</text>
                </>
            ) : (
                <path d="M 13 30 Q 16 24 19 30 Q 22 36 27 30"
                      fill="none" stroke={color} strokeWidth="1.5" />
            )}
            <text x="20" y="74" textAnchor="middle" fontSize="8" fill={color}>{v}V</text>
        </>
    );
};

const Ground = ({ color }) => (
    <>
        <line x1="20" y1="0"  x2="20" y2="10" stroke={color} strokeWidth="2" />
        <line x1="4"  y1="10" x2="36" y2="10" stroke={color} strokeWidth="2.5" />
        <line x1="8"  y1="16" x2="32" y2="16" stroke={color} strokeWidth="2" />
        <line x1="13" y1="22" x2="27" y2="22" stroke={color} strokeWidth="1.5" />
    </>
);

const Voltmeter = ({ color }) => (
    <>
        <line x1="20" y1="0"  x2="20" y2="12" stroke={color} strokeWidth="2" />
        <circle cx="20" cy="30" r="18" fill="rgba(0,0,0,0.25)" stroke={color} strokeWidth="2" />
        <text x="20" y="34" textAnchor="middle" fontSize="12" fill={color} fontWeight="bold">V</text>
        <line x1="20" y1="48" x2="20" y2="60" stroke={color} strokeWidth="2" />
    </>
);

const Ammeter = ({ color }) => (
    <>
        <line x1="0"  y1="15" x2="12" y2="15" stroke={color} strokeWidth="2" />
        <circle cx="30" cy="15" r="18" fill="rgba(0,0,0,0.25)" stroke={color} strokeWidth="2" />
        <text x="30" y="19" textAnchor="middle" fontSize="12" fill={color} fontWeight="bold">A</text>
        <line x1="48" y1="15" x2="60" y2="15" stroke={color} strokeWidth="2" />
    </>
);

const ANDGate = ({ color }) => (
    <>
        <line x1="0"  y1="10" x2="20" y2="10" stroke={color} strokeWidth="2" />
        <line x1="0"  y1="30" x2="20" y2="30" stroke={color} strokeWidth="2" />
        <line x1="20" y1="5"  x2="20" y2="35" stroke={color} strokeWidth="2" />
        <path d="M 20 5 Q 55 5 55 20 Q 55 35 20 35"
              fill="rgba(0,0,0,0.25)" stroke={color} strokeWidth="2" />
        <line x1="55" y1="20" x2="60" y2="20" stroke={color} strokeWidth="2" />
    </>
);

// ── Renderer Map ─────────────────────────────────────────────────────────────

const RENDERERS = {
    resistor:       (p) => <Resistor       {...p} />,
    capacitor:      (p) => <Capacitor      {...p} />,
    inductor:       (p) => <Inductor       {...p} />,
    diode:          (p) => <Diode          {...p} />,
    bjt_npn:        (p) => <BJT_NPN        {...p} />,
    op_amp:         (p) => <OpAmp          {...p} />,
    voltage_source: (p) => <VoltageSource  {...p} />,
    ground:         (p) => <Ground         {...p} />,
    voltmeter:      (p) => <Voltmeter      {...p} />,
    ammeter:        (p) => <Ammeter        {...p} />,
    logic_gate_and: (p) => <ANDGate        {...p} />
};

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Renders a single circuit component at (0, 0).
 * Caller wraps in a <g transform="translate(x,y) rotate(r, cx, cy)">
 */
export default function ComponentRenderer({ type, properties, color: overrideColor }) {
    const def     = COMP_DEFS[type];
    if (!def) return null;
    const color   = overrideColor || def.color;
    const Render  = RENDERERS[type];
    return Render ? Render({ color, properties }) : null;
}
