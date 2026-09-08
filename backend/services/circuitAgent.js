/**
 * circuitAgent.js  —  Self-Contained 5-Stage Circuit Evaluation Agent
 *
 * No external APIs. Deterministic rule-based reasoning over circuit JSON.
 * Outputs the exact schema defined in Section 6 of the master prompt.
 *
 * Pipeline:
 *   Stage 1 — Component Audit
 *   Stage 2 — Topology Analysis  (union-find net graph)
 *   Stage 3 — Value Simulation   (delegates to circuitEvaluator.js)
 *   Stage 4 — Verdict & Scoring
 *   Stage 5 — Feedback Generation (knowledge-base driven)
 */

'use strict';

const axios  = require('axios');
const { simulate, buildNets, COMPONENT_PINS, prop } = require('./circuitEvaluator');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001';


// ─── Knowledge Base ───────────────────────────────────────────────────────────

const CONCEPTS = {
    gain_formula:       'Inverting Amplifier Gain Formula (gain = −Rf/Rin)',
    virtual_ground:     'Virtual Ground / Virtual Short Circuit Concept',
    feedback_path:      'Negative Feedback Path in Op-Amp Circuits',
    ground_reference:   'Ground Reference and Circuit Completeness',
    node_analysis:      'Node Voltage Method (KCL)',
    voltage_divider:    'Voltage Divider Rule (Vout = Vin × R2/(R1+R2))',
    rlc_resonance:      'Series RLC Resonance (f₀ = 1 / 2π√LC)',
    impedance:          'Impedance and Reactance',
    ohms_law:           'Ohm\'s Law and Resistor Networks',
    led_forward:        'Diode Forward Voltage and LED Current Limiting',
    component_limits:   'Circuit Design Constraints and Component Selection',
    topology_basics:    'Schematic Reading and Circuit Topology',
    short_circuit:      'Short Circuit Prevention and Source Protection'
};

function buildFeedback(issues, simResult, question, components) {
    const msgs = [];
    const conceptSet = new Set();

    for (const issue of issues) {
        switch (issue.type) {
            case 'missing_ground':
                msgs.push('Your circuit has no ground reference. Every circuit requires a defined 0V reference node — connect a ground symbol to the return path of your voltage source.');
                conceptSet.add(CONCEPTS.ground_reference);
                conceptSet.add(CONCEPTS.node_analysis);
                break;

            case 'floating_pin':
                msgs.push(`Component ${issue.component_involved} has an unconnected pin. Unconnected pins leave nodes floating (undefined voltage). Ensure every relevant pin in your design has a wire attached.`);
                conceptSet.add(CONCEPTS.ground_reference);
                conceptSet.add(CONCEPTS.topology_basics);
                break;

            case 'wrong_component':
                msgs.push(`You used "${issue.component_involved}" which is not in the allowed palette for this question. Re-read the component constraints and stick to the permitted list.`);
                conceptSet.add(CONCEPTS.component_limits);
                break;

            case 'too_many_instances': {
                msgs.push(`You placed more instances of ${issue.component_involved} than permitted. The question limits this component type — remove the excess.`);
                conceptSet.add(CONCEPTS.component_limits);
                break;
            }
            case 'topology':
                msgs.push(`Circuit topology issue: ${issue.explanation}`);
                conceptSet.add(CONCEPTS.topology_basics);
                conceptSet.add(CONCEPTS.feedback_path);
                break;

            case 'component_value': {
                const exp = question.expected_behavior;
                if (simResult && simResult.measured_gain !== null && simResult.measured_gain !== undefined) {
                    const got     = simResult.measured_gain.toFixed(2);
                    const wanted  = exp.expected_gain;
                    const rfv     = simResult.Rf_val ? `${simResult.Rf_val}Ω` : '?Ω';
                    const rinv    = simResult.Rin_val ? `${simResult.Rin_val}Ω` : '?Ω';
                    msgs.push(
                        `Your circuit topology is correct but the gain is ${got} instead of ${wanted}. ` +
                        `For an inverting amplifier, gain = −Rf/Rin = −${rfv}/${rinv}. ` +
                        `Adjust the ratio of your feedback and input resistors to hit the target gain.`
                    );
                    conceptSet.add(CONCEPTS.gain_formula);
                    conceptSet.add(CONCEPTS.virtual_ground);
                } else if (exp.type === 'voltage_divider' && simResult && simResult.output_voltage !== null) {
                    const got    = simResult.output_voltage.toFixed(3);
                    const wanted = exp.expected_voltage;
                    msgs.push(
                        `Your divider output is ${got}V but the target is ${wanted}V. ` +
                        `Use the divider formula: Vout = Vin × R2/(R1+R2). ` +
                        `Adjust your resistor ratio accordingly.`
                    );
                    conceptSet.add(CONCEPTS.voltage_divider);
                    conceptSet.add(CONCEPTS.ohms_law);
                } else {
                    msgs.push(`Component values are incorrect. ${issue.explanation}`);
                    conceptSet.add(CONCEPTS.ohms_law);
                }
                break;
            }

            case 'short_circuit':
                msgs.push('Two voltage sources (or a source and ground) are directly connected with no impedance between them. This creates a short circuit. Insert a resistor or check your wiring.');
                conceptSet.add(CONCEPTS.short_circuit);
                conceptSet.add(CONCEPTS.ohms_law);
                break;

            default:
                msgs.push(issue.explanation || 'An unspecified issue was found in your circuit.');
                conceptSet.add(CONCEPTS.topology_basics);
        }
    }

    if (msgs.length === 0) {
        msgs.push('Excellent work! Your circuit is correctly designed and meets all requirements. The topology, component selection, and values are all correct.');
    }

    return {
        feedback_for_student: msgs.slice(0, 4).join(' '),
        concepts_to_review:   [...conceptSet]
    };
}

// ─── Stage 1: Component Audit ────────────────────────────────────────────────

function auditComponents(components, question) {
    const issues = [];
    const palette = question.visible_palette || [];
    const maxInst = question.max_instances instanceof Map
        ? Object.fromEntries(question.max_instances)
        : (question.max_instances || {});

    const countByType = {};

    for (const comp of components) {
        countByType[comp.type] = (countByType[comp.type] || 0) + 1;

        if (palette.length > 0 && !palette.includes(comp.type)) {
            issues.push({
                type:               'wrong_component',
                component_involved: comp.comp_id,
                explanation:        `${comp.comp_id} (type: ${comp.type}) is not in the allowed component palette for this question.`
            });
        }
    }

    for (const [type, maxCount] of Object.entries(maxInst)) {
        const actual = countByType[type] || 0;
        if (actual > Number(maxCount)) {
            issues.push({
                type:               'too_many_instances',
                component_involved: type,
                explanation:        `You used ${actual} instance(s) of "${type}" but the maximum allowed is ${maxCount}.`
            });
        }
    }

    return issues;
}

// ─── Stage 2: Topology Analysis ──────────────────────────────────────────────

function analyseTopology(components, connections, question) {
    const issues = [];
    const nets   = buildNets(components, connections);

    // --- Ground check ---
    const groundComp = components.find(c => c.type === 'ground');
    if (!groundComp) {
        issues.push({
            type:               'missing_ground',
            component_involved: null,
            explanation:        'No ground component found. The circuit has no defined 0V reference node.'
        });
    } else {
        // Ground must be connected to at least one other component
        const gNets = nets.filter(net => net.some(p => p.comp_id === groundComp.comp_id));
        const gConnected = gNets.some(net => net.length > 1);
        if (!gConnected) {
            issues.push({
                type:               'floating_pin',
                component_involved: groundComp.comp_id,
                explanation:        `${groundComp.comp_id} (Ground) is placed but not wired to anything.`
            });
        }
    }

    // --- Floating pin check (all non-ground components) ---
    for (const comp of components) {
        if (comp.type === 'ground') continue;
        const expectedPins = COMPONENT_PINS[comp.type] || [];
        // Only flag critical pins for certain types
        const criticalPins = getCriticalPins(comp.type);
        for (const pin of criticalPins) {
            const net = nets.find(n => n.some(p => p.comp_id === comp.comp_id && p.pin === pin));
            if (!net || net.length < 2) {
                issues.push({
                    type:               'floating_pin',
                    component_involved: comp.comp_id,
                    explanation:        `Pin "${pin}" of ${comp.comp_id} is not connected.`
                });
            }
        }
    }

    // --- Short circuit: two voltage sources directly on same net ---
    const vSources = components.filter(c => c.type === 'voltage_source');
    if (vSources.length >= 2) {
        for (let i = 0; i < vSources.length; i++) {
            for (let j = i + 1; j < vSources.length; j++) {
                const a = vSources[i], b = vSources[j];
                const samePos = nets.find(n =>
                    n.some(p => p.comp_id === a.comp_id && p.pin === 'positive') &&
                    n.some(p => p.comp_id === b.comp_id && p.pin === 'positive')
                );
                if (samePos) {
                    issues.push({
                        type:               'short_circuit',
                        component_involved: `${a.comp_id}, ${b.comp_id}`,
                        explanation:        `${a.comp_id} and ${b.comp_id} positive terminals are directly connected — this is a short circuit.`
                    });
                }
            }
        }
    }

    // --- Op-amp specific topology checks ---
    if (question.expected_behavior?.type === 'gain_check') {
        const opAmp = components.find(c => c.type === 'op_amp');
        if (opAmp) {
            // Non-inverting pin should be grounded for inverting config
            // NOTE: there may be multiple GND symbols (GND1, GND2, GND3 etc.)
            // so we check if ANY ground component shares the same net as non_inverting.
            const nonInvNet = nets.find(n =>
                n.some(p => p.comp_id === opAmp.comp_id && p.pin === 'non_inverting')
            );
            const groundComps = components.filter(c => c.type === 'ground');
            if (nonInvNet && groundComps.length > 0) {
                // Grounded = at least one GND symbol is on the same net as V+
                const nonInvGrounded = groundComps.some(gnd =>
                    nonInvNet.some(p => p.comp_id === gnd.comp_id)
                );
                if (!nonInvGrounded) {
                    issues.push({
                        type:               'topology',
                        component_involved: opAmp.comp_id,
                        explanation:        `For an inverting amplifier, the non-inverting input (V+) of ${opAmp.comp_id} should be connected to ground. Your V+ pin appears ungrounded.`
                    });
                }
            }

            // Feedback resistor must connect output back to inverting input
            const invertingNets = nets.filter(n => n.some(p => p.comp_id === opAmp.comp_id && p.pin === 'inverting'));
            const outputNets    = nets.filter(n => n.some(p => p.comp_id === opAmp.comp_id && p.pin === 'output'));
            const resistors     = components.filter(c => c.type === 'resistor');
            const hasFeedback   = resistors.some(r =>
                invertingNets.some(n => n.some(p => p.comp_id === r.comp_id)) &&
                outputNets.some(n => n.some(p => p.comp_id === r.comp_id))
            );
            if (!hasFeedback) {
                issues.push({
                    type:               'topology',
                    component_involved: opAmp.comp_id,
                    explanation:        `No feedback resistor found between the output and inverting input of ${opAmp.comp_id}. An inverting amplifier requires a resistor in the feedback path from output back to V−.`
                });
            }
        }
    }

    return issues;
}

function getCriticalPins(type) {
    switch (type) {
        case 'resistor':       return ['1', '2'];
        case 'capacitor':      return ['1', '2'];
        case 'inductor':       return ['1', '2'];
        case 'voltage_source': return ['positive', 'negative'];
        case 'op_amp':         return ['non_inverting', 'inverting', 'output'];
        case 'diode':          return ['anode', 'cathode'];
        case 'voltmeter':      return ['positive', 'negative'];
        case 'ammeter':        return ['1', '2'];
        default:               return [];
    }
}

// ─── Stage 3: Simulation (delegated) ─────────────────────────────────────────
// (see circuitEvaluator.js)

// ─── Stage 4: Verdict & Scoring ──────────────────────────────────────────────

function computeVerdict(issues, simResult, expectedBehavior) {
    const hasTopologyIssues = issues.some(i =>
        ['missing_ground', 'wrong_component', 'topology', 'short_circuit', 'too_many_instances'].includes(i.type)
    );
    const hasFloatingPins = issues.some(i => i.type === 'floating_pin');

    // If simulation failed due to topology
    if (!simResult || simResult.status === 'error') {
        if (issues.length === 0) {
            return { verdict: 'incorrect', score: 20, valueIssues: [] };
        }
        const score = hasTopologyIssues ? 10 : (hasFloatingPins ? 25 : 20);
        return { verdict: 'incorrect', score, valueIssues: [] };
    }

    const valueIssues = [];
    let valueCorrect = true;

    if (expectedBehavior) {
        const tol = (expectedBehavior.tolerance_percent || 5) / 100;

        switch (expectedBehavior.type) {
            case 'gain_check': {
                const meas = simResult.measured_gain;
                const exp  = expectedBehavior.expected_gain;
                if (meas === null || meas === undefined) {
                    valueCorrect = false;
                } else {
                    const within = Math.abs((meas - exp) / (exp || 1)) <= tol;
                    if (!within) {
                        valueCorrect = false;
                        valueIssues.push({
                            type:               'component_value',
                            component_involved: null,
                            explanation:        `Measured gain is ${meas.toFixed(4)} but expected ${exp} (tolerance ±${tol * 100}%).`
                        });
                    }
                }
                break;
            }
            case 'voltage_divider': {
                const meas = simResult.output_voltage;
                const exp  = expectedBehavior.expected_voltage;
                if (meas === null || meas === undefined) {
                    valueCorrect = false;
                } else {
                    const within = Math.abs((meas - exp) / (exp || 1)) <= tol;
                    if (!within) {
                        valueCorrect = false;
                        valueIssues.push({
                            type:               'component_value',
                            component_involved: null,
                            explanation:        `Divider output is ${meas.toFixed(4)}V but expected ${exp}V.`
                        });
                    }
                }
                break;
            }
            case 'rlc_analysis': {
                const meas = simResult.resonant_frequency;
                const exp  = expectedBehavior.expected_freq;
                if (meas === null || meas === undefined) {
                    valueCorrect = false;
                } else {
                    const within = Math.abs((meas - exp) / (exp || 1)) <= tol;
                    if (!within) {
                        valueCorrect = false;
                        valueIssues.push({
                            type:               'component_value',
                            component_involved: null,
                            explanation:        `Resonant frequency is ${meas.toFixed(2)} Hz but expected ${exp} Hz.`
                        });
                    }
                }
                break;
            }
        }
    }

    const allIssues = [...issues, ...valueIssues];

    if (hasTopologyIssues) {
        return { verdict: 'incorrect', score: 20, valueIssues };
    }
    if (hasFloatingPins && !hasTopologyIssues) {
        return { verdict: 'partially_correct', score: 45, valueIssues };
    }
    if (!valueCorrect && issues.length === 0) {
        // Topology correct, values wrong
        return { verdict: 'partially_correct', score: 65, valueIssues };
    }
    if (allIssues.length === 0) {
        return { verdict: 'correct', score: 100, valueIssues };
    }
    return { verdict: 'partially_correct', score: 50, valueIssues };
}

/**
 * evaluateRuleBased — deterministic rule-based evaluation (original logic).
 */
async function evaluateRuleBased(question, components, connections) {
    // Stage 1: Component audit
    const auditIssues = auditComponents(components, question);

    // Stage 2: Topology analysis
    const topoIssues = analyseTopology(components, connections, question);

    // Stage 3: Simulation
    const simResult = simulate(components, connections, question.expected_behavior);

    // Stage 4: Verdict & scoring
    const allStructuralIssues = [...auditIssues, ...topoIssues];
    const { verdict, score, valueIssues } = computeVerdict(allStructuralIssues, simResult, question.expected_behavior);
    const allIssues = [...allStructuralIssues, ...valueIssues];

    // Stage 5: Feedback generation
    const { feedback_for_student, concepts_to_review } = buildFeedback(
        allIssues, simResult, question, components
    );

    let summary;
    if (verdict === 'correct') {
        summary = 'The circuit is correctly designed and meets all requirements.';
    } else if (verdict === 'partially_correct') {
        const topIssue = allIssues[0];
        summary = topIssue
            ? `The circuit has a ${topIssue.type.replace('_', ' ')} issue — see details below.`
            : 'The circuit is partially correct but needs adjustments.';
    } else {
        const topIssue = allIssues[0];
        summary = topIssue
            ? `The circuit is incorrect: ${topIssue.explanation}`
            : 'The circuit does not meet the requirements.';
    }

    return {
        score,
        verdict,
        summary,
        issues_found:         allIssues,
        feedback_for_student,
        concepts_to_review,
        sim_result:           simResult,
        evaluated_at:         new Date(),
        engine:               'rule_based'
    };
}

/**
 * evaluate — ML-first evaluation with rule-engine fallback.
 *
 * 1. Always run the rule-based simulator to get a measured value.
 * 2. Try to POST to the Python ML service (/evaluate-circuit).
 * 3. If ML service responds: merge ML score/verdict/feedback with sim data.
 * 4. If ML service is down or not trained: fall back to rule-based result.
 */
async function evaluate(question, components, connections) {
    // Always run the simulator to get the measured value
    const simResult = simulate(components, connections, question.expected_behavior);

    // Resolve expected value from the question's expected_behavior
    const eb = question.expected_behavior || {};
    let measured = null;
    if (simResult && simResult.status === 'success') {
        if (simResult.measured_gain      !== undefined) measured = simResult.measured_gain;
        else if (simResult.output_voltage!== undefined) measured = simResult.output_voltage;
        else if (simResult.resonant_frequency !== undefined) measured = simResult.resonant_frequency;
        else if (simResult.led_current_ma !== undefined) measured = simResult.led_current_ma / 1000;
    }

    const expected = {
        value:     eb.expected_gain     ?? eb.expected_voltage ?? eb.expected_freq ?? 0,
        tolerance: (eb.tolerance_percent ?? 5) / 100
    };

    try {
        const mlRes = await axios.post(
            `${ML_SERVICE_URL}/evaluate-circuit`,
            {
                components:    components,
                connections:   connections,
                question_type: eb.type || 'gain_check',
                expected:      expected,
                measured:      measured,
            },
            { timeout: 8000 }   // 8s timeout — don't block student if ML is slow
        );

        const ml = mlRes.data;
        return {
            score:                ml.score,
            verdict:              ml.verdict,
            summary:              ml.summary,
            issues_found:         ml.issues_found,
            feedback_for_student: ml.feedback_for_student,
            concepts_to_review:   ml.concepts_to_review,
            sim_result:           simResult,
            ml_confidence:        ml.ml_confidence,
            evaluated_at:         new Date(),
            engine:               'ml_neural_network'
        };
    } catch (mlErr) {
        // ML service unavailable or model not yet trained → fall back to rule engine
        console.warn('[circuitAgent] ML service unavailable, using rule-based fallback:', mlErr.message);
        const ruleResult = await evaluateRuleBased(question, components, connections);
        return { ...ruleResult, sim_result: simResult };
    }
}

module.exports = { evaluate, evaluateRuleBased };
