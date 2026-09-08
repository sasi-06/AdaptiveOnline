"""
circuit_dataset_generator.py
─────────────────────────────────────────────────────────────────────────────
Generates synthetic training data for the circuit evaluation ML model.

Strategy:
  Physics-based deterministic labelling.
  Score = topology_score (0-70) + value_score (0-30)

  14 question types × 3,572 samples ≈ 50,000 total samples.
  35 features per sample.

Run:  python circuit_dataset_generator.py
Output: circuit_training_data.csv  (~50,000 samples)
"""

import random
import math
import csv
from pathlib import Path

RANDOM_SEED = 42
random.seed(RANDOM_SEED)

N_SAMPLES_PER_CONFIG = 3572  # 14 configs × 3572 ≈ 50,000

COMPONENT_TYPES = [
    "resistor", "capacitor", "inductor", "op_amp",
    "voltage_source", "ground", "diode", "voltmeter",
    "ammeter", "bjt_npn", "logic_gate_and"
]

# ── 35-Feature Extraction ─────────────────────────────────────────────────────

FEATURE_COLS = [
    # Structural
    "n_components", "n_connections", "n_unique_nodes",
    "has_ground", "has_op_amp",
    # Component counts
    "n_resistors", "n_capacitors", "n_inductors",
    "n_diodes", "n_bjt", "n_voltmeters",
    # Resistor metrics
    "r_max", "r_min", "r_ratio",
    # Source
    "v_in",
    # Topology quality
    "op_feedback_wired", "n_floating_comps",
    # Question type one-hot
    "qtype_gain", "qtype_divider", "qtype_rlc", "qtype_led",
    "qtype_bjt", "qtype_rc_filter", "qtype_rectifier", "qtype_power_supply",
    # Value error
    "val_error_frac",
    # New extended features
    "has_short_circuit",
    "circuit_completeness",
    "val_error_sigmoid",
    "r_count_expected",
    "topology_score_rule",
    "polarity_error_detected",
    "component_type_mismatch",
    "r_count_ratio",
    "has_measurement_device",
    "design_complexity_score",
]


def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


def extract_features(circuit, question_type, expected):
    components  = circuit.get("components",  [])
    connections = circuit.get("connections", [])

    comp_counts = {t: 0 for t in COMPONENT_TYPES}
    for c in components:
        t = c.get("type", "")
        if t in comp_counts:
            comp_counts[t] += 1

    n_comp  = len(components)
    n_conn  = len(connections)

    node_set = set()
    for c in connections:
        node_set.add(c["from"]["comp_id"] + ":" + c["from"]["pin"])
        node_set.add(c["to"]["comp_id"]   + ":" + c["to"]["pin"])
    n_nodes = len(node_set)

    has_ground  = 1 if comp_counts["ground"] > 0 else 0
    has_op_amp  = 1 if comp_counts["op_amp"]  > 0 else 0
    n_resistors = comp_counts["resistor"]
    n_caps      = comp_counts["capacitor"]
    n_inds      = comp_counts["inductor"]
    n_voltmeters = comp_counts["voltmeter"]
    n_diodes    = comp_counts["diode"]
    n_bjt       = comp_counts["bjt_npn"]

    # Measurement devices (voltmeter or ammeter)
    has_measurement_device = 1 if (comp_counts["voltmeter"] + comp_counts["ammeter"]) > 0 else 0

    # Resistor values
    resistors = [c for c in components if c.get("type") == "resistor"]
    r_vals    = [float(c.get("properties", {}).get("resistance_ohm", 1000)) for c in resistors]
    r_max = max(r_vals) if r_vals else 0.0
    r_min = min(r_vals) if r_vals else 0.0
    r_ratio = (r_max / r_min) if (r_min > 0 and len(r_vals) >= 2) else 0.0

    # Voltage source
    vsrc  = next((c for c in components if c.get("type") == "voltage_source"), None)
    v_in  = float(vsrc["properties"].get("voltage", 5)) if vsrc else 0.0

    # Polarity error: negative terminal of vsrc connected to a live node
    polarity_error = circuit.get("_polarity_error", 0)

    # Component type mismatch (e.g. diode in wrong circuit)
    component_type_mismatch = circuit.get("_type_mismatch", 0)

    # Op-amp feedback
    op_on_feedback = 0
    if has_op_amp:
        op_id = next((c["comp_id"] for c in components if c.get("type") == "op_amp"), None)
        if op_id:
            inv_c = [c for c in connections if
                     (c["to"]["comp_id"] == op_id   and c["to"]["pin"]   == "inverting") or
                     (c["from"]["comp_id"] == op_id and c["from"]["pin"] == "inverting")]
            out_c = [c for c in connections if
                     (c["from"]["comp_id"] == op_id and c["from"]["pin"] == "output") or
                     (c["to"]["comp_id"]   == op_id and c["to"]["pin"]   == "output")]
            if len(inv_c) >= 2 and len(out_c) >= 1:
                op_on_feedback = 1

    # Floating components
    connected_comps = set()
    for c in connections:
        connected_comps.add(c["from"]["comp_id"])
        connected_comps.add(c["to"]["comp_id"])
    comp_ids   = set(c["comp_id"] for c in components)
    n_floating = len(comp_ids - connected_comps)

    # Short-circuit detection
    has_short_circuit = 0
    if vsrc and has_ground:
        gnd_id = next((c["comp_id"] for c in components if c.get("type") == "ground"), None)
        if gnd_id:
            vsrc_id = vsrc["comp_id"]
            direct_short = any(
                (c["from"]["comp_id"] == vsrc_id and c["from"]["pin"] == "positive" and c["to"]["comp_id"] == gnd_id) or
                (c["to"]["comp_id"] == vsrc_id   and c["to"]["pin"] == "positive"   and c["from"]["comp_id"] == gnd_id)
                for c in connections
            )
            if direct_short:
                has_short_circuit = 1

    # Circuit completeness
    circuit_completeness = len(connected_comps & comp_ids) / max(1, n_comp)

    # Question-type one-hot encoding (8 types)
    qtype_map = {
        "gain_check":       [1, 0, 0, 0, 0, 0, 0, 0],
        "voltage_divider":  [0, 1, 0, 0, 0, 0, 0, 0],
        "rlc_analysis":     [0, 0, 1, 0, 0, 0, 0, 0],
        "led_circuit":      [0, 0, 0, 1, 0, 0, 0, 0],
        "bjt_amplifier":    [0, 0, 0, 0, 1, 0, 0, 0],
        "rc_filter":        [0, 0, 0, 0, 0, 1, 0, 0],
        "rectifier":        [0, 0, 0, 0, 0, 0, 1, 0],
        "power_supply":     [0, 0, 0, 0, 0, 0, 0, 1],
    }
    qtype_vec = qtype_map.get(question_type, [0, 0, 0, 0, 0, 0, 0, 0])

    # Expected component counts by type
    r_count_expected_map = {
        "gain_check": 2, "voltage_divider": 2, "rlc_analysis": 1,
        "led_circuit": 1, "bjt_amplifier": 3, "rc_filter": 1,
        "rectifier": 1, "power_supply": 2
    }
    r_count_expected = r_count_expected_map.get(question_type, 2)

    # R count ratio (placed / expected)
    r_count_ratio = (n_resistors / r_count_expected) if r_count_expected > 0 else 1.0

    # Value error
    measured     = circuit.get("_measured", None)
    expected_val = expected.get("value", 0)
    val_error    = 0.0
    if measured is not None and expected_val != 0:
        val_error = abs((measured - expected_val) / (abs(expected_val) + 1e-9))
    val_error_sigmoid = sigmoid(val_error * 5 - 2) if val_error > 0 else 0.0

    # Design complexity score: weighted combination
    design_complexity = (
        n_comp * 2 +
        n_conn * 1.5 +
        n_nodes * 1 +
        (10 if has_op_amp else 0) +
        (5 if n_bjt > 0 else 0)
    )

    # Rule-engine topology score (0–70)
    topo_score = 70.0
    if not has_ground:             topo_score -= 30.0
    if n_floating > 0:             topo_score -= min(20.0, n_floating * 8.0)
    if question_type == "gain_check" and has_op_amp and not op_on_feedback:
        topo_score -= 25.0
    if has_short_circuit:          topo_score -= 40.0
    if polarity_error:             topo_score -= 20.0
    if component_type_mismatch:    topo_score -= 15.0
    topo_score = max(0.0, topo_score)

    return {
        "n_components":           n_comp,
        "n_connections":          n_conn,
        "n_unique_nodes":         n_nodes,
        "has_ground":             has_ground,
        "has_op_amp":             has_op_amp,
        "n_resistors":            n_resistors,
        "n_capacitors":           n_caps,
        "n_inductors":            n_inds,
        "n_diodes":               n_diodes,
        "n_bjt":                  n_bjt,
        "n_voltmeters":           n_voltmeters,
        "r_max":                  r_max,
        "r_min":                  r_min,
        "r_ratio":                r_ratio,
        "v_in":                   v_in,
        "op_feedback_wired":      op_on_feedback,
        "n_floating_comps":       n_floating,
        "qtype_gain":             qtype_vec[0],
        "qtype_divider":          qtype_vec[1],
        "qtype_rlc":              qtype_vec[2],
        "qtype_led":              qtype_vec[3],
        "qtype_bjt":              qtype_vec[4],
        "qtype_rc_filter":        qtype_vec[5],
        "qtype_rectifier":        qtype_vec[6],
        "qtype_power_supply":     qtype_vec[7],
        "val_error_frac":         val_error,
        "has_short_circuit":      has_short_circuit,
        "circuit_completeness":   circuit_completeness,
        "val_error_sigmoid":      val_error_sigmoid,
        "r_count_expected":       r_count_expected,
        "topology_score_rule":    topo_score,
        "polarity_error_detected":polarity_error,
        "component_type_mismatch":component_type_mismatch,
        "r_count_ratio":          r_count_ratio,
        "has_measurement_device": has_measurement_device,
        "design_complexity_score":design_complexity,
    }


# ── Physics-Based Deterministic Scoring ──────────────────────────────────────

def label_sample(feat, question_type, expected, measured):
    has_ground     = feat["has_ground"] == 1
    n_floating     = feat["n_floating_comps"]
    has_feedback   = feat["op_feedback_wired"] == 1
    has_short      = feat["has_short_circuit"] == 1
    polarity_err   = feat["polarity_error_detected"] == 1
    type_mismatch  = feat["component_type_mismatch"] == 1
    tol            = expected.get("tolerance", 0.05)
    val_err        = feat["val_error_frac"]

    issues = []

    # Topology scoring (0–70)
    topology_score = 70.0
    if not has_ground:
        topology_score -= 30.0
        issues.append("missing_ground")
    if n_floating > 0:
        penalty = min(20.0, n_floating * 8.0)
        topology_score -= penalty
        issues.append("floating_pin")
    if question_type == "gain_check" and feat["has_op_amp"] and not has_feedback:
        topology_score -= 25.0
        issues.append("wrong_topology")
    if has_short:
        topology_score -= 40.0
        issues.append("short_circuit")
    if polarity_err:
        topology_score -= 20.0
        issues.append("polarity_error")
    if type_mismatch:
        topology_score -= 15.0
        issues.append("wrong_component_type")
    topology_score = max(0.0, topology_score)

    # Value score (0–30)
    value_score = 30.0
    if measured is None:
        value_score = 0.0
    elif val_err == 0.0 and expected.get("value", 0) == 0:
        value_score = 30.0 if topology_score > 40 else 15.0
    elif val_err <= tol:
        value_score = 30.0
    elif val_err <= tol * 3:
        value_score = round(30.0 * (1.0 - (val_err - tol) / (tol * 2)), 2)
        issues.append("wrong_value")
    elif val_err <= 2.0:
        value_score = round(30.0 * max(0.0, 1.0 - (val_err - tol * 3) / (2.0 - tol * 3)), 2)
        issues.append("wrong_value")
    else:
        value_score = 0.0
        issues.append("wrong_value")

    score = round(max(0.0, min(100.0, topology_score + value_score)), 1)
    verdict = 2 if score >= 85 else (1 if score >= 40 else 0)
    return score, verdict, issues


# ── Synthetic Circuit Builders ────────────────────────────────────────────────

def make_op_amp_circuit(target_gain, mistake=None):
    rin = random.choice([1000, 2000, 4700, 10000, 22000])
    rf  = abs(target_gain) * rin
    if mistake == "wrong_value":
        rf *= random.uniform(0.15, 3.5)
    rf = round(rf)

    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": random.choice([1, 2, 5, 10]), "waveform": "DC"}},
        {"comp_id": "R1",  "type": "resistor",        "properties": {"resistance_ohm": rin}},
        {"comp_id": "R2",  "type": "resistor",        "properties": {"resistance_ohm": rf}},
        {"comp_id": "OA1", "type": "op_amp",          "properties": {"model": "ideal"}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if random.random() < 0.2:
        components.append({"comp_id": "VM1", "type": "voltmeter", "properties": {}})

    connections = [
        {"from": {"comp_id": "V1",  "pin": "positive"},     "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "R1",  "pin": "2"},             "to": {"comp_id": "OA1", "pin": "inverting"}},
        {"from": {"comp_id": "R2",  "pin": "2"},             "to": {"comp_id": "OA1", "pin": "output"}},
        {"from": {"comp_id": "V1",  "pin": "negative"},      "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "OA1", "pin": "non_inverting"}, "to": {"comp_id": "GND", "pin": "1"}},
    ]
    polarity_err = 0
    type_mismatch = 0

    if mistake == "missing_feedback":
        connections.append({"from": {"comp_id": "R2", "pin": "1"}, "to": {"comp_id": "V1", "pin": "positive"}})
    elif mistake == "floating_component":
        connections = [c for c in connections if "R2" not in [c["from"]["comp_id"], c["to"]["comp_id"]]]
    elif mistake == "polarity_reversed":
        # Swap positive/negative of V1
        connections[0]["from"]["pin"] = "negative"
        connections[3]["from"]["pin"] = "positive"
        polarity_err = 1
    elif mistake == "wrong_component_type":
        # Replace R2 with inductor — wrong type
        for comp in components:
            if comp["comp_id"] == "R2":
                comp["type"] = "inductor"
                comp["properties"] = {"inductance_henry": 0.01}
        type_mismatch = 1
        connections.append({"from": {"comp_id": "OA1", "pin": "inverting"}, "to": {"comp_id": "R2", "pin": "1"}})
    else:
        connections.append({"from": {"comp_id": "OA1", "pin": "inverting"}, "to": {"comp_id": "R2", "pin": "1"}})

    measured_gain = -(rf / rin) if rin > 0 and mistake not in ["missing_feedback", "floating_component"] else None
    return {"components": components, "connections": connections, "_measured": measured_gain,
            "_polarity_error": polarity_err, "_type_mismatch": type_mismatch}


def make_voltage_divider(target_vout, vin=5.0, mistake=None):
    if mistake == "wrong_value":
        r1 = random.choice([1000, 2200, 4700, 10000])
        r2 = r1 * random.uniform(0.08, 4.0)
    else:
        r1 = random.choice([1000, 2200, 4700, 10000, 47000])
        if (vin - target_vout) > 0:
            ratio = target_vout / (vin - target_vout)
            r2    = round(r1 * ratio * random.uniform(0.98, 1.02))
        else:
            r2 = r1

    components = [
        {"comp_id": "V1", "type": "voltage_source", "properties": {"voltage": vin, "waveform": "DC"}},
        {"comp_id": "R1", "type": "resistor",        "properties": {"resistance_ohm": r1}},
        {"comp_id": "R2", "type": "resistor",        "properties": {"resistance_ohm": r2}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if random.random() < 0.25:
        components.append({"comp_id": "VM1", "type": "voltmeter", "properties": {}})

    connections = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1", "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "R2", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    polarity_err = 0
    if mistake == "floating_component":
        pass  # R2 bottom end not connected to ground
    elif mistake == "polarity_reversed":
        connections[0]["from"]["pin"] = "negative"
        connections[2]["from"]["pin"] = "positive"
        polarity_err = 1
        connections.append({"from": {"comp_id": "R2", "pin": "2"}, "to": {"comp_id": "GND", "pin": "1"}})
    else:
        connections.append({"from": {"comp_id": "R2", "pin": "2"}, "to": {"comp_id": "GND", "pin": "1"}})

    measured = vin * (r2 / (r1 + r2)) if (r1 + r2) > 0 and mistake != "floating_component" else None
    return {"components": components, "connections": connections, "_measured": measured,
            "_polarity_error": polarity_err, "_type_mismatch": 0}


def make_rlc_circuit(target_freq, mistake=None):
    L = random.choice([0.001, 0.005, 0.01, 0.02, 0.05, 0.1])
    if mistake == "wrong_value":
        C = random.uniform(1e-9, 1e-4)
    else:
        C = 1.0 / ((2 * math.pi * target_freq) ** 2 * L)
        if mistake != "exact_correct":
            C *= random.uniform(0.90, 1.10)

    R = random.choice([10, 47, 100, 220, 470, 1000])
    type_mismatch = 0
    components = [
        {"comp_id": "V1", "type": "voltage_source", "properties": {"voltage": 5, "waveform": "sine"}},
        {"comp_id": "R1", "type": "resistor",        "properties": {"resistance_ohm": R}},
        {"comp_id": "L1", "type": "inductor",        "properties": {"inductance_henry": L}},
        {"comp_id": "C1", "type": "capacitor",       "properties": {"capacitance_farad": C}},
    ]
    if mistake == "wrong_component_type":
        # Replace inductor with resistor — wrong type
        for comp in components:
            if comp["comp_id"] == "L1":
                comp["type"] = "resistor"
                comp["properties"] = {"resistance_ohm": 470}
        type_mismatch = 1
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})

    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1", "pin": "1"}},
            {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "L1", "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": type_mismatch}

    connections = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1", "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "L1", "pin": "1"}},
        {"from": {"comp_id": "L1", "pin": "2"},         "to": {"comp_id": "C1", "pin": "1"}},
        {"from": {"comp_id": "C1", "pin": "2"},         "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    f0 = 1.0 / (2 * math.pi * math.sqrt(L * C)) if (L * C) > 0 and type_mismatch == 0 else 0
    return {"components": components, "connections": connections, "_measured": f0,
            "_polarity_error": 0, "_type_mismatch": type_mismatch}


def make_led_circuit(mistake=None):
    if mistake == "wrong_value":
        R = random.choice([5, 10, 20, 5000, 10000, 50000])
    else:
        R = random.choice([100, 150, 200, 270, 330, 470, 560])

    polarity_err = 0
    components = [
        {"comp_id": "V1", "type": "voltage_source", "properties": {"voltage": 5, "waveform": "DC"}},
        {"comp_id": "R1", "type": "resistor",        "properties": {"resistance_ohm": R}},
        {"comp_id": "D1", "type": "diode",           "properties": {"model": "ideal"}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})

    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1", "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}

    if mistake == "polarity_reversed":
        # Diode reverse-biased
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1",  "pin": "1"}},
            {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "D1",  "pin": "cathode"}},
            {"from": {"comp_id": "D1", "pin": "anode"},     "to": {"comp_id": "GND", "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
        ]
        polarity_err = 1
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": polarity_err, "_type_mismatch": 0}

    connections = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "D1",  "pin": "anode"}},
        {"from": {"comp_id": "D1", "pin": "cathode"},   "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    Vf = 2.0
    measured = (5.0 - Vf) / R if R > 0 else 0
    return {"components": components, "connections": connections, "_measured": measured,
            "_polarity_error": 0, "_type_mismatch": 0}


def make_bjt_amplifier(target_gain=10.0, mistake=None):
    """Common-emitter BJT amplifier with collector-emitter resistors."""
    Vcc = 12.0
    Rc  = random.choice([1000, 2200, 4700, 10000])
    Re  = round(Rc / abs(target_gain)) if mistake != "wrong_value" else random.choice([100, 500, 5000, 50000])
    Rb  = random.choice([47000, 100000, 220000])

    polarity_err = 0
    type_mismatch = 0

    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": Vcc, "waveform": "DC"}},
        {"comp_id": "Rb",  "type": "resistor",        "properties": {"resistance_ohm": Rb}},
        {"comp_id": "Rc",  "type": "resistor",        "properties": {"resistance_ohm": Rc}},
        {"comp_id": "Re",  "type": "resistor",        "properties": {"resistance_ohm": Re}},
        {"comp_id": "Q1",  "type": "bjt_npn",         "properties": {"model": "2N2222"}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if random.random() < 0.2:
        components.append({"comp_id": "VM1", "type": "voltmeter", "properties": {}})

    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1",  "pin": "positive"},  "to": {"comp_id": "Rc",  "pin": "1"}},
            {"from": {"comp_id": "V1",  "pin": "negative"},   "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}

    if mistake == "polarity_reversed":
        polarity_err = 1
        connections = [
            {"from": {"comp_id": "V1",  "pin": "negative"},  "to": {"comp_id": "Rc",  "pin": "1"}},
            {"from": {"comp_id": "Rc",  "pin": "2"},          "to": {"comp_id": "Q1",  "pin": "collector"}},
            {"from": {"comp_id": "V1",  "pin": "positive"},   "to": {"comp_id": "GND", "pin": "1"}},
            {"from": {"comp_id": "GND", "pin": "1"},          "to": {"comp_id": "Q1",  "pin": "emitter"}},
            {"from": {"comp_id": "Rb",  "pin": "1"},          "to": {"comp_id": "V1",  "pin": "negative"}},
            {"from": {"comp_id": "Rb",  "pin": "2"},          "to": {"comp_id": "Q1",  "pin": "base"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": polarity_err, "_type_mismatch": 0}

    connections = [
        {"from": {"comp_id": "V1",  "pin": "positive"},  "to": {"comp_id": "Rc",  "pin": "1"}},
        {"from": {"comp_id": "Rc",  "pin": "2"},          "to": {"comp_id": "Q1",  "pin": "collector"}},
        {"from": {"comp_id": "Q1",  "pin": "emitter"},    "to": {"comp_id": "Re",  "pin": "1"}},
        {"from": {"comp_id": "Re",  "pin": "2"},          "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1",  "pin": "positive"},   "to": {"comp_id": "Rb",  "pin": "1"}},
        {"from": {"comp_id": "Rb",  "pin": "2"},          "to": {"comp_id": "Q1",  "pin": "base"}},
        {"from": {"comp_id": "V1",  "pin": "negative"},   "to": {"comp_id": "GND", "pin": "1"}},
    ]
    measured_gain = -(Rc / Re) if Re > 0 else None
    return {"components": components, "connections": connections, "_measured": measured_gain,
            "_polarity_error": polarity_err, "_type_mismatch": type_mismatch}


def make_rc_filter(target_freq, mistake=None):
    """RC low-pass filter: Vout = Vin × 1/(1 + jωRC)"""
    C = random.choice([1e-9, 10e-9, 100e-9, 1e-6, 10e-6])
    if mistake == "wrong_value":
        R = random.uniform(1, 10e6)
    else:
        R = 1.0 / (2 * math.pi * target_freq * C)
        R *= random.uniform(0.95, 1.05)

    type_mismatch = 0
    components = [
        {"comp_id": "V1", "type": "voltage_source", "properties": {"voltage": 5, "waveform": "sine"}},
        {"comp_id": "R1", "type": "resistor",        "properties": {"resistance_ohm": R}},
        {"comp_id": "C1", "type": "capacitor",       "properties": {"capacitance_farad": C}},
    ]
    if mistake == "wrong_component_type":
        for comp in components:
            if comp["comp_id"] == "C1":
                comp["type"] = "inductor"
                comp["properties"] = {"inductance_henry": 0.01}
        type_mismatch = 1
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if random.random() < 0.2:
        components.append({"comp_id": "VM1", "type": "voltmeter", "properties": {}})

    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1", "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": type_mismatch}

    connections = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1", "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "C1", "pin": "1"}},
        {"from": {"comp_id": "C1", "pin": "2"},         "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    fc = 1.0 / (2 * math.pi * R * C) if (R * C) > 0 and type_mismatch == 0 else 0
    return {"components": components, "connections": connections, "_measured": fc,
            "_polarity_error": 0, "_type_mismatch": type_mismatch}


def make_half_wave_rectifier(mistake=None):
    """Half-wave rectifier: AC source + diode + load resistor."""
    Vac = random.choice([5, 10, 12, 24])
    RL  = random.choice([470, 1000, 2200, 4700, 10000])
    polarity_err = 0
    type_mismatch = 0

    components = [
        {"comp_id": "V1", "type": "voltage_source", "properties": {"voltage": Vac, "waveform": "sine"}},
        {"comp_id": "D1", "type": "diode",           "properties": {"model": "1N4007"}},
        {"comp_id": "R1", "type": "resistor",        "properties": {"resistance_ohm": RL}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if random.random() < 0.2:
        components.append({"comp_id": "VM1", "type": "voltmeter", "properties": {}})

    if mistake == "polarity_reversed":
        polarity_err = 1
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "D1",  "pin": "cathode"}},
            {"from": {"comp_id": "D1", "pin": "anode"},     "to": {"comp_id": "R1",  "pin": "1"}},
            {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "GND", "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": polarity_err, "_type_mismatch": 0}

    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "D1",  "pin": "anode"}},
            {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}

    connections = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "D1",  "pin": "anode"}},
        {"from": {"comp_id": "D1", "pin": "cathode"},   "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    Vf = 0.7
    measured_vdc = (Vac - Vf) / math.pi  # Average half-wave DC voltage
    return {"components": components, "connections": connections, "_measured": measured_vdc,
            "_polarity_error": 0, "_type_mismatch": 0}


def make_power_supply_filter(mistake=None):
    """Capacitor-filtered power supply."""
    Vac  = random.choice([9, 12, 15, 24])
    RL   = random.choice([470, 1000, 2200, 4700])
    if mistake == "wrong_value":
        C = random.choice([1e-12, 1e-9, 1e-3])   # too small or too large
    else:
        C = random.choice([100e-6, 470e-6, 1000e-6, 2200e-6])

    polarity_err = 0
    components = [
        {"comp_id": "V1", "type": "voltage_source", "properties": {"voltage": Vac, "waveform": "sine"}},
        {"comp_id": "D1", "type": "diode",           "properties": {"model": "1N4007"}},
        {"comp_id": "C1", "type": "capacitor",       "properties": {"capacitance_farad": C}},
        {"comp_id": "R1", "type": "resistor",        "properties": {"resistance_ohm": RL}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if random.random() < 0.25:
        components.append({"comp_id": "VM1", "type": "voltmeter", "properties": {}})

    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "D1",  "pin": "anode"}},
            {"from": {"comp_id": "D1", "pin": "cathode"},   "to": {"comp_id": "R1",  "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}

    connections = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "D1",  "pin": "anode"}},
        {"from": {"comp_id": "D1", "pin": "cathode"},   "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "D1", "pin": "cathode"},   "to": {"comp_id": "C1",  "pin": "1"}},
        {"from": {"comp_id": "C1", "pin": "2"},         "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},         "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    Vf = 0.7
    measured_vdc = Vac - Vf
    return {"components": components, "connections": connections, "_measured": measured_vdc,
            "_polarity_error": polarity_err, "_type_mismatch": 0}


# ── Mistake Distribution ───────────────────────────────────────────────────────

MISTAKES = [
    None, None, None, None,            # 40% correct/near-correct
    "wrong_value", "wrong_value",      # 20% wrong values
    "missing_ground",                  # 10% missing ground
    "missing_feedback",                # 5%  missing feedback (op-amp only → else wrong_value)
    "floating_component",              # 8%  floating component
    "polarity_reversed",               # 7%  polarity error
    "wrong_component_type",            # 5%  wrong component type
    "over_engineered",                 # ignored for now → wrong_value
]

# 14 question configs × 3572 ≈ 50,008 samples
QUESTION_CONFIGS = [
    # Op-amp gain check — 4 variants
    {"type": "gain_check",      "expected": {"value": -10,  "tolerance": 0.05}, "make": lambda m: make_op_amp_circuit(-10,  m)},
    {"type": "gain_check",      "expected": {"value": -5,   "tolerance": 0.05}, "make": lambda m: make_op_amp_circuit(-5,   m)},
    {"type": "gain_check",      "expected": {"value": -2,   "tolerance": 0.05}, "make": lambda m: make_op_amp_circuit(-2,   m)},
    {"type": "gain_check",      "expected": {"value": -20,  "tolerance": 0.05}, "make": lambda m: make_op_amp_circuit(-20,  m)},
    # Voltage divider — 3 variants
    {"type": "voltage_divider", "expected": {"value": 2.5,  "tolerance": 0.05}, "make": lambda m: make_voltage_divider(2.5, 5.0, m)},
    {"type": "voltage_divider", "expected": {"value": 3.3,  "tolerance": 0.05}, "make": lambda m: make_voltage_divider(3.3, 5.0, m)},
    {"type": "voltage_divider", "expected": {"value": 1.8,  "tolerance": 0.05}, "make": lambda m: make_voltage_divider(1.8, 5.0, m)},
    # RLC circuits — 2 variants
    {"type": "rlc_analysis",    "expected": {"value": 1000, "tolerance": 0.05}, "make": lambda m: make_rlc_circuit(1000, m)},
    {"type": "rlc_analysis",    "expected": {"value": 5000, "tolerance": 0.05}, "make": lambda m: make_rlc_circuit(5000, m)},
    # LED circuit — 1 variant
    {"type": "led_circuit",     "expected": {"value": 0.015,"tolerance": 0.20}, "make": lambda m: make_led_circuit(m)},
    # BJT amplifier — 1 variant
    {"type": "bjt_amplifier",   "expected": {"value": -10,  "tolerance": 0.10}, "make": lambda m: make_bjt_amplifier(10.0, m)},
    # RC low-pass filter — 1 variant
    {"type": "rc_filter",       "expected": {"value": 1000, "tolerance": 0.10}, "make": lambda m: make_rc_filter(1000, m)},
    # Rectifier — 1 variant
    {"type": "rectifier",       "expected": {"value": 3.6,  "tolerance": 0.15}, "make": lambda m: make_half_wave_rectifier(m)},
    # Power supply filter — 1 variant
    {"type": "power_supply",    "expected": {"value": 11.3, "tolerance": 0.10}, "make": lambda m: make_power_supply_filter(m)},
]


def generate_dataset(n_per_config=N_SAMPLES_PER_CONFIG):
    rows = []
    for cfg in QUESTION_CONFIGS:
        for _ in range(n_per_config):
            mistake = random.choice(MISTAKES)
            # missing_feedback only applies to gain_check
            if cfg["type"] != "gain_check" and mistake == "missing_feedback":
                mistake = "wrong_value"
            # over_engineered → treat as wrong_value for now
            if mistake == "over_engineered":
                mistake = "wrong_value"

            circuit  = cfg["make"](mistake)
            measured = circuit.get("_measured", None)
            feat     = extract_features(circuit, cfg["type"], cfg["expected"])
            score, verdict, issues = label_sample(feat, cfg["type"], cfg["expected"], measured)

            row = {
                **feat,
                "score":                    score,
                "verdict":                  verdict,
                "question_type":            cfg["type"],
                "missing_ground_lbl":       int("missing_ground"       in issues),
                "floating_pin_lbl":         int("floating_pin"         in issues),
                "wrong_topology_lbl":       int("wrong_topology"       in issues),
                "short_circuit_lbl":        int("short_circuit"        in issues),
                "wrong_value_lbl":          int("wrong_value"          in issues),
                "polarity_error_lbl":       int("polarity_error"       in issues),
                "wrong_component_type_lbl": int("wrong_component_type" in issues),
            }
            rows.append(row)
    return rows


def main():
    print("=" * 65)
    print("  Circuit Evaluation Dataset Generator — 35 Features, 50k+ Samples")
    print("=" * 65)
    rows = generate_dataset()

    out_path   = Path(__file__).parent / "circuit_training_data.csv"
    fieldnames = list(rows[0].keys())

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n[OK] Generated {len(rows):,} samples -> {out_path}")
    verdicts = [r["verdict"] for r in rows]
    scores   = [r["score"]   for r in rows]
    print(f"     Correct:   {verdicts.count(2):,}")
    print(f"     Partial:   {verdicts.count(1):,}")
    print(f"     Incorrect: {verdicts.count(0):,}")
    print(f"     Score range: {min(scores):.1f} – {max(scores):.1f} | Mean: {sum(scores)/len(scores):.1f}")
    print(f"     Features: {len(FEATURE_COLS)}")
    print(f"     Configs:  {len(QUESTION_CONFIGS)}")


if __name__ == "__main__":
    main()
