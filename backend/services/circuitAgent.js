/**
 * circuitAgent.js  —  4-Tier Deterministic Circuit Diagnostic Engine
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Stage 1 — Component Audit     (palette + instance limits)  │
 *   │  Stage 2 — Topology Analysis   (union-find, KVL/KCL gates)  │
 *   │  Stage 3 — Physics Simulation  (circuitEvaluator.js)        │
 *   │  Stage 4 — 4-Tier Gated Score  (deterministic 0-100 pts)   │
 *   │  Stage 5 — ML Ensemble Boost   (local Python service only)  │
 *   │  Stage 6 — Diagnostic Report   (deterministic JSON)         │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * NO external AI/LLM APIs. Uses only:
 *   - circuitEvaluator.js (in-process physics engine)
 *   - ml-service (local Python Flask: MLP+HistGBR+GCN ensemble)
 *
 * Scoring tiers (matches master prompt spec):
 *   Tier 1 — Structural Topology      max 30 pts  (HARD FAIL gate)
 *   Tier 2 — Completeness & Grounding max 20 pts
 *   Tier 3 — Parametric Accuracy      max 35 pts  (formula-driven)
 *   Tier 4 — Practicality & Safety    max 15 pts  (E12, thermal, ratings)
 */

'use strict';

const axios = require('axios');
const {
    simulate, buildNets, prop, numProp, isE12Standard, nearestE12, COMPONENT_PINS
} = require('./circuitEvaluator');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001';

// ─── Domain Mapping ───────────────────────────────────────────────────────────
const DOMAIN_MAP = {
    gain_check:      'AC_ANALOG',
    voltage_divider: 'DC_BIAS',
    rlc_analysis:    'AC_ANALOG',
    led_circuit:     'DC_BIAS',
    bjt_amplifier:   'DC_BIAS',
    rc_filter:       'AC_ANALOG',
    rectifier:       'TRANSIENT_POWER',
    power_supply:    'TRANSIENT_POWER',
    wheatstone:      'DC_BIAS',
    digital_logic:   'DIGITAL_LOGIC',
};

const CIRCUIT_CLASS_MAP = {
    gain_check:      'Active_OpAmp',
    voltage_divider: 'DC_Resistive',
    rlc_analysis:    'Passive_Filter',
    led_circuit:     'DC_Resistive',
    bjt_amplifier:   'Transistor_Amplifier',
    rc_filter:       'Passive_Filter',
    rectifier:       'Switching_Power',
    power_supply:    'Switching_Power',
    digital_logic:   'Digital_Logic',
};

// ─── Critical pins that MUST be connected for a circuit to function ───────────
const CRITICAL_PINS = {
    resistor:       ['1', '2'],
    capacitor:      ['1', '2'],
    inductor:       ['1', '2'],
    voltage_source: ['positive', 'negative'],
    op_amp:         ['non_inverting', 'inverting', 'output'],
    diode:          ['anode', 'cathode'],
    led:            ['anode', 'cathode'],
    bjt_npn:        ['base', 'collector', 'emitter'],
    bjt_pnp:        ['base', 'collector', 'emitter'],
    voltmeter:      ['positive', 'negative'],
    ammeter:        ['1', '2'],
};

// ─── Pedagogical topic knowledge base (domain-scoped) ─────────────────────────
const PEDAGOGY = {
    gain_check:      ['Inverting Amplifier Gain: A_v = −Rf/Rin', 'Virtual Ground / Virtual Short Concept', 'Negative Feedback and Closed-Loop Stability', 'Op-Amp GBW Product and Bandwidth', 'Node Voltage Method (KCL)'],
    voltage_divider: ['Voltage Divider Rule: Vout = Vin × R2/(R1+R2)', 'Thevenin Equivalent Output Resistance', 'Ohm\'s Law and Series Resistor Networks', 'Loading Effect on Voltage Dividers'],
    rlc_analysis:    ['Series RLC Resonance: f₀ = 1/(2π√LC)', 'Quality Factor Q and Bandwidth', 'Impedance and Reactance', 'Phasor Analysis and Phase Angle'],
    led_circuit:     ['Diode Forward Voltage and I-V Characteristic', 'LED Current Limiting: I = (Vs−Vf)/R', 'Power Dissipation in Resistors', 'E12 Standard Component Values'],
    bjt_amplifier:   ['BJT Voltage-Divider Bias', 'Q-Point and DC Operating Point', 'Small-Signal Model: r_e = 26mV/I_C', 'Common-Emitter Voltage Gain: A_v = −R_C/r_e', 'KVL in CE Bias Loop'],
    rc_filter:       ['RC Low-Pass / High-Pass Filter: f_c = 1/(2πRC)', 'Bode Plot: −20dB/decade roll-off', 'Phase Shift at Cutoff Frequency', 'Time Constant τ = RC'],
    rectifier:       ['Diode Half-Wave and Full-Wave Rectification', 'Ripple Voltage and Filter Capacitor Sizing', 'AC-to-DC Conversion Efficiency', 'PIV Rating of Rectifier Diodes'],
    default:         ['KVL and KCL (Kirchhoff\'s Laws)', 'Circuit Topology and Component Connectivity', 'Ground Reference and Node Voltage Method'],
};

// ─── Stage 1: Component Palette & Instance Audit ──────────────────────────────
function auditComponents(components, question) {
    const issues     = [];
    const palette    = question.visible_palette || [];
    const maxInst    = question.max_instances instanceof Map
        ? Object.fromEntries(question.max_instances)
        : (question.max_instances || {});
    const countByType = {};

    for (const comp of components) {
        countByType[comp.type] = (countByType[comp.type] || 0) + 1;

        if (palette.length > 0 && !palette.includes(comp.type)) {
            issues.push({
                fault_code:  'ERR_COMP_NOT_IN_PALETTE',
                severity:    'Critical',
                component_ref: comp.comp_id,
                issue_description: `Component "${comp.comp_id}" (type: ${comp.type}) is not in the allowed palette for this question.`,
                mathematical_root_cause: `Allowed palette: [${palette.join(', ')}]. Submitted type: ${comp.type}.`,
                suggested_fix: `Remove "${comp.comp_id}" and replace with a permitted component type.`
            });
        }
    }

    for (const [type, maxCount] of Object.entries(maxInst)) {
        const actual = countByType[type] || 0;
        if (actual > Number(maxCount)) {
            issues.push({
                fault_code:  'ERR_TOO_MANY_INSTANCES',
                severity:    'Major',
                component_ref: type,
                issue_description: `${actual} instance(s) of "${type}" placed but maximum allowed is ${maxCount}.`,
                mathematical_root_cause: `Count(${type}) = ${actual} > MaxAllowed = ${maxCount}.`,
                suggested_fix: `Remove ${actual - maxCount} extra instance(s) of "${type}".`
            });
        }
    }

    return issues;
}

// ─── Stage 2: Topology Analysis ───────────────────────────────────────────────
function analyseTopology(components, connections, question) {
    const issues = [];
    const nets   = buildNets(components, connections);
    const eb     = question.expected_behavior || {};

    // ── 2a. Ground reference check ─────────────────────────────────────────────
    const groundComps = components.filter(c => c.type === 'ground');
    if (groundComps.length === 0) {
        issues.push({
            fault_code:  'ERR_TOPOLOGY_NO_GROUND',
            severity:    'Critical',
            component_ref: 'GND',
            issue_description: 'No ground reference component found. Every circuit requires a 0V reference node.',
            mathematical_root_cause: 'Without GND, all node voltages are undefined — KVL and KCL cannot be applied. V_node = V_source − V_GND requires V_GND = 0V.',
            suggested_fix: 'Add a ground (GND) component and connect it to the negative terminal of the voltage source.'
        });
    } else {
        // Ground placed but disconnected?
        for (const gnd of groundComps) {
            const gNets = nets.filter(net => net.some(p => p.comp_id === gnd.comp_id));
            const connected = gNets.some(net => net.length > 1);
            if (!connected) {
                issues.push({
                    fault_code:  'ERR_TOPOLOGY_FLOATING_GND',
                    severity:    'Critical',
                    component_ref: gnd.comp_id,
                    issue_description: `Ground component "${gnd.comp_id}" is placed but not wired to anything.`,
                    mathematical_root_cause: 'A floating GND symbol provides no electrical reference. Wire it into the circuit return path.',
                    suggested_fix: `Connect "${gnd.comp_id}" to the negative terminal of the voltage source or circuit return path.`
                });
            }
        }
    }

    // ── 2b. Floating critical pins ─────────────────────────────────────────────
    for (const comp of components) {
        if (comp.type === 'ground') continue;
        const critPins = CRITICAL_PINS[comp.type] || [];
        for (const pin of critPins) {
            const net = nets.find(n => n.some(p => p.comp_id === comp.comp_id && p.pin === pin));
            if (!net || net.length < 2) {
                issues.push({
                    fault_code:  'ERR_TOPOLOGY_FLOATING_PIN',
                    severity:    'Major',
                    component_ref: comp.comp_id,
                    issue_description: `Pin "${pin}" of ${comp.comp_id} (${comp.type}) is unconnected — floating node.`,
                    mathematical_root_cause: `Floating pin → high-impedance node → undefined voltage. Net size = 1 (isolated). Any node must have ≥2 pin endpoints connected to form a valid net.`,
                    suggested_fix: `Wire pin "${pin}" of ${comp.comp_id} to the appropriate circuit node.`
                });
            }
        }
    }

    // ── 2c. Short circuit: Voltage source positive directly to ground ──────────
    const vSources = components.filter(c => c.type === 'voltage_source');
    for (const vs of vSources) {
        const posNets = nets.filter(n => n.some(p => p.comp_id === vs.comp_id && p.pin === 'positive'));
        for (const gnd of groundComps) {
            const posHasGnd = posNets.some(net => net.some(p => p.comp_id === gnd.comp_id));
            if (posHasGnd) {
                const vsV = numProp(vs, 'voltage', 0);
                issues.push({
                    fault_code:  'ERR_TOPOLOGY_SHORT_CIRCUIT',
                    severity:    'Critical',
                    component_ref: `${vs.comp_id}, ${gnd.comp_id}`,
                    issue_description: `Voltage source "${vs.comp_id}" positive terminal is directly connected to ground "${gnd.comp_id}" — this is a short circuit.`,
                    mathematical_root_cause: `V = ${vsV}V across 0Ω → I = ${vsV}/0 → ∞ A (short circuit). KVL violated: no series impedance to limit current.`,
                    suggested_fix: `Insert a series resistor between "${vs.comp_id}" positive terminal and the load before returning to ground.`
                });
            }
        }
    }

    // ── 2d. Op-Amp specific topology (for gain_check) ─────────────────────────
    if (eb.type === 'gain_check') {
        const opAmp = components.find(c => c.type === 'op_amp');
        if (opAmp) {
            // Non-inverting pin (V+) must be grounded for inverting config
            const nonInvNet = nets.find(n => n.some(p => p.comp_id === opAmp.comp_id && p.pin === 'non_inverting'));
            const nonInvGrounded = groundComps.some(gnd =>
                nonInvNet && nonInvNet.some(p => p.comp_id === gnd.comp_id)
            );
            if (!nonInvGrounded) {
                issues.push({
                    fault_code:  'ERR_TOPOLOGY_OPAMP_VINP_UNGROUNDED',
                    severity:    'Major',
                    component_ref: opAmp.comp_id,
                    issue_description: `Non-inverting input (V+) of "${opAmp.comp_id}" is not connected to ground. For an inverting amplifier, V+ must be at 0V.`,
                    mathematical_root_cause: 'Inverting amplifier assumption: Virtual ground at V− requires V+ = 0V. If V+ ≠ 0V, output = A_OL × (V+ − V−) → saturation.',
                    suggested_fix: `Connect pin "non_inverting" of ${opAmp.comp_id} directly to a GND component.`
                });
            }

            // Feedback resistor: output → inverting (Rf)
            const invertNets = nets.filter(n => n.some(p => p.comp_id === opAmp.comp_id && p.pin === 'inverting'));
            const outNets    = nets.filter(n => n.some(p => p.comp_id === opAmp.comp_id && p.pin === 'output'));
            const resistors  = components.filter(c => c.type === 'resistor');
            const hasFeedback = resistors.some(r =>
                invertNets.some(n => n.some(p => p.comp_id === r.comp_id)) &&
                outNets.some(n => n.some(p => p.comp_id === r.comp_id))
            );
            if (!hasFeedback) {
                issues.push({
                    fault_code:  'ERR_TOPOLOGY_OPAMP_NO_FEEDBACK',
                    severity:    'Critical',
                    component_ref: opAmp.comp_id,
                    issue_description: `No feedback resistor (Rf) found between output and inverting input of "${opAmp.comp_id}". Without Rf the op-amp is open-loop.`,
                    mathematical_root_cause: 'Open-loop gain A_OL ≈ 10⁵–10⁶ V/V. Any non-zero differential input drives output to ±V_rail. Gain = −Rf/Rin only exists when Rf creates a closed feedback loop.',
                    suggested_fix: `Add a resistor from the "output" pin of ${opAmp.comp_id} back to its "inverting" pin to close the feedback loop.`
                });
            }
        }
    }

    // ── 2e. BJT topology check (for bjt_amplifier) ────────────────────────────
    if (eb.type === 'bjt_amplifier') {
        const bjt = components.find(c => c.type === 'bjt_npn' || c.type === 'bjt_pnp');
        if (bjt) {
            for (const pin of ['base', 'collector', 'emitter']) {
                const pNet = nets.find(n => n.some(p => p.comp_id === bjt.comp_id && p.pin === pin));
                if (!pNet || pNet.length < 2) {
                    issues.push({
                        fault_code:  `ERR_TOPOLOGY_BJT_${pin.toUpperCase()}_OPEN`,
                        severity:    'Critical',
                        component_ref: bjt.comp_id,
                        issue_description: `BJT "${bjt.comp_id}" ${pin} pin is not connected.`,
                        mathematical_root_cause: `A BJT requires all three terminals (B, C, E) to be connected. Open ${pin} → transistor cannot operate in active region (V_BE < 0.7V or I_C = 0).`,
                        suggested_fix: `Connect the ${pin} pin of ${bjt.comp_id} to the appropriate bias network.`
                    });
                }
            }
        }
    }

    // ── 2f. Diode polarity check ───────────────────────────────────────────────
    const diodes = components.filter(c => c.type === 'diode' || c.type === 'led');
    for (const d of diodes) {
        const anodeNets   = nets.filter(n => n.some(p => p.comp_id === d.comp_id && p.pin === 'anode'));
        const cathodeNets = nets.filter(n => n.some(p => p.comp_id === d.comp_id && p.pin === 'cathode'));
        // Check if cathode is on a higher-potential net than anode (reverse bias heuristic)
        for (const vs of vSources) {
            const posNets = nets.filter(n => n.some(p => p.comp_id === vs.comp_id && p.pin === 'positive'));
            const cathOnPos = cathodeNets.some(cn => posNets.some(pn => pn === cn));
            if (cathOnPos) {
                issues.push({
                    fault_code:  'ERR_TOPOLOGY_DIODE_REVERSED',
                    severity:    'Critical',
                    component_ref: d.comp_id,
                    issue_description: `Diode "${d.comp_id}" appears reverse-biased — cathode connected toward the positive supply terminal.`,
                    mathematical_root_cause: `Reverse bias: V_AK < 0. Diode blocks current (I ≈ I_s × (e^(V_AK/V_T) − 1) ≈ −I_s ≈ 0). No forward current flows.`,
                    suggested_fix: `Reverse ${d.comp_id} orientation: connect anode toward the positive supply, cathode toward the load.`
                });
            }
        }
    }

    return issues;
}

// ─── Stage 4: 4-Tier Gated Scoring Engine ────────────────────────────────────
/**
 * Tier 1 — Structural Topology   (0–30 pts) — HARD FAIL gate
 * Tier 2 — Completeness/Grounding (0–20 pts)
 * Tier 3 — Parametric Accuracy   (0–35 pts) — formula: 35 × (1 − |err|/target)
 * Tier 4 — Practicality/Safety   (0–15 pts) — E12, thermal, ratings
 */
function computeTieredScore(auditIssues, topoIssues, simResult, expectedBehavior, components) {
    const allIssues = [...auditIssues, ...topoIssues];

    // ── Tier 1: Structural Topology (max 30) ──────────────────────────────────
    const criticalFaults = allIssues.filter(i =>
        i.severity === 'Critical' &&
        ['ERR_TOPOLOGY_SHORT_CIRCUIT', 'ERR_TOPOLOGY_NO_GROUND', 'ERR_TOPOLOGY_FLOATING_GND',
         'ERR_TOPOLOGY_OPAMP_NO_FEEDBACK', 'ERR_COMP_NOT_IN_PALETTE',
         'ERR_TOPOLOGY_BJT_BASE_OPEN', 'ERR_TOPOLOGY_BJT_COLLECTOR_OPEN', 'ERR_TOPOLOGY_BJT_EMITTER_OPEN',
         'ERR_TOPOLOGY_DIODE_REVERSED'].includes(i.fault_code)
    );

    let tier1Points = 30;
    let tier1Status = 'Pass';
    let topologyHardFail = false;

    if (criticalFaults.length > 0) {
        // Hard fail: deduct based on number of critical faults
        tier1Points = Math.max(0, 30 - criticalFaults.length * 12);
        tier1Status = 'Fail';
        if (criticalFaults.some(f =>
            ['ERR_TOPOLOGY_SHORT_CIRCUIT', 'ERR_TOPOLOGY_OPAMP_NO_FEEDBACK',
             'ERR_TOPOLOGY_BJT_BASE_OPEN', 'ERR_TOPOLOGY_BJT_COLLECTOR_OPEN',
             'ERR_TOPOLOGY_BJT_EMITTER_OPEN'].includes(f.fault_code)
        )) {
            tier1Points = 0;
            topologyHardFail = true;
        }
    }

    // ── Tier 2: Completeness & Grounding (max 20) ─────────────────────────────
    let tier2Points = 20;
    let tier2Status = 'Pass';

    const hasGround = !allIssues.some(i =>
        ['ERR_TOPOLOGY_NO_GROUND', 'ERR_TOPOLOGY_FLOATING_GND'].includes(i.fault_code)
    );
    const floatingPins = allIssues.filter(i => i.fault_code === 'ERR_TOPOLOGY_FLOATING_PIN');

    if (!hasGround) {
        tier2Points -= 12;
        tier2Status = 'Fail';
    }
    if (floatingPins.length > 0) {
        tier2Points -= Math.min(8, floatingPins.length * 4);
        tier2Status = 'Fail';
    }
    tier2Points = Math.max(0, tier2Points);

    // ── Tier 3: Parametric Accuracy (max 35) — only if topology not hard-failed
    let tier3Points = 0;
    let tier3Status = 'Fail';
    const valueIssues = [];

    if (!topologyHardFail && simResult && simResult.status === 'success' && expectedBehavior) {
        const tol   = (expectedBehavior.tolerance_percent || 5) / 100;
        let measured  = null, target = null, paramName = '', unit = '';

        switch (expectedBehavior.type) {
            case 'gain_check':
                measured  = simResult.measured_gain;
                target    = expectedBehavior.expected_gain;
                paramName = 'Voltage Gain (A_v)';
                unit      = 'V/V';
                break;
            case 'voltage_divider':
                measured  = simResult.output_voltage;
                target    = expectedBehavior.expected_voltage;
                paramName = 'Output Voltage (V_out)';
                unit      = 'V';
                break;
            case 'rlc_analysis':
                measured  = simResult.resonant_frequency;
                target    = expectedBehavior.expected_freq;
                paramName = 'Resonant Frequency (f₀)';
                unit      = 'Hz';
                break;
            case 'led_circuit':
                measured  = simResult.led_current_ma;
                target    = expectedBehavior.expected_current_ma || 20;
                paramName = 'LED Current (I_LED)';
                unit      = 'mA';
                break;
            case 'bjt_amplifier':
                measured  = simResult.ac_gain_midband;
                target    = expectedBehavior.expected_gain;
                paramName = 'Mid-band Voltage Gain (A_v)';
                unit      = 'V/V';
                break;
            case 'rc_filter':
                measured  = simResult.cutoff_frequency_hz;
                target    = expectedBehavior.expected_freq;
                paramName = 'Cutoff Frequency (f_c)';
                unit      = 'Hz';
                break;
            case 'rectifier':
                measured  = simResult.V_dc;
                target    = expectedBehavior.expected_voltage;
                paramName = 'DC Output Voltage (V_dc)';
                unit      = 'V';
                break;
        }

        if (measured !== null && measured !== undefined && target !== null && target !== undefined && target !== 0) {
            const errFrac = Math.abs((measured - target) / target);
            // Formula: max(0, 35 × (1 − |err| / tolerance))
            tier3Points = Math.max(0, Math.round(35 * Math.max(0, 1 - errFrac / Math.max(tol, 0.01))));
            tier3Status = tier3Points >= 20 ? 'Pass' : 'Fail';

            if (errFrac > tol) {
                const rootCause = buildParametricRootCause(expectedBehavior.type, measured, target, simResult, components);
                valueIssues.push({
                    fault_code:    'ERR_PARAM_VALUE_MISMATCH',
                    severity:      errFrac > 0.5 ? 'Critical' : errFrac > 0.2 ? 'Major' : 'Minor',
                    component_ref: rootCause.component_ref,
                    issue_description: `${paramName}: target = ${target} ${unit}, measured = ${measured.toFixed(4)} ${unit} (error ${(errFrac * 100).toFixed(1)}%, tolerance ±${tol * 100}%).`,
                    mathematical_root_cause: rootCause.math,
                    suggested_fix: rootCause.fix,
                    _meta: { measured, target, errFrac, paramName, unit }
                });
            }
        } else if (measured !== null && measured !== undefined) {
            // No target defined — give partial credit for successful simulation
            tier3Points = 20;
            tier3Status = 'Pass';
        }
    }

    // ── Tier 4: Engineering Practicality & Safety (max 15) ────────────────────
    let tier4Points = 15;
    let tier4Status = 'Pass';
    const practicalityIssues = [];

    if (!topologyHardFail && simResult && simResult.status === 'success') {
        // Thermal overload check
        const thermalWarnings = simResult.thermal_warnings || [];
        if (thermalWarnings.length > 0) {
            tier4Points -= Math.min(8, thermalWarnings.length * 4);
            tier4Status = 'Fail';
            for (const tw of thermalWarnings) {
                practicalityIssues.push({
                    fault_code:    'ERR_SAFETY_THERMAL_OVERLOAD',
                    severity:      'Major',
                    component_ref: tw.component,
                    issue_description: `"${tw.component}" dissipates ${tw.power_mw}mW which exceeds the 250mW standard ¼W resistor rating.`,
                    mathematical_root_cause: `P = I²R = ${tw.power_mw}mW > P_max = ${tw.limit_mw}mW. Component will overheat.`,
                    suggested_fix: `Use a higher-wattage resistor (≥½W or 1W) or increase resistance to reduce current and power dissipation.`
                });
            }
        }

        // E12 standard value check for resistors
        const resistors = components.filter(c => c.type === 'resistor');
        let nonE12Count = 0;
        for (const r of resistors) {
            const rVal = numProp(r, 'resistance_ohm', 1000);
            if (!isE12Standard(rVal)) {
                nonE12Count++;
                const nearest = nearestE12(rVal);
                practicalityIssues.push({
                    fault_code:    'ERR_SAFETY_NON_E12_VALUE',
                    severity:      'Minor',
                    component_ref: r.comp_id,
                    issue_description: `Resistor "${r.comp_id}" = ${rVal}Ω is not an E12 standard value — not stocked by most suppliers.`,
                    mathematical_root_cause: `E12 series provides ±10% coverage. ${rVal}Ω deviates ${((Math.abs(rVal - nearest) / nearest) * 100).toFixed(1)}% from nearest E12 value ${nearest}Ω.`,
                    suggested_fix: `Replace ${rVal}Ω with the nearest E12 standard value: ${nearest}Ω.`
                });
            }
        }
        if (nonE12Count > 0) {
            tier4Points -= Math.min(6, nonE12Count * 2);
            tier4Status = 'Fail';
        }

        // Voltage rating check (simplified — flag if output voltage > 25V common IC limit)
        const vout = simResult.output_voltage;
        if (vout && Math.abs(vout) > 25) {
            tier4Points -= 5;
            tier4Status = 'Fail';
            practicalityIssues.push({
                fault_code:    'ERR_SAFETY_VOLTAGE_EXCEEDED',
                severity:      'Major',
                component_ref: 'OUTPUT_NODE',
                issue_description: `Output voltage ${vout.toFixed(2)}V exceeds typical IC supply rating (±15V or 25V max for µA741).`,
                mathematical_root_cause: `|V_out| = ${Math.abs(vout).toFixed(2)}V > 25V max. Op-amp output is limited to V_rail − V_dropout ≈ ±13.5V for ±15V supply.`,
                suggested_fix: 'Reduce input voltage or adjust gain so output stays within ±V_rail range.'
            });
        }
    }
    tier4Points = Math.max(0, tier4Points);

    // ── Total Score ────────────────────────────────────────────────────────────
    const totalScore = tier1Points + tier2Points + tier3Points + tier4Points;

    return {
        tier1: { points: tier1Points, status: tier1Status },
        tier2: { points: tier2Points, status: tier2Status },
        tier3: { points: tier3Points, status: tier3Status },
        tier4: { points: tier4Points, status: tier4Status },
        totalScore: Math.min(100, totalScore),
        topologyHardFail,
        valueIssues,
        practicalityIssues
    };
}

// ─── Mathematical Root Cause Builder ─────────────────────────────────────────
function buildParametricRootCause(qtype, measured, target, simResult, components) {
    switch (qtype) {
        case 'gain_check': {
            const rfVal  = simResult.Rf_val  || '?';
            const rinVal = simResult.Rin_val || '?';
            const targetRatio = Math.abs(target);
            const idealRf = Math.round(targetRatio * (rinVal || 1000));
            return {
                component_ref: `${simResult.Rf_id || 'Rf'}, ${simResult.Rin_id || 'Rin'}`,
                math: `Formula: A_v = −Rf/Rin = −${rfVal}/${rinVal} = ${measured.toFixed(3)} (target: ${target}). Required ratio Rf/Rin = ${targetRatio}.`,
                fix: `Set Rf = ${idealRf}Ω (nearest E12: ${nearestE12(idealRf)}Ω) keeping Rin = ${rinVal}Ω to achieve gain = ${target}.`
            };
        }
        case 'voltage_divider': {
            const r1 = simResult.R1_val || '?', r2 = simResult.R2_val || '?', vin = simResult.Vin || 5;
            const requiredR2fraction = target / vin;
            const idealR2 = Math.round(requiredR2fraction / (1 - requiredR2fraction) * (r1 || 1000));
            return {
                component_ref: `${simResult.R1_id || 'R1'}, ${simResult.R2_id || 'R2'}`,
                math: `Formula: V_out = V_in × R2/(R1+R2) = ${vin} × ${r2}/(${r1}+${r2}) = ${measured.toFixed(3)}V (target: ${target}V).`,
                fix: `Replace R2 with ${idealR2}Ω (nearest E12: ${nearestE12(idealR2)}Ω) to get V_out = ${target}V with R1 = ${r1}Ω, V_in = ${vin}V.`
            };
        }
        case 'rlc_analysis': {
            const lVal = simResult.L_val || 0.01, cVal = simResult.C_val || 1e-6;
            const idealC = 1 / (4 * Math.PI * Math.PI * target * target * lVal);
            return {
                component_ref: 'L1, C1',
                math: `Formula: f₀ = 1/(2π√LC) = 1/(2π√(${lVal}×${cVal})) = ${measured.toFixed(1)}Hz (target: ${target}Hz).`,
                fix: `Adjust capacitor to C = 1/(4π²×f₀²×L) = ${(idealC * 1e6).toFixed(2)}µF (nearest E12: ${nearestE12(idealC * 1e6)}µF) keeping L = ${(lVal * 1000).toFixed(1)}mH.`
            };
        }
        case 'led_circuit': {
            const vin = simResult.v_resistor !== undefined ? (simResult.vf_actual + simResult.v_resistor) : 5;
            const vf  = simResult.vf_actual || 2.0;
            const idealR = Math.round((vin - vf) / (target / 1000));
            return {
                component_ref: 'R1 (current limiting)',
                math: `Formula: I_LED = (V_in − V_f) / R = (${vin} − ${vf}) / R = ${measured.toFixed(1)}mA (target: ${target}mA).`,
                fix: `Replace current-limiting resistor with R = (${vin}V − ${vf}V) / ${target}mA = ${idealR}Ω (nearest E12: ${nearestE12(idealR)}Ω).`
            };
        }
        case 'bjt_amplifier': {
            const rc = simResult.Q_point ? '?' : '?';
            return {
                component_ref: 'RC, RE',
                math: `Formula: A_v ≈ −R_C / r_e where r_e = 26mV / I_C. Measured A_v = ${measured.toFixed(1)} (target: ${target}).`,
                fix: `Adjust collector resistor R_C or emitter resistor R_E ratio to achieve target gain. Current gain: ${measured.toFixed(1)} V/V.`
            };
        }
        case 'rc_filter': {
            const r = components.find(c => c.type === 'resistor');
            const c = components.find(c => c.type === 'capacitor');
            const rVal = r ? numProp(r, 'resistance_ohm', 1000) : 1000;
            const idealC = 1 / (2 * Math.PI * target * rVal);
            return {
                component_ref: `${r ? r.comp_id : 'R1'}, ${c ? c.comp_id : 'C1'}`,
                math: `Formula: f_c = 1/(2πRC) = 1/(2π × ${rVal} × C) = ${measured.toFixed(1)}Hz (target: ${target}Hz).`,
                fix: `Set C = 1/(2π × f_c × R) = ${(idealC * 1e6).toFixed(3)}µF (nearest E12: ${nearestE12(idealC * 1e6)}µF) keeping R = ${rVal}Ω.`
            };
        }
        default:
            return {
                component_ref: 'Unknown',
                math: `Measured: ${measured.toFixed(4)}, Target: ${target}, Error: ${((Math.abs(measured - target) / Math.abs(target)) * 100).toFixed(1)}%.`,
                fix: 'Review the design formula and recalculate component values to meet the target specification.'
            };
    }
}

// ─── Verdict + Grade from Total Score ────────────────────────────────────────
function verdictFromScore(score) {
    if (score >= 85) return { verdict: 'correct',           grade: 'Grade A', evaluation_status: 'Pass' };
    if (score >= 60) return { verdict: 'partially_correct', grade: 'Grade B', evaluation_status: 'Partially Correct' };
    if (score >= 40) return { verdict: 'partially_correct', grade: 'Grade C', evaluation_status: 'Partially Correct' };
    return              { verdict: 'incorrect',           grade: 'Grade F', evaluation_status: 'Fail' };
}

// ─── Key Metrics Comparison Builder ──────────────────────────────────────────
function buildMetricsComparison(simResult, expectedBehavior) {
    if (!simResult || simResult.status !== 'success' || !expectedBehavior) return [];

    const rows = [];
    const push = (name, target, actual, unit) => {
        if (actual === null || actual === undefined || target === null || target === undefined) return;
        const errPct = target !== 0 ? Math.abs((actual - target) / target) * 100 : 0;
        rows.push({
            parameter_name: name,
            target_value:   `${target} ${unit}`,
            actual_value:   `${typeof actual === 'number' ? actual.toFixed(4) : actual} ${unit}`,
            error_percentage: parseFloat(errPct.toFixed(2))
        });
    };

    switch (expectedBehavior.type) {
        case 'gain_check':
            push('Voltage Gain (A_v)', expectedBehavior.expected_gain, simResult.measured_gain, 'V/V');
            push('Output Voltage (V_out)', expectedBehavior.expected_gain ? expectedBehavior.expected_gain * (simResult.vin_actual || 1) : null, simResult.output_voltage, 'V');
            if (simResult.bandwidth_hz) rows.push({ parameter_name: 'Bandwidth (−3dB)', target_value: '—', actual_value: `${(simResult.bandwidth_hz >= 1000 ? (simResult.bandwidth_hz/1000).toFixed(1)+'k' : simResult.bandwidth_hz)} Hz`, error_percentage: 0 });
            break;
        case 'voltage_divider':
            push('Output Voltage (V_out)', expectedBehavior.expected_voltage, simResult.output_voltage, 'V');
            if (simResult.i_total_ma) rows.push({ parameter_name: 'Total Current (I)', target_value: '—', actual_value: `${simResult.i_total_ma} mA`, error_percentage: 0 });
            if (simResult.r_out_eq_ohm) rows.push({ parameter_name: 'Thevenin R_out', target_value: '—', actual_value: `${simResult.r_out_eq_ohm} Ω`, error_percentage: 0 });
            break;
        case 'rlc_analysis':
            push('Resonant Frequency (f₀)', expectedBehavior.expected_freq, simResult.resonant_frequency, 'Hz');
            if (simResult.Q_factor) rows.push({ parameter_name: 'Q Factor', target_value: '—', actual_value: `${simResult.Q_factor}`, error_percentage: 0 });
            if (simResult.bandwidth_hz) rows.push({ parameter_name: 'Bandwidth (BW)', target_value: '—', actual_value: `${simResult.bandwidth_hz} Hz`, error_percentage: 0 });
            break;
        case 'led_circuit':
            push('LED Current (I_LED)', expectedBehavior.expected_current_ma || 20, simResult.led_current_ma, 'mA');
            if (simResult.vf_actual) rows.push({ parameter_name: 'Forward Voltage (V_f)', target_value: '2.0 V', actual_value: `${simResult.vf_actual} V`, error_percentage: 0 });
            break;
        case 'bjt_amplifier':
            push('Mid-band Gain (A_v)', expectedBehavior.expected_gain, simResult.ac_gain_midband, 'V/V');
            if (simResult.Q_point) rows.push({ parameter_name: 'Q-Point V_CE', target_value: '—', actual_value: `${simResult.Q_point.V_CE} V`, error_percentage: 0 });
            if (simResult.Q_point) rows.push({ parameter_name: 'Q-Point I_C', target_value: '—', actual_value: `${simResult.Q_point.I_C_mA} mA`, error_percentage: 0 });
            break;
        case 'rc_filter':
            push('Cutoff Frequency (f_c)', expectedBehavior.expected_freq, simResult.cutoff_frequency_hz, 'Hz');
            if (simResult.time_constant_ms) rows.push({ parameter_name: 'Time Constant (τ)', target_value: '—', actual_value: `${simResult.time_constant_ms} ms`, error_percentage: 0 });
            break;
        case 'rectifier':
            push('DC Output Voltage (V_dc)', expectedBehavior.expected_voltage, simResult.V_dc, 'V');
            if (simResult.V_ripple) rows.push({ parameter_name: 'Ripple Voltage', target_value: '< 5% V_dc', actual_value: `${simResult.V_ripple} V`, error_percentage: 0 });
            break;
    }
    return rows;
}

// ─── Floating Nodes Reporter ──────────────────────────────────────────────────
function findFloatingNodes(components, connections) {
    const nets = buildNets(components, connections);
    const floating = [];
    for (const comp of components) {
        if (comp.type === 'ground') continue;
        const critPins = CRITICAL_PINS[comp.type] || [];
        for (const pin of critPins) {
            const net = nets.find(n => n.some(p => p.comp_id === comp.comp_id && p.pin === pin));
            if (!net || net.length < 2) {
                floating.push(`${comp.comp_id}::${pin}`);
            }
        }
    }
    return floating;
}

// ─── Rule-Based Evaluation (full deterministic pipeline) ─────────────────────
async function evaluateRuleBased(question, components, connections) {
    const eb = question.expected_behavior || {};

    // Stage 1: Component Audit
    const auditIssues = auditComponents(components, question);
    // Stage 2: Topology Analysis
    const topoIssues  = analyseTopology(components, connections, question);
    // Stage 3: Physics Simulation
    const simResult   = simulate(components, connections, eb);
    // Stage 4: 4-Tier Scoring
    const tiered = computeTieredScore(auditIssues, topoIssues, simResult, eb, components);

    const allIssues = [...auditIssues, ...topoIssues, ...tiered.valueIssues, ...tiered.practicalityIssues];
    const { verdict, grade, evaluation_status } = verdictFromScore(tiered.totalScore);
    const metricsComparison = buildMetricsComparison(simResult, eb);
    const floatingNodes = findFloatingNodes(components, connections);
    const hasGround = !allIssues.some(i => ['ERR_TOPOLOGY_NO_GROUND', 'ERR_TOPOLOGY_FLOATING_GND'].includes(i.fault_code));
    const domain    = DOMAIN_MAP[eb.type] || 'DC_BIAS';
    const circuitClass = CIRCUIT_CLASS_MAP[eb.type] || 'DC_Resistive';
    const pedTopics = PEDAGOGY[eb.type] || PEDAGOGY.default;

    // Build summary
    const primaryFault = allIssues.find(i => i.severity === 'Critical');
    let summary;
    if (verdict === 'correct') {
        summary = 'Circuit correctly designed and meets all specification requirements.';
    } else if (primaryFault) {
        summary = primaryFault.issue_description;
    } else {
        const firstIssue = allIssues[0];
        summary = firstIssue ? firstIssue.issue_description : 'Circuit needs adjustments to meet the specification.';
    }

    // Build feedback for student
    const feedbackParts = [];
    for (const issue of allIssues.slice(0, 3)) {
        feedbackParts.push(issue.suggested_fix);
    }
    if (feedbackParts.length === 0) {
        feedbackParts.push('Excellent! Your circuit is correctly designed and meets all requirements.');
    }

    // Detected topology string
    const hasOpAmp = components.some(c => c.type === 'op_amp');
    const hasBJT   = components.some(c => c.type === 'bjt_npn' || c.type === 'bjt_pnp');
    const hasLC    = components.some(c => c.type === 'inductor') && components.some(c => c.type === 'capacitor');
    const hasDiode = components.some(c => c.type === 'diode' || c.type === 'led');
    let detectedTopology = eb.type ? eb.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown';
    if (hasOpAmp) detectedTopology = 'Inverting Op-Amp Amplifier';
    else if (hasBJT) detectedTopology = 'BJT Common-Emitter Amplifier';
    else if (hasLC)  detectedTopology = 'Series RLC Resonant Circuit';
    else if (hasDiode && components.some(c => c.type === 'resistor')) detectedTopology = 'Diode Circuit';

    return {
        // Core eval fields
        score:                tiered.totalScore,
        verdict,
        summary,
        issues_found:         allIssues,
        feedback_for_student: feedbackParts.join(' '),
        concepts_to_review:   pedTopics,
        sim_result:           simResult,
        evaluated_at:         new Date(),
        engine:               'rule_physics_4tier',

        // Admin diagnostic report (matches master prompt JSON schema)
        admin_summary: {
            overall_score:      tiered.totalScore,
            grade,
            evaluation_status,
            circuit_class:      circuitClass,
            confidence:         0.92
        },
        tier_scores: {
            topology:     tiered.tier1,
            completeness: tiered.tier2,
            parametric:   tiered.tier3,
            practicality: tiered.tier4
        },
        circuit_diagnostics: {
            detected_topology:    detectedTopology,
            ground_referenced:    hasGround,
            floating_nodes_found: floatingNodes,
            key_metrics_comparison: metricsComparison
        },
        detected_faults: allIssues.map(i => ({
            fault_code:              i.fault_code,
            severity:                i.severity,
            component_ref:           i.component_ref,
            issue_description:       i.issue_description,
            mathematical_root_cause: i.mathematical_root_cause,
            suggested_fix:           i.suggested_fix
        })),
        pedagogical_review_topics: pedTopics
    };
}

// ─── CircuitAttemptLog (optional) ─────────────────────────────────────────────
let CircuitAttemptLog = null;
try { CircuitAttemptLog = require('../models/CircuitAttemptLog'); } catch (_) {}

// ─── Main Evaluate Function (ML-first, physics-fallback) ──────────────────────
/**
 * evaluate() — Public API called from circuitRoutes.js
 *
 * Pipeline:
 *   1. Always run physics engine (Stage 1–4) → deterministic base result
 *   2. Try local Python ML service (/evaluate-circuit) for ML ensemble boost
 *   3. If ML service unavailable → return physics engine result directly
 *   4. If ML service responds → merge: use physics tier scores + ML verdict/confidence
 *   5. Log attempt for self-improvement training data
 */
async function evaluate(question, components, connections, studentId = null, behavior = {}) {
    // ── Always run the physics engine first ───────────────────────────────────
    const ruleResult = await evaluateRuleBased(question, components, connections);
    const simResult  = ruleResult.sim_result;

    // Resolve measured value for ML feature extraction
    const eb = question.expected_behavior || {};
    let measured = null;
    if (simResult && simResult.status === 'success') {
        if (simResult.measured_gain      !== undefined && simResult.measured_gain !== null) measured = simResult.measured_gain;
        else if (simResult.output_voltage!== undefined && simResult.output_voltage !== null) measured = simResult.output_voltage;
        else if (simResult.resonant_frequency !== undefined)  measured = simResult.resonant_frequency;
        else if (simResult.led_current_ma !== undefined)      measured = simResult.led_current_ma / 1000;
        else if (simResult.ac_gain_midband !== undefined)     measured = simResult.ac_gain_midband;
        else if (simResult.cutoff_frequency_hz !== undefined) measured = simResult.cutoff_frequency_hz;
        else if (simResult.V_dc !== undefined)                measured = simResult.V_dc;
    }

    const expected = {
        value:     eb.expected_gain ?? eb.expected_voltage ?? eb.expected_freq ?? eb.expected_current_ma ?? 0,
        tolerance: (eb.tolerance_percent ?? 5) / 100
    };

    // ── Try local ML service ───────────────────────────────────────────────────
    try {
        const mlRes = await axios.post(
            `${ML_SERVICE_URL}/evaluate-circuit`,
            {
                components,
                connections,
                question_type: eb.type || 'gain_check',
                expected,
                measured,
                behavior: {
                    time_spent_sec:        behavior.time_spent_sec        || 0,
                    n_component_deletes:   behavior.n_component_deletes   || 0,
                    n_wire_deletes:        behavior.n_wire_deletes         || 0,
                    question_difficulty:   question.difficulty === 'hard' ? 3 : question.difficulty === 'medium' ? 2 : 1
                }
            },
            { timeout: 10000 }
        );

        const ml = mlRes.data;

        // ── Merge Strategy ────────────────────────────────────────────────────
        // Physics engine provides tier scores (deterministic & trusted).
        // ML provides confidence, viva questions, SHAP, design_analysis.
        // Final score = weighted blend favoring physics-based tier score.
        const physicsScore = ruleResult.score;
        const mlScore      = typeof ml.score === 'number' ? ml.score : physicsScore;
        const blendedScore = Math.round(0.65 * physicsScore + 0.35 * mlScore);

        const { verdict, grade, evaluation_status } = verdictFromScore(blendedScore);

        // Use ML issues only if physics found none (avoid double-reporting)
        const mlIssues = (ml.issues_found || []).filter(mi =>
            !ruleResult.issues_found.some(ri => ri.fault_code && mi.type && ri.fault_code.includes(mi.type.toUpperCase()))
        );

        const mergedResult = {
            // Core fields
            score:                blendedScore,
            verdict,
            summary:              ruleResult.summary,
            issues_found:         [...ruleResult.issues_found, ...mlIssues],
            feedback_for_student: ruleResult.feedback_for_student,
            concepts_to_review:   ruleResult.concepts_to_review,
            sim_result:           simResult,
            evaluated_at:         new Date(),
            engine:               'physics_4tier+ml_ensemble',

            // ML-provided enrichments
            ml_confidence:        ml.ml_confidence,
            design_analysis:      ml.design_analysis,
            shap_explanation:     ml.shap_explanation,
            viva_questions:       ml.viva_questions,
            model_votes:          ml.model_votes,
            disagreement_flag:    ml.disagreement_flag || false,
            instructor_review_required: ml.instructor_review_required || false,

            // 4-Tier deterministic diagnostic (physics-authoritative)
            admin_summary: {
                ...ruleResult.admin_summary,
                overall_score:  blendedScore,
                grade,
                evaluation_status,
                confidence:     ml.ml_confidence || 0.92
            },
            tier_scores:           ruleResult.tier_scores,
            circuit_diagnostics:   ruleResult.circuit_diagnostics,
            detected_faults:       ruleResult.detected_faults,
            pedagogical_review_topics: ruleResult.pedagogical_review_topics
        };

        // ── Async training log ────────────────────────────────────────────────
        if (CircuitAttemptLog) {
            CircuitAttemptLog.create({
                student_id:        studentId || null,
                question_id:       question._id || null,
                components,
                connections,
                score_label:       blendedScore,
                verdict_label:     verdict === 'correct' ? 2 : verdict === 'partially_correct' ? 1 : 0,
                ml_score:          mlScore,
                ml_confidence:     ml.ml_confidence,
                engine_used:       'physics_4tier+ml_ensemble',
                disagreement_flag: ml.disagreement_flag || false,
                time_spent_sec:    behavior.time_spent_sec || 0,
                n_deletes:         behavior.n_component_deletes || 0
            }).catch(err => console.warn('[CircuitAgent] Log error:', err.message));
        }

        return mergedResult;

    } catch (mlErr) {
        // ML service not running or not trained — physics engine result is fully self-contained
        console.warn('[CircuitAgent] ML service unavailable, using physics-only result:', mlErr.message);

        if (CircuitAttemptLog) {
            CircuitAttemptLog.create({
                student_id:    studentId || null,
                question_id:   question._id || null,
                components,
                connections,
                score_label:   ruleResult.score,
                verdict_label: ruleResult.verdict === 'correct' ? 2 : ruleResult.verdict === 'partially_correct' ? 1 : 0,
                engine_used:   'rule_physics_4tier',
                time_spent_sec: behavior.time_spent_sec || 0
            }).catch(() => {});
        }

        return {
            ...ruleResult,
            ml_confidence:        null,
            design_analysis:      null,
            shap_explanation:     null,
            viva_questions:       null,
            model_votes: {
                flat_ensemble: 'not_available',
                gnn:           'not_available',
                rule_engine:   ruleResult.verdict
            },
            disagreement_flag:          false,
            instructor_review_required: ruleResult.score < 60
        };
    }
}

module.exports = { evaluate, evaluateRuleBased };
