/**
 * seedECEQuestions.js
 * Seeds ECE & EEE coding questions with embedded circuit diagram SVGs
 * Run: node seedECEQuestions.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CodingQuestion = require('./models/CodingQuestion');

const MONGO_URI = process.env.MONGO_URI;

// ── SVG Circuit Diagrams ──────────────────────────────────────────────────────

const SVG_4BIT_COUNTER = `<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg" font-family="monospace" font-size="12">
  <rect width="600" height="260" fill="#0f172a" rx="12"/>
  <!-- CLK -->
  <text x="20" y="50" fill="#94a3b8">CLK</text>
  <line x1="60" y1="45" x2="100" y2="45" stroke="#38bdf8" stroke-width="2"/>
  <polyline points="100,45 100,30 120,30 120,45 140,45 140,30 160,30 160,45 180,45" stroke="#38bdf8" stroke-width="2" fill="none"/>
  <!-- D Flip-Flop boxes -->
  <rect x="200" y="20" width="60" height="80" fill="#1e293b" stroke="#6366f1" stroke-width="2" rx="4"/>
  <text x="218" y="65" fill="#818cf8">FF-0</text>
  <rect x="280" y="20" width="60" height="80" fill="#1e293b" stroke="#6366f1" stroke-width="2" rx="4"/>
  <text x="298" y="65" fill="#818cf8">FF-1</text>
  <rect x="360" y="20" width="60" height="80" fill="#1e293b" stroke="#6366f1" stroke-width="2" rx="4"/>
  <text x="378" y="65" fill="#818cf8">FF-2</text>
  <rect x="440" y="20" width="60" height="80" fill="#1e293b" stroke="#6366f1" stroke-width="2" rx="4"/>
  <text x="458" y="65" fill="#818cf8">FF-3</text>
  <!-- Q outputs -->
  <line x1="260" y1="60" x2="280" y2="60" stroke="#10b981" stroke-width="2"/>
  <line x1="340" y1="60" x2="360" y2="60" stroke="#10b981" stroke-width="2"/>
  <line x1="420" y1="60" x2="440" y2="60" stroke="#10b981" stroke-width="2"/>
  <line x1="500" y1="60" x2="530" y2="60" stroke="#10b981" stroke-width="2"/>
  <!-- Labels -->
  <text x="200" y="130" fill="#94a3b8">Q[0]</text>
  <text x="280" y="130" fill="#94a3b8">Q[1]</text>
  <text x="360" y="130" fill="#94a3b8">Q[2]</text>
  <text x="440" y="130" fill="#94a3b8">Q[3]</text>
  <!-- RST line -->
  <text x="20" y="100" fill="#94a3b8">RST</text>
  <line x1="60" y1="95" x2="200" y2="95" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3"/>
  <line x1="200" y1="95" x2="500" y2="95" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3"/>
  <!-- Waveform output -->
  <text x="20" y="175" fill="#f8fafc" font-size="13" font-weight="bold">Output Waveform (Q[3:0]):</text>
  <polyline points="60,215 80,215 80,200 100,200 100,215 120,215 120,195 140,195 140,215 160,215 160,190 180,190 180,215 200,215 200,185 220,185 220,215 240,215" stroke="#10b981" stroke-width="2" fill="none"/>
  <text x="250" y="218" fill="#64748b">0→1→2→...→15→0 (cyclic)</text>
</svg>`;

const SVG_PWM_GENERATOR = `<svg viewBox="0 0 600 280" xmlns="http://www.w3.org/2000/svg" font-family="monospace" font-size="12">
  <rect width="600" height="280" fill="#0f172a" rx="12"/>
  <!-- Title -->
  <text x="180" y="25" fill="#f8fafc" font-size="14" font-weight="bold">PWM Signal Generator — Timer/Counter Circuit</text>
  <!-- MCU Box -->
  <rect x="40" y="50" width="120" height="150" fill="#1e293b" stroke="#f59e0b" stroke-width="2" rx="6"/>
  <text x="68" y="75" fill="#fbbf24" font-size="13" font-weight="bold">MCU</text>
  <text x="52" y="100" fill="#94a3b8">Timer/Counter</text>
  <text x="52" y="118" fill="#94a3b8">Compare Reg</text>
  <text x="52" y="136" fill="#94a3b8">OCR = duty*255</text>
  <text x="52" y="158" fill="#94a3b8">TCCR Config</text>
  <!-- PWM Out Pin -->
  <line x1="160" y1="130" x2="220" y2="130" stroke="#f59e0b" stroke-width="2.5"/>
  <text x="165" y="125" fill="#fbbf24" font-size="10">OC0 PIN</text>
  <!-- Waveform -->
  <text x="225" y="60" fill="#94a3b8">PWM Output (50% Duty Cycle):</text>
  <polyline points="220,130 220,90 270,90 270,130 320,130 320,90 370,90 370,130 420,130 420,90 470,90 470,130 520,130" stroke="#10b981" stroke-width="2.5" fill="none"/>
  <text x="230" y="155" fill="#64748b">|←— Period T —→|</text>
  <line x1="220" y1="148" x2="320" y2="148" stroke="#64748b" stroke-width="1" marker-end="url(#arr)"/>
  <!-- Load resistor -->
  <rect x="400" y="50" width="60" height="30" fill="none" stroke="#818cf8" stroke-width="2" rx="4"/>
  <text x="415" y="70" fill="#818cf8">R Load</text>
  <line x1="460" y1="65" x2="520" y2="65" stroke="#818cf8" stroke-width="1.5"/>
  <text x="525" y="68" fill="#94a3b8">LED / Motor</text>
  <!-- Formula -->
  <rect x="40" y="215" width="520" height="50" fill="#1e293b" rx="8"/>
  <text x="55" y="238" fill="#fbbf24" font-size="13">Duty Cycle = OCR0 / 255 × 100%</text>
  <text x="55" y="255" fill="#94a3b8">f_PWM = f_clk / (Prescaler × 256)  |  e.g. 16MHz / (64×256) ≈ 976 Hz</text>
</svg>`;

const SVG_OP_AMP_FILTER = `<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" font-family="monospace" font-size="12">
  <rect width="600" height="300" fill="#0f172a" rx="12"/>
  <text x="160" y="28" fill="#f8fafc" font-size="14" font-weight="bold">Active Low-Pass Filter — Op-Amp RC Circuit</text>
  <!-- Input signal -->
  <text x="20" y="130" fill="#94a3b8">Vin</text>
  <line x1="48" y1="125" x2="90" y2="125" stroke="#38bdf8" stroke-width="2"/>
  <!-- R1 resistor -->
  <rect x="90" y="115" width="50" height="20" fill="none" stroke="#f59e0b" stroke-width="2" rx="3"/>
  <text x="100" y="129" fill="#fbbf24">R1</text>
  <line x1="140" y1="125" x2="200" y2="125" stroke="#38bdf8" stroke-width="2"/>
  <!-- Op-Amp triangle -->
  <polygon points="200,100 200,155 255,128" fill="#1e293b" stroke="#818cf8" stroke-width="2.5"/>
  <text x="208" y="122" fill="#a78bfa">−</text>
  <text x="208" y="142" fill="#a78bfa">+</text>
  <text x="230" y="132" fill="#818cf8" font-size="11">LM741</text>
  <!-- Output -->
  <line x1="255" y1="128" x2="320" y2="128" stroke="#10b981" stroke-width="2"/>
  <text x="325" y="132" fill="#10b981">Vout</text>
  <!-- C1 capacitor (feedback path) -->
  <line x1="255" y1="128" x2="285" y2="128" stroke="#10b981" stroke-width="1"/>
  <line x1="285" y1="80" x2="285" y2="128" stroke="#a78bfa" stroke-width="1.5"/>
  <line x1="270" y1="80" x2="300" y2="80" stroke="#a78bfa" stroke-width="2.5"/>
  <line x1="270" y1="75" x2="300" y2="75" stroke="#a78bfa" stroke-width="2.5"/>
  <text x="305" y="82" fill="#a78bfa">C1</text>
  <line x1="285" y1="70" x2="200" y2="70" stroke="#a78bfa" stroke-width="1.5"/>
  <line x1="200" y1="70" x2="200" y2="125" stroke="#a78bfa" stroke-width="1.5"/>
  <!-- GND -->
  <line x1="200" y1="155" x2="200" y2="180" stroke="#64748b" stroke-width="2"/>
  <line x1="185" y1="180" x2="215" y2="180" stroke="#64748b" stroke-width="2"/>
  <line x1="190" y1="186" x2="210" y2="186" stroke="#64748b" stroke-width="1.5"/>
  <line x1="195" y1="192" x2="205" y2="192" stroke="#64748b" stroke-width="1"/>
  <text x="210" y="192" fill="#64748b">GND</text>
  <!-- Formula Box -->
  <rect x="40" y="215" width="520" height="70" fill="#1e293b" rx="8"/>
  <text x="55" y="238" fill="#fbbf24" font-size="13">Cutoff Frequency Formula:</text>
  <text x="55" y="258" fill="#38bdf8" font-size="14">f_c = 1 / (2π × R1 × C1)</text>
  <text x="55" y="278" fill="#94a3b8">Example: R1=10kΩ, C1=1μF → f_c = 1/(2π×10000×0.000001) ≈ 15.92 Hz</text>
</svg>`;

const SVG_SPI_MODULE = `<svg viewBox="0 0 620 300" xmlns="http://www.w3.org/2000/svg" font-family="monospace" font-size="12">
  <rect width="620" height="300" fill="#0f172a" rx="12"/>
  <text x="170" y="28" fill="#f8fafc" font-size="14" font-weight="bold">SPI Interface — Master/Slave Register Design</text>
  <!-- Master box -->
  <rect x="30" y="50" width="130" height="160" fill="#1e293b" stroke="#6366f1" stroke-width="2" rx="6"/>
  <text x="62" y="75" fill="#818cf8" font-size="13" font-weight="bold">SPI MASTER</text>
  <text x="40" y="100" fill="#94a3b8">SCLK Gen</text>
  <text x="40" y="118" fill="#94a3b8">MOSI Shift Reg</text>
  <text x="40" y="136" fill="#94a3b8">MISO Capture</text>
  <text x="40" y="154" fill="#94a3b8">CS/SS Control</text>
  <!-- Slave box -->
  <rect x="420" y="50" width="130" height="160" fill="#1e293b" stroke="#10b981" stroke-width="2" rx="6"/>
  <text x="452" y="75" fill="#10b981" font-size="13" font-weight="bold">SPI SLAVE</text>
  <text x="430" y="100" fill="#94a3b8">SCLK Input</text>
  <text x="430" y="118" fill="#94a3b8">MOSI Capture</text>
  <text x="430" y="136" fill="#94a3b8">MISO Shift Reg</text>
  <text x="430" y="154" fill="#94a3b8">CS Detect</text>
  <!-- SCLK line -->
  <line x1="160" y1="90" x2="420" y2="90" stroke="#f59e0b" stroke-width="2"/>
  <text x="270" y="85" fill="#fbbf24">SCLK</text>
  <!-- MOSI line -->
  <line x1="160" y1="115" x2="420" y2="115" stroke="#38bdf8" stroke-width="2"/>
  <text x="270" y="110" fill="#38bdf8">MOSI →</text>
  <!-- MISO line -->
  <line x1="160" y1="140" x2="420" y2="140" stroke="#818cf8" stroke-width="2"/>
  <text x="270" y="135" fill="#818cf8">← MISO</text>
  <!-- CS line -->
  <line x1="160" y1="165" x2="420" y2="165" stroke="#ef4444" stroke-width="2" stroke-dasharray="5,3"/>
  <text x="275" y="160" fill="#ef4444">CS/SS</text>
  <!-- Timing -->
  <rect x="30" y="230" width="560" height="58" fill="#1e293b" rx="8"/>
  <text x="45" y="250" fill="#fbbf24">SPI Timing:</text>
  <polyline points="120,265 140,265 140,248 155,248 155,265 170,265 170,248 185,248 185,265 200,265 200,248 215,248 215,265 230,265" stroke="#f59e0b" stroke-width="1.5" fill="none"/>
  <text x="240" y="265" fill="#94a3b8">SCLK: Idle LOW, Active Edge samples MOSI/MISO</text>
</svg>`;

const SVG_BUCK_CONVERTER = `<svg viewBox="0 0 620 300" xmlns="http://www.w3.org/2000/svg" font-family="monospace" font-size="12">
  <rect width="620" height="300" fill="#0f172a" rx="12"/>
  <text x="180" y="28" fill="#f8fafc" font-size="14" font-weight="bold">DC-DC Buck Converter Circuit</text>
  <!-- Vin source -->
  <circle cx="50" cy="130" r="28" fill="none" stroke="#38bdf8" stroke-width="2"/>
  <text x="35" y="128" fill="#38bdf8">Vin</text>
  <text x="30" y="144" fill="#38bdf8">12V DC</text>
  <!-- MOSFET Switch -->
  <line x1="78" y1="115" x2="130" y2="115" stroke="#38bdf8" stroke-width="2"/>
  <rect x="130" y="100" width="35" height="30" fill="#1e293b" stroke="#f59e0b" stroke-width="2" rx="3"/>
  <text x="133" y="120" fill="#fbbf24">SW</text>
  <!-- Inductor L -->
  <line x1="165" y1="115" x2="195" y2="115" stroke="#38bdf8" stroke-width="2"/>
  <path d="M195,115 Q205,95 215,115 Q225,95 235,115 Q245,95 255,115 Q265,95 275,115" stroke="#a78bfa" stroke-width="2.5" fill="none"/>
  <text x="225" y="102" fill="#a78bfa">L</text>
  <line x1="275" y1="115" x2="340" y2="115" stroke="#38bdf8" stroke-width="2"/>
  <!-- Capacitor C -->
  <line x1="340" y1="115" x2="340" y2="145" stroke="#38bdf8" stroke-width="2"/>
  <line x1="318" y1="145" x2="362" y2="145" stroke="#818cf8" stroke-width="3"/>
  <line x1="318" y1="152" x2="362" y2="152" stroke="#818cf8" stroke-width="3"/>
  <text x="368" y="150" fill="#818cf8">C</text>
  <line x1="340" y1="152" x2="340" y2="175" stroke="#64748b" stroke-width="2"/>
  <!-- Diode -->
  <line x1="147" y1="115" x2="147" y2="145" stroke="#ef4444" stroke-width="2"/>
  <polygon points="130,145 164,145 147,165" fill="#ef4444"/>
  <line x1="147" y1="165" x2="147" y2="175" stroke="#ef4444" stroke-width="2"/>
  <text x="155" y="158" fill="#ef4444">D</text>
  <!-- GND -->
  <line x1="50" y1="158" x2="50" y2="175" stroke="#64748b" stroke-width="2"/>
  <line x1="30" y1="175" x2="360" y2="175" stroke="#64748b" stroke-width="2"/>
  <!-- Load -->
  <line x1="340" y1="115" x2="450" y2="115" stroke="#10b981" stroke-width="2"/>
  <rect x="450" y="100" width="50" height="30" fill="none" stroke="#10b981" stroke-width="2" rx="4"/>
  <text x="458" y="120" fill="#10b981">R Load</text>
  <line x1="500" y1="115" x2="520" y2="115" stroke="#10b981" stroke-width="2"/>
  <text x="525" y="120" fill="#10b981">Vout</text>
  <!-- Formula box -->
  <rect x="30" y="195" width="560" height="90" fill="#1e293b" rx="8"/>
  <text x="45" y="215" fill="#fbbf24" font-size="13">Buck Converter Equations:</text>
  <text x="45" y="235" fill="#38bdf8" font-size="13">Vout = D × Vin  (where D = duty cycle, 0 ≤ D ≤ 1)</text>
  <text x="45" y="255" fill="#94a3b8">Inductor Ripple: ΔiL = (Vin − Vout) × D / (f × L)</text>
  <text x="45" y="275" fill="#94a3b8">Capacitor Ripple: ΔVout = ΔiL / (8 × f × C)</text>
</svg>`;

// ── ECE/EEE Questions ─────────────────────────────────────────────────────────

const ECE_EEE_QUESTIONS = [

  // ── ECE Q1: 4-bit Counter (Verilog) ─────────────────────────────────────────
  {
    title: '4-Bit Synchronous Up Counter (Verilog)',
    department: 'ECE',
    domain_type: 'verilog',
    difficulty: 'Medium',
    tags: ['Verilog', 'Sequential Logic', 'Flip-Flop', 'Counter'],
    languagesSupported: ['verilog'],
    description: `## 4-Bit Synchronous Up Counter

Design a **4-bit synchronous up counter** using Verilog HDL that:
- Counts from \`0000\` to \`1111\` (0 to 15) and wraps back to 0.
- Has a synchronous active-high **reset** signal that forces the count to 0.
- Is driven by a rising-edge triggered **clock**.

### Circuit Reference
The circuit shows four D Flip-Flops connected in series sharing a common CLK and RST line. Each Q output represents one bit of the 4-bit count value.

### Requirements
- **Module name**: \`counter_4bit\`
- **Inputs**: \`clk\` (1-bit), \`reset\` (1-bit)
- **Output**: \`q\` (4-bit register \`[3:0]\`)

### Test Behaviour
| Clock Cycle | reset | q      |
|-------------|-------|--------|
| 0           | 1     | 0000   |
| 1           | 0     | 0001   |
| 2           | 0     | 0010   |
| 3           | 0     | 0011   |`,
    circuitDiagram: SVG_4BIT_COUNTER,
    circuitDescription: 'Four cascaded D Flip-Flops sharing CLK & RST. Q[0] is the LSB (least significant bit) and Q[3] is the MSB (most significant bit). On each rising clock edge the counter increments by 1.',
    starterCode: {
      verilog: `// 4-Bit Synchronous Up Counter
// Module must be named: counter_4bit
// Inputs: clk (1-bit), reset (1-bit active-high synchronous)
// Output: q [3:0]

module counter_4bit(
    input wire clk,
    input wire reset,
    output reg [3:0] q
);
    // Write your logic here
    
endmodule`,
    },
    testCases: [
      { input: 'reset=1', expectedOutput: 'COUNTER_RESET: q=0000', isHidden: false },
      { input: 'reset=0,cycles=5', expectedOutput: 'COUNTER_SEQ: q=0001,0010,0011,0100,0101', isHidden: false },
      { input: 'reset=0,cycles=16', expectedOutput: 'COUNTER_WRAP: q wraps 0000 after 1111', isHidden: true },
    ],
    examples: [
      { input: 'reset=1', output: 'q=4\'b0000', explanation: 'Synchronous reset forces all bits to 0 on the next clock edge.' },
      { input: 'reset=0 (after 3 cycles)', output: 'q=4\'b0011', explanation: 'After 3 rising clock edges without reset, counter reaches binary 3.' },
    ],
  },

  // ── ECE Q2: SPI Master Module (Verilog) ─────────────────────────────────────
  {
    title: 'SPI Master Shift Register Module (Verilog)',
    department: 'ECE',
    domain_type: 'verilog',
    difficulty: 'Hard',
    tags: ['Verilog', 'SPI', 'Serial Interface', 'Shift Register'],
    languagesSupported: ['verilog'],
    description: `## SPI Master Shift Register Module

Implement a **SPI Master shift register** in Verilog that transmits 8 bits of data serially over the MOSI line, synchronized to a generated SCLK signal.

### Circuit Reference
The circuit shows a Master module with internal shift register connected to the Slave via 4 wires: SCLK, MOSI, MISO, and CS.

### Requirements
- **Module name**: \`spi_master\`
- **Inputs**: \`clk\`, \`reset\`, \`start\`, \`data_in [7:0]\`
- **Outputs**: \`sclk\`, \`mosi\`, \`cs_n\`, \`done\`
- On asserting \`start\`, CS goes low and 8 bits are shifted MSB-first on MOSI.
- After all 8 bits transmitted, \`done\` goes high and \`cs_n\` returns high.`,
    circuitDiagram: SVG_SPI_MODULE,
    circuitDescription: 'SPI protocol uses 4 signals: SCLK (clock generated by master), MOSI (master-out-slave-in data), MISO (slave-out-master-in data), CS (chip select, active LOW). Data is shifted MSB-first on each rising edge of SCLK.',
    starterCode: {
      verilog: `// SPI Master Module
// Transmits 8-bit data MSB first over MOSI line

module spi_master(
    input wire clk,
    input wire reset,
    input wire start,
    input wire [7:0] data_in,
    output reg sclk,
    output reg mosi,
    output reg cs_n,
    output reg done
);
    // Write your SPI shift register logic here
    
endmodule`,
    },
    testCases: [
      { input: 'data=0xA5,start=1', expectedOutput: 'SPI_TX: MOSI=10100101 CS_LOW=1 DONE=1', isHidden: false },
      { input: 'data=0xFF,start=1', expectedOutput: 'SPI_TX: MOSI=11111111 CS_LOW=1 DONE=1', isHidden: false },
      { input: 'reset=1', expectedOutput: 'SPI_RESET: CS_HIGH=1 DONE=0', isHidden: true },
    ],
    examples: [
      { input: 'data_in=8\'hA5, start=1', output: 'MOSI shifts 10100101 MSB first', explanation: '0xA5 = 1010 0101 in binary. MSB (bit 7=1) is transmitted first on MOSI.' },
    ],
  },

  // ── ECE Q3: Op-Amp Cutoff Frequency (Python for ECE) ─────────────────────
  {
    title: 'Op-Amp Active Low-Pass Filter — Cutoff Frequency Calculator',
    department: 'ECE',
    domain_type: 'dsp',
    difficulty: 'Easy',
    tags: ['Op-Amp', 'Filter', 'Cutoff Frequency', 'Signal Processing'],
    languagesSupported: ['python', 'cpp'],
    description: `## Op-Amp Active Low-Pass Filter

Given the active low-pass filter circuit with Op-Amp, resistor R1, and capacitor C1:

### Circuit Reference
The circuit shows an LM741 Op-Amp in inverting configuration with a feedback capacitor C1 forming a first-order low-pass filter.

### Task
Write a program that takes R1 (in Ohms) and C1 (in Farads) as input and prints the **cutoff frequency** in Hz, rounded to 2 decimal places.

### Formula
$$f_c = \\frac{1}{2\\pi \\times R1 \\times C1}$$

### Input Format
\`\`\`
R1 C1
\`\`\`
(space separated, R1 in Ohms, C1 in Farads)

### Output Format
\`\`\`
Cutoff Frequency: X.XX Hz
\`\`\``,
    circuitDiagram: SVG_OP_AMP_FILTER,
    circuitDescription: 'Active Low-Pass Filter using LM741 Op-Amp. R1 is the input series resistor. C1 is the feedback capacitor between the output and inverting input. The circuit passes frequencies below f_c and attenuates frequencies above f_c at -20 dB/decade.',
    starterCode: {
      python: `import math

# Read R1 (Ohms) and C1 (Farads) from input
line = input().split()
R1 = float(line[0])
C1 = float(line[1])

# Calculate cutoff frequency: f_c = 1 / (2 * pi * R1 * C1)
# TODO: Write your calculation here

# Print result as: Cutoff Frequency: X.XX Hz
`,
      cpp: `#include <iostream>
#include <cmath>
#include <iomanip>
using namespace std;

int main() {
    double R1, C1;
    cin >> R1 >> C1;
    
    // Calculate f_c = 1 / (2 * pi * R1 * C1)
    // TODO: Write your calculation here
    
    // Print: Cutoff Frequency: X.XX Hz
    return 0;
}`,
    },
    testCases: [
      { input: '10000 0.000001', expectedOutput: 'Cutoff Frequency: 15.92 Hz', isHidden: false },
      { input: '1000 0.0000001', expectedOutput: 'Cutoff Frequency: 1591.55 Hz', isHidden: false },
      { input: '4700 0.0000047', expectedOutput: 'Cutoff Frequency: 7.19 Hz', isHidden: false },
      { input: '22000 0.00000001', expectedOutput: 'Cutoff Frequency: 723.43 Hz', isHidden: true },
    ],
    examples: [
      { input: '10000 0.000001', output: 'Cutoff Frequency: 15.92 Hz', explanation: 'f_c = 1/(2π×10000×0.000001) = 1/(0.0628) ≈ 15.92 Hz' },
    ],
  },

  // ── EEE Q1: PWM Generator (Embedded C) ──────────────────────────────────────
  {
    title: 'PWM Signal Generator using Timer (Embedded C)',
    department: 'EEE',
    domain_type: 'embedded_c',
    difficulty: 'Medium',
    tags: ['Embedded C', 'PWM', 'Timer', 'Microcontroller', 'GPIO'],
    languagesSupported: ['c_embedded'],
    description: `## PWM Signal Generator using Timer Counter (Embedded C)

Write an **Embedded C** program for an ATmega328P microcontroller (Arduino UNO) that configures **Timer0** in **Fast PWM Mode** to generate a PWM signal on the OC0A pin (PD6).

### Circuit Reference
The diagram shows the MCU Timer/Counter module generating a PWM signal connected to an LED or motor through an output compare pin.

### Requirements
1. Configure **Timer0** in Fast PWM Mode (WGM = 3).
2. Set **non-inverting** Compare Output Mode on OC0A (COM0A = 2).
3. Set **prescaler to 64** (CS = 3).
4. Set **OCR0A to 127** (approximately 50% duty cycle).
5. Configure **PD6 as OUTPUT**.
6. Print the duty cycle percentage as: \`PWM Duty: 50%\`

### Formula
$$\\text{Duty Cycle} = \\frac{OCR0A}{255} \\times 100\\%$$
$$f_{PWM} = \\frac{f_{clk}}{N \\times 256}$$`,
    circuitDiagram: SVG_PWM_GENERATOR,
    circuitDescription: 'The MCU Timer/Counter generates PWM by comparing a counter value to OCR0A. When counter < OCR0A, the output pin (OC0A/PD6) is HIGH. The ratio HIGH/(HIGH+LOW) is the duty cycle. Prescaler divides the clock to set PWM frequency.',
    starterCode: {
      c_embedded: `// PWM Signal Generator — ATmega328P Timer0 Fast PWM Mode
// Target: Configure Timer0 to output ~50% duty cycle PWM on OC0A (PD6)

#include <stdint.h>
#include <stdio.h>

// Simulate register definitions (for simulation purposes)
volatile uint8_t TCCR0A = 0;
volatile uint8_t TCCR0B = 0;
volatile uint8_t OCR0A  = 0;
volatile uint8_t DDRD   = 0;

void configure_pwm(void) {
    // Step 1: Set Fast PWM Mode (WGM00=1, WGM01=1 in TCCR0A)
    // Step 2: Set non-inverting Compare Output Mode (COM0A1=1 in TCCR0A)
    // Step 3: Set prescaler to 64 (CS01=1, CS00=1 in TCCR0B)
    // Step 4: Set OCR0A = 127 for ~50% duty cycle
    // Step 5: Set PD6 as output (DDRD |= (1<<6))
    
    // TODO: Write your register configuration here
}

int main(void) {
    configure_pwm();
    
    // Calculate and print the duty cycle
    // Formula: Duty = (OCR0A / 255.0) * 100
    
    // TODO: Print "PWM Duty: XX%"
    
    return 0;
}`,
    },
    testCases: [
      { input: 'OCR0A=127', expectedOutput: 'PWM Duty: 50%', isHidden: false },
      { input: 'OCR0A=191', expectedOutput: 'PWM Duty: 75%', isHidden: false },
      { input: 'OCR0A=63', expectedOutput: 'PWM Duty: 25%', isHidden: true },
      { input: 'OCR0A=255', expectedOutput: 'PWM Duty: 100%', isHidden: true },
    ],
    examples: [
      { input: 'OCR0A=127', output: 'PWM Duty: 50%', explanation: 'Duty = 127/255 × 100 ≈ 49.8% ≈ 50%' },
    ],
  },

  // ── EEE Q2: Buck Converter Vout (Python for EEE) ────────────────────────────
  {
    title: 'Buck Converter Output Voltage & Ripple Calculator',
    department: 'EEE',
    domain_type: 'control_systems',
    difficulty: 'Medium',
    tags: ['Power Electronics', 'Buck Converter', 'Duty Cycle', 'Ripple'],
    languagesSupported: ['python', 'cpp'],
    description: `## Buck Converter Output Voltage & Ripple Calculator

A **DC-DC Buck Converter** steps down a DC voltage using a MOSFET switch, inductor (L), diode, and capacitor (C).

### Circuit Reference
The circuit diagram shows the complete Buck Converter topology: Vin source → MOSFET switch → Freewheeling diode → Inductor L → Output Capacitor C → Load resistor R.

### Task
Write a program that reads the converter parameters and prints:
1. Output voltage (\`Vout\`)
2. Inductor current ripple (\`ΔiL\`)
3. Output voltage ripple (\`ΔVout\`)

### Input Format
\`\`\`
Vin D f L C
\`\`\`
- \`Vin\` = Input voltage (Volts)
- \`D\` = Duty cycle (0.0 to 1.0)
- \`f\` = Switching frequency (Hz)
- \`L\` = Inductance (Henries)
- \`C\` = Capacitance (Farads)

### Formulas
- \`Vout = D × Vin\`
- \`ΔiL = (Vin − Vout) × D / (f × L)\`
- \`ΔVout = ΔiL / (8 × f × C)\`

### Output Format
\`\`\`
Vout: X.XX V
Inductor Ripple: X.XXXX A
Voltage Ripple: X.XXXX V
\`\`\``,
    circuitDiagram: SVG_BUCK_CONVERTER,
    circuitDescription: 'Buck Converter: The MOSFET switch (SW) turns ON/OFF at high frequency controlled by PWM. When SW is ON, energy stores in L. When SW is OFF, the freewheeling diode D conducts and L releases energy to the load. Capacitor C smooths the output ripple voltage.',
    starterCode: {
      python: `# Buck Converter Output Voltage & Ripple Calculator

line = input().split()
Vin = float(line[0])
D   = float(line[1])
f   = float(line[2])
L   = float(line[3])
C   = float(line[4])

# Calculate:
# Vout = D * Vin
# delta_iL = (Vin - Vout) * D / (f * L)
# delta_Vout = delta_iL / (8 * f * C)

# TODO: Write your calculations here

# Print results (2 decimal places for Vout, 4 decimal for ripple values)
`,
      cpp: `#include <iostream>
#include <cmath>
#include <iomanip>
using namespace std;

int main() {
    double Vin, D, f, L, C;
    cin >> Vin >> D >> f >> L >> C;
    
    // Vout = D * Vin
    // delta_iL = (Vin - Vout) * D / (f * L)
    // delta_Vout = delta_iL / (8 * f * C)
    
    // TODO: Calculate and print results
    return 0;
}`,
    },
    testCases: [
      { input: '12.0 0.5 100000 0.001 0.0001', expectedOutput: 'Vout: 6.00 V\nInductor Ripple: 0.0300 A\nVoltage Ripple: 0.0000 V', isHidden: false },
      { input: '24.0 0.75 50000 0.0005 0.00005', expectedOutput: 'Vout: 18.00 V\nInductor Ripple: 0.1800 A\nVoltage Ripple: 0.0001 V', isHidden: false },
      { input: '5.0 0.4 200000 0.00002 0.000001', expectedOutput: 'Vout: 2.00 V\nInductor Ripple: 0.3000 A\nVoltage Ripple: 0.0002 V', isHidden: true },
    ],
    examples: [
      {
        input: '12 0.5 100000 0.001 0.0001',
        output: 'Vout: 6.00 V\nInductor Ripple: 0.0300 A\nVoltage Ripple: 0.0000 V',
        explanation: 'Vout=0.5×12=6V, ΔiL=(12-6)×0.5/(100000×0.001)=0.03A, ΔVout=0.03/(8×100000×0.0001)≈0V'
      },
    ],
  },
];

// ── Seed function ─────────────────────────────────────────────────────────────

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB Connected');

    // Remove old ECE/EEE seeded questions to avoid duplicates
    const titles = ECE_EEE_QUESTIONS.map(q => q.title);
    const deleted = await CodingQuestion.deleteMany({ title: { $in: titles } });
    console.log(`🗑️  Removed ${deleted.deletedCount} old ECE/EEE questions`);

    const inserted = await CodingQuestion.insertMany(ECE_EEE_QUESTIONS);
    console.log(`✅ Inserted ${inserted.length} ECE/EEE coding questions with circuit diagrams:`);
    inserted.forEach(q => console.log(`   → [${q.department}] ${q.title}`));

    await mongoose.disconnect();
    console.log('\n🎉 Seed complete! ECE & EEE questions are ready in the platform.');
  } catch (err) {
    console.error('❌ Seed Error:', err.message);
    process.exit(1);
  }
}

seed();
