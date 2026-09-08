/**
 * seedAdvancedCircuits.js
 * Seeds 5 advanced ECE & EEE circuit image question sets:
 *  1. Buck DC-DC Converter        (EEE – Power Electronics)
 *  2. PID Controller Block Diagram (EEE – Control Systems)
 *  3. SCR Thyristor Firing Circuit (EEE – Power Electronics)
 *  4. 3-Phase Delta (Δ) Load       (EEE – Power Systems)
 *  5. SPI Protocol Timing Diagram  (ECE – Communication/Embedded)
 */

const path = require('path');
module.paths.push(path.join(__dirname, '../backend/node_modules'));

const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Question = require('../backend/models/Question');
const Exam     = require('../backend/models/Exam');

const enc = body =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(body);

const W = 560, H = 240;
const BG = '#0f172a', SRF = '#1e293b', BDR = '#334155';
const wrap = inner =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="monospace">` +
  `<rect width="${W}" height="${H}" fill="${BG}"/>` +
  `<rect x="8" y="8" width="${W-16}" height="${H-16}" rx="10" fill="${SRF}" stroke="${BDR}" stroke-width="1.5"/>` +
  inner + `</svg>`;

/* ══════════════════════════════════════════════════════════════
   1. BUCK (STEP-DOWN) DC-DC CONVERTER
   ══════════════════════════════════════════════════════════════ */
const BUCK = enc(wrap(`
<text x="280" y="26" text-anchor="middle" fill="#94a3b8" font-size="11">Buck (Step-Down) DC-DC Converter</text>

<!-- Vin -->
<text x="30" y="90" fill="#ef4444" font-size="10" font-weight="bold">+Vin</text>
<text x="30" y="102" fill="#ef4444" font-size="9">24V</text>
<line x1="55" y1="90" x2="90" y2="90" stroke="#ef4444" stroke-width="2"/>

<!-- MOSFET Switch S (Q1) -->
<rect x="90" y="75" width="34" height="30" rx="5" fill="${BG}" stroke="#38bdf8" stroke-width="2"/>
<text x="107" y="87" text-anchor="middle" fill="#38bdf8" font-size="9">Q1</text>
<text x="107" y="98" text-anchor="middle" fill="#38bdf8" font-size="8">MOSFET</text>
<line x1="124" y1="90" x2="160" y2="90" stroke="#38bdf8" stroke-width="2"/>
<circle cx="160" cy="90" r="3" fill="#38bdf8"/>

<!-- PWM gate signal arrow -->
<line x1="107" y1="75" x2="107" y2="55" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3"/>
<text x="108" y="50" fill="#f59e0b" font-size="9">PWM Gate</text>
<text x="108" y="62" fill="#f59e0b" font-size="8">(D=Vout/Vin)</text>

<!-- Inductor L -->
<path d="M 160 90 Q 172 76 184 90 Q 196 76 208 90 Q 220 76 232 90" fill="none" stroke="#10b981" stroke-width="2.5"/>
<text x="196" y="73" text-anchor="middle" fill="#10b981" font-size="9">L = 100μH</text>
<line x1="232" y1="90" x2="280" y2="90" stroke="#10b981" stroke-width="2"/>
<circle cx="280" cy="90" r="3" fill="#10b981"/>

<!-- Freewheeling Diode D1 (from node to GND) -->
<line x1="160" y1="90" x2="160" y2="110" stroke="#a78bfa" stroke-width="2"/>
<polygon points="160,110 148,130 172,130" fill="none" stroke="#a78bfa" stroke-width="2.5"/>
<line x1="148" y1="130" x2="172" y2="130" stroke="#a78bfa" stroke-width="2.5"/>
<text x="178" y="122" fill="#a78bfa" font-size="9">D1</text>
<text x="148" y="148" fill="#a78bfa" font-size="8">(freewheeling)</text>
<line x1="160" y1="130" x2="160" y2="175" stroke="#a78bfa" stroke-width="2"/>

<!-- Output Capacitor Cout -->
<line x1="280" y1="90" x2="320" y2="90" stroke="#ec4899" stroke-width="2"/>
<line x1="320" y1="73" x2="320" y2="107" stroke="#ec4899" stroke-width="3"/>
<line x1="330" y1="73" x2="330" y2="107" stroke="#ec4899" stroke-width="3"/>
<text x="325" y="65" text-anchor="middle" fill="#ec4899" font-size="8">Cout</text>
<text x="325" y="56" text-anchor="middle" fill="#ec4899" font-size="8">470μF</text>
<line x1="330" y1="90" x2="430" y2="90" stroke="#ec4899" stroke-width="2"/>

<!-- Load RL -->
<rect x="430" y="73" width="22" height="55" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="441" y="98" text-anchor="middle" fill="#10b981" font-size="8">RL</text>
<text x="441" y="108" text-anchor="middle" fill="#10b981" font-size="7">10Ω</text>

<!-- GND rail -->
<line x1="160" y1="175" x2="452" y2="175" stroke="#334155" stroke-width="2"/>
<line x1="452" y1="128" x2="452" y2="175" stroke="#334155" stroke-width="2"/>
<line x1="55" y1="130" x2="55" y2="175" stroke="#334155" stroke-width="2"/>
<line x1="55" y1="175" x2="160" y2="175" stroke="#334155" stroke-width="2"/>
<text x="260" y="190" text-anchor="middle" fill="#64748b" font-size="8">GND</text>
<line x1="245" y1="183" x2="275" y2="183" stroke="#64748b" stroke-width="2"/>

<!-- Vout label -->
<circle cx="510" cy="90" r="5" fill="#38bdf8"/>
<line x1="452" y1="90" x2="510" y2="90" stroke="#38bdf8" stroke-width="1.5"/>
<text x="518" y="94" fill="#38bdf8" font-size="10" font-weight="bold">Vout</text>

<!-- Waveform sketches bottom -->
<rect x="15" y="198" width="${W-30}" height="30" rx="5" fill="#090d16" stroke="#334155" stroke-width="1"/>
<text x="25" y="210" fill="#94a3b8" font-size="8" font-weight="bold">VL waveform:</text>
<polyline points="90,220 90,208 140,208 140,220 190,220 190,208 240,208 240,220" fill="none" stroke="#f59e0b" stroke-width="1.5"/>
<text x="260" y="210" fill="#64748b" font-size="8">Vout = D × Vin  •  D = duty cycle  •  IL ripple = Vin×D(1-D)/(L×f)</text>
`));

/* ══════════════════════════════════════════════════════════════
   2. PID CONTROLLER BLOCK DIAGRAM
   ══════════════════════════════════════════════════════════════ */
const PID = enc(wrap(`
<text x="280" y="26" text-anchor="middle" fill="#94a3b8" font-size="11">PID Controller — Closed-Loop Control System Block Diagram</text>

<!-- Setpoint R(s) -->
<text x="22" y="112" fill="#f59e0b" font-size="10" font-weight="bold">R(s)</text>
<text x="20" y="124" fill="#f59e0b" font-size="8">Setpoint</text>
<line x1="50" y1="110" x2="78" y2="110" stroke="#f59e0b" stroke-width="2"/>

<!-- Summing junction (error) -->
<circle cx="88" cy="110" r="10" fill="${BG}" stroke="#38bdf8" stroke-width="2"/>
<text x="84" y="106" fill="#10b981" font-size="10">+</text>
<text x="84" y="118" fill="#ef4444" font-size="10">–</text>
<line x1="98" y1="110" x2="128" y2="110" stroke="#38bdf8" stroke-width="2"/>
<text x="88" y="92" fill="#38bdf8" font-size="8">E(s)</text>

<!-- PID Controller block -->
<rect x="128" y="90" width="130" height="40" rx="6" fill="${BG}" stroke="#a78bfa" stroke-width="2.5"/>
<text x="193" y="107" text-anchor="middle" fill="#a78bfa" font-size="10" font-weight="bold">PID Controller</text>
<text x="193" y="120" text-anchor="middle" fill="#94a3b8" font-size="8">Kp + Ki/s + Kd·s</text>
<line x1="258" y1="110" x2="288" y2="110" stroke="#a78bfa" stroke-width="2"/>
<text x="268" y="105" fill="#a78bfa" font-size="8">U(s)</text>

<!-- Plant / Process block -->
<rect x="288" y="90" width="100" height="40" rx="6" fill="${BG}" stroke="#10b981" stroke-width="2.5"/>
<text x="338" y="107" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">Plant</text>
<text x="338" y="120" text-anchor="middle" fill="#94a3b8" font-size="8">G(s) = 1/(s²+2s+1)</text>
<line x1="388" y1="110" x2="430" y2="110" stroke="#10b981" stroke-width="2"/>
<circle cx="430" cy="110" r="3" fill="#10b981"/>

<!-- Output Y(s) -->
<line x1="430" y1="110" x2="520" y2="110" stroke="#38bdf8" stroke-width="2"/>
<text x="490" y="105" fill="#38bdf8" font-size="10" font-weight="bold">Y(s)</text>
<text x="482" y="117" fill="#38bdf8" font-size="8">Output</text>

<!-- Sensor / Feedback path -->
<line x1="430" y1="110" x2="430" y2="160" stroke="#ec4899" stroke-width="2"/>
<line x1="430" y1="160" x2="88" y2="160" stroke="#ec4899" stroke-width="2"/>
<line x1="88" y1="160" x2="88" y2="120" stroke="#ec4899" stroke-width="2"/>
<rect x="240" y="150" width="80" height="22" rx="4" fill="${BG}" stroke="#ec4899" stroke-width="1.5"/>
<text x="280" y="165" text-anchor="middle" fill="#ec4899" font-size="9">Sensor H(s)</text>
<text x="280" y="175" text-anchor="middle" fill="#ec4899" font-size="7">H(s) = 1 (unity)</text>

<!-- PID formula annotation -->
<rect x="15" y="190" width="${W-30}" height="35" rx="5" fill="#090d16" stroke="#334155" stroke-width="1"/>
<text x="25" y="204" fill="#f59e0b" font-size="9" font-weight="bold">u(t) = Kp·e(t) + Ki∫e(t)dt + Kd·de(t)/dt</text>
<text x="25" y="218" fill="#64748b" font-size="8">Kp=Proportional gain  •  Ki=Integral gain (eliminates SS error)  •  Kd=Derivative gain (reduces overshoot)</text>
`));

/* ══════════════════════════════════════════════════════════════
   3. SCR THYRISTOR FIRING / AC PHASE CONTROL CIRCUIT
   ══════════════════════════════════════════════════════════════ */
const SCR = enc(wrap(`
<text x="280" y="26" text-anchor="middle" fill="#94a3b8" font-size="11">SCR Thyristor — Half-Wave AC Phase Control Circuit</text>

<!-- AC Source -->
<circle cx="45" cy="115" r="20" fill="none" stroke="#f59e0b" stroke-width="2"/>
<text x="45" y="111" text-anchor="middle" fill="#f59e0b" font-size="9">AC Vs</text>
<text x="45" y="123" text-anchor="middle" fill="#f59e0b" font-size="8">230V</text>

<!-- Top wire to SCR Anode -->
<line x1="65" y1="100" x2="150" y2="100" stroke="#a78bfa" stroke-width="2"/>

<!-- SCR symbol -->
<!-- Diode part -->
<polygon points="150,88 150,112 180,100" fill="none" stroke="#a78bfa" stroke-width="2.5"/>
<line x1="180" y1="88" x2="180" y2="112" stroke="#a78bfa" stroke-width="2.5"/>
<text x="140" y="80" fill="#a78bfa" font-size="9">A (Anode)</text>
<text x="185" y="80" fill="#a78bfa" font-size="9">K (Cathode)</text>
<!-- Gate line -->
<line x1="180" y1="112" x2="180" y2="135" stroke="#ec4899" stroke-width="2"/>
<line x1="180" y1="135" x2="210" y2="135" stroke="#ec4899" stroke-width="2"/>
<text x="215" y="139" fill="#ec4899" font-size="9">Gate (G)</text>
<!-- SCR label -->
<text x="162" y="130" text-anchor="middle" fill="#a78bfa" font-size="10" font-weight="bold">SCR</text>
<text x="162" y="142" text-anchor="middle" fill="#94a3b8" font-size="8">BT151</text>

<!-- Cathode to Load -->
<line x1="180" y1="100" x2="290" y2="100" stroke="#a78bfa" stroke-width="2"/>

<!-- Load RL -->
<rect x="290" y="83" width="24" height="55" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="302" y="108" text-anchor="middle" fill="#10b981" font-size="8">RL</text>
<text x="302" y="118" text-anchor="middle" fill="#10b981" font-size="7">500Ω</text>
<line x1="302" y1="138" x2="302" y2="165" stroke="#10b981" stroke-width="2"/>

<!-- GND -->
<line x1="65" y1="130" x2="65" y2="165" stroke="#334155" stroke-width="2"/>
<line x1="65" y1="165" x2="302" y2="165" stroke="#334155" stroke-width="2"/>
<line x1="175" y1="165" x2="175" y2="175" stroke="#64748b" stroke-width="2"/>
<line x1="163" y1="175" x2="187" y2="175" stroke="#64748b" stroke-width="2.5"/>
<line x1="168" y1="181" x2="182" y2="181" stroke="#64748b" stroke-width="1.5"/>
<text x="175" y="196" text-anchor="middle" fill="#64748b" font-size="8">GND</text>

<!-- Gate firing circuit -->
<rect x="330" y="95" width="110" height="55" rx="6" fill="${BG}" stroke="#ec4899" stroke-width="2"/>
<text x="385" y="113" text-anchor="middle" fill="#ec4899" font-size="9" font-weight="bold">Gate Firing</text>
<text x="385" y="125" text-anchor="middle" fill="#ec4899" font-size="8">Circuit</text>
<text x="385" y="137" text-anchor="middle" fill="#94a3b8" font-size="8">Trigger @ angle α</text>
<line x1="330" y1="135" x2="210" y2="135" stroke="#ec4899" stroke-width="1.5" stroke-dasharray="4"/>

<!-- Vout label -->
<circle cx="500" cy="100" r="5" fill="#38bdf8"/>
<line x1="302" y1="100" x2="500" y2="100" stroke="#38bdf8" stroke-width="1.5"/>
<text x="512" y="104" fill="#38bdf8" font-size="10" font-weight="bold">Vout</text>

<!-- Firing angle waveform -->
<rect x="15" y="198" width="${W-30}" height="30" rx="5" fill="#090d16" stroke="#334155" stroke-width="1"/>
<text x="20" y="208" fill="#94a3b8" font-size="8" font-weight="bold">Output waveform (α=90°):</text>
<path d="M 130 225 Q 155 205 180 218 Q 205 228 230 225" fill="none" stroke="#38bdf8" stroke-width="2"/>
<text x="245" y="213" fill="#64748b" font-size="8">Vout(avg) = Vm(1+cosα)/(2π)  •  Power = V²rms/RL  •  α: firing angle</text>
`));

/* ══════════════════════════════════════════════════════════════
   4. 3-PHASE DELTA (Δ) LOAD
   ══════════════════════════════════════════════════════════════ */
const DELTA = enc(wrap(`
<text x="280" y="26" text-anchor="middle" fill="#94a3b8" font-size="11">3-Phase Delta (Δ) Connected Load — Power System</text>

<!-- Three corner nodes -->
<!-- Top node (R-Y line) -->
<circle cx="280" cy="55" r="6" fill="#ef4444"/>
<text x="280" y="43" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="bold">R</text>
<line x1="90" y1="55" x2="274" y2="55" stroke="#ef4444" stroke-width="2"/>
<text x="60" y="59" fill="#ef4444" font-size="9">IR (Line)</text>

<!-- Bottom-left node (Y) -->
<circle cx="150" cy="185" r="6" fill="#f59e0b"/>
<text x="130" y="200" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">Y</text>
<line x1="90" y1="185" x2="144" y2="185" stroke="#f59e0b" stroke-width="2"/>
<text x="60" y="189" fill="#f59e0b" font-size="9">IY (Line)</text>

<!-- Bottom-right node (B) -->
<circle cx="415" cy="185" r="6" fill="#38bdf8"/>
<text x="445" y="200" text-anchor="middle" fill="#38bdf8" font-size="9" font-weight="bold">B</text>
<line x1="421" y1="185" x2="490" y2="185" stroke="#38bdf8" stroke-width="2"/>
<text x="495" y="189" fill="#38bdf8" font-size="9">IB</text>

<!-- Delta impedances (three sides) -->
<!-- R-Y side (left diagonal) -->
<line x1="280" y1="61" x2="156" y2="179" stroke="#a78bfa" stroke-width="2"/>
<rect x="175" y="100" width="55" height="22" rx="3" fill="${SRF}" stroke="#a78bfa" stroke-width="2"/>
<text x="202" y="113" text-anchor="middle" fill="#a78bfa" font-size="8">ZRY=10∠30°Ω</text>
<text x="165" y="145" fill="#a78bfa" font-size="8" transform="rotate(-53,165,145)">IRY</text>

<!-- Y-B side (bottom) -->
<line x1="156" y1="185" x2="409" y2="185" stroke="#10b981" stroke-width="2"/>
<rect x="242" y="190" width="55" height="22" rx="3" fill="${SRF}" stroke="#10b981" stroke-width="2"/>
<text x="269" y="203" text-anchor="middle" fill="#10b981" font-size="8">ZYB=10∠30°Ω</text>
<text x="310" y="183" fill="#10b981" font-size="8">IYB →</text>

<!-- R-B side (right diagonal) -->
<line x1="280" y1="61" x2="409" y2="179" stroke="#ec4899" stroke-width="2"/>
<rect x="315" y="100" width="55" height="22" rx="3" fill="${SRF}" stroke="#ec4899" stroke-width="2"/>
<text x="342" y="113" text-anchor="middle" fill="#ec4899" font-size="8">ZRB=10∠30°Ω</text>
<text x="390" y="130" fill="#ec4899" font-size="8">IRB</text>

<!-- Key formulas right panel -->
<rect x="15" y="198" width="${W-30}" height="30" rx="5" fill="#090d16" stroke="#334155" stroke-width="1"/>
<text x="25" y="210" fill="#94a3b8" font-size="8" font-weight="bold">Delta Key Relations:</text>
<text x="130" y="210" fill="#10b981" font-size="8">VL = Vph (Delta: line = phase voltage)</text>
<text x="25" y="222" fill="#f59e0b" font-size="8">IL = √3 × Iph  •  P = 3×Vph×Iph×cosφ = √3×VL×IL×cosφ</text>
`));

/* ══════════════════════════════════════════════════════════════
   5. SPI BUS PROTOCOL TIMING DIAGRAM
   ══════════════════════════════════════════════════════════════ */
const SPI = enc(wrap(`
<text x="280" y="26" text-anchor="middle" fill="#94a3b8" font-size="11">SPI (Serial Peripheral Interface) Protocol — Timing Diagram</text>

<!-- Signal labels -->
<text x="25" y="62" fill="#ef4444" font-size="9" font-weight="bold">CS̄</text>
<text x="25" y="96" fill="#f59e0b" font-size="9" font-weight="bold">SCLK</text>
<text x="25" y="132" fill="#10b981" font-size="9" font-weight="bold">MOSI</text>
<text x="25" y="168" fill="#38bdf8" font-size="9" font-weight="bold">MISO</text>

<!-- CS (active LOW) -->
<polyline points="60,52 60,52 80,52 80,72 520,72 520,52" fill="none" stroke="#ef4444" stroke-width="2"/>
<text x="295" y="68" text-anchor="middle" fill="#ef4444" font-size="8">Active (LOW) — transaction in progress</text>

<!-- SCLK 8 pulses -->
<polyline points="
  60,104 80,104 80,86 100,86 100,104 120,104 120,86 140,86 140,104
  160,104 160,86 180,86 180,104 200,104 200,86 220,86 220,104
  240,104 240,86 260,86 260,104 280,104 280,86 300,86 300,104
  320,104 320,86 340,86 340,104 360,104 360,86 380,86 380,104
  400,104 520,104
" fill="none" stroke="#f59e0b" stroke-width="2"/>

<!-- MOSI data bits (D7..D0 = 10110101) -->
<text x="90" y="130" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">1</text>
<text x="130" y="130" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">0</text>
<text x="170" y="130" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">1</text>
<text x="210" y="130" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">1</text>
<text x="250" y="130" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">0</text>
<text x="290" y="130" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">1</text>
<text x="330" y="130" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">0</text>
<text x="370" y="130" text-anchor="middle" fill="#10b981" font-size="10" font-weight="bold">1</text>
<!-- MOSI bus line -->
<line x1="60" y1="125" x2="60" y2="135" stroke="#10b981" stroke-width="2"/>
<line x1="60" y1="125" x2="410" y2="125" stroke="#10b981" stroke-width="1" stroke-dasharray="2"/>
<line x1="60" y1="135" x2="410" y2="135" stroke="#10b981" stroke-width="1" stroke-dasharray="2"/>
<line x1="410" y1="125" x2="410" y2="135" stroke="#10b981" stroke-width="2"/>
<text x="450" y="131" fill="#10b981" font-size="9">0xB5</text>

<!-- MISO data bits (response 01001110) -->
<text x="90" y="167" text-anchor="middle" fill="#38bdf8" font-size="10">0</text>
<text x="130" y="167" text-anchor="middle" fill="#38bdf8" font-size="10">1</text>
<text x="170" y="167" text-anchor="middle" fill="#38bdf8" font-size="10">0</text>
<text x="210" y="167" text-anchor="middle" fill="#38bdf8" font-size="10">0</text>
<text x="250" y="167" text-anchor="middle" fill="#38bdf8" font-size="10">1</text>
<text x="290" y="167" text-anchor="middle" fill="#38bdf8" font-size="10">1</text>
<text x="330" y="167" text-anchor="middle" fill="#38bdf8" font-size="10">1</text>
<text x="370" y="167" text-anchor="middle" fill="#38bdf8" font-size="10">0</text>
<line x1="60" y1="160" x2="60" y2="172" stroke="#38bdf8" stroke-width="2"/>
<line x1="60" y1="160" x2="410" y2="160" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2"/>
<line x1="60" y1="172" x2="410" y2="172" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2"/>
<line x1="410" y1="160" x2="410" y2="172" stroke="#38bdf8" stroke-width="2"/>
<text x="450" y="167" fill="#38bdf8" font-size="9">0x4E</text>

<!-- Clock edge arrows showing sampling -->
<line x1="80" y1="80" x2="80" y2="140" stroke="#64748b" stroke-width="1" stroke-dasharray="2"/>
<line x1="120" y1="80" x2="120" y2="140" stroke="#64748b" stroke-width="1" stroke-dasharray="2"/>

<!-- Legend -->
<rect x="15" y="190" width="${W-30}" height="35" rx="5" fill="#090d16" stroke="#334155" stroke-width="1"/>
<text x="25" y="203" fill="#94a3b8" font-size="8" font-weight="bold">SPI Protocol:</text>
<text x="25" y="215" fill="#64748b" font-size="8">• Full-duplex: MOSI (Master→Slave) + MISO (Slave→Master) simultaneously</text>
<text x="25" y="225" fill="#64748b" font-size="8">• CS̄ LOW = active transaction  •  Data sampled on SCLK rising edge (Mode 0)</text>
`));

/* ══════════════════════════════════════════════════════════════
   QUESTION BANK
   ══════════════════════════════════════════════════════════════ */
const QUESTIONS = [

  // ── Buck Converter ─────────────────────────────────────────
  { question_text: 'In the Buck (step-down) converter circuit above with Vin=24V, if the MOSFET PWM duty cycle D=0.5 (50%), what is the output voltage Vout?',
    options: ['12V', '24V', '6V', '48V'],
    correct_answer: '12V',
    topic: 'Power Electronics', concept: 'Buck Converter Output Voltage',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: BUCK },

  { question_text: 'In the Buck converter above, what is the function of the freewheeling diode D1 connected from the switching node to GND?',
    options: ['Provides a current path for inductor L when Q1 is OFF', 'Rectifies AC input', 'Filters output ripple', 'Protects Q1 from overvoltage'],
    correct_answer: 'Provides a current path for inductor L when Q1 is OFF',
    topic: 'Power Electronics', concept: 'Buck Converter Freewheeling Diode',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: BUCK },

  { question_text: 'In the Buck converter shown, if Vin=24V, L=100μH, switching frequency f=100kHz, and D=0.4, what is the inductor current ripple ΔIL?',
    options: ['576 mA', '240 mA', '960 mA', '100 mA'],
    correct_answer: '576 mA',
    topic: 'Power Electronics', concept: 'Buck Converter Inductor Ripple',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: BUCK },

  { question_text: 'From the Buck converter circuit, increasing the PWM duty cycle D while keeping Vin constant will:',
    options: ['Increase Vout (Vout = D × Vin)', 'Decrease Vout', 'Increase switching frequency', 'Have no effect on Vout'],
    correct_answer: 'Increase Vout (Vout = D × Vin)',
    topic: 'Power Electronics', concept: 'Buck Converter Duty Cycle Effect',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: BUCK },

  // ── PID Controller ─────────────────────────────────────────
  { question_text: 'In the PID controller block diagram shown above, what does the integral term Ki∫e(t)dt primarily eliminate in the system response?',
    options: ['Steady-state error', 'Overshoot', 'Rise time', 'Settling time'],
    correct_answer: 'Steady-state error',
    topic: 'Circuit Analysis & Network Theory', concept: 'PID Integral Term Function',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: PID },

  { question_text: 'In the PID closed-loop system above, error signal E(s) is defined as:',
    options: ['E(s) = R(s) – Y(s) (setpoint minus actual output)', 'E(s) = Y(s) – R(s)', 'E(s) = R(s) × Y(s)', 'E(s) = R(s) + Y(s)'],
    correct_answer: 'E(s) = R(s) – Y(s) (setpoint minus actual output)',
    topic: 'Circuit Analysis & Network Theory', concept: 'PID Error Signal',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: PID },

  { question_text: 'In the PID system block diagram above, the derivative term Kd × de(t)/dt has which effect on the transient response?',
    options: ['Reduces overshoot and improves stability by damping oscillations', 'Increases overshoot', 'Eliminates steady-state error', 'Increases rise time'],
    correct_answer: 'Reduces overshoot and improves stability by damping oscillations',
    topic: 'Circuit Analysis & Network Theory', concept: 'PID Derivative Term Effect',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: PID },

  { question_text: 'In the PID control system shown, the closed-loop transfer function T(s) = G(s)×C(s) / (1 + G(s)×C(s)×H(s)) where H(s)=1 (unity feedback). What happens as loop gain → ∞?',
    options: ['T(s) → 1 (output perfectly tracks input)', 'T(s) → 0', 'System becomes unstable immediately', 'T(s) → G(s)'],
    correct_answer: 'T(s) → 1 (output perfectly tracks input)',
    topic: 'Circuit Analysis & Network Theory', concept: 'PID Closed-Loop Transfer Function',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: PID },

  // ── SCR / Thyristor ────────────────────────────────────────
  { question_text: 'In the SCR half-wave phase control circuit above, if Vm=325V (peak) and firing angle α=60°, what is the average output voltage Vout(avg)?',
    options: ['116 V', '103.5 V', '146 V', '65 V'],
    correct_answer: '116 V',
    topic: 'Power Electronics', concept: 'SCR Average Output Voltage',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: SCR },

  { question_text: 'From the SCR thyristor circuit above, once the SCR turns ON via a gate pulse, what causes it to turn OFF?',
    options: ['AC supply current falls below holding current IH at the end of +ve half-cycle', 'Removing the gate pulse immediately turns it off', 'Applying reverse gate voltage', 'Disconnecting the load'],
    correct_answer: 'AC supply current falls below holding current IH at the end of +ve half-cycle',
    topic: 'Power Electronics', concept: 'SCR Turn-OFF Mechanism',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: SCR },

  { question_text: 'In the SCR circuit shown, increasing the firing angle α from 30° to 120° will:',
    options: ['Decrease average output power delivered to RL', 'Increase average output power', 'Have no effect on power', 'Damage the SCR'],
    correct_answer: 'Decrease average output power delivered to RL',
    topic: 'Power Electronics', concept: 'SCR Firing Angle Power Control',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: SCR },

  // ── 3-Phase Delta ──────────────────────────────────────────
  { question_text: 'In the 3-phase delta (Δ) connected load above, how does the line voltage VL relate to the phase voltage Vph?',
    options: ['VL = Vph (they are equal in delta)', 'VL = √3 × Vph', 'VL = Vph / √3', 'VL = 3 × Vph'],
    correct_answer: 'VL = Vph (they are equal in delta)',
    topic: 'Power Electronics', concept: '3-Phase Delta Voltage Relation',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: DELTA },

  { question_text: 'In the 3-phase delta circuit above with balanced loads Zph=10∠30°Ω and VL=400V, calculate the phase current Iph.',
    options: ['40 A', '23.1 A', '69.3 A', '13.3 A'],
    correct_answer: '40 A',
    topic: 'Power Electronics', concept: '3-Phase Delta Phase Current',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'EEE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: DELTA },

  { question_text: 'In the 3-phase delta system shown above, the line current IL relates to phase current Iph as:',
    options: ['IL = √3 × Iph', 'IL = Iph', 'IL = Iph / √3', 'IL = 3 × Iph'],
    correct_answer: 'IL = √3 × Iph',
    topic: 'Power Electronics', concept: '3-Phase Delta Line Current',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'EEE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: DELTA },

  { question_text: 'Calculate the total 3-phase real power for the delta circuit above with VL=400V, IL=69.3A, power factor cosφ=cos(30°)=0.866.',
    options: ['≈ 41,600 W (41.6 kW)', '≈ 24,000 W', '≈ 48,000 W', '≈ 16,000 W'],
    correct_answer: '≈ 41,600 W (41.6 kW)',
    topic: 'Power Electronics', concept: '3-Phase Delta Total Power',
    difficulty: 'hard', structure_type: 'circuit_analysis', department: 'EEE', marks: 3,
    domain_type: 'circuit_analysis', circuit_diagram_url: DELTA },

  // ── SPI Timing Diagram ─────────────────────────────────────
  { question_text: 'In the SPI timing diagram above, how many clock pulses (SCLK) are required to transfer 1 byte (8 bits) of data on MOSI?',
    options: ['8 clock pulses', '4 clock pulses', '16 clock pulses', '1 clock pulse'],
    correct_answer: '8 clock pulses',
    topic: 'Communication Systems & Microprocessors', concept: 'SPI Clock Cycles per Byte',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: SPI },

  { question_text: 'From the SPI protocol timing diagram above, what does the CS̄ (Chip Select) signal going LOW indicate?',
    options: ['A new SPI transaction has started (slave is selected)', 'Transaction has ended', 'Clock is paused', 'MOSI data is invalid'],
    correct_answer: 'A new SPI transaction has started (slave is selected)',
    topic: 'Communication Systems & Microprocessors', concept: 'SPI Chip Select Function',
    difficulty: 'easy', structure_type: 'circuit_analysis', department: 'ECE', marks: 1,
    domain_type: 'circuit_analysis', circuit_diagram_url: SPI },

  { question_text: 'In the SPI timing diagram, MOSI transmits 0xB5 (10110101) and simultaneously MISO returns 0x4E (01001110). This confirms SPI is:',
    options: ['Full-duplex (simultaneous bidirectional data transfer)', 'Half-duplex (one direction at a time)', 'Simplex (one direction only)', 'Asynchronous (no clock)'],
    correct_answer: 'Full-duplex (simultaneous bidirectional data transfer)',
    topic: 'Communication Systems & Microprocessors', concept: 'SPI Full-Duplex Operation',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: SPI },

  { question_text: 'From the SPI timing above (Mode 0), data on MOSI/MISO is sampled (captured) at which SCLK edge?',
    options: ['Rising edge of SCLK (CPOL=0, CPHA=0)', 'Falling edge of SCLK', 'Both edges', 'CS̄ falling edge'],
    correct_answer: 'Rising edge of SCLK (CPOL=0, CPHA=0)',
    topic: 'Communication Systems & Microprocessors', concept: 'SPI Mode 0 Sampling Edge',
    difficulty: 'medium', structure_type: 'circuit_analysis', department: 'ECE', marks: 2,
    domain_type: 'circuit_analysis', circuit_diagram_url: SPI },
];

/* ══════════════════════════════════════════════════════════════
   SEED
   ══════════════════════════════════════════════════════════════ */
async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB...');

    let exam = await Exam.findOne({ title: 'ECE & EEE Circuit Analysis Technical Exam' });
    if (!exam) {
      exam = await Exam.create({
        title: 'ECE & EEE Circuit Analysis Technical Exam',
        description: 'Circuit-image-based MCQs for ECE & EEE',
        duration: 120, total_questions: 0,
        difficulty_distribution: { easy: 0, medium: 0, hard: 0 },
        per_question_time: { easy: 45, medium: 60, hard: 90 },
        questions: [], assigned_students: []
      });
    }

    const docs = QUESTIONS.map(q => ({ ...q, examId: exam._id }));
    const inserted = await Question.insertMany(docs);
    console.log(`\n🎉 Seeded ${inserted.length} advanced circuit questions!\n`);

    exam.questions.push(...inserted.map(q => q._id));
    exam.total_questions = exam.questions.length;
    exam.duration = 120;
    await exam.save();

    console.log(`✔ Exam now has ${exam.questions.length} total questions (120 min).\n`);
    console.log('📊 New advanced circuits:');
    console.log('  • Buck DC-DC Converter          → 4 Qs (EEE) — Vout=D×Vin, freewheeling diode, ripple');
    console.log('  • PID Controller Block Diagram  → 4 Qs (EEE) — error, P/I/D terms, closed-loop TF');
    console.log('  • SCR Thyristor Phase Control   → 3 Qs (EEE) — firing angle, turn-off, power control');
    console.log('  • 3-Phase Delta (Δ) Load        → 4 Qs (EEE) — VL=Vph, IL=√3×Iph, 3-phase power');
    console.log('  • SPI Bus Protocol Timing       → 4 Qs (ECE) — CS̄, MOSI/MISO, full-duplex, Mode 0');
    console.log('\n  Total new: 19 questions  •  5 new advanced schematics');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
seed();
