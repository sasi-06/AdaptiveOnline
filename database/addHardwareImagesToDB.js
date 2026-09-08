/**
 * addHardwareImagesToDB.js
 * Directly updates MongoDB with real hardware schematic diagram images
 * (SVG Schematics) for ECE & EEE Questions and Coding Challenges.
 */

const path = require('path');
module.paths.push(path.join(__dirname, '../backend/node_modules'));

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Question = require('../backend/models/Question');
const CodingQuestion = require('../backend/models/CodingQuestion');

// SVG Vector Hardware Schematics (Offline-ready & High Resolution)
const OPAMP_CIRCUIT_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 240" width="100%" height="100%" style="background:#0f172a;">
    <rect x="10" y="10" width="480" height="220" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    
    <!-- Op-Amp Triangle -->
    <polygon points="200,60 200,180 320,120" fill="#090d16" stroke="#38bdf8" stroke-width="3"/>
    <text x="215" y="95" fill="#ef4444" font-size="18" font-family="monospace" font-weight="bold">-</text>
    <text x="215" y="155" fill="#10b981" font-size="18" font-family="monospace" font-weight="bold">+</text>
    <text x="240" y="125" fill="#38bdf8" font-size="14" font-family="monospace" font-weight="bold">LM741</text>

    <!-- Inverting Input Line & Rin -->
    <line x1="60" y1="90" x2="110" y2="90" stroke="#f59e0b" stroke-width="2"/>
    <path d="M 110 90 L 120 80 L 130 100 L 140 80 L 150 100 L 160 80 L 170 90" stroke="#f59e0b" stroke-width="2" fill="none"/>
    <line x1="170" y1="90" x2="200" y2="90" stroke="#f59e0b" stroke-width="2"/>
    <text x="125" y="70" fill="#f59e0b" font-size="12" font-family="monospace" font-weight="bold">Rin = 10kΩ</text>

    <!-- Vin Voltage Source -->
    <circle cx="60" cy="90" r="10" fill="none" stroke="#f59e0b" stroke-width="2"/>
    <text x="35" y="94" fill="#f59e0b" font-size="11" font-family="monospace" font-weight="bold">Vin</text>

    <!-- Feedback Resistor Rf -->
    <line x1="185" y1="90" x2="185" y2="35" stroke="#ec4899" stroke-width="2"/>
    <line x1="185" y1="35" x2="220" y2="35" stroke="#ec4899" stroke-width="2"/>
    <path d="M 220 35 L 225 25 L 235 45 L 245 25 L 255 45 L 265 25 L 275 35" stroke="#ec4899" stroke-width="2" fill="none"/>
    <line x1="275" y1="35" x2="340" y2="35" stroke="#ec4899" stroke-width="2"/>
    <line x1="340" y1="35" x2="340" y2="120" stroke="#ec4899" stroke-width="2"/>
    <text x="225" y="20" fill="#ec4899" font-size="12" font-family="monospace" font-weight="bold">Rf = 100kΩ</text>

    <!-- Non-Inverting Ground -->
    <line x1="180" y1="150" x2="200" y2="150" stroke="#10b981" stroke-width="2"/>
    <line x1="180" y1="150" x2="180" y2="180" stroke="#10b981" stroke-width="2"/>
    <line x1="170" y1="180" x2="190" y2="180" stroke="#10b981" stroke-width="3"/>
    <text x="160" y="200" fill="#10b981" font-size="11" font-family="monospace">GND (0V)</text>

    <!-- Vout Output Line -->
    <line x1="320" y1="120" x2="430" y2="120" stroke="#38bdf8" stroke-width="2"/>
    <circle cx="430" cy="120" r="4" fill="#38bdf8"/>
    <text x="440" y="125" fill="#38bdf8" font-size="14" font-family="monospace" font-weight="bold">Vout</text>
</svg>
`)}`;

const MCU_DAC_SCHEMATIC_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="100%" height="100%" style="background:#090d16;">
    <rect x="20" y="20" width="560" height="260" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    
    <!-- ARM / ATmega MCU -->
    <rect x="50" y="60" width="180" height="180" rx="8" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
    <text x="140" y="145" text-anchor="middle" fill="#60a5fa" font-size="14" font-family="monospace" font-weight="bold">ARM Cortex / MCU</text>
    <text x="140" y="165" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="monospace">PORTB [0:7]</text>

    <!-- DAC 0808 IC -->
    <rect x="360" y="60" width="180" height="180" rx="8" fill="#0f172a" stroke="#10b981" stroke-width="2"/>
    <text x="450" y="145" text-anchor="middle" fill="#34d399" font-size="14" font-family="monospace" font-weight="bold">DAC 0808 IC</text>
    <text x="450" y="165" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="monospace">8-Bit R-2R Ladder</text>

    <!-- 8-bit Parallel Bus -->
    <line x1="230" y1="120" x2="360" y2="120" stroke="#f59e0b" stroke-width="4"/>
    <line x1="280" y1="105" x2="310" y2="135" stroke="#f59e0b" stroke-width="2"/>
    <text x="295" y="100" text-anchor="middle" fill="#f59e0b" font-size="12" font-family="monospace" font-weight="bold">8-Bit Data Bus D0..D7</text>

    <!-- Analog Vout Pin -->
    <line x1="540" y1="150" x2="570" y2="150" stroke="#ec4899" stroke-width="3"/>
    <circle cx="570" cy="150" r="5" fill="#ec4899"/>
    <text x="500" y="210" fill="#ec4899" font-size="12" font-family="monospace" font-weight="bold">Iout → Vout (Sine Wave)</text>
</svg>
`)}`;

async function addHardwareImages() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for attaching hardware schematic images...');

        // 1. Update Op-Amp & Circuit Questions with schematic diagram URL
        const opampResult = await Question.updateMany(
            { department: 'ECE' },
            { $set: { circuit_diagram_url: OPAMP_CIRCUIT_SVG, domain_type: 'circuit_analysis' } }
        );
        console.log(`✔ Attached Op-Amp Circuit Schematics to ${opampResult.modifiedCount} ECE Questions.`);

        // 2. Update Verilog & Embedded C Coding Questions with MCU DAC Schematic URL
        const codingResult = await CodingQuestion.updateMany(
            { department: { $in: ['ECE', 'EEE'] } },
            { $set: { problemImage: MCU_DAC_SCHEMATIC_SVG } }
        );
        console.log(`✔ Attached MCU/DAC Hardware Schematics to ${codingResult.modifiedCount} ECE/EEE Coding Challenges.`);

        // 3. Create a dedicated Hardware Image Schematic Question
        await CodingQuestion.create({
            title: 'ARM Cortex MCU & DAC0808 Interfacing (Hardware Image Analysis)',
            description: 'Inspect the provided hardware schematic diagram showing an ARM Cortex Microcontroller connected to a DAC0808 8-bit R-2R converter via PORTB [0:7]. Write an Embedded C / C++ function `generate_sine_wave()` that outputs digital samples to PORTB to generate a 1 kHz analog Sine Wave output at Vout.',
            difficulty: 'Hard',
            tags: ['ECE', 'EEE', 'Hardware Image Analysis', 'ARM', 'DAC'],
            department: 'ECE',
            domain_type: 'hardware_image_analysis',
            problemImage: MCU_DAC_SCHEMATIC_SVG,
            languagesSupported: ['c_embedded', 'cpp', 'python'],
            examples: [{ input: 'generate_sine_wave()', output: 'PORTB values = 128, 160, 192, 220...', explanation: 'Outputs sine wave samples to 8-bit DAC' }],
            testCases: [
                { input: 'generate_sine_wave()', expectedOutput: 'PORTB = 128', isHidden: false }
            ],
            starterCode: {
                c_embedded: `// ARM Cortex MCU & DAC 0808 Driver
#include <stdint.h>
#include <math.h>

void generate_sine_wave(void) {
    // Inspect the DAC0808 schematic diagram attached above.
    // PORTB [0:7] is connected to D0-D7 of DAC0808.
    for (int i = 0; i < 360; i += 10) {
        uint8_t dac_val = (uint8_t)(127.5 * (1.0 + sin(i * 3.14159 / 180.0)));
        // Write dac_val to PORTB
    }
}`
            }
        });
        console.log('🎉 Successfully created Hardware Image Analysis Challenge with image URL!');

        process.exit(0);
    } catch (err) {
        console.error('Error adding hardware images:', err);
        process.exit(1);
    }
}

addHardwareImages();
