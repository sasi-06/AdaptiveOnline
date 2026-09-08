/**
 * seedCircuitQuestions.js
 *
 * Seeds 5 sample circuit design questions into MongoDB.
 * Run with:  node backend/seedCircuitQuestions.js
 */

'use strict';

const mongoose  = require('mongoose');
const dotenv    = require('dotenv');
dotenv.config();

const CircuitQuestion = require('./models/CircuitQuestion');

const QUESTIONS = [
    {
        title:       'Design an Inverting Amplifier with Gain = −10',
        description: 'Using a single ideal op-amp, design an inverting amplifier that produces a voltage gain of exactly −10. ' +
                     'The input is a 1V DC source. Connect the non-inverting input to ground. ' +
                     'Use two resistors to set the gain: Rin at the input and Rf in the feedback path.',
        topic:       'Op-Amp Circuits',
        difficulty:  'medium',
        hint_text:   'For an inverting amplifier: Gain = −Rf/Rin. Choose Rin = 1kΩ and find Rf.',
        visible_palette: ['resistor', 'op_amp', 'voltage_source', 'ground', 'voltmeter'],
        max_instances:   { op_amp: 1, resistor: 5, voltage_source: 1 },
        expected_behavior: {
            type:             'gain_check',
            formula:          'gain = -Rf/Rin',
            expected_gain:    -10,
            tolerance_percent: 5
        },
        reference_solution: {
            components: [
                { comp_id: 'V1',  type: 'voltage_source', properties: { voltage: 1, waveform: 'DC' },    position: { x: 40,  y: 200 } },
                { comp_id: 'R1',  type: 'resistor',       properties: { resistance_ohm: 1000 },          position: { x: 160, y: 160 } },
                { comp_id: 'R2',  type: 'resistor',       properties: { resistance_ohm: 10000 },         position: { x: 340, y: 100 } },
                { comp_id: 'OA1', type: 'op_amp',         properties: { model: 'ideal' },                position: { x: 260, y: 160 } },
                { comp_id: 'GND', type: 'ground',         properties: {},                                position: { x: 200, y: 320 } }
            ],
            connections: [
                { from: { comp_id: 'V1',  pin: 'positive' },     to: { comp_id: 'R1',  pin: '1' } },
                { from: { comp_id: 'R1',  pin: '2' },            to: { comp_id: 'OA1', pin: 'inverting' } },
                { from: { comp_id: 'OA1', pin: 'inverting' },    to: { comp_id: 'R2',  pin: '1' } },
                { from: { comp_id: 'R2',  pin: '2' },            to: { comp_id: 'OA1', pin: 'output' } },
                { from: { comp_id: 'OA1', pin: 'non_inverting' },to: { comp_id: 'GND', pin: '1' } },
                { from: { comp_id: 'V1',  pin: 'negative' },     to: { comp_id: 'GND', pin: '1' } }
            ]
        }
    },
    {
        title:       'Voltage Divider: Output = 2.5V from 5V',
        description: 'Design a resistive voltage divider that produces exactly 2.5V at the output node from a 5V DC supply. ' +
                     'Place two resistors in series between the supply and ground. The output is measured at the junction between the two resistors.',
        topic:       'Resistor Networks',
        difficulty:  'easy',
        hint_text:   'Vout = Vin × R2 / (R1 + R2). For equal output voltage, make R1 = R2.',
        visible_palette: ['resistor', 'voltage_source', 'ground', 'voltmeter'],
        max_instances:   { resistor: 4, voltage_source: 1 },
        expected_behavior: {
            type:              'voltage_divider',
            formula:           'Vout = Vin * R2/(R1+R2)',
            expected_voltage:  2.5,
            tolerance_percent: 5
        },
        reference_solution: {
            components: [
                { comp_id: 'V1',  type: 'voltage_source', properties: { voltage: 5, waveform: 'DC' }, position: { x: 60,  y: 180 } },
                { comp_id: 'R1',  type: 'resistor',       properties: { resistance_ohm: 1000 },       position: { x: 200, y: 100 } },
                { comp_id: 'R2',  type: 'resistor',       properties: { resistance_ohm: 1000 },       position: { x: 200, y: 200 } },
                { comp_id: 'GND', type: 'ground',         properties: {},                              position: { x: 220, y: 320 } }
            ],
            connections: [
                { from: { comp_id: 'V1', pin: 'positive' }, to: { comp_id: 'R1', pin: '1' } },
                { from: { comp_id: 'R1', pin: '2' },        to: { comp_id: 'R2', pin: '1' } },
                { from: { comp_id: 'R2', pin: '2' },        to: { comp_id: 'GND', pin: '1' } },
                { from: { comp_id: 'V1', pin: 'negative' }, to: { comp_id: 'GND', pin: '1' } }
            ]
        }
    },
    {
        title:       'Series RLC Circuit at 1 kHz Resonance',
        description: 'Design a series RLC circuit that resonates at exactly 1 kHz (1000 Hz). ' +
                     'Choose appropriate inductor and capacitor values. Add a resistor for damping. ' +
                     'Connect all components in series with a 5V AC source.',
        topic:       'RLC Circuits & Resonance',
        difficulty:  'hard',
        hint_text:   'Resonant frequency: f₀ = 1 / (2π√LC). Try L = 10mH and find the matching C.',
        visible_palette: ['resistor', 'capacitor', 'inductor', 'voltage_source', 'ground', 'voltmeter', 'ammeter'],
        max_instances:   { resistor: 2, capacitor: 1, inductor: 1, voltage_source: 1 },
        expected_behavior: {
            type:             'rlc_analysis',
            formula:          'f0 = 1/(2*pi*sqrt(L*C))',
            expected_freq:    1000,
            tolerance_percent: 5
        },
        reference_solution: {
            components: [
                { comp_id: 'V1',  type: 'voltage_source', properties: { voltage: 5, waveform: 'sine', frequency_hz: 1000 }, position: { x: 60, y: 200 } },
                { comp_id: 'R1',  type: 'resistor',       properties: { resistance_ohm: 100 },     position: { x: 200, y: 100 } },
                { comp_id: 'L1',  type: 'inductor',       properties: { inductance_henry: 0.01 },  position: { x: 340, y: 100 } },
                { comp_id: 'C1',  type: 'capacitor',      properties: { capacitance_farad: 2.53e-6 }, position: { x: 480, y: 100 } },
                { comp_id: 'GND', type: 'ground',         properties: {},                          position: { x: 360, y: 320 } }
            ]
        }
    },
    {
        title:       'LED Current Limiting Circuit',
        description: 'Connect a red LED in series with a current-limiting resistor to a 5V DC supply and ground. ' +
                     'The LED has a forward voltage of 2V. Choose a resistor value that limits current to approximately 15mA.',
        topic:       'Diodes & LED Circuits',
        difficulty:  'easy',
        hint_text:   'I = (Vcc − Vf) / R. With Vcc=5V and Vf=2V, target I=15mA ≈ 200Ω.',
        visible_palette: ['resistor', 'diode', 'voltage_source', 'ground'],
        max_instances:   { resistor: 1, diode: 1, voltage_source: 1 },
        expected_behavior: {
            type:             'led_circuit',
            formula:          'I = (Vcc - Vf) / R',
            expected_voltage: 2.0,
            tolerance_percent: 10
        },
        reference_solution: {
            components: [
                { comp_id: 'V1',  type: 'voltage_source', properties: { voltage: 5, waveform: 'DC' }, position: { x: 60, y: 200 } },
                { comp_id: 'R1',  type: 'resistor',       properties: { resistance_ohm: 200 },        position: { x: 220, y: 100 } },
                { comp_id: 'D1',  type: 'diode',          properties: { model: 'ideal' },             position: { x: 380, y: 100 } },
                { comp_id: 'GND', type: 'ground',         properties: {},                              position: { x: 380, y: 320 } }
            ]
        }
    },
    {
        title:       'Design an Inverting Amplifier with Gain = −5',
        description: 'Using a single ideal op-amp, design an inverting amplifier with a voltage gain of −5. ' +
                     'The input is a 2V DC source. Use resistors to set the gain. ' +
                     'Remember to ground the non-inverting input.',
        topic:       'Op-Amp Circuits',
        difficulty:  'easy',
        hint_text:   'Gain = −Rf/Rin. With Rin = 2kΩ, what should Rf be?',
        visible_palette: ['resistor', 'op_amp', 'voltage_source', 'ground', 'voltmeter'],
        max_instances:   { op_amp: 1, resistor: 4, voltage_source: 1 },
        expected_behavior: {
            type:              'gain_check',
            formula:           'gain = -Rf/Rin',
            expected_gain:     -5,
            tolerance_percent:  5
        },
        reference_solution: {
            components: [
                { comp_id: 'V1',  type: 'voltage_source', properties: { voltage: 2, waveform: 'DC' },   position: { x: 40,  y: 200 } },
                { comp_id: 'R1',  type: 'resistor',       properties: { resistance_ohm: 2000 },          position: { x: 160, y: 160 } },
                { comp_id: 'R2',  type: 'resistor',       properties: { resistance_ohm: 10000 },         position: { x: 340, y: 100 } },
                { comp_id: 'OA1', type: 'op_amp',         properties: { model: 'ideal' },                position: { x: 260, y: 160 } },
                { comp_id: 'GND', type: 'ground',         properties: {},                                position: { x: 200, y: 320 } }
            ]
        }
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const count = await CircuitQuestion.countDocuments();
        if (count > 0) {
            console.log(`${count} circuit questions already exist. Skipping seed.`);
            process.exit(0);
        }

        const created = await CircuitQuestion.insertMany(QUESTIONS);
        console.log(`✅  Seeded ${created.length} circuit questions.`);
        created.forEach(q => console.log(`   • ${q._id}  "${q.title}"`));
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    }
}

seed();
