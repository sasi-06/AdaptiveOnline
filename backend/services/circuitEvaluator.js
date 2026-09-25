/**
 * circuitEvaluator.js  —  Deterministic Physics-Based Circuit Simulator
 *
 * Supports:
 *   1. Op-Amp Inverting Amplifier  (gain_check)
 *   2. Voltage Divider             (voltage_divider)
 *   3. Series RLC Circuit          (rlc_analysis)
 *   4. LED Driver Circuit          (led_circuit)
 *   5. BJT Common-Emitter Amp      (bjt_amplifier)
 *   6. RC Low/High-Pass Filter     (rc_filter)
 *   7. Half/Full-Wave Rectifier    (rectifier)
 *
 * All formulae reference IEEE/Sedra-Smith textbook derivations.
 * Every return object includes:
 *   - status: 'success' | 'error' | 'unsupported'
 *   - engine: 'spice-js-sim'
 *   - domain: circuit domain string
 *   - All measured electrical metrics with proper units
 */

'use strict';

// ─── Known pin sets per component type ───────────────────────────────────────
const COMPONENT_PINS = {
    resistor:         ['1', '2'],
    capacitor:        ['1', '2'],
    inductor:         ['1', '2'],
    diode:            ['anode', 'cathode'],
    zener_diode:      ['anode', 'cathode'],
    bjt_npn:          ['base', 'collector', 'emitter'],
    bjt_pnp:          ['base', 'collector', 'emitter'],
    mosfet_n:         ['gate', 'drain', 'source'],
    op_amp:           ['non_inverting', 'inverting', 'output', 'vcc', 'vee'],
    voltage_source:   ['positive', 'negative'],
    current_source:   ['positive', 'negative'],
    ground:           ['1'],
    voltmeter:        ['positive', 'negative'],
    ammeter:          ['1', '2'],
    logic_gate_and:   ['in1', 'in2', 'out'],
    logic_gate_or:    ['in1', 'in2', 'out'],
    logic_gate_not:   ['in', 'out'],
    logic_gate_nand:  ['in1', 'in2', 'out'],
    logic_gate_nor:   ['in1', 'in2', 'out'],
    logic_gate_xor:   ['in1', 'in2', 'out'],
    led:              ['anode', 'cathode'],
    switch:           ['1', '2'],
    transformer:      ['primary_p', 'primary_n', 'secondary_p', 'secondary_n'],
};

// ─── E12 Standard Resistor Values (for practicality tier) ────────────────────
const E12_VALUES = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
function nearestE12(val) {
    if (!val || val <= 0) return null;
    const decades = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];
    let best = null, bestDiff = Infinity;
    for (const decade of decades) {
        for (const e of E12_VALUES) {
            const candidate = e * decade;
            const diff = Math.abs(candidate - val);
            if (diff < bestDiff) { bestDiff = diff; best = candidate; }
        }
    }
    return best;
}
function isE12Standard(val) {
    if (!val || val <= 0) return true;
    const nearest = nearestE12(val);
    return Math.abs(nearest - val) / val < 0.02; // within 2%
}

// ─── Union-Find Net Builder ───────────────────────────────────────────────────
function buildNets(components, connections) {
    const parent = {};
    const key = (comp_id, pin) => `${comp_id}::${pin}`;

    for (const comp of components) {
        const pins = COMPONENT_PINS[comp.type] || [];
        for (const pin of pins) {
            const k = key(comp.comp_id, pin);
            parent[k] = k;
        }
    }

    function find(x) {
        if (parent[x] !== x) parent[x] = find(parent[x]);
        return parent[x];
    }

    function union(a, b) {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent[ra] = rb;
    }

    for (const conn of connections) {
        const fk = key(conn.from.comp_id, conn.from.pin);
        const tk = key(conn.to.comp_id, conn.to.pin);
        if (parent[fk] !== undefined && parent[tk] !== undefined) union(fk, tk);
    }

    const netMap = {};
    for (const k of Object.keys(parent)) {
        const root = find(k);
        if (!netMap[root]) netMap[root] = [];
        const parts = k.split('::');
        netMap[root].push({ comp_id: parts[0], pin: parts.slice(1).join('::') });
    }

    return Object.values(netMap);
}

function netsForPin(nets, comp_id, pin) {
    return nets.filter(net => net.some(p => p.comp_id === comp_id && p.pin === pin));
}

function prop(comp, key) {
    if (!comp || !comp.properties) return undefined;
    if (typeof comp.properties.get === 'function') return comp.properties.get(key);
    return comp.properties[key];
}

function numProp(comp, key, fallback = 0) {
    const v = prop(comp, key);
    const n = Number(v);
    return isNaN(n) ? fallback : n;
}

// ─── Waveform Generator Utilities ────────────────────────────────────────────
function sineWaveform(vin, vout, freq = 1000, points = 31) {
    const period = 1 / freq;
    const waveform = [];
    for (let i = 0; i <= points; i++) {
        const t = (i / points) * (2 * period);
        const vin_t  = vin  * Math.sin(2 * Math.PI * freq * t);
        const vout_t = vout * Math.sin(2 * Math.PI * freq * t);
        waveform.push({ t_ms: parseFloat((t * 1000).toFixed(3)), vin: parseFloat(vin_t.toFixed(4)), vout: parseFloat(vout_t.toFixed(4)) });
    }
    return waveform;
}

function dcWaveform(vin, vout, duration_ms = 10, points = 20) {
    const waveform = [];
    for (let i = 0; i <= points; i++) {
        const t = (i / points) * duration_ms;
        waveform.push({ t_ms: parseFloat(t.toFixed(3)), vin: parseFloat(vin.toFixed(4)), vout: parseFloat(vout.toFixed(4)) });
    }
    return waveform;
}

function bodePlot(gain_mag, bandwidth_hz, minF = 10, maxF = 1e6, points = 20, invertPhase = false) {
    const result = [];
    for (let i = 0; i < points; i++) {
        const freq    = minF * Math.pow(maxF / minF, i / (points - 1));
        const mag     = gain_mag / Math.sqrt(1 + Math.pow(freq / bandwidth_hz, 2));
        const db      = 20 * Math.log10(Math.max(1e-9, mag));
        const phase   = (invertPhase ? 180 : 0) - Math.atan(freq / bandwidth_hz) * (180 / Math.PI);
        result.push({ freq: Math.round(freq), gain_db: parseFloat(db.toFixed(2)), phase_deg: parseFloat(phase.toFixed(1)) });
    }
    return result;
}

// ─── 1. Op-Amp Inverting Amplifier ───────────────────────────────────────────
/**
 * Inverting Amplifier: Gain = -Rf/Rin
 * Vout = Gain × Vin
 * Bandwidth = GBW / |Gain|  (741 GBW = 1 MHz)
 * Iin = Vin / Rin  (virtual ground at V-)
 */
function analyseOpAmpGain(components, connections) {
    const nets   = buildNets(components, connections);
    const opAmp  = components.find(c => c.type === 'op_amp');
    if (!opAmp) return { status: 'error', domain: 'AC_ANALOG', message: 'No op-amp found in netlist' };

    const resistors  = components.filter(c => c.type === 'resistor');
    const voltageSrc = components.find(c => c.type === 'voltage_source');

    const invertingNets = netsForPin(nets, opAmp.comp_id, 'inverting');
    const outputNets    = netsForPin(nets, opAmp.comp_id, 'output');

    // Identify Rf: connected to BOTH inverting node AND output node
    let Rf = null, Rin = null;
    for (const r of resistors) {
        const onInv = invertingNets.some(n => n.some(p => p.comp_id === r.comp_id));
        const onOut = outputNets.some(n => n.some(p => p.comp_id === r.comp_id));
        if (onInv && onOut) { Rf = r; break; }
    }

    // Identify Rin: on inverting node but NOT Rf
    for (const r of resistors) {
        if (Rf && r.comp_id === Rf.comp_id) continue;
        const onInv = invertingNets.some(n => n.some(p => p.comp_id === r.comp_id));
        if (onInv) { Rin = r; break; }
    }

    if (!Rf || !Rin) {
        return {
            status: 'error', domain: 'AC_ANALOG',
            message: !Rf
                ? 'Cannot identify feedback resistor (Rf) — ensure a resistor connects op-amp output to inverting input'
                : 'Cannot identify input resistor (Rin) — ensure a resistor connects signal source to inverting input',
            measured_gain: null, output_voltage: null
        };
    }

    const rfVal  = numProp(Rf,  'resistance_ohm', 10000);
    const rinVal = numProp(Rin, 'resistance_ohm', 1000);
    const vin    = voltageSrc ? numProp(voltageSrc, 'voltage', 1.0) : 1.0;

    // Core formula: Vout = -(Rf/Rin) × Vin
    const gain   = -(rfVal / rinVal);
    const vout   = gain * vin;

    // Electrical metrics
    const iIn_mA  = Math.abs(vin / rinVal) * 1000;   // Virtual ground: Iin = Vin/Rin
    const pRin_mW = (vin * vin / rinVal) * 1000;
    const pRf_mW  = (vout * vout / rfVal) * 1000;

    // GBW product (µA741 = 1 MHz standard)
    const GBW = 1_000_000;
    const bandwidth_hz = GBW / Math.max(1, Math.abs(gain));

    const MAX_P = 250;
    const thermalWarnings = [];
    if (pRin_mW > MAX_P) thermalWarnings.push({ component: Rin.comp_id, power_mw: pRin_mW.toFixed(1), limit_mw: MAX_P });
    if (pRf_mW  > MAX_P) thermalWarnings.push({ component: Rf.comp_id,  power_mw: pRf_mW.toFixed(1),  limit_mw: MAX_P });

    // E12 check
    const rfE12  = isE12Standard(rfVal);
    const rinE12 = isE12Standard(rinVal);

    return {
        engine: 'spice-js-sim', status: 'success', domain: 'AC_ANALOG',
        measured_gain:   parseFloat(gain.toFixed(4)),
        output_voltage:  parseFloat(vout.toFixed(4)),
        Rf_id: Rf.comp_id, Rf_val: rfVal,
        Rin_id: Rin.comp_id, Rin_val: rinVal,
        vin_actual: vin,
        i_in_ma:    parseFloat(iIn_mA.toFixed(3)),
        phase_shift_deg: 180,  // Inverting configuration
        bandwidth_hz: Math.round(bandwidth_hz),
        phase_margin_deg: 60,  // µA741 standard
        power_breakdown: [
            { comp_id: Rin.comp_id, type: 'Resistor (Rin)', resistance_ohm: rinVal, power_mw: parseFloat(pRin_mW.toFixed(2)), current_ma: parseFloat(iIn_mA.toFixed(3)), status: pRin_mW > MAX_P ? '⚠️ Thermal Overload' : '🟢 Safe (<250mW)', e12_standard: rinE12 },
            { comp_id: Rf.comp_id,  type: 'Resistor (Rf)',  resistance_ohm: rfVal,  power_mw: parseFloat(pRf_mW.toFixed(2)),  current_ma: parseFloat(iIn_mA.toFixed(3)), status: pRf_mW  > MAX_P ? '⚠️ Thermal Overload' : '🟢 Safe (<250mW)', e12_standard: rfE12 }
        ],
        thermal_warnings: thermalWarnings,
        bode_plot: bodePlot(Math.abs(gain), bandwidth_hz, 10, 1e6, 20, true),
        waveform:  sineWaveform(vin, vout),
        ee_grade: thermalWarnings.length > 0 ? 'C' : (rfE12 && rinE12 ? 'A+' : 'A'),
        design_notes: [
            `Gain formula: A_v = −Rf/Rin = −${rfVal}/${rinVal} = ${gain.toFixed(2)}`,
            `Virtual ground at V⁻: I_in = ${iIn_mA.toFixed(2)} mA`,
            `3dB bandwidth: ${bandwidth_hz >= 1000 ? (bandwidth_hz/1000).toFixed(1)+'kHz' : bandwidth_hz+'Hz'} (GBW/${Math.abs(gain).toFixed(0)})`
        ]
    };
}

// ─── 2. Voltage Divider ───────────────────────────────────────────────────────
/**
 * Vout = Vin × R2 / (R1 + R2)
 * Uses node connectivity to correctly identify which resistor is R1 (top) vs R2 (bottom)
 */
function analyseVoltageDivider(components, connections) {
    const resistors  = components.filter(c => c.type === 'resistor');
    const voltageSrc = components.find(c => c.type === 'voltage_source');
    const groundComp = components.find(c => c.type === 'ground');

    if (resistors.length < 2 || !voltageSrc) {
        return { status: 'error', domain: 'DC_BIAS', message: 'Voltage divider requires voltage source and ≥2 resistors' };
    }

    const nets = buildNets(components, connections);

    // Identify R1 (connected to Vs+) and R2 (connected to GND)
    const vsrcPositiveNets = netsForPin(nets, voltageSrc.comp_id, 'positive');
    const gndNets = groundComp ? netsForPin(nets, groundComp.comp_id, '1') : [];

    let R1 = null, R2 = null;
    for (const r of resistors) {
        const toVsrc = vsrcPositiveNets.some(n => n.some(p => p.comp_id === r.comp_id));
        if (toVsrc) { R1 = r; break; }
    }
    for (const r of resistors) {
        if (R1 && r.comp_id === R1.comp_id) continue;
        if (gndNets.length > 0) {
            const toGnd = gndNets.some(n => n.some(p => p.comp_id === r.comp_id));
            if (toGnd) { R2 = r; break; }
        }
    }
    // Fallback: just take first two resistors in order
    if (!R1) R1 = resistors[0];
    if (!R2) R2 = resistors.find(r => r.comp_id !== R1.comp_id) || resistors[1];

    const r1    = numProp(R1, 'resistance_ohm', 1000);
    const r2    = numProp(R2, 'resistance_ohm', 1000);
    const vin   = numProp(voltageSrc, 'voltage', 5.0);

    // Core formula: Vout = Vin × R2/(R1+R2)
    const rTotal    = r1 + r2;
    const iTotal_mA = (vin / rTotal) * 1000;
    const vout      = vin * (r2 / rTotal);
    const rOut_eq   = (r1 * r2) / rTotal;      // Thevenin output resistance

    const pR1_mW = (iTotal_mA / 1000) * (iTotal_mA / 1000) * r1 * 1000;
    const pR2_mW = (iTotal_mA / 1000) * (iTotal_mA / 1000) * r2 * 1000;

    const MAX_P = 250;
    const thermalWarnings = [];
    if (pR1_mW > MAX_P) thermalWarnings.push({ component: R1.comp_id, power_mw: pR1_mW.toFixed(1), limit_mw: MAX_P });
    if (pR2_mW > MAX_P) thermalWarnings.push({ component: R2.comp_id, power_mw: pR2_mW.toFixed(1), limit_mw: MAX_P });

    const r1E12 = isE12Standard(r1), r2E12 = isE12Standard(r2);

    return {
        engine: 'spice-js-sim', status: 'success', domain: 'DC_BIAS',
        output_voltage:  parseFloat(vout.toFixed(4)),
        measured_gain:   parseFloat((vout / vin).toFixed(4)),
        R1_id: R1.comp_id, R1_val: r1,
        R2_id: R2.comp_id, R2_val: r2,
        Vin: vin,
        i_total_ma:   parseFloat(iTotal_mA.toFixed(3)),
        r_out_eq_ohm: Math.round(rOut_eq),
        power_breakdown: [
            { comp_id: R1.comp_id, type: 'Upper Resistor (R1)', resistance_ohm: r1, power_mw: parseFloat(pR1_mW.toFixed(2)), current_ma: parseFloat(iTotal_mA.toFixed(3)), status: pR1_mW > MAX_P ? '⚠️ Thermal Overload' : '🟢 Safe', e12_standard: r1E12 },
            { comp_id: R2.comp_id, type: 'Lower Resistor (R2)', resistance_ohm: r2, power_mw: parseFloat(pR2_mW.toFixed(2)), current_ma: parseFloat(iTotal_mA.toFixed(3)), status: pR2_mW > MAX_P ? '⚠️ Thermal Overload' : '🟢 Safe', e12_standard: r2E12 }
        ],
        thermal_warnings: thermalWarnings,
        waveform: dcWaveform(vin, vout),
        ee_grade: thermalWarnings.length > 0 ? 'C' : (r1E12 && r2E12 ? 'A+' : 'A'),
        design_notes: [
            `Divider formula: V_out = V_in × R2/(R1+R2) = ${vin} × ${r2}/(${r1}+${r2}) = ${vout.toFixed(3)}V`,
            `Total current: I = V_in/(R1+R2) = ${iTotal_mA.toFixed(2)}mA`,
            `Thevenin output impedance: R_th = R1||R2 = ${rOut_eq.toFixed(0)}Ω`
        ]
    };
}

// ─── 3. Series RLC Circuit ────────────────────────────────────────────────────
/**
 * f₀ = 1 / (2π√LC)
 * Q  = (1/R)√(L/C)
 * BW = f₀/Q = R/L × (1/2π) ... actually BW = R/(2πL) for series RLC
 * Z at resonance = R (purely resistive)
 */
function analyseRLC(components, connections) {
    const R = components.find(c => c.type === 'resistor');
    const L = components.find(c => c.type === 'inductor');
    const C = components.find(c => c.type === 'capacitor');

    if (!L || !C) return { status: 'error', domain: 'AC_ANALOG', message: 'RLC analysis requires both inductor and capacitor' };

    const lVal = numProp(L, 'inductance_henry', 0.01);
    const cVal = numProp(C, 'capacitance_farad', 1e-6);
    const rVal = R ? numProp(R, 'resistance_ohm', 10) : 10;
    const vsrc = components.find(c => c.type === 'voltage_source');
    const vin  = vsrc ? numProp(vsrc, 'voltage', 5.0) : 5.0;

    // Core formulae
    const f0 = 1 / (2 * Math.PI * Math.sqrt(lVal * cVal));
    const Q  = (1 / rVal) * Math.sqrt(lVal / cVal);
    const bw = f0 / Q;  // Bandwidth at -3dB
    const Xl = 2 * Math.PI * f0 * lVal;  // Reactance at resonance
    const Xc = 1 / (2 * Math.PI * f0 * cVal);

    // Bode plot: series RLC bandpass response
    const minF = Math.max(10, f0 / 20), maxF = f0 * 20;
    const rlcBode = [];
    for (let i = 0; i < 40; i++) {
        const freq  = minF * Math.pow(maxF / minF, i / 39);
        const w     = 2 * Math.PI * freq;
        const Zx    = w * lVal - 1 / (w * cVal);
        const Zmag  = Math.sqrt(rVal * rVal + Zx * Zx);
        const Ipeak = vin / Zmag;
        const Vr    = Ipeak * rVal;  // Voltage across R (bandpass output)
        const db    = 20 * Math.log10(Math.max(1e-9, Vr / vin));
        const phase = -Math.atan(Zx / rVal) * (180 / Math.PI);
        rlcBode.push({ freq: Math.round(freq), gain_db: parseFloat(db.toFixed(2)), phase_deg: parseFloat(phase.toFixed(1)) });
    }

    const pR_mW = R ? (vin * vin / (rVal * 2)) * 1000 : 0; // Avg power at resonance

    return {
        engine: 'spice-js-sim', status: 'success', domain: 'AC_ANALOG',
        resonant_frequency: parseFloat(f0.toFixed(2)),
        Q_factor:           parseFloat(Q.toFixed(3)),
        bandwidth_hz:       parseFloat(bw.toFixed(2)),
        X_L_at_f0:          parseFloat(Xl.toFixed(2)),
        X_C_at_f0:          parseFloat(Xc.toFixed(2)),
        L_val: lVal, C_val: cVal, R_val: rVal,
        bode_plot: rlcBode,
        ee_grade: Q > 10 ? 'A+' : Q > 5 ? 'A' : Q > 2 ? 'B' : 'C',
        design_notes: [
            `Resonant frequency: f₀ = 1/(2π√LC) = ${f0.toFixed(1)} Hz`,
            `Quality factor: Q = (1/R)√(L/C) = ${Q.toFixed(2)}`,
            `Bandwidth: BW = f₀/Q = ${bw.toFixed(1)} Hz`,
            `At f₀: X_L = X_C = ${Xl.toFixed(1)}Ω, Z = ${rVal}Ω (purely resistive)`
        ]
    };
}

// ─── 4. LED Driver Circuit ────────────────────────────────────────────────────
/**
 * I_LED = (Vin - Vf) / R_limit
 * Optimal range: 10–25 mA (general purpose LED)
 * Vf depends on LED colour: Red=1.8-2.2V, Green=1.9-2.4V, Blue=3.0-3.5V
 */
function analyseLED(components, connections) {
    const R    = components.find(c => c.type === 'resistor');
    const vSrc = components.find(c => c.type === 'voltage_source');
    const led  = components.find(c => c.type === 'led' || c.type === 'diode');

    if (!R || !vSrc) return { status: 'error', domain: 'DC_BIAS', message: 'LED circuit requires resistor and voltage source' };

    const vin  = numProp(vSrc, 'voltage', 5.0);
    const rVal = numProp(R, 'resistance_ohm', 220);
    // Vf: use component property if given, else default red LED
    const vf   = led ? numProp(led, 'forward_voltage', 2.0) : 2.0;

    if (vin <= vf) {
        return { status: 'error', domain: 'DC_BIAS', message: `Supply voltage (${vin}V) is insufficient to forward-bias LED (Vf = ${vf}V)` };
    }

    // Core formula: I_LED = (Vin - Vf) / R
    const iLED_mA  = ((vin - vf) / rVal) * 1000;
    const vR       = vin - vf;         // Voltage across current-limiting resistor
    const pR_mW    = (iLED_mA / 1000) * vR * 1000;
    const pLED_mW  = (iLED_mA / 1000) * vf * 1000;

    let statusText = '🟢 Optimal (10–25 mA)';
    if      (iLED_mA < 5)  statusText = '⚠️ Under-driven (<5mA) — LED will be dim or not light';
    else if (iLED_mA < 10) statusText = '🟡 Low current (5–10mA) — acceptable';
    else if (iLED_mA > 30) statusText = '🔴 Over-current (>30mA) — LED damage risk';

    const rIdeal = Math.round((vin - vf) / 0.020); // For 20mA target
    const rE12   = isE12Standard(rVal);

    return {
        engine: 'spice-js-sim', status: 'success', domain: 'DC_BIAS',
        led_current_ma:  parseFloat(iLED_mA.toFixed(2)),
        vf_actual:       vf,
        v_resistor:      parseFloat(vR.toFixed(3)),
        output_voltage:  parseFloat(vf.toFixed(2)),
        measured_gain:   null,
        power_breakdown: [
            { comp_id: R.comp_id, type: 'Current-limiting Resistor', resistance_ohm: rVal, power_mw: parseFloat(pR_mW.toFixed(2)), current_ma: parseFloat(iLED_mA.toFixed(2)), status: pR_mW > 250 ? '⚠️ Overheat Risk' : '🟢 Safe', e12_standard: rE12 },
            { comp_id: led ? led.comp_id : 'LED',  type: 'LED', vf_volts: vf, power_mw: parseFloat(pLED_mW.toFixed(2)), current_ma: parseFloat(iLED_mA.toFixed(2)), status: statusText }
        ],
        thermal_warnings: pR_mW > 250 ? [{ component: R.comp_id, power_mw: pR_mW.toFixed(1), limit_mw: 250 }] : [],
        ee_grade: iLED_mA >= 10 && iLED_mA <= 25 ? 'A+' : iLED_mA > 30 ? 'D' : 'B',
        design_notes: [
            `LED current: I = (Vin − Vf)/R = (${vin} − ${vf})/${rVal} = ${iLED_mA.toFixed(2)} mA`,
            `For 20mA target: R = (${vin}V − ${vf}V) / 20mA = ${rIdeal}Ω (nearest E12: ${nearestE12(rIdeal)}Ω)`
        ]
    };
}

// ─── 5. BJT Common-Emitter Amplifier ─────────────────────────────────────────
/**
 * DC biasing: V_B = Vin × R2/(R1+R2) [voltage divider bias]
 * V_E = V_B − 0.7V (V_BE for Si NPN)
 * I_C ≈ I_E = V_E / R_E   (β >> 1 assumption)
 * V_CE = Vcc − I_C(R_C + R_E)
 * AC Gain (mid-band): A_v = −R_C / r_e  where r_e = 26mV / I_C
 */
function analyseBJT(components, connections) {
    const bjt  = components.find(c => c.type === 'bjt_npn' || c.type === 'bjt_pnp');
    const vsrc = components.find(c => c.type === 'voltage_source');

    if (!bjt || !vsrc) {
        return { status: 'error', domain: 'DC_BIAS', message: 'BJT amplifier requires BJT transistor and voltage source' };
    }

    const resistors = components.filter(c => c.type === 'resistor');
    if (resistors.length < 2) {
        return { status: 'error', domain: 'DC_BIAS', message: 'BJT amplifier needs at least R_C and R_E (or bias resistors)' };
    }

    const vcc  = numProp(vsrc, 'voltage', 12.0);
    const beta  = 100; // Standard hFE assumption
    const vBE   = bjt.type === 'bjt_pnp' ? -0.7 : 0.7;

    // Heuristic: largest resistor = R1 (upper bias), then R2, R_C, R_E by descending value
    const sorted = [...resistors].sort((a, b) =>
        numProp(b, 'resistance_ohm', 1000) - numProp(a, 'resistance_ohm', 1000)
    );

    const R1 = sorted[0], R2 = sorted[1];
    const RC = sorted[2] || sorted[1];
    const RE = sorted[3] || sorted[2] || sorted[1];

    const r1 = numProp(R1, 'resistance_ohm', 47000);
    const r2 = numProp(R2, 'resistance_ohm', 10000);
    const rc = numProp(RC, 'resistance_ohm', 2200);
    const re = numProp(RE, 'resistance_ohm', 1000);

    // DC Analysis
    const vB  = vcc * r2 / (r1 + r2);         // Base voltage
    const vE  = vB - Math.abs(vBE);            // Emitter voltage
    const iC  = vE > 0 ? vE / re : 0;          // Collector current (I_C ≈ I_E)
    const vCE = vcc - iC * (rc + re);          // Collector-emitter voltage

    // AC Analysis (mid-band)
    const r_e  = 0.026 / Math.max(iC, 1e-6);  // Small-signal emitter resistance = 26mV/Ic
    const Av   = -(rc / r_e);                  // Mid-band voltage gain (bypass cap on RE assumed)

    // Operating region check
    let region = 'Active';
    if (vCE < 0.2)  region = 'Saturation';
    if (iC   < 1e-6) region = 'Cutoff';

    const pBJT_mW  = iC * vCE * 1000;
    const pRC_mW   = iC * iC * rc * 1000;
    const MAX_P = 250;

    return {
        engine: 'spice-js-sim', status: 'success', domain: 'DC_BIAS',
        V_B: parseFloat(vB.toFixed(3)),
        V_E: parseFloat(vE.toFixed(3)),
        V_CE: parseFloat(vCE.toFixed(3)),
        I_C_mA: parseFloat((iC * 1000).toFixed(3)),
        Q_point: { V_CE: parseFloat(vCE.toFixed(2)), I_C_mA: parseFloat((iC * 1000).toFixed(2)) },
        operating_region: region,
        ac_gain_midband: parseFloat(Av.toFixed(2)),
        r_e_ohm: parseFloat(r_e.toFixed(1)),
        measured_gain: parseFloat(Av.toFixed(4)),
        output_voltage: parseFloat((Av * 0.01).toFixed(4)), // For 10mV input signal
        power_breakdown: [
            { comp_id: bjt.comp_id, type: 'BJT Transistor', power_mw: parseFloat(pBJT_mW.toFixed(2)), current_ma: parseFloat((iC * 1000).toFixed(2)), status: pBJT_mW > MAX_P ? '⚠️ Thermal Limit' : '🟢 Safe', vce_v: parseFloat(vCE.toFixed(2)) },
            { comp_id: RC.comp_id,  type: 'Collector Resistor (RC)', resistance_ohm: rc, power_mw: parseFloat(pRC_mW.toFixed(2)), current_ma: parseFloat((iC * 1000).toFixed(2)), status: pRC_mW > MAX_P ? '⚠️ Overheat' : '🟢 Safe', e12_standard: isE12Standard(rc) }
        ],
        thermal_warnings: (pBJT_mW > MAX_P || pRC_mW > MAX_P) ? [{ component: bjt.comp_id, power_mw: pBJT_mW.toFixed(1), limit_mw: MAX_P }] : [],
        ee_grade: region === 'Active' && Math.abs(Av) > 10 ? 'A+' : region === 'Active' ? 'A' : 'D',
        design_notes: [
            `DC bias: V_B = ${vB.toFixed(2)}V, V_E = ${vE.toFixed(2)}V, I_C = ${(iC*1000).toFixed(2)}mA`,
            `Q-point: V_CE = ${vCE.toFixed(2)}V, I_C = ${(iC*1000).toFixed(2)}mA → Region: ${region}`,
            `AC gain: A_v = -R_C/r_e = -${rc}/${r_e.toFixed(1)} = ${Av.toFixed(1)}`
        ]
    };
}

// ─── 6. RC Filter (Low-Pass & High-Pass) ─────────────────────────────────────
/**
 * Low-Pass:  f_c = 1/(2πRC),  H(f) = 1/√(1+(f/f_c)²)
 * High-Pass: f_c = 1/(2πRC),  H(f) = (f/f_c)/√(1+(f/f_c)²)
 */
function analyseRCFilter(components, connections, expectedBehavior = {}) {
    const R = components.find(c => c.type === 'resistor');
    const C = components.find(c => c.type === 'capacitor');
    const vsrc = components.find(c => c.type === 'voltage_source');

    if (!R || !C) return { status: 'error', domain: 'AC_ANALOG', message: 'RC filter requires resistor and capacitor' };

    const rVal = numProp(R, 'resistance_ohm', 1000);
    const cVal = numProp(C, 'capacitance_farad', 1e-6);
    const vin  = vsrc ? numProp(vsrc, 'voltage', 1.0) : 1.0;

    const fc  = 1 / (2 * Math.PI * rVal * cVal);
    const tau = rVal * cVal;    // Time constant

    const filterType = (expectedBehavior.filter_type || 'low_pass').toLowerCase();
    const isHP = filterType === 'high_pass';

    // Bode plot
    const minF = Math.max(1, fc / 100), maxF = fc * 100;
    const rcBode = [];
    for (let i = 0; i < 40; i++) {
        const freq    = minF * Math.pow(maxF / minF, i / 39);
        const ratio   = freq / fc;
        const mag     = isHP ? ratio / Math.sqrt(1 + ratio * ratio) : 1 / Math.sqrt(1 + ratio * ratio);
        const db      = 20 * Math.log10(Math.max(1e-9, mag));
        const phase   = isHP ? 90 - Math.atan(ratio) * (180 / Math.PI) : -Math.atan(ratio) * (180 / Math.PI);
        rcBode.push({ freq: Math.round(freq), gain_db: parseFloat(db.toFixed(2)), phase_deg: parseFloat(phase.toFixed(1)) });
    }

    return {
        engine: 'spice-js-sim', status: 'success', domain: 'AC_ANALOG',
        filter_type: isHP ? 'High-Pass' : 'Low-Pass',
        cutoff_frequency_hz: parseFloat(fc.toFixed(2)),
        time_constant_ms: parseFloat((tau * 1000).toFixed(3)),
        R_val: rVal, C_val: cVal,
        bandwidth_hz: parseFloat(fc.toFixed(2)),
        measured_gain: isHP ? 0 : 1.0,  // At DC
        output_voltage: vin,
        bode_plot: rcBode,
        ee_grade: isE12Standard(rVal) ? 'A+' : 'A',
        design_notes: [
            `${isHP ? 'High-Pass' : 'Low-Pass'} filter: f_c = 1/(2πRC) = 1/(2π × ${rVal} × ${cVal}) = ${fc.toFixed(1)} Hz`,
            `Time constant: τ = RC = ${(tau * 1000).toFixed(2)} ms`,
            `Roll-off: −20 dB/decade beyond f_c`
        ]
    };
}

// ─── 7. Rectifier Circuit ────────────────────────────────────────────────────
/**
 * Half-wave: V_dc = Vm/π − Vf,  V_ripple = Vm/(2√3·f·R·C)
 * Full-wave: V_dc = 2Vm/π − 2Vf
 */
function analyseRectifier(components, connections) {
    const diodes = components.filter(c => c.type === 'diode' || c.type === 'led');
    const vsrc   = components.find(c => c.type === 'voltage_source');
    const C_comp = components.find(c => c.type === 'capacitor');
    const R_load = components.find(c => c.type === 'resistor');

    if (diodes.length === 0 || !vsrc) {
        return { status: 'error', domain: 'TRANSIENT_POWER', message: 'Rectifier requires diode(s) and voltage source' };
    }

    const vm   = numProp(vsrc, 'voltage', 12.0) * Math.SQRT2;  // Peak voltage
    const vf   = 0.7;  // Silicon diode forward voltage
    const freq = numProp(vsrc, 'frequency', 50);  // Supply frequency
    const cVal = C_comp ? numProp(C_comp, 'capacitance_farad', 1e-3) : 0;
    const rLoad = R_load ? numProp(R_load, 'resistance_ohm', 1000) : 1000;

    const isFullWave = diodes.length >= 4;

    const vDC = isFullWave ? (2 * vm / Math.PI) - 2 * vf : vm / Math.PI - vf;
    const vRipple = cVal > 0
        ? vDC / (2 * (isFullWave ? 2 : 1) * freq * rLoad * cVal)
        : vDC * 0.3;  // No filter cap — high ripple

    const iDC = vDC / rLoad;
    const eff  = (vDC * iDC) / ((vm / Math.SQRT2) * (iDC)) * 100;

    return {
        engine: 'spice-js-sim', status: 'success', domain: 'TRANSIENT_POWER',
        rectifier_type: isFullWave ? 'Full-Wave Bridge' : 'Half-Wave',
        V_dc:       parseFloat(vDC.toFixed(3)),
        V_ripple:   parseFloat(vRipple.toFixed(3)),
        V_peak:     parseFloat(vm.toFixed(3)),
        I_dc_mA:    parseFloat((iDC * 1000).toFixed(2)),
        efficiency_pct: parseFloat(eff.toFixed(1)),
        output_voltage: parseFloat(vDC.toFixed(4)),
        measured_gain:  null,
        ee_grade: vRipple < vDC * 0.05 ? 'A+' : vRipple < vDC * 0.1 ? 'A' : 'B',
        design_notes: [
            `${isFullWave ? 'Full-wave' : 'Half-wave'} rectifier: V_dc = ${vDC.toFixed(2)}V`,
            `Ripple voltage: V_r = ${vRipple.toFixed(3)}V (${((vRipple/vDC)*100).toFixed(1)}% of V_dc)`,
            cVal > 0 ? `Filter capacitor: ${(cVal * 1e6).toFixed(0)}μF reduces ripple` : 'No filter capacitor — high ripple voltage'
        ]
    };
}

// ─── Main Simulation Dispatcher ───────────────────────────────────────────────
function simulate(components, connections, expected_behavior) {
    if (!expected_behavior) {
        return { engine: 'spice-js-sim', status: 'error', domain: 'UNKNOWN', message: 'No expected_behavior defined for this question' };
    }

    switch (expected_behavior.type) {
        case 'gain_check':
            return analyseOpAmpGain(components, connections);
        case 'voltage_divider':
            return analyseVoltageDivider(components, connections);
        case 'rlc_analysis':
            return analyseRLC(components, connections);
        case 'led_circuit':
            return analyseLED(components, connections);
        case 'bjt_amplifier':
            return analyseBJT(components, connections);
        case 'rc_filter':
            return analyseRCFilter(components, connections, expected_behavior);
        case 'rectifier':
            return analyseRectifier(components, connections);
        default:
            return {
                engine: 'spice-js-sim', status: 'unsupported', domain: 'UNKNOWN',
                message: `Circuit type "${expected_behavior.type}" is not yet supported by the physics engine`
            };
    }
}

module.exports = {
    simulate,
    buildNets,
    prop,
    numProp,
    isE12Standard,
    nearestE12,
    COMPONENT_PINS
};
