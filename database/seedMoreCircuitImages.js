/**
 * seedMoreCircuitImages.js
 * Seeds additional ECE & EEE MCQ + circuit-analysis questions with inline SVG diagrams.
 * NEW circuits: Zener Regulator, RC Filter, MOSFET Amp, Op-Amp Differentiator,
 *               Wheatstone Bridge, 555 Timer, 3-Phase Motor Star, Colpitts Oscillator
 */

const path = require('path');
module.paths.push(path.join(__dirname, '../backend/node_modules'));

const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Question = require('../backend/models/Question');
const Exam     = require('../backend/models/Exam');

// ── Helper ────────────────────────────────────────────────────
const svg = (w, h, body) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `font-family="monospace">${body}</svg>`
  );

const BG  = '#0f172a';
const SRF = '#1e293b';
const BDR = '#334155';
const bg  = (w,h) =>
  `<rect width="${w}" height="${h}" fill="${BG}"/>` +
  `<rect x="8" y="8" width="${w-16}" height="${h-16}" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>`;

/* ════════════════════════════════════════════════════════════
   CIRCUIT SVG DIAGRAMS
   ════════════════════════════════════════════════════════════ */

// 1. Zener Voltage Regulator ────────────────────────────────
const ZENER_REG = svg(520,220,`
${bg(520,220)}
<text x="260" y="27" text-anchor="middle" fill="#94a3b8" font-size="11">Zener Diode Voltage Regulator Circuit</text>

<!-- Vin source -->
<circle cx="50" cy="115" r="18" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="50" y="111" text-anchor="middle" fill="#f59e0b" font-size="9">Vin</text>
<text x="50" y="123" text-anchor="middle" fill="#f59e0b" font-size="8">15V</text>

<!-- Top wire & Rs -->
<line x1="68" y1="100" x2="110" y2="100" stroke="#a78bfa" stroke-width="2"/>
<rect x="110" y="91" width="55" height="18" rx="3" fill="${SRF}" stroke="#a78bfa" stroke-width="2"/>
<text x="137" y="104" text-anchor="middle" fill="#a78bfa" font-size="9">Rs=470Ω</text>
<line x1="165" y1="100" x2="250" y2="100" stroke="#a78bfa" stroke-width="2"/>
<circle cx="250" cy="100" r="3" fill="#a78bfa"/>

<!-- Zener Diode (reverse-biased) -->
<line x1="250" y1="100" x2="250" y2="118" stroke="#ec4899" stroke-width="2"/>
<polygon points="250,118 238,140 262,140" fill="none" stroke="#ec4899" stroke-width="2.5"/>
<!-- Zener bar with notch -->
<line x1="236" y1="140" x2="264" y2="140" stroke="#ec4899" stroke-width="2.5"/>
<line x1="236" y1="140" x2="230" y2="147" stroke="#ec4899" stroke-width="2"/>
<line x1="264" y1="140" x2="270" y2="133" stroke="#ec4899" stroke-width="2"/>
<text x="278" y="130" fill="#ec4899" font-size="9">Vz = 5.1V</text>
<text x="278" y="141" fill="#ec4899" font-size="8">1N4733A</text>
<line x1="250" y1="140" x2="250" y2="165" stroke="#ec4899" stroke-width="2"/>

<!-- Load Resistor RL -->
<line x1="250" y1="100" x2="380" y2="100" stroke="#10b981" stroke-width="2"/>
<rect x="370" y="100" width="18" height="65" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="395" y="130" fill="#10b981" font-size="9">RL</text>
<text x="395" y="141" fill="#10b981" font-size="8">1kΩ</text>
<line x1="380" y1="165" x2="250" y2="165" stroke="#10b981" stroke-width="2"/>

<!-- Bottom return & GND -->
<line x1="250" y1="165" x2="50" y2="165" stroke="#334155" stroke-width="2"/>
<line x1="50" y1="130" x2="50" y2="165" stroke="#334155" stroke-width="2"/>
<line x1="235" y1="175" x2="265" y2="175" stroke="#64748b" stroke-width="2.5"/>
<line x1="240" y1="181" x2="260" y2="181" stroke="#64748b" stroke-width="1.5"/>
<text x="250" y="196" text-anchor="middle" fill="#64748b" font-size="8">GND</text>

<!-- Vout label -->
<circle cx="430" cy="100" r="5" fill="#38bdf8"/>
<line x1="380" y1="100" x2="430" y2="100" stroke="#38bdf8" stroke-width="1.5"/>
<text x="445" y="104" fill="#38bdf8" font-size="11" font-weight="bold">Vout=5.1V</text>

<text x="20" y="212" fill="#64748b" font-size="9">IZ = (Vin – Vz)/Rs – IL  •  Regulation: Vout = Vz (constant) for Vin > Vz + IZmin×Rs</text>
`);

// 2. RC Low-Pass Filter ──────────────────────────────────────
const RC_LPF = svg(520,230,`
${bg(520,230)}
<text x="260" y="27" text-anchor="middle" fill="#94a3b8" font-size="11">RC Low-Pass Filter — Frequency Response</text>

<!-- Input Vin -->
<circle cx="45" cy="100" r="18" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="45" y="96" text-anchor="middle" fill="#f59e0b" font-size="9">Vin</text>
<text x="45" y="108" text-anchor="middle" fill="#f59e0b" font-size="8">ω</text>

<!-- Resistor R -->
<line x1="63" y1="90" x2="95" y2="90" stroke="#a78bfa" stroke-width="2"/>
<rect x="95" y="81" width="55" height="18" rx="3" fill="${SRF}" stroke="#a78bfa" stroke-width="2"/>
<text x="122" y="94" text-anchor="middle" fill="#a78bfa" font-size="9">R = 1kΩ</text>
<line x1="150" y1="90" x2="210" y2="90" stroke="#a78bfa" stroke-width="2"/>
<circle cx="210" cy="90" r="3" fill="#a78bfa"/>

<!-- Capacitor C (vertical) -->
<line x1="210" y1="90" x2="210" y2="108" stroke="#ec4899" stroke-width="2"/>
<line x1="195" y1="108" x2="225" y2="108" stroke="#ec4899" stroke-width="3"/>
<line x1="195" y1="116" x2="225" y2="116" stroke="#ec4899" stroke-width="3"/>
<line x1="210" y1="116" x2="210" y2="145" stroke="#ec4899" stroke-width="2"/>
<text x="232" y="113" fill="#ec4899" font-size="9">C = 100nF</text>

<!-- GND -->
<line x1="195" y1="145" x2="225" y2="145" stroke="#64748b" stroke-width="2.5"/>
<line x1="200" y1="151" x2="220" y2="151" stroke="#64748b" stroke-width="1.5"/>
<text x="210" y="165" text-anchor="middle" fill="#64748b" font-size="8">GND</text>

<!-- Vout -->
<circle cx="310" cy="90" r="5" fill="#38bdf8"/>
<line x1="210" y1="90" x2="310" y2="90" stroke="#38bdf8" stroke-width="1.5"/>
<text x="322" y="94" fill="#38bdf8" font-size="11" font-weight="bold">Vout</text>

<!-- Bode Plot sketch -->
<rect x="15" y="170" width="490" height="45" rx="6" fill="#090d16" stroke="#334155" stroke-width="1"/>
<text x="25" y="185" fill="#94a3b8" font-size="9" font-weight="bold">|H(f)| Bode Plot →</text>
<!-- Flat passband -->
<line x1="70" y1="190" x2="200" y2="190" stroke="#10b981" stroke-width="2"/>
<!-- Roll-off at fc -->
<line x1="200" y1="190" x2="400" y2="208" stroke="#10b981" stroke-width="2"/>
<line x1="200" y1="183" x2="200" y2="210" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3"/>
<text x="195" y="180" fill="#f59e0b" font-size="8">fc≈1.59kHz</text>
<text x="205" y="210" fill="#f59e0b" font-size="8">–3dB point</text>
<text x="350" y="207" fill="#ef4444" font-size="8">–20dB/dec</text>

<text x="20" y="218" fill="#64748b" font-size="8">fc = 1/(2πRC) = 1/(2π×1k×100n) ≈ 1592 Hz  •  |H(fc)| = 1/√2 = –3dB  •  φ = –45°</text>
`);

// 3. N-Channel MOSFET Common-Source Amplifier ───────────────
const MOSFET_AMP = svg(520,230,`
${bg(520,230)}
<text x="260" y="27" text-anchor="middle" fill="#94a3b8" font-size="11">N-Channel MOSFET Common-Source Amplifier</text>

<!-- VDD -->
<line x1="290" y1="35" x2="290" y2="50" stroke="#ef4444" stroke-width="2"/>
<text x="290" y="32" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">+VDD (12V)</text>

<!-- RD Drain Resistor -->
<rect x="275" y="50" width="30" height="35" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="290" y="65" text-anchor="middle" fill="#10b981" font-size="8">RD</text>
<text x="290" y="77" text-anchor="middle" fill="#10b981" font-size="8">4.7kΩ</text>
<line x1="290" y1="85" x2="290" y2="105" stroke="#10b981" stroke-width="2"/>

<!-- MOSFET body -->
<line x1="290" y1="105" x2="290" y2="165" stroke="#38bdf8" stroke-width="3"/>
<!-- Gate insulated -->
<line x1="265" y1="120" x2="282" y2="120" stroke="#38bdf8" stroke-width="2"/>
<line x1="282" y1="108" x2="282" y2="135" stroke="#38bdf8" stroke-width="2.5"/>
<line x1="285" y1="108" x2="285" y2="135" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="2"/>
<!-- Drain -->
<line x1="290" y1="108" x2="320" y2="108" stroke="#38bdf8" stroke-width="2"/>
<!-- Source -->
<line x1="290" y1="150" x2="320" y2="150" stroke="#38bdf8" stroke-width="2"/>
<!-- Arrow -->
<polygon points="306,118 306,142 316,130" fill="#38bdf8"/>
<text x="265" y="118" fill="#38bdf8" font-size="8">G</text>
<text x="325" y="111" fill="#38bdf8" font-size="8">D</text>
<text x="325" y="153" fill="#38bdf8" font-size="8">S</text>
<text x="305" y="175" text-anchor="middle" fill="#38bdf8" font-size="8">2N7000</text>

<!-- Gate biasing R1 R2 -->
<line x1="200" y1="35" x2="265" y2="35" stroke="#f59e0b" stroke-width="2"/>
<line x1="200" y1="35" x2="200" y2="55" stroke="#f59e0b" stroke-width="2"/>
<rect x="185" y="55" width="30" height="30" rx="3" fill="${SRF}" stroke="#f59e0b" stroke-width="2"/>
<text x="200" y="68" text-anchor="middle" fill="#f59e0b" font-size="7">R1</text>
<text x="200" y="78" text-anchor="middle" fill="#f59e0b" font-size="7">1MΩ</text>
<line x1="200" y1="85" x2="200" y2="100" stroke="#f59e0b" stroke-width="2"/>
<circle cx="200" cy="100" r="3" fill="#f59e0b"/>
<rect x="185" y="100" width="30" height="30" rx="3" fill="${SRF}" stroke="#f59e0b" stroke-width="2"/>
<text x="200" y="113" text-anchor="middle" fill="#f59e0b" font-size="7">R2</text>
<text x="200" y="123" text-anchor="middle" fill="#f59e0b" font-size="7">220kΩ</text>
<line x1="200" y1="130" x2="200" y2="185" stroke="#f59e0b" stroke-width="2"/>

<!-- Coupling Capacitors -->
<line x1="60" y1="120" x2="90" y2="120" stroke="#a78bfa" stroke-width="2"/>
<line x1="90" y1="110" x2="90" y2="130" stroke="#a78bfa" stroke-width="3"/>
<line x1="97" y1="110" x2="97" y2="130" stroke="#a78bfa" stroke-width="3"/>
<text x="93" y="103" text-anchor="middle" fill="#a78bfa" font-size="7">Cin</text>
<line x1="97" y1="120" x2="200" y2="120" stroke="#a78bfa" stroke-width="2"/>
<line x1="200" y1="120" x2="265" y2="120" stroke="#a78bfa" stroke-width="2"/>
<text x="45" y="124" fill="#ec4899" font-size="9" font-weight="bold">Vin</text>
<line x1="58" y1="120" x2="60" y2="120" stroke="#ec4899" stroke-width="2"/>

<!-- Source bypass Rs -->
<line x1="320" y1="150" x2="350" y2="150" stroke="#a78bfa" stroke-width="2"/>
<rect x="350" y="140" width="22" height="40" rx="3" fill="${SRF}" stroke="#a78bfa" stroke-width="2"/>
<text x="361" y="158" text-anchor="middle" fill="#a78bfa" font-size="7">RS</text>
<text x="361" y="168" text-anchor="middle" fill="#a78bfa" font-size="7">1kΩ</text>
<line x1="372" y1="180" x2="200" y2="185" stroke="#64748b" stroke-width="2"/>
<line x1="290" y1="165" x2="372" y2="180" stroke="#64748b" stroke-width="2"/>

<!-- Vout -->
<line x1="290" y1="105" x2="450" y2="105" stroke="#38bdf8" stroke-width="1.5"/>
<circle cx="450" cy="105" r="5" fill="#38bdf8"/>
<text x="462" y="109" fill="#38bdf8" font-size="11" font-weight="bold">Vout</text>

<text x="15" y="222" fill="#64748b" font-size="8">Av = –gm×RD  •  VGS = VG – VS  •  ID = k(VGS–Vth)²/2  •  Phase: 180° inversion</text>
`);

// 4. Op-Amp Differentiator ──────────────────────────────────
const OPAMP_DIFF = svg(520,215,`
${bg(520,215)}
<text x="260" y="27" text-anchor="middle" fill="#94a3b8" font-size="11">Op-Amp Differentiator Circuit (Active RC)</text>

<!-- Vin source -->
<circle cx="45" cy="110" r="18" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="45" y="106" text-anchor="middle" fill="#f59e0b" font-size="9">Vin(t)</text>

<!-- Input Capacitor C (series) -->
<line x1="63" y1="100" x2="90" y2="100" stroke="#a78bfa" stroke-width="2"/>
<line x1="90" y1="88" x2="90" y2="112" stroke="#a78bfa" stroke-width="3"/>
<line x1="98" y1="88" x2="98" y2="112" stroke="#a78bfa" stroke-width="3"/>
<text x="94" y="80" text-anchor="middle" fill="#a78bfa" font-size="9">C=10μF</text>
<line x1="98" y1="100" x2="200" y2="100" stroke="#a78bfa" stroke-width="2"/>

<!-- Op-Amp -->
<polygon points="200,70 200,150 285,110" fill="${BG}" stroke="#38bdf8" stroke-width="2.5"/>
<text x="218" y="95" fill="#ef4444" font-size="16" font-weight="bold">–</text>
<text x="218" y="135" fill="#10b981" font-size="16" font-weight="bold">+</text>
<text x="232" y="113" fill="#38bdf8" font-size="8">LM741</text>

<!-- Non-inv to GND -->
<line x1="200" y1="134" x2="178" y2="134" stroke="#10b981" stroke-width="2"/>
<line x1="178" y1="134" x2="178" y2="175" stroke="#10b981" stroke-width="2"/>
<line x1="163" y1="175" x2="193" y2="175" stroke="#10b981" stroke-width="2.5"/>
<line x1="167" y1="181" x2="189" y2="181" stroke="#10b981" stroke-width="1.5"/>
<text x="178" y="196" text-anchor="middle" fill="#10b981" font-size="8">GND</text>

<!-- Feedback Rf resistor -->
<line x1="188" y1="100" x2="188" y2="48" stroke="#ec4899" stroke-width="2"/>
<line x1="188" y1="48" x2="310" y2="48" stroke="#ec4899" stroke-width="2"/>
<rect x="215" y="39" width="55" height="18" rx="3" fill="${SRF}" stroke="#ec4899" stroke-width="2"/>
<text x="243" y="52" text-anchor="middle" fill="#ec4899" font-size="9">Rf=10kΩ</text>
<line x1="310" y1="48" x2="310" y2="110" stroke="#ec4899" stroke-width="2"/>
<circle cx="310" cy="110" r="3" fill="#ec4899"/>

<!-- Vout -->
<line x1="285" y1="110" x2="420" y2="110" stroke="#38bdf8" stroke-width="2"/>
<circle cx="420" cy="110" r="5" fill="#38bdf8"/>
<text x="432" y="114" fill="#38bdf8" font-size="11" font-weight="bold">Vout</text>

<!-- Formula box -->
<rect x="15" y="195" width="490" height="16" rx="4" fill="#090d16" stroke="#334155" stroke-width="1"/>
<text x="20" y="206" fill="#64748b" font-size="9">Vout = –Rf×C × dVin/dt  •  Square wave in → Triangle wave output  •  Sine in → –Cosine out</text>
`);

// 5. Wheatstone Bridge ─────────────────────────────────────
const WHEATSTONE = svg(520,230,`
${bg(520,230)}
<text x="260" y="27" text-anchor="middle" fill="#94a3b8" font-size="11">Wheatstone Bridge — Resistance Measurement</text>

<!-- Vex supply -->
<line x1="200" y1="38" x2="200" y2="55" stroke="#ef4444" stroke-width="2"/>
<text x="200" y="35" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="bold">Vex=5V</text>
<line x1="320" y1="38" x2="320" y2="55" stroke="#64748b" stroke-width="2"/>
<text x="320" y="35" text-anchor="middle" fill="#64748b" font-size="9">GND</text>

<!-- R1 top-left -->
<line x1="200" y1="55" x2="200" y2="78" stroke="#f59e0b" stroke-width="2"/>
<rect x="183" y="78" width="34" height="28" rx="3" fill="${SRF}" stroke="#f59e0b" stroke-width="2"/>
<text x="200" y="89" text-anchor="middle" fill="#f59e0b" font-size="8">R1</text>
<text x="200" y="100" text-anchor="middle" fill="#f59e0b" font-size="7">1kΩ</text>
<line x1="200" y1="106" x2="200" y2="120" stroke="#f59e0b" stroke-width="2"/>
<circle cx="200" cy="120" r="4" fill="#f59e0b"/>
<line x1="200" y1="120" x2="165" y2="120" stroke="#f59e0b" stroke-width="2"/>

<!-- R3 bottom-left -->
<line x1="165" y1="120" x2="140" y2="120" stroke="#10b981" stroke-width="2"/>
<line x1="140" y1="120" x2="140" y2="138" stroke="#10b981" stroke-width="2"/>
<rect x="123" y="138" width="34" height="28" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="140" y="149" text-anchor="middle" fill="#10b981" font-size="8">R3</text>
<text x="140" y="160" text-anchor="middle" fill="#10b981" font-size="7">1kΩ</text>
<line x1="140" y1="166" x2="140" y2="185" stroke="#10b981" stroke-width="2"/>
<line x1="140" y1="185" x2="320" y2="185" stroke="#64748b" stroke-width="2"/>
<line x1="320" y1="55" x2="320" y2="185" stroke="#64748b" stroke-width="2"/>

<!-- R2 top-right -->
<line x1="200" y1="55" x2="260" y2="55" stroke="#a78bfa" stroke-width="2"/>
<line x1="260" y1="55" x2="260" y2="78" stroke="#a78bfa" stroke-width="2"/>
<rect x="243" y="78" width="34" height="28" rx="3" fill="${SRF}" stroke="#a78bfa" stroke-width="2"/>
<text x="260" y="89" text-anchor="middle" fill="#a78bfa" font-size="8">R2</text>
<text x="260" y="100" text-anchor="middle" fill="#a78bfa" font-size="7">1kΩ</text>
<line x1="260" y1="106" x2="260" y2="120" stroke="#a78bfa" stroke-width="2"/>
<circle cx="260" cy="120" r="4" fill="#a78bfa"/>

<!-- Rx unknown bottom-right -->
<line x1="260" y1="120" x2="290" y2="120" stroke="#ec4899" stroke-width="2"/>
<line x1="290" y1="120" x2="290" y2="138" stroke="#ec4899" stroke-width="2"/>
<rect x="273" y="138" width="34" height="28" rx="3" fill="${SRF}" stroke="#ec4899" stroke-width="2"/>
<text x="290" y="149" text-anchor="middle" fill="#ec4899" font-size="8">Rx</text>
<text x="290" y="160" text-anchor="middle" fill="#ec4899" font-size="7">Unknown</text>
<line x1="290" y1="166" x2="290" y2="185" stroke="#ec4899" stroke-width="2"/>

<!-- Galvanometer between midpoints -->
<line x1="200" y1="120" x2="200" y2="140" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3"/>
<line x1="200" y1="140" x2="260" y2="140" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3"/>
<line x1="260" y1="120" x2="260" y2="140" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3"/>
<circle cx="230" cy="140" r="12" fill="${SRF}" stroke="#38bdf8" stroke-width="2"/>
<text x="230" y="144" text-anchor="middle" fill="#38bdf8" font-size="9" font-weight="bold">G</text>
<text x="230" y="170" text-anchor="middle" fill="#38bdf8" font-size="8">Galvanometer</text>

<text x="15" y="218" fill="#64748b" font-size="9">Balance: R1/R3 = R2/Rx → Rx = R2×R3/R1  •  At balance: Vg=0, no current through G</text>
`);

// 6. 555 Timer Astable Circuit ─────────────────────────────
const TIMER_555 = svg(520,235,`
${bg(520,235)}
<text x="260" y="27" text-anchor="middle" fill="#94a3b8" font-size="11">555 Timer IC — Astable Multivibrator (Square Wave Generator)</text>

<!-- VCC -->
<line x1="210" y1="35" x2="210" y2="50" stroke="#ef4444" stroke-width="2"/>
<text x="210" y="32" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="bold">+VCC (9V)</text>

<!-- 555 IC block -->
<rect x="155" y="55" width="140" height="135" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="2.5"/>
<text x="225" y="80" text-anchor="middle" fill="#a78bfa" font-size="13" font-weight="bold">NE555</text>
<text x="225" y="95" text-anchor="middle" fill="#94a3b8" font-size="9">ASTABLE MODE</text>

<!-- Pin labels inside IC -->
<text x="163" y="112" fill="#64748b" font-size="8">GND(1)</text>
<text x="163" y="128" fill="#64748b" font-size="8">TRG(2)</text>
<text x="163" y="144" fill="#64748b" font-size="8">OUT(3)</text>
<text x="163" y="160" fill="#64748b" font-size="8">RST(4)</text>
<text x="265" y="112" fill="#64748b" font-size="8">(8)VCC</text>
<text x="265" y="128" fill="#64748b" font-size="8">(7)DIS</text>
<text x="265" y="144" fill="#64748b" font-size="8">(6)THR</text>
<text x="265" y="160" fill="#64748b" font-size="8">(5)CV</text>

<!-- RA resistor -->
<line x1="295" y1="50" x2="295" y2="68" stroke="#f59e0b" stroke-width="2"/>
<rect x="280" y="68" width="30" height="22" rx="3" fill="${SRF}" stroke="#f59e0b" stroke-width="2"/>
<text x="295" y="82" text-anchor="middle" fill="#f59e0b" font-size="8">RA=4.7kΩ</text>
<line x1="295" y1="90" x2="295" y2="125" stroke="#f59e0b" stroke-width="2"/>
<circle cx="295" cy="125" r="3" fill="#f59e0b"/>

<!-- RB resistor -->
<rect x="280" y="125" width="30" height="22" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="295" y="139" text-anchor="middle" fill="#10b981" font-size="8">RB=4.7kΩ</text>
<line x1="295" y1="147" x2="295" y2="160" stroke="#10b981" stroke-width="2"/>
<circle cx="295" cy="160" r="3" fill="#10b981"/>

<!-- Timing Capacitor C -->
<line x1="295" y1="160" x2="295" y2="175" stroke="#ec4899" stroke-width="2"/>
<line x1="280" y1="175" x2="310" y2="175" stroke="#ec4899" stroke-width="3"/>
<line x1="280" y1="183" x2="310" y2="183" stroke="#ec4899" stroke-width="3"/>
<text x="318" y="180" fill="#ec4899" font-size="8">C=10μF</text>
<line x1="295" y1="183" x2="295" y2="200" stroke="#ec4899" stroke-width="2"/>

<!-- GND rail -->
<line x1="130" y1="200" x2="295" y2="200" stroke="#64748b" stroke-width="2"/>
<line x1="115" y1="200" x2="145" y2="200" stroke="#64748b" stroke-width="2.5"/>
<line x1="120" y1="206" x2="140" y2="206" stroke="#64748b" stroke-width="1.5"/>
<text x="130" y="220" text-anchor="middle" fill="#64748b" font-size="8">GND</text>

<!-- Output square wave sketch -->
<line x1="155" y1="144" x2="60" y2="144" stroke="#38bdf8" stroke-width="2"/>
<text x="50" y="144" text-anchor="end" fill="#38bdf8" font-size="9" font-weight="bold">OUT</text>
<!-- Wave -->
<polyline points="15,185 15,165 35,165 35,185 55,185 55,165 75,165 75,185 95,185 95,165 115,165 115,185 135,185" 
  fill="none" stroke="#38bdf8" stroke-width="2"/>

<text x="15" y="222" fill="#64748b" font-size="8">f = 1.44/((RA+2RB)×C) ≈ 7.2Hz  •  Duty = (RA+RB)/(RA+2RB)×100%  •  Ton=(RA+RB)×0.693C</text>
`);

// 7. 3-Phase Star (Y) Connected Load ───────────────────────
const THREE_PHASE = svg(520,235,`
${bg(520,235)}
<text x="260" y="27" text-anchor="middle" fill="#94a3b8" font-size="11">3-Phase Star (Y) Connected Load — Power System</text>

<!-- Neutral point N -->
<circle cx="260" cy="130" r="8" fill="#334155" stroke="#64748b" stroke-width="2"/>
<text x="260" y="133" text-anchor="middle" fill="#94a3b8" font-size="8">N</text>

<!-- Phase R (Red) -->
<line x1="90" y1="65" x2="252" y2="124" stroke="#ef4444" stroke-width="2.5"/>
<rect x="100" y="55" width="55" height="20" rx="3" fill="${SRF}" stroke="#ef4444" stroke-width="2"/>
<text x="128" y="69" text-anchor="middle" fill="#ef4444" font-size="9">ZR = 10∠30°Ω</text>
<circle cx="90" cy="65" r="20" fill="none" stroke="#ef4444" stroke-width="2"/>
<text x="90" y="60" text-anchor="middle" fill="#ef4444" font-size="8">VR</text>
<text x="90" y="72" text-anchor="middle" fill="#ef4444" font-size="7">230V 0°</text>

<!-- Phase Y (Yellow) -->
<line x1="90" y1="160" x2="252" y2="138" stroke="#f59e0b" stroke-width="2.5"/>
<rect x="100" y="153" width="55" height="20" rx="3" fill="${SRF}" stroke="#f59e0b" stroke-width="2"/>
<text x="128" y="167" text-anchor="middle" fill="#f59e0b" font-size="9">ZY = 10∠30°Ω</text>
<circle cx="90" cy="172" r="20" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="90" y="167" text-anchor="middle" fill="#f59e0b" font-size="8">VY</text>
<text x="90" y="179" text-anchor="middle" fill="#f59e0b" font-size="7">230V –120°</text>

<!-- Phase B (Blue) -->
<line x1="260" y1="50" x2="260" y2="122" stroke="#38bdf8" stroke-width="2.5"/>
<rect x="230" y="38" width="55" height="20" rx="3" fill="${SRF}" stroke="#38bdf8" stroke-width="2"/>
<text x="258" y="52" text-anchor="middle" fill="#38bdf8" font-size="9">ZB = 10∠30°Ω</text>
<circle cx="260" cy="28" r="18" fill="none" stroke="#38bdf8" stroke-width="2"/>
<text x="260" y="23" text-anchor="middle" fill="#38bdf8" font-size="7">VB 230V</text>
<text x="260" y="34" text-anchor="middle" fill="#38bdf8" font-size="7">+120°</text>

<!-- Line voltages labels -->
<text x="420" y="80" fill="#10b981" font-size="10" font-weight="bold">VL = √3 × Vph</text>
<text x="420" y="95" fill="#10b981" font-size="9">   = √3 × 230</text>
<text x="420" y="110" fill="#10b981" font-size="9">   = 398.4V</text>
<line x1="410" y1="82" x2="418" y2="82" stroke="#10b981" stroke-width="1.5" stroke-dasharray="3"/>

<!-- Neutral wire -->
<line x1="260" y1="138" x2="260" y2="200" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4"/>
<text x="275" y="195" fill="#94a3b8" font-size="8">Neutral Wire</text>

<!-- Power formula -->
<rect x="330" y="130" width="175" height="65" rx="6" fill="#090d16" stroke="#334155" stroke-width="1"/>
<text x="418" y="148" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="bold">3-Phase Power</text>
<text x="338" y="163" fill="#10b981" font-size="9">P = √3 × VL × IL × cosφ</text>
<text x="338" y="177" fill="#10b981" font-size="9">P = 3 × Vph × Iph × cosφ</text>
<text x="338" y="191" fill="#f59e0b" font-size="8">IL = Iph (Star connection)</text>

<text x="15" y="225" fill="#64748b" font-size="8">Balanced Star: Vph=230V, VL=398V, IL=Iph=Vph/|Z|=23A, P=3×Vph×Iph×cosφ</text>
`);

// 8. Colpitts LC Oscillator ─────────────────────────────────
const COLPITTS = svg(520,225,`
${bg(520,225)}
<text x="260" y="27" text-anchor="middle" fill="#94a3b8" font-size="11">Colpitts Oscillator — LC Tank Circuit with BJT</text>

<!-- VCC -->
<line x1="290" y1="35" x2="290" y2="48" stroke="#ef4444" stroke-width="2"/>
<text x="290" y="32" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="bold">+VCC(12V)</text>

<!-- RFC Choke -->
<path d="M 290 48 Q 298 55 290 62 Q 282 69 290 76" fill="none" stroke="#10b981" stroke-width="2.5"/>
<text x="305" y="63" fill="#10b981" font-size="8">RFC</text>
<line x1="290" y1="76" x2="290" y2="88" stroke="#10b981" stroke-width="2"/>

<!-- BJT NPN -->
<line x1="290" y1="88" x2="290" y2="148" stroke="#38bdf8" stroke-width="3"/>
<line x1="290" y1="100" x2="320" y2="80" stroke="#38bdf8" stroke-width="2"/>
<polygon points="312,76 326,72 322,85" fill="#38bdf8"/>
<line x1="290" y1="128" x2="320" y2="150" stroke="#38bdf8" stroke-width="2"/>
<line x1="260" y1="114" x2="290" y2="114" stroke="#38bdf8" stroke-width="2"/>
<text x="258" y="113" fill="#38bdf8" font-size="8">B</text>
<text x="325" y="78" fill="#38bdf8" font-size="8">C</text>
<text x="325" y="153" fill="#38bdf8" font-size="8">E</text>

<!-- Inductor L (tank) -->
<line x1="370" y1="48" x2="370" y2="62" stroke="#a78bfa" stroke-width="2"/>
<path d="M 370 62 Q 380 70 370 78 Q 360 86 370 94 Q 380 102 370 110" fill="none" stroke="#a78bfa" stroke-width="2.5"/>
<line x1="370" y1="110" x2="370" y2="124" stroke="#a78bfa" stroke-width="2"/>
<text x="385" y="88" fill="#a78bfa" font-size="9">L=10μH</text>

<!-- C1 -->
<line x1="330" y1="80" x2="370" y2="48" stroke="#ec4899" stroke-width="2"/>
<line x1="400" y1="110" x2="430" y2="110" stroke="#ec4899" stroke-width="2"/>
<line x1="430" y1="97" x2="430" y2="123" stroke="#ec4899" stroke-width="3"/>
<line x1="438" y1="97" x2="438" y2="123" stroke="#ec4899" stroke-width="3"/>
<text x="448" y="113" fill="#ec4899" font-size="8">C1</text>
<text x="448" y="123" fill="#ec4899" font-size="7">100pF</text>

<!-- C2 -->
<line x1="400" y1="155" x2="430" y2="155" stroke="#f59e0b" stroke-width="2"/>
<line x1="430" y1="143" x2="430" y2="167" stroke="#f59e0b" stroke-width="3"/>
<line x1="438" y1="143" x2="438" y2="167" stroke="#f59e0b" stroke-width="3"/>
<text x="448" y="158" fill="#f59e0b" font-size="8">C2</text>
<text x="448" y="168" fill="#f59e0b" font-size="7">100pF</text>
<line x1="330" y1="150" x2="400" y2="155" stroke="#f59e0b" stroke-width="2"/>

<!-- Feedback tap between C1 and C2 -->
<line x1="438" y1="123" x2="438" y2="143" stroke="#64748b" stroke-width="2"/>
<line x1="438" y1="133" x2="260" y2="114" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4"/>
<text x="350" y="110" fill="#64748b" font-size="8">Feedback tap</text>

<!-- GND -->
<line x1="290" y1="148" x2="370" y2="165" stroke="#64748b" stroke-width="2"/>
<line x1="370" y1="124" x2="370" y2="165" stroke="#a78bfa" stroke-width="2"/>
<line x1="355" y1="165" x2="385" y2="165" stroke="#64748b" stroke-width="2.5"/>
<line x1="360" y1="171" x2="380" y2="171" stroke="#64748b" stroke-width="1.5"/>
<text x="370" y="186" text-anchor="middle" fill="#64748b" font-size="8">GND</text>

<!-- Vout at collector -->
<circle cx="75" cy="80" r="5" fill="#38bdf8"/>
<line x1="80" y1="80" x2="320" y2="80" stroke="#38bdf8" stroke-width="1.5"/>
<text x="30" y="84" fill="#38bdf8" font-size="11" font-weight="bold">Vout</text>

<text x="15" y="218" fill="#64748b" font-size="8">f₀ = 1/(2π√(L×Ceq))  •  Ceq = C1×C2/(C1+C2) = 50pF  •  f₀ ≈ 7.12MHz  •  Barkhausen: β×Av≥1</text>
`);

/* ════════════════════════════════════════════════════════════
   QUESTION BANK — 3 questions per circuit diagram
   ════════════════════════════════════════════════════════════ */

const NEW_QUESTIONS = [

  // ── Zener Regulator ────────────────────────────────────────
  { question_text: 'In the Zener voltage regulator circuit above with Vin=15V, Rs=470Ω, Vz=5.1V, what is the current through Rs (IRS)?',
    options: ['21.1 mA', '5.1 mA', '10.6 mA', '15 mA'],
    correct_answer: '21.1 mA',
    topic: 'Power Electronics', concept: 'Zener Regulator Current',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'ECE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: ZENER_REG },

  { question_text: 'In the Zener regulator circuit shown above, what is the purpose of the series resistor Rs=470Ω?',
    options: ['Limits current to protect the Zener diode from excess power', 'Increases output voltage', 'Acts as a filter', 'Provides feedback'],
    correct_answer: 'Limits current to protect the Zener diode from excess power',
    topic: 'Power Electronics', concept: 'Zener Regulator Series Resistor',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: ZENER_REG },

  { question_text: 'In the Zener regulator above, if load RL is removed (open circuit), what happens to Vout?',
    options: ['Vout remains at 5.1V (Zener clamps it)', 'Vout rises to 15V (Vin)', 'Vout drops to 0V', 'Vout becomes undefined'],
    correct_answer: 'Vout remains at 5.1V (Zener clamps it)',
    topic: 'Power Electronics', concept: 'Zener Regulation at No Load',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: ZENER_REG },

  // ── RC Low-Pass Filter ──────────────────────────────────────
  { question_text: 'For the RC low-pass filter shown above with R=1kΩ and C=100nF, calculate the cut-off frequency fc.',
    options: ['1592 Hz', '159.2 Hz', '15920 Hz', '1000 Hz'],
    correct_answer: '1592 Hz',
    topic: 'Signals & Systems & DSP', concept: 'RC Filter Cut-off Frequency',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: RC_LPF },

  { question_text: 'In the RC filter circuit above, at the cut-off frequency fc, the output voltage Vout compared to input Vin is:',
    options: ['Vout = Vin/√2 ≈ 0.707 × Vin (–3dB)', 'Vout = Vin (0dB)', 'Vout = 0', 'Vout = 2 × Vin'],
    correct_answer: 'Vout = Vin/√2 ≈ 0.707 × Vin (–3dB)',
    topic: 'Signals & Systems & DSP', concept: 'RC Filter –3dB Point',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: RC_LPF },

  { question_text: 'The RC low-pass filter above attenuates high-frequency signals at what roll-off rate per decade?',
    options: ['–20 dB/decade (1st order)', '–40 dB/decade', '–60 dB/decade', '0 dB/decade (flat)'],
    correct_answer: '–20 dB/decade (1st order)',
    topic: 'Signals & Systems & DSP', concept: 'RC Filter Roll-off Rate',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: RC_LPF },

  // ── MOSFET Common-Source Amplifier ──────────────────────────
  { question_text: 'In the N-channel MOSFET common-source amplifier above, by what angle is the output signal Vout phase-shifted relative to the input Vin?',
    options: ['180° (phase inversion)', '0° (in-phase)', '90° leading', '90° lagging'],
    correct_answer: '180° (phase inversion)',
    topic: 'Analog & Op-Amp Circuits', concept: 'MOSFET Amplifier Phase Shift',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: MOSFET_AMP },

  { question_text: 'In the MOSFET amplifier schematic above, what is the purpose of the two bias resistors R1=1MΩ and R2=220kΩ connected to the gate?',
    options: ['Establish a stable VGS bias point (Q-point) via voltage divider', 'Provide AC coupling', 'Set the drain current directly', 'Block DC at the input'],
    correct_answer: 'Establish a stable VGS bias point (Q-point) via voltage divider',
    topic: 'Analog & Op-Amp Circuits', concept: 'MOSFET Gate Bias Network',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: MOSFET_AMP },

  { question_text: 'In the MOSFET common-source amplifier above, if transconductance gm=2mA/V and RD=4.7kΩ, what is the voltage gain |Av|?',
    options: ['9.4', '4.7', '2.35', '1'],
    correct_answer: '9.4',
    topic: 'Analog & Op-Amp Circuits', concept: 'MOSFET Voltage Gain',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'ECE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: MOSFET_AMP },

  // ── Op-Amp Differentiator ───────────────────────────────────
  { question_text: 'In the Op-Amp differentiator circuit above, what is the output Vout if the input is a constant DC voltage Vin = 3V?',
    options: ['0V (derivative of constant = 0)', '–3V', '+30V', '3V'],
    correct_answer: '0V (derivative of constant = 0)',
    topic: 'Analog & Op-Amp Circuits', concept: 'Op-Amp Differentiator DC Input',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: OPAMP_DIFF },

  { question_text: 'For the Op-Amp differentiator above with Rf=10kΩ and C=10μF, if Vin is a 100Hz square wave with amplitude 1V, the output is:',
    options: ['Narrow positive and negative spike pulses (impulse train)', 'A triangle wave', 'A sine wave', 'Constant 10V'],
    correct_answer: 'Narrow positive and negative spike pulses (impulse train)',
    topic: 'Analog & Op-Amp Circuits', concept: 'Op-Amp Differentiator Square Wave Response',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: OPAMP_DIFF },

  { question_text: 'The Op-Amp differentiator in the circuit above is prone to oscillation at high frequencies. What component can be added in series with C to stabilize it?',
    options: ['A small series resistor Rin in series with C', 'A large inductor in parallel', 'A second capacitor in parallel with Rf', 'No fix is possible'],
    correct_answer: 'A small series resistor Rin in series with C',
    topic: 'Analog & Op-Amp Circuits', concept: 'Op-Amp Differentiator Stabilization',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'ECE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: OPAMP_DIFF },

  // ── Wheatstone Bridge ───────────────────────────────────────
  { question_text: 'In the Wheatstone bridge above with R1=R2=R3=1kΩ and balance condition (Vg=0), what is the value of Rx?',
    options: ['1 kΩ', '500 Ω', '2 kΩ', '250 Ω'],
    correct_answer: '1 kΩ',
    topic: 'Circuit Analysis & Network Theory', concept: 'Wheatstone Bridge Balance',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: WHEATSTONE },

  { question_text: 'In the Wheatstone bridge circuit shown above, when is the galvanometer G reading zero (null condition)?',
    options: ['R1/R3 = R2/Rx (bridge balanced)', 'R1 = R2 = R3 = Rx = 0', 'All resistors are equal only', 'When Vex = 0'],
    correct_answer: 'R1/R3 = R2/Rx (bridge balanced)',
    topic: 'Circuit Analysis & Network Theory', concept: 'Wheatstone Bridge Null Condition',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: WHEATSTONE },

  { question_text: 'A Wheatstone bridge (as shown) is used to measure a strain gauge resistance Rx that changes from 1kΩ to 1.05kΩ. The bridge R1=R2=R3=1kΩ. Calculate the output voltage Vg with Vex=5V.',
    options: ['≈ 62.5 mV (bridge unbalanced)', '0 V (still balanced)', '250 mV', '5 V'],
    correct_answer: '≈ 62.5 mV (bridge unbalanced)',
    topic: 'Circuit Analysis & Network Theory', concept: 'Wheatstone Bridge Sensitivity',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: WHEATSTONE },

  // ── 555 Timer Astable ───────────────────────────────────────
  { question_text: 'In the 555 timer astable circuit above with RA=RB=4.7kΩ and C=10μF, what is the output frequency f?',
    options: ['≈ 7.2 Hz', '≈ 72 Hz', '≈ 1 kHz', '≈ 100 Hz'],
    correct_answer: '≈ 7.2 Hz',
    topic: 'Digital Electronics', concept: '555 Timer Astable Frequency',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'ECE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: TIMER_555 },

  { question_text: 'From the 555 timer circuit shown, what is the duty cycle D when RA=4.7kΩ and RB=4.7kΩ?',
    options: ['75% (Ton > Toff since RA charges with RB)', '50%', '25%', '100%'],
    correct_answer: '75% (Ton > Toff since RA charges with RB)',
    topic: 'Digital Electronics', concept: '555 Timer Duty Cycle',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: TIMER_555 },

  { question_text: 'In the 555 astable circuit above, what is the function of pin 7 (DISCHARGE) connected at the junction of RA and RB?',
    options: ['It discharges C through RB when output is LOW', 'It charges C through RA only', 'It resets the oscillator', 'It connects to VCC'],
    correct_answer: 'It discharges C through RB when output is LOW',
    topic: 'Digital Electronics', concept: '555 Timer Discharge Pin Function',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: TIMER_555 },

  // ── 3-Phase Star Load ───────────────────────────────────────
  { question_text: 'In the 3-phase star (Y) connected system above with phase voltage Vph=230V, what is the line voltage VL?',
    options: ['398.4V (√3 × 230)', '230V', '460V', '115V'],
    correct_answer: '398.4V (√3 × 230)',
    topic: 'Power Electronics', concept: '3-Phase Star Line Voltage',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: THREE_PHASE },

  { question_text: 'In the 3-phase star circuit above, with balanced impedance |Z|=10Ω per phase and Vph=230V, calculate the phase current Iph.',
    options: ['23A', '39.8A', '11.5A', '46A'],
    correct_answer: '23A',
    topic: 'Power Electronics', concept: '3-Phase Star Phase Current',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: THREE_PHASE },

  { question_text: 'In a balanced 3-phase star system (as shown above), what is the current through the neutral wire?',
    options: ['Zero (balanced 3-phase currents cancel)', '23A (same as phase current)', '39.8A (line current)', 'Depends on load'],
    correct_answer: 'Zero (balanced 3-phase currents cancel)',
    topic: 'Power Electronics', concept: '3-Phase Neutral Current',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: THREE_PHASE },

  // ── Colpitts Oscillator ─────────────────────────────────────
  { question_text: 'In the Colpitts oscillator above with L=10μH, C1=C2=100pF, calculate the equivalent capacitance Ceq and oscillation frequency f₀.',
    options: ['Ceq=50pF, f₀≈7.12MHz', 'Ceq=200pF, f₀≈3.56MHz', 'Ceq=100pF, f₀≈5.03MHz', 'Ceq=50pF, f₀≈14MHz'],
    correct_answer: 'Ceq=50pF, f₀≈7.12MHz',
    topic: 'Analog & Op-Amp Circuits', concept: 'Colpitts Oscillator Frequency',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'ECE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: COLPITTS },

  { question_text: 'In the Colpitts oscillator circuit above, feedback is taken from the voltage divider formed by:',
    options: ['C1 and C2 (capacitive voltage divider tap)', 'L and C1 only', 'The inductor L tap', 'The transistor base directly'],
    correct_answer: 'C1 and C2 (capacitive voltage divider tap)',
    topic: 'Analog & Op-Amp Circuits', concept: 'Colpitts Feedback Network',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: COLPITTS },

  { question_text: 'What is the Barkhausen criterion that must be satisfied by the Colpitts oscillator circuit shown above for sustained oscillations?',
    options: ['Loop gain |Aβ| = 1 and total loop phase shift = 0° (or 360°)', 'Loop gain > 10', 'Phase shift = 90°', 'C1 = C2 only'],
    correct_answer: 'Loop gain |Aβ| = 1 and total loop phase shift = 0° (or 360°)',
    topic: 'Analog & Op-Amp Circuits', concept: 'Barkhausen Criterion for Oscillation',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: COLPITTS },
];

/* ════════════════════════════════════════════════════════════
   SEED FUNCTION
   ════════════════════════════════════════════════════════════ */
async function seedMore() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB...');

    // Re-use (or re-find) the ECE/EEE Circuit Analysis exam
    let exam = await Exam.findOne({ title: 'ECE & EEE Circuit Analysis Technical Exam' });
    if (!exam) {
      exam = await Exam.create({
        title: 'ECE & EEE Circuit Analysis Technical Exam',
        description: 'Circuit-image-based MCQs for ECE & EEE',
        duration: 90, total_questions: 0,
        difficulty_distribution: { easy: 0, medium: 0, hard: 0 },
        per_question_time: { easy: 45, medium: 60, hard: 90 },
        questions: [], assigned_students: []
      });
    }

    const docs = NEW_QUESTIONS.map(q => ({ ...q, examId: exam._id }));
    const inserted = await Question.insertMany(docs);
    console.log(`🎉 Seeded ${inserted.length} new circuit-image questions!`);

    exam.questions.push(...inserted.map(q => q._id));
    exam.total_questions = exam.questions.length;
    await exam.save();
    console.log(`✔ Exam now has ${exam.questions.length} total questions.`);

    console.log('\n📊 New circuit diagrams added:');
    console.log('  • Zener Voltage Regulator     → 3 questions (ECE)');
    console.log('  • RC Low-Pass Filter           → 3 questions (ECE)');
    console.log('  • MOSFET Common-Source Amp     → 3 questions (ECE)');
    console.log('  • Op-Amp Differentiator        → 3 questions (ECE)');
    console.log('  • Wheatstone Bridge            → 3 questions (EEE)');
    console.log('  • 555 Timer Astable            → 3 questions (ECE)');
    console.log('  • 3-Phase Star Load            → 3 questions (EEE)');
    console.log('  • Colpitts LC Oscillator       → 3 questions (ECE)');
    console.log('\n  Total new: 24 questions  •  8 new circuit schematics');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seedMore();
