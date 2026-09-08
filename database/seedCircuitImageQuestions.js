/**
 * seedCircuitImageQuestions.js
 * Seeds ECE & EEE MCQ and circuit-analysis questions WITH embedded SVG circuit diagrams.
 * Covers: Op-Amp Circuits, BJT Biasing, RLC Circuits, Power Electronics, 
 *         Digital Logic Gates, Half-Wave Rectifier, Voltage Divider, Oscilloscopes
 */

const path = require('path');
module.paths.push(path.join(__dirname, '../backend/node_modules'));

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Question = require('../backend/models/Question');
const Exam     = require('../backend/models/Exam');

/* ────────────────────────────────────────────────────────────
   SVG CIRCUIT DIAGRAMS (Inline, no external dependencies)
   ──────────────────────────────────────────────────────────── */

const svg = (content) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 240" font-family="monospace">${content}</svg>`);

const BG   = '#0f172a';
const SRF  = '#1e293b';
const BDR  = '#334155';

// ── 1. Op-Amp Inverting Amplifier ───────────────────────────
const OPAMP_INV = svg(`
<rect width="520" height="240" fill="${BG}"/>
<rect x="10" y="10" width="500" height="220" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>
<text x="260" y="30" text-anchor="middle" fill="#94a3b8" font-size="11">Op-Amp Inverting Amplifier</text>

<!-- Vin source -->
<circle cx="50" cy="110" r="16" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="50" y="114" text-anchor="middle" fill="#f59e0b" font-size="10">Vin</text>

<!-- Rin resistor -->
<line x1="66" y1="110" x2="100" y2="110" stroke="#f59e0b" stroke-width="2"/>
<rect x="100" y="101" width="50" height="18" rx="3" fill="${SRF}" stroke="#f59e0b" stroke-width="2"/>
<text x="125" y="114" text-anchor="middle" fill="#f59e0b" font-size="9">Rin=10kΩ</text>
<line x1="150" y1="110" x2="200" y2="110" stroke="#f59e0b" stroke-width="2"/>

<!-- Op-Amp triangle -->
<polygon points="200,75 200,155 285,115" fill="${BG}" stroke="#38bdf8" stroke-width="2.5"/>
<text x="222" y="100" fill="#ef4444" font-size="16" font-weight="bold">–</text>
<text x="222" y="138" fill="#10b981" font-size="16" font-weight="bold">+</text>
<text x="230" y="117" fill="#38bdf8" font-size="9">UA741</text>

<!-- Non-inverting to GND -->
<line x1="200" y1="140" x2="180" y2="140" stroke="#10b981" stroke-width="2"/>
<line x1="180" y1="140" x2="180" y2="190" stroke="#10b981" stroke-width="2"/>
<line x1="165" y1="190" x2="195" y2="190" stroke="#10b981" stroke-width="2.5"/>
<line x1="170" y1="196" x2="190" y2="196" stroke="#10b981" stroke-width="1.5"/>
<line x1="175" y1="202" x2="185" y2="202" stroke="#10b981" stroke-width="1"/>
<text x="180" y="218" text-anchor="middle" fill="#10b981" font-size="9">GND</text>

<!-- Feedback Rf -->
<line x1="175" y1="110" x2="175" y2="55" stroke="#ec4899" stroke-width="2"/>
<line x1="175" y1="55" x2="310" y2="55" stroke="#ec4899" stroke-width="2"/>
<rect x="210" y="46" width="55" height="18" rx="3" fill="${SRF}" stroke="#ec4899" stroke-width="2"/>
<text x="237" y="58" text-anchor="middle" fill="#ec4899" font-size="9">Rf=100kΩ</text>
<line x1="310" y1="55" x2="310" y2="115" stroke="#ec4899" stroke-width="2"/>
<circle cx="310" cy="115" r="3" fill="#ec4899"/>

<!-- Vout -->
<line x1="285" y1="115" x2="420" y2="115" stroke="#38bdf8" stroke-width="2"/>
<circle cx="420" cy="115" r="5" fill="#38bdf8"/>
<text x="440" y="119" fill="#38bdf8" font-size="11" font-weight="bold">Vout</text>

<!-- Labels -->
<text x="50" y="230" fill="#64748b" font-size="9">Av = –Rf/Rin = –10  •  Vout = –10 × Vin</text>
`);

// ── 2. Half-Wave Rectifier ───────────────────────────────────
const HALF_WAVE_RECT = svg(`
<rect width="520" height="240" fill="${BG}"/>
<rect x="10" y="10" width="500" height="220" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>
<text x="260" y="28" text-anchor="middle" fill="#94a3b8" font-size="11">Half-Wave Rectifier Circuit</text>

<!-- AC Source -->
<circle cx="55" cy="130" r="20" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="55" y="126" text-anchor="middle" fill="#f59e0b" font-size="9">~AC</text>
<text x="55" y="138" text-anchor="middle" fill="#f59e0b" font-size="8">Vs</text>

<!-- Top wire -->
<line x1="75" y1="115" x2="170" y2="115" stroke="#a78bfa" stroke-width="2"/>

<!-- Diode D1 -->
<polygon points="170,104 170,126 205,115" fill="none" stroke="#a78bfa" stroke-width="2.5"/>
<line x1="205" y1="104" x2="205" y2="126" stroke="#a78bfa" stroke-width="2.5"/>
<line x1="205" y1="115" x2="260" y2="115" stroke="#a78bfa" stroke-width="2"/>
<text x="185" y="100" text-anchor="middle" fill="#a78bfa" font-size="10">D1 (1N4007)</text>

<!-- Load Resistor RL -->
<line x1="300" y1="90" x2="300" y2="115" stroke="#10b981" stroke-width="2"/>
<rect x="285" y="90" width="30" height="55" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="300" y="120" text-anchor="middle" fill="#10b981" font-size="8">RL</text>
<text x="300" y="130" text-anchor="middle" fill="#10b981" font-size="7">1kΩ</text>
<line x1="300" y1="145" x2="300" y2="165" stroke="#10b981" stroke-width="2"/>

<!-- Connections -->
<line x1="260" y1="115" x2="285" y2="90" stroke="#10b981" stroke-width="1" stroke-dasharray="2"/>
<line x1="260" y1="115" x2="285" y2="115" stroke="#10b981" stroke-width="2"/>

<!-- Output Vout -->
<circle cx="380" cy="115" r="5" fill="#38bdf8"/>
<line x1="300" y1="90" x2="380" y2="90" stroke="#38bdf8" stroke-width="1.5"/>
<line x1="380" y1="90" x2="380" y2="165" stroke="#38bdf8" stroke-width="1.5"/>
<text x="395" y="120" fill="#38bdf8" font-size="11" font-weight="bold">Vout</text>

<!-- Bottom return -->
<line x1="75" y1="145" x2="380" y2="165" stroke="#64748b" stroke-width="1.5"/>

<!-- Waveform boxes -->
<text x="50" y="230" fill="#64748b" font-size="9">Vout(avg) = Vm/π ≈ 0.318Vm  •  Only +ve half cycles pass  •  η≈40.6%</text>
`);

// ── 3. Voltage Divider / BJT Biasing ─────────────────────────
const BJT_BIAS = svg(`
<rect width="520" height="240" fill="${BG}"/>
<rect x="10" y="10" width="500" height="220" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>
<text x="260" y="28" text-anchor="middle" fill="#94a3b8" font-size="11">NPN BJT Voltage-Divider Bias Circuit</text>

<!-- VCC -->
<line x1="260" y1="38" x2="260" y2="55" stroke="#ef4444" stroke-width="2"/>
<text x="260" y="36" text-anchor="middle" fill="#ef4444" font-size="11" font-weight="bold">+VCC (12V)</text>

<!-- R1 -->
<rect x="245" y="55" width="30" height="40" rx="3" fill="${SRF}" stroke="#f59e0b" stroke-width="2"/>
<text x="260" y="71" text-anchor="middle" fill="#f59e0b" font-size="8">R1</text>
<text x="260" y="82" text-anchor="middle" fill="#f59e0b" font-size="8">47kΩ</text>
<line x1="260" y1="95" x2="260" y2="115" stroke="#f59e0b" stroke-width="2"/>
<circle cx="260" cy="115" r="3" fill="#f59e0b"/>

<!-- R2 -->
<rect x="245" y="130" width="30" height="40" rx="3" fill="${SRF}" stroke="#f59e0b" stroke-width="2"/>
<text x="260" y="146" text-anchor="middle" fill="#f59e0b" font-size="8">R2</text>
<text x="260" y="157" text-anchor="middle" fill="#f59e0b" font-size="8">10kΩ</text>
<line x1="260" y1="170" x2="260" y2="190" stroke="#f59e0b" stroke-width="2"/>
<line x1="245" y1="190" x2="275" y2="190" stroke="#f59e0b" stroke-width="2.5"/>
<line x1="250" y1="196" x2="270" y2="196" stroke="#f59e0b" stroke-width="1.5"/>
<text x="260" y="210" text-anchor="middle" fill="#f59e0b" font-size="8">GND</text>

<!-- BJT NPN -->
<line x1="260" y1="115" x2="310" y2="115" stroke="#38bdf8" stroke-width="2"/>
<line x1="310" y1="85" x2="310" y2="155" stroke="#38bdf8" stroke-width="3"/>
<line x1="310" y1="100" x2="350" y2="75" stroke="#38bdf8" stroke-width="2"/>
<polygon points="340,73 355,68 350,82" fill="#38bdf8"/>
<line x1="310" y1="130" x2="350" y2="155" stroke="#38bdf8" stroke-width="2"/>
<text x="290" y="113" fill="#38bdf8" font-size="9">B</text>
<text x="355" y="74" fill="#38bdf8" font-size="9">C</text>
<text x="355" y="158" fill="#38bdf8" font-size="9">E</text>

<!-- RC Collector resistor -->
<line x1="350" y1="55" x2="350" y2="75" stroke="#10b981" stroke-width="2"/>
<rect x="335" y="38" width="30" height="22" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="350" y="51" text-anchor="middle" fill="#10b981" font-size="8">RC=4.7kΩ</text>

<!-- RE Emitter -->
<line x1="350" y1="155" x2="350" y2="175" stroke="#a78bfa" stroke-width="2"/>
<rect x="335" y="175" width="30" height="18" rx="3" fill="${SRF}" stroke="#a78bfa" stroke-width="2"/>
<text x="350" y="187" text-anchor="middle" fill="#a78bfa" font-size="7">RE=1kΩ</text>
<line x1="350" y1="193" x2="350" y2="210" stroke="#a78bfa" stroke-width="2"/>

<!-- Vout at collector -->
<circle cx="430" cy="75" r="5" fill="#38bdf8"/>
<line x1="350" y1="75" x2="430" y2="75" stroke="#38bdf8" stroke-width="1.5"/>
<text x="445" y="79" fill="#38bdf8" font-size="10" font-weight="bold">Vout</text>

<text x="50" y="230" fill="#64748b" font-size="9">VB = VCC×R2/(R1+R2)  •  IC ≈ IE ≈ (VB–0.7)/RE  •  VCE = VCC–IC(RC+RE)</text>
`);

// ── 4. RLC Series Circuit ─────────────────────────────────────
const RLC_SERIES = svg(`
<rect width="520" height="240" fill="${BG}"/>
<rect x="10" y="10" width="500" height="220" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>
<text x="260" y="28" text-anchor="middle" fill="#94a3b8" font-size="11">RLC Series Resonant Circuit</text>

<!-- AC Source -->
<circle cx="55" cy="120" r="20" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="55" y="116" text-anchor="middle" fill="#f59e0b" font-size="9">Vs~</text>
<text x="55" y="128" text-anchor="middle" fill="#f59e0b" font-size="8">ω</text>

<!-- Top wire -->
<line x1="75" y1="103" x2="120" y2="103" stroke="#a78bfa" stroke-width="2"/>

<!-- Resistor R -->
<rect x="120" y="94" width="50" height="18" rx="3" fill="${SRF}" stroke="#a78bfa" stroke-width="2"/>
<text x="145" y="107" text-anchor="middle" fill="#a78bfa" font-size="9">R = 10Ω</text>
<line x1="170" y1="103" x2="210" y2="103" stroke="#a78bfa" stroke-width="2"/>

<!-- Inductor L -->
<path d="M 210 103 Q 220 88 230 103 Q 240 88 250 103 Q 260 88 270 103" fill="none" stroke="#10b981" stroke-width="2.5"/>
<line x1="270" y1="103" x2="310" y2="103" stroke="#10b981" stroke-width="2"/>
<text x="240" y="88" text-anchor="middle" fill="#10b981" font-size="9">L = 10mH</text>

<!-- Capacitor C -->
<line x1="310" y1="103" x2="345" y2="103" stroke="#ec4899" stroke-width="2"/>
<line x1="345" y1="90" x2="345" y2="116" stroke="#ec4899" stroke-width="3"/>
<line x1="355" y1="90" x2="355" y2="116" stroke="#ec4899" stroke-width="3"/>
<line x1="355" y1="103" x2="390" y2="103" stroke="#ec4899" stroke-width="2"/>
<text x="350" y="83" text-anchor="middle" fill="#ec4899" font-size="9">C = 100μF</text>

<!-- Vout across capacitor -->
<circle cx="430" cy="103" r="5" fill="#38bdf8"/>
<line x1="390" y1="103" x2="430" y2="103" stroke="#38bdf8" stroke-width="1.5"/>
<text x="445" y="107" fill="#38bdf8" font-size="10" font-weight="bold">Vc</text>

<!-- Bottom return -->
<line x1="75" y1="137" x2="430" y2="137" stroke="#334155" stroke-width="2"/>
<line x1="430" y1="103" x2="430" y2="137" stroke="#38bdf8" stroke-width="1.5"/>
<line x1="55" y1="137" x2="75" y2="137" stroke="#334155" stroke-width="2"/>

<!-- Resonance Formula -->
<text x="130" y="165" fill="#60a5fa" font-size="10">f₀ = 1/(2π√LC)</text>
<text x="130" y="180" fill="#60a5fa" font-size="10">Z = R at resonance (XL = XC)</text>
<text x="50" y="230" fill="#64748b" font-size="9">At resonance: f₀≈159Hz  •  Q = XL/R  •  BW = f₀/Q</text>
`);

// ── 5. Digital Logic: Full Adder ──────────────────────────────
const FULL_ADDER = svg(`
<rect width="520" height="240" fill="${BG}"/>
<rect x="10" y="10" width="500" height="220" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>
<text x="260" y="28" text-anchor="middle" fill="#94a3b8" font-size="11">Full Adder Circuit (XOR + AND + OR)</text>

<!-- Inputs -->
<text x="30" y="85" fill="#f59e0b" font-size="11" font-weight="bold">A</text>
<text x="30" y="125" fill="#10b981" font-size="11" font-weight="bold">B</text>
<text x="30" y="165" fill="#a78bfa" font-size="11" font-weight="bold">Cin</text>
<line x1="42" y1="82" x2="90" y2="82" stroke="#f59e0b" stroke-width="2"/>
<line x1="42" y1="122" x2="90" y2="122" stroke="#10b981" stroke-width="2"/>
<line x1="42" y1="162" x2="160" y2="162" stroke="#a78bfa" stroke-width="2"/>

<!-- XOR Gate 1 (A,B → S1) -->
<path d="M 90 68 Q 100 82 90 96" fill="none" stroke="#38bdf8" stroke-width="2"/>
<path d="M 95 68 Q 130 82 95 96" fill="none" stroke="#38bdf8" stroke-width="2"/>
<line x1="90" y1="68" x2="110" y2="68" stroke="#38bdf8" stroke-width="2"/>
<line x1="90" y1="96" x2="110" y2="96" stroke="#38bdf8" stroke-width="2"/>
<text x="112" y="86" fill="#38bdf8" font-size="8">XOR1</text>
<line x1="130" y1="82" x2="165" y2="82" stroke="#38bdf8" stroke-width="2"/>

<!-- XOR Gate 2 (S1, Cin → Sum) -->
<path d="M 165 68 Q 175 82 165 96" fill="none" stroke="#38bdf8" stroke-width="2"/>
<path d="M 170 68 Q 205 82 170 96" fill="none" stroke="#38bdf8" stroke-width="2"/>
<line x1="165" y1="68" x2="185" y2="68" stroke="#38bdf8" stroke-width="2"/>
<line x1="165" y1="96" x2="185" y2="96" stroke="#38bdf8" stroke-width="2"/>
<text x="186" y="86" fill="#38bdf8" font-size="8">XOR2</text>
<line x1="205" y1="82" x2="280" y2="82" stroke="#38bdf8" stroke-width="2"/>
<text x="285" y="86" fill="#38bdf8" font-size="12" font-weight="bold">Sum</text>

<!-- AND Gate 1 (A,B → C1) -->
<rect x="95" y="138" width="35" height="22" rx="8" fill="none" stroke="#ec4899" stroke-width="2"/>
<text x="112" y="153" text-anchor="middle" fill="#ec4899" font-size="8">AND</text>
<line x1="90" y1="144" x2="95" y2="144" stroke="#ec4899" stroke-width="2"/>
<line x1="90" y1="156" x2="95" y2="156" stroke="#ec4899" stroke-width="2"/>
<line x1="130" y1="150" x2="230" y2="150" stroke="#ec4899" stroke-width="2"/>

<!-- AND Gate 2 (S1, Cin → C2) -->
<rect x="175" y="165" width="35" height="22" rx="8" fill="none" stroke="#ec4899" stroke-width="2"/>
<text x="192" y="180" text-anchor="middle" fill="#ec4899" font-size="8">AND</text>
<line x1="165" y1="172" x2="175" y2="172" stroke="#ec4899" stroke-width="2"/>
<line x1="165" y1="182" x2="175" y2="182" stroke="#ec4899" stroke-width="2"/>
<line x1="210" y1="176" x2="230" y2="176" stroke="#ec4899" stroke-width="2"/>

<!-- OR Gate (C1, C2 → Cout) -->
<path d="M 230 138 Q 240 160 230 182" fill="none" stroke="#f59e0b" stroke-width="2"/>
<path d="M 235 138 Q 268 160 235 182" fill="none" stroke="#f59e0b" stroke-width="2"/>
<line x1="230" y1="150" x2="235" y2="150" stroke="#f59e0b" stroke-width="2"/>
<line x1="230" y1="176" x2="235" y2="176" stroke="#f59e0b" stroke-width="2"/>
<text x="255" y="164" fill="#f59e0b" font-size="8">OR</text>
<line x1="268" y1="160" x2="310" y2="160" stroke="#f59e0b" stroke-width="2"/>
<text x="315" y="164" fill="#f59e0b" font-size="12" font-weight="bold">Cout</text>

<text x="30" y="230" fill="#64748b" font-size="9">Sum = A⊕B⊕Cin  •  Cout = AB + BCin + ACin  •  Inputs: A,B,Cin → Outputs: Sum, Cout</text>
`);

// ── 6. H-Bridge Motor Drive (EEE) ────────────────────────────
const HBRIDGE = svg(`
<rect width="520" height="240" fill="${BG}"/>
<rect x="10" y="10" width="500" height="220" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>
<text x="260" y="28" text-anchor="middle" fill="#94a3b8" font-size="11">H-Bridge DC Motor Drive (MOSFET)</text>

<!-- VDC Supply -->
<text x="260" y="46" text-anchor="middle" fill="#ef4444" font-size="11" font-weight="bold">+VDC (24V)</text>
<line x1="260" y1="50" x2="260" y2="62" stroke="#ef4444" stroke-width="2"/>
<line x1="150" y1="62" x2="370" y2="62" stroke="#ef4444" stroke-width="2"/>

<!-- Q1 top-left MOSFET -->
<line x1="170" y1="62" x2="170" y2="80" stroke="#ef4444" stroke-width="2"/>
<rect x="155" y="80" width="30" height="28" rx="4" fill="${SRF}" stroke="#38bdf8" stroke-width="2"/>
<text x="170" y="98" text-anchor="middle" fill="#38bdf8" font-size="9">Q1</text>
<line x1="170" y1="108" x2="170" y2="126" stroke="#a78bfa" stroke-width="2"/>
<text x="135" y="98" fill="#38bdf8" font-size="8">S1(IN1)</text>
<line x1="155" y1="94" x2="138" y2="94" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3"/>

<!-- Q2 top-right MOSFET -->
<line x1="350" y1="62" x2="350" y2="80" stroke="#ef4444" stroke-width="2"/>
<rect x="335" y="80" width="30" height="28" rx="4" fill="${SRF}" stroke="#38bdf8" stroke-width="2"/>
<text x="350" y="98" text-anchor="middle" fill="#38bdf8" font-size="9">Q2</text>
<line x1="350" y1="108" x2="350" y2="126" stroke="#a78bfa" stroke-width="2"/>
<text x="365" y="98" fill="#38bdf8" font-size="8">S2(IN2)</text>
<line x1="365" y1="94" x2="382" y2="94" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3"/>

<!-- Motor between midpoints -->
<line x1="170" y1="126" x2="220" y2="126" stroke="#a78bfa" stroke-width="2"/>
<circle cx="260" cy="126" r="22" fill="${SRF}" stroke="#a78bfa" stroke-width="2.5"/>
<text x="260" y="122" text-anchor="middle" fill="#a78bfa" font-size="9" font-weight="bold">DC</text>
<text x="260" y="134" text-anchor="middle" fill="#a78bfa" font-size="9" font-weight="bold">Motor</text>
<line x1="282" y1="126" x2="350" y2="126" stroke="#a78bfa" stroke-width="2"/>

<!-- Q3 bottom-left MOSFET -->
<line x1="170" y1="126" x2="170" y2="142" stroke="#a78bfa" stroke-width="2"/>
<rect x="155" y="142" width="30" height="28" rx="4" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="170" y="160" text-anchor="middle" fill="#10b981" font-size="9">Q3</text>
<line x1="170" y1="170" x2="170" y2="185" stroke="#10b981" stroke-width="2"/>
<text x="135" y="160" fill="#10b981" font-size="8">S3(IN3)</text>

<!-- Q4 bottom-right MOSFET -->
<line x1="350" y1="126" x2="350" y2="142" stroke="#a78bfa" stroke-width="2"/>
<rect x="335" y="142" width="30" height="28" rx="4" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="350" y="160" text-anchor="middle" fill="#10b981" font-size="9">Q4</text>
<line x1="350" y1="170" x2="350" y2="185" stroke="#10b981" stroke-width="2"/>
<text x="365" y="160" fill="#10b981" font-size="8">S4(IN4)</text>

<!-- GND rail -->
<line x1="150" y1="185" x2="370" y2="185" stroke="#64748b" stroke-width="2"/>
<text x="260" y="200" text-anchor="middle" fill="#64748b" font-size="9">GND</text>

<text x="30" y="225" fill="#64748b" font-size="9">CW: Q1+Q4 ON  •  CCW: Q2+Q3 ON  •  PWM on gate = Speed Control</text>
`);

// ── 7. Transformer + Bridge Rectifier (EEE) ──────────────────
const BRIDGE_RECT = svg(`
<rect width="520" height="240" fill="${BG}"/>
<rect x="10" y="10" width="500" height="220" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>
<text x="260" y="28" text-anchor="middle" fill="#94a3b8" font-size="11">Step-Down Transformer + Full-Wave Bridge Rectifier</text>

<!-- AC Mains -->
<circle cx="45" cy="125" r="18" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="45" y="121" text-anchor="middle" fill="#f59e0b" font-size="8">230V</text>
<text x="45" y="132" text-anchor="middle" fill="#f59e0b" font-size="8">50Hz</text>

<!-- Transformer -->
<line x1="63" y1="110" x2="100" y2="110" stroke="#f59e0b" stroke-width="2"/>
<line x1="63" y1="140" x2="100" y2="140" stroke="#f59e0b" stroke-width="2"/>
<rect x="100" y="95" width="15" height="60" rx="2" fill="${SRF}" stroke="#a78bfa" stroke-width="2.5"/>
<rect x="125" y="95" width="15" height="60" rx="2" fill="${SRF}" stroke="#10b981" stroke-width="2.5"/>
<text x="120" y="175" text-anchor="middle" fill="#94a3b8" font-size="8">Transformer</text>
<text x="120" y="185" text-anchor="middle" fill="#94a3b8" font-size="8">N1:N2=10:1</text>
<line x1="140" y1="110" x2="175" y2="110" stroke="#10b981" stroke-width="2"/>
<line x1="140" y1="140" x2="175" y2="140" stroke="#10b981" stroke-width="2"/>

<!-- Bridge Diodes diamond arrangement -->
<!-- D1 top -->
<polygon points="200,90 215,105 200,120" fill="none" stroke="#ec4899" stroke-width="2"/>
<line x1="215" y1="105" x2="215" y2="95" stroke="#ec4899" stroke-width="2"/>
<text x="215" y="88" text-anchor="middle" fill="#ec4899" font-size="8">D1</text>
<!-- D2 right -->
<polygon points="250,105 240,120 240,90" fill="none" stroke="#ec4899" stroke-width="2"/>
<line x1="250" y1="105" x2="255" y2="105" stroke="#ec4899" stroke-width="2"/>
<text x="265" y="108" fill="#ec4899" font-size="8">D2</text>
<!-- D3 bottom -->
<polygon points="200,120 215,135 215,120" fill="none" stroke="#ec4899" stroke-width="2"/>
<line x1="215" y1="135" x2="215" y2="150" stroke="#ec4899" stroke-width="2"/>
<text x="215" y="163" text-anchor="middle" fill="#ec4899" font-size="8">D3</text>
<!-- D4 left -->
<polygon points="175,105 190,90 190,120" fill="none" stroke="#ec4899" stroke-width="2"/>
<line x1="175" y1="105" x2="175" y2="115" stroke="#ec4899" stroke-width="2"/>
<text x="170" y="108" fill="#ec4899" font-size="8">D4</text>

<!-- Output Filter Cap -->
<line x1="280" y1="90" x2="320" y2="90" stroke="#38bdf8" stroke-width="2"/>
<line x1="320" y1="75" x2="320" y2="108" stroke="#38bdf8" stroke-width="3"/>
<line x1="330" y1="75" x2="330" y2="108" stroke="#38bdf8" stroke-width="3"/>
<text x="325" y="70" text-anchor="middle" fill="#38bdf8" font-size="8">C=1000μF</text>
<line x1="330" y1="90" x2="380" y2="90" stroke="#38bdf8" stroke-width="2"/>

<!-- Load Resistor -->
<rect x="380" y="76" width="25" height="55" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="392" y="107" text-anchor="middle" fill="#10b981" font-size="8">RL</text>

<!-- Vout -->
<text x="420" y="95" fill="#38bdf8" font-size="11" font-weight="bold">+Vout</text>
<text x="420" y="145" fill="#64748b" font-size="9">GND</text>

<text x="30" y="228" fill="#64748b" font-size="9">Vout(avg) = 2Vm/π ≈ 0.636Vm  •  η≈81.2%  •  Ripple factor=0.482</text>
`);

// ── 8. Oscilloscope Display (Signal Analysis) ─────────────────
const OSCILLOSCOPE = svg(`
<rect width="520" height="240" fill="${BG}"/>
<rect x="10" y="10" width="500" height="220" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>
<text x="260" y="28" text-anchor="middle" fill="#94a3b8" font-size="11">Oscilloscope Display — 2-Channel Signal Measurement</text>

<!-- Oscilloscope screen -->
<rect x="30" y="40" width="310" height="175" rx="6" fill="#050c18" stroke="#1d4ed8" stroke-width="2"/>

<!-- Grid lines -->
${[60,90,120,150,180,210].map(y=>`<line x1="30" y1="${y}" x2="340" y2="${y}" stroke="#1e3a5f" stroke-width="0.8" stroke-dasharray="4"/>`).join('')}
${[90,150,210,270,300].map(x=>`<line x1="${x}" y1="40" x2="${x}" y2="215" stroke="#1e3a5f" stroke-width="0.8" stroke-dasharray="4"/>`).join('')}

<!-- Channel 1: Yellow Sine Wave (CH1) -->
<polyline points="
  30,127 50,95 70,70 90,95 110,127 130,160 150,185 170,160 190,127 210,95 230,70 250,95 270,127 290,160 310,185 330,160
" fill="none" stroke="#facc15" stroke-width="2.5"/>

<!-- Channel 2: Cyan Square Wave (CH2) -->
<polyline points="
  30,100 30,80 90,80 90,160 150,160 150,80 210,80 210,160 270,160 270,80 330,80 330,160
" fill="none" stroke="#22d3ee" stroke-width="2"/>

<!-- Center cross-hair -->
<line x1="185" y1="40" x2="185" y2="215" stroke="#334155" stroke-width="1"/>
<line x1="30" y1="127" x2="340" y2="127" stroke="#334155" stroke-width="1"/>

<!-- Measurements panel right side -->
<rect x="355" y="40" width="145" height="175" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
<text x="428" y="58" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="bold">MEASUREMENTS</text>
<text x="360" y="76" fill="#facc15" font-size="9">CH1 (Sine):</text>
<text x="360" y="90" fill="#facc15" font-size="8">Freq: 1 kHz</text>
<text x="360" y="103" fill="#facc15" font-size="8">Amp: ±5V (10Vpp)</text>
<text x="360" y="116" fill="#facc15" font-size="8">RMS: 3.54V</text>
<line x1="360" y1="122" x2="495" y2="122" stroke="#334155" stroke-width="1"/>
<text x="360" y="134" fill="#22d3ee" font-size="9">CH2 (Square):</text>
<text x="360" y="148" fill="#22d3ee" font-size="8">Freq: 500 Hz</text>
<text x="360" y="161" fill="#22d3ee" font-size="8">Duty: 50%</text>
<text x="360" y="174" fill="#22d3ee" font-size="8">High: +5V</text>
<text x="360" y="187" fill="#22d3ee" font-size="8">Low: 0V</text>
<text x="360" y="205" fill="#64748b" font-size="8">Time/div: 0.5ms</text>

<text x="30" y="232" fill="#64748b" font-size="9">Vrms = Vpeak/√2 (sine)  •  Duty Cycle = Ton/T × 100%  •  f = 1/T</text>
`);

/* ─────────────────────────────────────────────────────────────
   QUESTION BANK WITH CIRCUIT IMAGES
   ───────────────────────────────────────────────────────────── */

const QUESTIONS_WITH_IMAGES = [
  // ── Op-Amp Inverting Amplifier ──────────────────────────────
  {
    question_text: 'In the inverting Op-Amp circuit shown above, calculate the closed-loop voltage gain AV and output voltage Vout when Vin = +1V.',
    options: ['AV = –10, Vout = –10V', 'AV = +10, Vout = +10V', 'AV = –100, Vout = –100V', 'AV = +1, Vout = +1V'],
    correct_answer: 'AV = –10, Vout = –10V',
    topic: 'Analog & Op-Amp Circuits', concept: 'Inverting Amplifier Gain',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: OPAMP_INV
  },
  {
    question_text: 'From the Op-Amp circuit schematic above, what is the role of the feedback resistor Rf = 100kΩ connected between the output and the inverting (–) terminal?',
    options: ['It sets the voltage gain', 'It provides DC bias to the base', 'It eliminates the output signal', 'It grounds the output'],
    correct_answer: 'It sets the voltage gain',
    topic: 'Analog & Op-Amp Circuits', concept: 'Feedback Resistor Function',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: OPAMP_INV
  },
  {
    question_text: 'In the Op-Amp circuit diagram above, the non-inverting (+) terminal is connected to GND. If Vin = –0.5V with Rin = 10kΩ and Rf = 100kΩ, calculate Vout.',
    options: ['+5V', '–5V', '+0.5V', '–0.5V'],
    correct_answer: '+5V',
    topic: 'Analog & Op-Amp Circuits', concept: 'Inverting Amplifier Output',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: OPAMP_INV
  },
  {
    question_text: 'What is the virtual ground concept observed at the inverting (–) terminal in the Op-Amp circuit shown above?',
    options: ['The (–) terminal is at 0V due to negative feedback', 'The (–) terminal is physically grounded', 'The output is zero', 'The gain is zero'],
    correct_answer: 'The (–) terminal is at 0V due to negative feedback',
    topic: 'Analog & Op-Amp Circuits', concept: 'Virtual Ground',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: OPAMP_INV
  },

  // ── Half-Wave Rectifier ─────────────────────────────────────
  {
    question_text: 'In the half-wave rectifier circuit shown above with a 1N4007 diode, what is the average output voltage Vout(avg) if the peak input voltage Vm = 20V?',
    options: ['6.37V', '12.73V', '14.14V', '20V'],
    correct_answer: '6.37V',
    topic: 'Power Electronics', concept: 'Half-Wave Rectifier Output',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: HALF_WAVE_RECT
  },
  {
    question_text: 'Observe the half-wave rectifier schematic. During the negative half-cycle of the AC input, the diode D1 is in which state?',
    options: ['Reverse biased (open circuit)', 'Forward biased (conducting)', 'Zener breakdown', 'Neutral (no effect)'],
    correct_answer: 'Reverse biased (open circuit)',
    topic: 'Power Electronics', concept: 'Diode Operation in Rectifier',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: HALF_WAVE_RECT
  },
  {
    question_text: 'From the half-wave rectifier circuit above, what is the rectification efficiency (η) in percentage?',
    options: ['40.6%', '81.2%', '50%', '100%'],
    correct_answer: '40.6%',
    topic: 'Power Electronics', concept: 'Rectifier Efficiency',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: HALF_WAVE_RECT
  },

  // ── BJT Biasing ─────────────────────────────────────────────
  {
    question_text: 'In the NPN BJT voltage-divider bias circuit shown above with VCC=12V, R1=47kΩ, R2=10kΩ, RE=1kΩ, calculate the base voltage VB.',
    options: ['2.1V', '4.8V', '6.0V', '12V'],
    correct_answer: '2.1V',
    topic: 'Analog & Op-Amp Circuits', concept: 'BJT Voltage Divider Bias',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'ECE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: BJT_BIAS
  },
  {
    question_text: 'From the BJT circuit schematic above, what happens to the Q-point if temperature increases and IC rises (thermal runaway)?',
    options: ['VCE decreases and BJT may saturate', 'VCE increases', 'IB decreases', 'RE has no effect'],
    correct_answer: 'VCE decreases and BJT may saturate',
    topic: 'Analog & Op-Amp Circuits', concept: 'BJT Thermal Runaway',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'ECE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: BJT_BIAS
  },
  {
    question_text: 'In the BJT bias circuit shown, what is the purpose of the emitter resistor RE = 1kΩ?',
    options: ['Provides thermal stability via negative feedback', 'Increases voltage gain', 'Provides base bias current', 'Bypasses high-frequency signals'],
    correct_answer: 'Provides thermal stability via negative feedback',
    topic: 'Analog & Op-Amp Circuits', concept: 'BJT Emitter Resistor',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: BJT_BIAS
  },

  // ── RLC Series ──────────────────────────────────────────────
  {
    question_text: 'From the RLC series circuit diagram above with L=10mH, C=100μF, calculate the resonant frequency f₀.',
    options: ['159 Hz', '1591 Hz', '15.9 Hz', '100 Hz'],
    correct_answer: '159 Hz',
    topic: 'Circuit Analysis & Network Theory', concept: 'RLC Resonant Frequency',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: RLC_SERIES
  },
  {
    question_text: 'In the RLC series circuit shown, at resonance frequency f₀, what is the total impedance Z of the circuit?',
    options: ['Z = R only (XL = XC cancel)', 'Z = XL + XC', 'Z = 0', 'Z = XL – XC'],
    correct_answer: 'Z = R only (XL = XC cancel)',
    topic: 'Circuit Analysis & Network Theory', concept: 'RLC Impedance at Resonance',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: RLC_SERIES
  },
  {
    question_text: 'In the RLC circuit schematic above, when the source frequency is below f₀, what does the circuit behave like?',
    options: ['Capacitive (XC > XL)', 'Inductive (XL > XC)', 'Purely resistive', 'Open circuit'],
    correct_answer: 'Capacitive (XC > XL)',
    topic: 'Circuit Analysis & Network Theory', concept: 'RLC Behavior Below Resonance',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: RLC_SERIES
  },

  // ── Full Adder ──────────────────────────────────────────────
  {
    question_text: 'From the Full Adder circuit diagram above, what is the output Sum and Cout when inputs A=1, B=1, Cin=0?',
    options: ['Sum=0, Cout=1', 'Sum=1, Cout=0', 'Sum=1, Cout=1', 'Sum=0, Cout=0'],
    correct_answer: 'Sum=0, Cout=1',
    topic: 'Digital Electronics', concept: 'Full Adder Truth Table',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: FULL_ADDER
  },
  {
    question_text: 'From the Full Adder schematic, how many XOR gates are used and what are their input-output relationships?',
    options: ['2 XOR gates: first gives A⊕B, second gives (A⊕B)⊕Cin = Sum', '1 XOR gate only', '3 XOR gates', 'No XOR gates — only AND and OR'],
    correct_answer: '2 XOR gates: first gives A⊕B, second gives (A⊕B)⊕Cin = Sum',
    topic: 'Digital Electronics', concept: 'Full Adder Logic Structure',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: FULL_ADDER
  },
  {
    question_text: 'In the Full Adder circuit above, when A=1, B=1, Cin=1, the carry output Cout is?',
    options: ['1', '0', 'depends on clock', 'invalid'],
    correct_answer: '1',
    topic: 'Digital Electronics', concept: 'Full Adder Carry Output',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: FULL_ADDER
  },

  // ── H-Bridge Motor Drive (EEE) ──────────────────────────────
  {
    question_text: 'In the H-Bridge motor drive circuit above, which MOSFETs must be switched ON to run the DC motor in the FORWARD (Clockwise) direction?',
    options: ['Q1 and Q4 ON (Q2 and Q3 OFF)', 'Q2 and Q3 ON (Q1 and Q4 OFF)', 'All four ON simultaneously', 'Q1 and Q3 ON'],
    correct_answer: 'Q1 and Q4 ON (Q2 and Q3 OFF)',
    topic: 'Power Electronics', concept: 'H-Bridge Motor Control Direction',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: HBRIDGE
  },
  {
    question_text: 'From the H-Bridge schematic above, what happens if Q1 and Q3 are both switched ON simultaneously?',
    options: ['Short circuit across +VDC to GND (shoot-through fault)', 'Motor runs forward', 'Motor brakes', 'Motor runs in reverse'],
    correct_answer: 'Short circuit across +VDC to GND (shoot-through fault)',
    topic: 'Power Electronics', concept: 'H-Bridge Shoot-Through Fault',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: HBRIDGE
  },
  {
    question_text: 'In the H-Bridge circuit diagram, PWM signals are applied to the gate terminals of Q1 & Q4. Increasing the PWM duty cycle from 50% to 80% will:',
    options: ['Increase motor speed by raising average voltage', 'Decrease motor speed', 'Reverse motor direction', 'Have no effect'],
    correct_answer: 'Increase motor speed by raising average voltage',
    topic: 'Power Electronics', concept: 'H-Bridge PWM Speed Control',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: HBRIDGE
  },

  // ── Bridge Rectifier (EEE) ──────────────────────────────────
  {
    question_text: 'From the full-wave bridge rectifier circuit above with a 10:1 step-down transformer from 230V AC, and Vm≈32V (peak), what is the average DC output voltage Vout(avg)?',
    options: ['20.4V', '14.4V', '32V', '22.6V'],
    correct_answer: '20.4V',
    topic: 'Power Electronics', concept: 'Bridge Rectifier Average Output',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: BRIDGE_RECT
  },
  {
    question_text: 'In the bridge rectifier circuit above, how many diodes conduct during the positive half-cycle of the AC input?',
    options: ['2 diodes (D1 and D2)', '4 diodes simultaneously', '1 diode', '3 diodes'],
    correct_answer: '2 diodes (D1 and D2)',
    topic: 'Power Electronics', concept: 'Bridge Rectifier Conduction',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: BRIDGE_RECT
  },
  {
    question_text: 'What is the purpose of the 1000μF filter capacitor C shown in the bridge rectifier circuit above?',
    options: ['To smooth output DC voltage by reducing AC ripple', 'To increase voltage', 'To store charge for fault protection', 'To limit current'],
    correct_answer: 'To smooth output DC voltage by reducing AC ripple',
    topic: 'Power Electronics', concept: 'Rectifier Filter Capacitor',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: BRIDGE_RECT
  },

  // ── Oscilloscope (ECE & EEE) ─────────────────────────────────
  {
    question_text: 'Observe the oscilloscope display above. If Time/div = 0.5ms and the yellow CH1 sine wave completes 1 full cycle in 2 divisions, what is the frequency?',
    options: ['1000 Hz (1 kHz)', '500 Hz', '2000 Hz', '250 Hz'],
    correct_answer: '1000 Hz (1 kHz)',
    topic: 'Signals & Systems & DSP', concept: 'Oscilloscope Frequency Measurement',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: OSCILLOSCOPE
  },
  {
    question_text: 'From the oscilloscope display above, Channel 1 (yellow) shows a sine wave with peak amplitude 5V. Calculate the RMS voltage.',
    options: ['3.54V', '5V', '7.07V', '2.5V'],
    correct_answer: '3.54V',
    topic: 'Signals & Systems & DSP', concept: 'RMS Voltage Measurement',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: OSCILLOSCOPE
  },
  {
    question_text: 'The cyan CH2 square wave on the oscilloscope above has frequency 500 Hz with 50% duty cycle. What is the pulse ON time Ton for each cycle?',
    options: ['1 ms', '2 ms', '0.5 ms', '4 ms'],
    correct_answer: '1 ms',
    topic: 'Signals & Systems & DSP', concept: 'PWM Duty Cycle Measurement',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: OSCILLOSCOPE
  }
];

/* ─────────────────────────────────────────────────────────────
   MAIN SEEDING FUNCTION
   ───────────────────────────────────────────────────────────── */
async function seedCircuitQuestions() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding circuit image questions...');

    // Find or create a dedicated ECE/EEE Circuit Analysis Exam
    let exam = await Exam.findOne({ title: 'ECE & EEE Circuit Analysis Technical Exam' });
    if (!exam) {
      exam = await Exam.create({
        title: 'ECE & EEE Circuit Analysis Technical Exam',
        description: 'Hardware schematic & circuit diagram-based MCQs for ECE & EEE students covering Op-Amps, Rectifiers, BJTs, RLC, Digital Logic, and Power Electronics.',
        duration: 60,
        total_questions: 25,
        difficulty_distribution: { easy: 8, medium: 10, hard: 7 },
        per_question_time: { easy: 45, medium: 60, hard: 90 },
        questions: [],
        assigned_students: []
      });
      console.log('✔ Created "ECE & EEE Circuit Analysis Technical Exam"');
    }

    // Attach examId
    const questionsToInsert = QUESTIONS_WITH_IMAGES.map(q => ({
      ...q,
      examId: exam._id
    }));

    const inserted = await Question.insertMany(questionsToInsert);
    console.log(`🎉 Successfully seeded ${inserted.length} ECE/EEE circuit image questions!`);

    // Link to exam
    exam.questions = [...(exam.questions || []), ...inserted.map(q => q._id)];
    exam.total_questions = exam.questions.length;
    await exam.save();
    console.log(`✔ Exam updated with ${inserted.length} new questions (total: ${exam.questions.length}).`);

    console.log('\n📊 Questions breakdown by circuit diagram:');
    console.log('  • Op-Amp Inverting Amplifier  → 4 questions');
    console.log('  • Half-Wave Rectifier         → 3 questions');
    console.log('  • BJT Voltage-Divider Bias    → 3 questions');
    console.log('  • RLC Series Resonant Circuit → 3 questions');
    console.log('  • Full Adder Logic Circuit    → 3 questions');
    console.log('  • H-Bridge Motor Drive        → 3 questions');
    console.log('  • Bridge Rectifier + Filter   → 3 questions');
    console.log('  • Oscilloscope Display        → 3 questions');

    process.exit(0);
  } catch (err) {
    console.error('Error seeding circuit image questions:', err);
    process.exit(1);
  }
}

seedCircuitQuestions();
