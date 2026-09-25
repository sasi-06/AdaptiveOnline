"""
circuit_dataset_generator.py
─────────────────────────────────────────────────────────────────────────────
Generates synthetic training data for the circuit evaluation ML model.

Strategy:
  Physics-based deterministic labelling.
  Score = topology_score (0-70) + value_score (0-30)

  20 question types × 3,000 samples ≈ 60,000 total samples.
  60 features per sample (expanded from 35).

Run:  python circuit_dataset_generator.py
Outputs:
  circuit_training_data.csv   (~60,000 samples, 60 features)
  circuit_graph_records.json  (raw circuit JSON for GNN training)
"""

import json
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

# ── 60-Feature Extraction ─────────────────────────────────────────────────────

FEATURE_COLS = [
    # ── GROUP A: Structural (original 35) ─────────────────────────────────────
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
    # Question type one-hot (original 8)
    "qtype_gain", "qtype_divider", "qtype_rlc", "qtype_led",
    "qtype_bjt", "qtype_rc_filter", "qtype_rectifier", "qtype_power_supply",
    # Value error
    "val_error_frac",
    # Extended original
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
    # ── GROUP B: New question type one-hot (6 new circuit types) ──────────────
    "qtype_wheatstone",
    "qtype_full_rectifier",
    "qtype_zener",
    "qtype_common_base",
    "qtype_schmitt",
    "qtype_oscillator",
    # ── GROUP C: Net-Level Analysis (Union-Find) ───────────────────────────────
    "n_true_nets",
    "max_net_size",
    "isolated_net_count",
    "n_series_pairs",
    "dc_path_complete",
    # ── GROUP D: Component Value Physics ──────────────────────────────────────
    "lc_product",
    "rc_time_constant",
    "r_value_std",
    "cap_max_uf",
    "ind_max_mh",
    # ── GROUP E: Pin-Level Health ──────────────────────────────────────────────
    "bjt_all_pins_wired",
    "op_vcc_vee_wired",
    "max_fan_out",
    "avg_connections_per_comp",
    # ── GROUP F: Exam Behavior Signals ─────────────────────────────────────────
    "time_spent_sec",
    "n_component_deletes",
    "n_wire_deletes",
    # ── GROUP G: Question Context ──────────────────────────────────────────────
    "question_difficulty",
]


def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


# ── Union-Find Net Builder ────────────────────────────────────────────────────

def build_union_find_nets(connections):
    """
    Returns a dict mapping each root → list of pin keys belonging to that net.
    A pin key is  'comp_id::pin'.
    """
    parent = {}

    def _key(side):
        return f"{side['comp_id']}::{side['pin']}"

    def find(x):
        if parent.get(x, x) != x:
            parent[x] = find(parent[x])
        return parent.get(x, x)

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for conn in connections:
        fk = _key(conn["from"])
        tk = _key(conn["to"])
        parent.setdefault(fk, fk)
        parent.setdefault(tk, tk)
        union(fk, tk)

    # Consolidate: root → members
    nets = {}
    for k in parent:
        root = find(k)
        nets.setdefault(root, []).append(k)
    return nets


def _compute_net_features(components, connections):
    """Derive net-level features using union-find."""
    # Build union-find inline so parent is in scope
    parent = {}

    def _key(side):
        return f"{side['comp_id']}::{side['pin']}"

    def find(x):
        if parent.get(x, x) != x:
            parent[x] = find(parent[x])
        return parent.get(x, x)

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for conn in connections:
        fk = _key(conn["from"])
        tk = _key(conn["to"])
        parent.setdefault(fk, fk)
        parent.setdefault(tk, tk)
        union(fk, tk)

    # Consolidate nets
    nets = {}
    for k in parent:
        root = find(k)
        nets.setdefault(root, []).append(k)

    net_list    = list(nets.values())
    n_true_nets = len(net_list)
    max_net_size = max((len(n) for n in net_list), default=0)

    # Isolated nets = nets whose pins all belong to exactly 1 component
    isolated = sum(
        1 for net in net_list
        if len({k.split("::")[0] for k in net}) == 1
    )

    # Series pairs: nets that contain exactly 2 pins (one from each component)
    series_pairs = sum(1 for net in net_list if len(net) == 2)

    # DC path: heuristic — V+ pin and GND pin are both connected
    vs_ids  = {c["comp_id"] for c in components if c.get("type") == "voltage_source"}
    gnd_ids = {c["comp_id"] for c in components if c.get("type") == "ground"}
    has_vs_conn  = any(
        conn["from"]["comp_id"] in vs_ids or conn["to"]["comp_id"] in vs_ids
        for conn in connections
    )
    has_gnd_conn = any(
        conn["from"]["comp_id"] in gnd_ids or conn["to"]["comp_id"] in gnd_ids
        for conn in connections
    )
    dc_path = 1 if (has_vs_conn and has_gnd_conn) else 0

    return {
        "n_true_nets":        n_true_nets,
        "max_net_size":       max_net_size,
        "isolated_net_count": isolated,
        "n_series_pairs":     series_pairs,
        "dc_path_complete":   dc_path,
    }


def extract_features(circuit, question_type, expected, behavior=None):
    """
    Extract 60 features from a circuit dict.
    behavior (optional): dict with keys time_spent_sec, n_component_deletes, n_wire_deletes
    """
    components  = circuit.get("components",  [])
    connections = circuit.get("connections", [])
    behavior    = behavior or {}

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

    has_ground   = 1 if comp_counts["ground"] > 0 else 0
    has_op_amp   = 1 if comp_counts["op_amp"]  > 0 else 0
    n_resistors  = comp_counts["resistor"]
    n_caps       = comp_counts["capacitor"]
    n_inds       = comp_counts["inductor"]
    n_voltmeters = comp_counts["voltmeter"]
    n_diodes     = comp_counts["diode"]
    n_bjt        = comp_counts["bjt_npn"]
    has_measurement_device = 1 if (comp_counts["voltmeter"] + comp_counts["ammeter"]) > 0 else 0

    # ── Resistor values ───────────────────────────────────────────────────────
    resistors = [c for c in components if c.get("type") == "resistor"]
    r_vals    = [float(c.get("properties", {}).get("resistance_ohm", 1000)) for c in resistors]
    r_max   = max(r_vals) if r_vals else 0.0
    r_min   = min(r_vals) if r_vals else 0.0
    r_ratio = (r_max / r_min) if (r_min > 0 and len(r_vals) >= 2) else 0.0
    r_std   = (sum((v - (sum(r_vals)/len(r_vals)))**2 for v in r_vals) / len(r_vals))**0.5 if len(r_vals) > 1 else 0.0

    # ── Capacitor / Inductor values ───────────────────────────────────────────
    caps  = [c for c in components if c.get("type") == "capacitor"]
    inds  = [c for c in components if c.get("type") == "inductor"]
    c_vals = [float(c.get("properties", {}).get("capacitance_farad", 1e-6)) for c in caps]
    l_vals = [float(c.get("properties", {}).get("inductance_henry", 0.001)) for c in inds]
    cap_max_uf = max(c_vals) * 1e6 if c_vals else 0.0
    ind_max_mh = max(l_vals) * 1000 if l_vals else 0.0
    # Physics products
    lc_product    = (l_vals[0] * c_vals[0]) if (l_vals and c_vals) else 0.0
    rc_time_const = (r_vals[0] * c_vals[0]) if (r_vals and c_vals) else 0.0

    # ── Voltage source ────────────────────────────────────────────────────────
    vsrc = next((c for c in components if c.get("type") == "voltage_source"), None)
    v_in = float(vsrc["properties"].get("voltage", 5)) if vsrc else 0.0

    # ── Polarity / mismatch flags (from circuit builder) ─────────────────────
    polarity_error          = circuit.get("_polarity_error", 0)
    component_type_mismatch = circuit.get("_type_mismatch",  0)

    # ── Op-amp feedback ───────────────────────────────────────────────────────
    op_on_feedback  = 0
    op_vcc_vee      = 0
    if has_op_amp:
        op_id = next((c["comp_id"] for c in components if c.get("type") == "op_amp"), None)
        if op_id:
            inv_c = [c for c in connections if
                     (c["to"]["comp_id"]   == op_id and c["to"]["pin"]   == "inverting") or
                     (c["from"]["comp_id"] == op_id and c["from"]["pin"] == "inverting")]
            out_c = [c for c in connections if
                     (c["from"]["comp_id"] == op_id and c["from"]["pin"] == "output") or
                     (c["to"]["comp_id"]   == op_id and c["to"]["pin"]   == "output")]
            if len(inv_c) >= 2 and len(out_c) >= 1:
                op_on_feedback = 1
            vcc_c = [c for c in connections if
                     (c["from"]["comp_id"] == op_id and c["from"]["pin"] in ("vcc","vee")) or
                     (c["to"]["comp_id"]   == op_id and c["to"]["pin"]   in ("vcc","vee"))]
            op_vcc_vee = 1 if len(vcc_c) >= 2 else 0

    # ── BJT pin check ─────────────────────────────────────────────────────────
    bjt_all_wired = 0
    if n_bjt > 0:
        bjt_comp = next((c for c in components if c.get("type") == "bjt_npn"), None)
        if bjt_comp:
            bjt_id  = bjt_comp["comp_id"]
            b_wired = any((c["from"]["comp_id"]==bjt_id and c["from"]["pin"]=="base") or
                          (c["to"]["comp_id"]==bjt_id   and c["to"]["pin"]=="base")   for c in connections)
            co_wired= any((c["from"]["comp_id"]==bjt_id and c["from"]["pin"]=="collector") or
                          (c["to"]["comp_id"]==bjt_id   and c["to"]["pin"]=="collector") for c in connections)
            em_wired= any((c["from"]["comp_id"]==bjt_id and c["from"]["pin"]=="emitter") or
                          (c["to"]["comp_id"]==bjt_id   and c["to"]["pin"]=="emitter")   for c in connections)
            bjt_all_wired = 1 if (b_wired and co_wired and em_wired) else 0

    # ── Floating components ───────────────────────────────────────────────────
    connected_comps = set()
    for c in connections:
        connected_comps.add(c["from"]["comp_id"])
        connected_comps.add(c["to"]["comp_id"])
    comp_ids   = set(c["comp_id"] for c in components)
    n_floating = len(comp_ids - connected_comps)

    # ── Max fan-out & avg connections per component ───────────────────────────
    conn_count = {}
    for conn in connections:
        conn_count[conn["from"]["comp_id"]] = conn_count.get(conn["from"]["comp_id"], 0) + 1
        conn_count[conn["to"]["comp_id"]]   = conn_count.get(conn["to"]["comp_id"],   0) + 1
    max_fan_out = max(conn_count.values()) if conn_count else 0
    avg_conn    = (sum(conn_count.values()) / max(1, n_comp))

    # ── Short-circuit detection ───────────────────────────────────────────────
    has_short_circuit = 0
    if vsrc and has_ground:
        gnd_id  = next((c["comp_id"] for c in components if c.get("type") == "ground"), None)
        vsrc_id = vsrc["comp_id"]
        if gnd_id:
            direct_short = any(
                (c["from"]["comp_id"] == vsrc_id and c["from"]["pin"] == "positive" and c["to"]["comp_id"] == gnd_id) or
                (c["to"]["comp_id"]   == vsrc_id and c["to"]["pin"]   == "positive" and c["from"]["comp_id"] == gnd_id)
                for c in connections
            )
            if direct_short:
                has_short_circuit = 1

    # ── Circuit completeness ──────────────────────────────────────────────────
    circuit_completeness = len(connected_comps & comp_ids) / max(1, n_comp)

    # ── Net-Level Features (Union-Find) ───────────────────────────────────────
    net_feats = _compute_net_features(components, connections)

    # ── Question-type one-hot (original 8 + 6 new) ───────────────────────────
    qtype_map = {
        "gain_check":       [1,0,0,0,0,0,0,0],
        "voltage_divider":  [0,1,0,0,0,0,0,0],
        "rlc_analysis":     [0,0,1,0,0,0,0,0],
        "led_circuit":      [0,0,0,1,0,0,0,0],
        "bjt_amplifier":    [0,0,0,0,1,0,0,0],
        "rc_filter":        [0,0,0,0,0,1,0,0],
        "rectifier":        [0,0,0,0,0,0,1,0],
        "power_supply":     [0,0,0,0,0,0,0,1],
    }
    qtype_vec = qtype_map.get(question_type, [0,0,0,0,0,0,0,0])

    # New circuit type one-hot
    new_qtypes = ["wheatstone", "full_rectifier", "zener", "common_base", "schmitt", "oscillator"]
    new_qtype_vec = [1 if question_type == qt else 0 for qt in new_qtypes]

    # ── Expected resistor count ───────────────────────────────────────────────
    r_count_expected_map = {
        "gain_check":2, "voltage_divider":2, "rlc_analysis":1,
        "led_circuit":1, "bjt_amplifier":3, "rc_filter":1,
        "rectifier":1, "power_supply":2,
        "wheatstone":4, "full_rectifier":1, "zener":1,
        "common_base":3, "schmitt":2, "oscillator":2,
    }
    r_count_expected = r_count_expected_map.get(question_type, 2)
    r_count_ratio    = (n_resistors / r_count_expected) if r_count_expected > 0 else 1.0

    # ── Value error ───────────────────────────────────────────────────────────
    measured     = circuit.get("_measured", None)
    expected_val = expected.get("value", 0)
    val_error    = 0.0
    if measured is not None and expected_val != 0:
        val_error = abs((measured - expected_val) / (abs(expected_val) + 1e-9))
    val_error_sigmoid = sigmoid(val_error * 5 - 2) if val_error > 0 else 0.0

    # ── Design complexity score ───────────────────────────────────────────────
    design_complexity = (
        n_comp * 2 + n_conn * 1.5 + n_nodes * 1 +
        (10 if has_op_amp else 0) + (5 if n_bjt > 0 else 0)
    )

    # ── Rule-engine topology score (0-70) ─────────────────────────────────────
    topo_score = 70.0
    if not has_ground:                           topo_score -= 30.0
    if n_floating > 0:                           topo_score -= min(20.0, n_floating * 8.0)
    if question_type == "gain_check" and has_op_amp and not op_on_feedback:
                                                 topo_score -= 25.0
    if has_short_circuit:                        topo_score -= 40.0
    if polarity_error:                           topo_score -= 20.0
    if component_type_mismatch:                  topo_score -= 15.0
    topo_score = max(0.0, topo_score)

    # ── Exam behavior signals (default 0 for synthetic data) ─────────────────
    time_spent      = float(behavior.get("time_spent_sec",       random.randint(60, 600)))
    n_comp_deletes  = int(behavior.get("n_component_deletes",    random.randint(0, 5)))
    n_wire_deletes  = int(behavior.get("n_wire_deletes",         random.randint(0, 8)))
    q_difficulty    = int(behavior.get("question_difficulty",    random.choice([1, 2, 3])))

    return {
        # ── Original 35 ─────────────────────────────────────────────────────
        "n_components":            n_comp,
        "n_connections":           n_conn,
        "n_unique_nodes":          n_nodes,
        "has_ground":              has_ground,
        "has_op_amp":              has_op_amp,
        "n_resistors":             n_resistors,
        "n_capacitors":            n_caps,
        "n_inductors":             n_inds,
        "n_diodes":                n_diodes,
        "n_bjt":                   n_bjt,
        "n_voltmeters":            n_voltmeters,
        "r_max":                   r_max,
        "r_min":                   r_min,
        "r_ratio":                 r_ratio,
        "v_in":                    v_in,
        "op_feedback_wired":       op_on_feedback,
        "n_floating_comps":        n_floating,
        "qtype_gain":              qtype_vec[0],
        "qtype_divider":           qtype_vec[1],
        "qtype_rlc":               qtype_vec[2],
        "qtype_led":               qtype_vec[3],
        "qtype_bjt":               qtype_vec[4],
        "qtype_rc_filter":         qtype_vec[5],
        "qtype_rectifier":         qtype_vec[6],
        "qtype_power_supply":      qtype_vec[7],
        "val_error_frac":          val_error,
        "has_short_circuit":       has_short_circuit,
        "circuit_completeness":    circuit_completeness,
        "val_error_sigmoid":       val_error_sigmoid,
        "r_count_expected":        r_count_expected,
        "topology_score_rule":     topo_score,
        "polarity_error_detected": polarity_error,
        "component_type_mismatch": component_type_mismatch,
        "r_count_ratio":           r_count_ratio,
        "has_measurement_device":  has_measurement_device,
        "design_complexity_score": design_complexity,
        # ── New 6 question-type one-hots ─────────────────────────────────────
        "qtype_wheatstone":        new_qtype_vec[0],
        "qtype_full_rectifier":    new_qtype_vec[1],
        "qtype_zener":             new_qtype_vec[2],
        "qtype_common_base":       new_qtype_vec[3],
        "qtype_schmitt":           new_qtype_vec[4],
        "qtype_oscillator":        new_qtype_vec[5],
        # ── Net-level (Group C) ───────────────────────────────────────────────
        "n_true_nets":             net_feats["n_true_nets"],
        "max_net_size":            net_feats["max_net_size"],
        "isolated_net_count":      net_feats["isolated_net_count"],
        "n_series_pairs":          net_feats["n_series_pairs"],
        "dc_path_complete":        net_feats["dc_path_complete"],
        # ── Component value physics (Group D) ─────────────────────────────────
        "lc_product":              lc_product,
        "rc_time_constant":        rc_time_const,
        "r_value_std":             r_std,
        "cap_max_uf":              cap_max_uf,
        "ind_max_mh":              ind_max_mh,
        # ── Pin health (Group E) ──────────────────────────────────────────────
        "bjt_all_pins_wired":      bjt_all_wired,
        "op_vcc_vee_wired":        op_vcc_vee,
        "max_fan_out":             max_fan_out,
        "avg_connections_per_comp":round(avg_conn, 3),
        # ── Exam behavior (Group F) ───────────────────────────────────────────
        "time_spent_sec":          time_spent,
        "n_component_deletes":     n_comp_deletes,
        "n_wire_deletes":          n_wire_deletes,
        # ── Question context (Group G) ────────────────────────────────────────
        "question_difficulty":     q_difficulty,
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


# ── 6 New Circuit Builder Functions ───────────────────────────────────────────

def make_wheatstone_bridge(target_ratio=1.0, mistake=None):
    """Balanced Wheatstone bridge: R1/R2 = R3/R4. Vout = 0 at balance."""
    R1 = random.choice([1000, 2200, 4700, 10000])
    R2 = round(R1 * target_ratio * random.uniform(0.97, 1.03))
    R3 = random.choice([1000, 2200, 4700])
    R4 = round(R3 * target_ratio)
    Vin = 10.0
    if mistake == "wrong_value":
        R4 = round(R3 * random.uniform(0.2, 4.0))
    polarity_err = 0
    type_mismatch = 0
    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": Vin,  "waveform": "DC"}},
        {"comp_id": "R1",  "type": "resistor",       "properties": {"resistance_ohm": R1}},
        {"comp_id": "R2",  "type": "resistor",       "properties": {"resistance_ohm": R2}},
        {"comp_id": "R3",  "type": "resistor",       "properties": {"resistance_ohm": R3}},
        {"comp_id": "R4",  "type": "resistor",       "properties": {"resistance_ohm": R4}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if random.random() < 0.25:
        components.append({"comp_id": "VM1", "type": "voltmeter", "properties": {}})
    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1",  "pin": "positive"}, "to": {"comp_id": "R1",  "pin": "1"}},
            {"from": {"comp_id": "V1",  "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}
    connections = [
        {"from": {"comp_id": "V1",  "pin": "positive"}, "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "V1",  "pin": "positive"}, "to": {"comp_id": "R3",  "pin": "1"}},
        {"from": {"comp_id": "R1",  "pin": "2"},         "to": {"comp_id": "R2",  "pin": "1"}},
        {"from": {"comp_id": "R3",  "pin": "2"},         "to": {"comp_id": "R4",  "pin": "1"}},
        {"from": {"comp_id": "R2",  "pin": "2"},         "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "R4",  "pin": "2"},         "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1",  "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
    ]
    # Vout across bridge arms
    Vout = Vin * (R2/(R1+R2) - R4/(R3+R4)) if (R1+R2) > 0 and (R3+R4) > 0 else 0
    return {"components": components, "connections": connections, "_measured": Vout,
            "_polarity_error": polarity_err, "_type_mismatch": type_mismatch}


def make_full_wave_rectifier(mistake=None):
    """Full-wave bridge: 4 diodes + filter cap + load R. Vdc = Vpeak - 2*Vf."""
    Vac = random.choice([9, 12, 15, 24])
    RL  = random.choice([470, 1000, 2200, 4700])
    C   = random.choice([100e-6, 470e-6, 1000e-6])
    if mistake == "wrong_value":
        C = random.choice([1e-12, 1e-9])  # too small → heavy ripple
    polarity_err = 0
    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": Vac, "waveform": "sine"}},
        {"comp_id": "D1",  "type": "diode",           "properties": {"model": "1N4007"}},
        {"comp_id": "D2",  "type": "diode",           "properties": {"model": "1N4007"}},
        {"comp_id": "D3",  "type": "diode",           "properties": {"model": "1N4007"}},
        {"comp_id": "D4",  "type": "diode",           "properties": {"model": "1N4007"}},
        {"comp_id": "C1",  "type": "capacitor",       "properties": {"capacitance_farad": C}},
        {"comp_id": "R1",  "type": "resistor",        "properties": {"resistance_ohm": RL}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "D1",  "pin": "anode"}},
            {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}
    if mistake == "polarity_reversed":
        polarity_err = 1
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "D1",  "pin": "cathode"}},
            {"from": {"comp_id": "D1", "pin": "anode"},    "to": {"comp_id": "R1",  "pin": "1"}},
            {"from": {"comp_id": "R1", "pin": "2"},        "to": {"comp_id": "GND", "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": polarity_err, "_type_mismatch": 0}
    connections = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "D1",  "pin": "anode"}},
        {"from": {"comp_id": "D1", "pin": "cathode"},  "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "D2",  "pin": "anode"}},
        {"from": {"comp_id": "D2", "pin": "cathode"},  "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "D3", "pin": "cathode"},  "to": {"comp_id": "V1",  "pin": "positive"}},
        {"from": {"comp_id": "D4", "pin": "cathode"},  "to": {"comp_id": "V1",  "pin": "negative"}},
        {"from": {"comp_id": "D3", "pin": "anode"},    "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "D4", "pin": "anode"},    "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "C1", "pin": "1"},        "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "C1", "pin": "2"},        "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},        "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
    ]
    Vdc = Vac * math.sqrt(2) - 2 * 0.7  # full-wave peak - 2 diode drops
    return {"components": components, "connections": connections, "_measured": Vdc,
            "_polarity_error": polarity_err, "_type_mismatch": 0}


def make_zener_regulator(vz=5.1, mistake=None):
    """Zener shunt regulator: Rseries + Zener → Vout = Vz."""
    Vin  = random.choice([9, 12, 15])
    Iz   = random.choice([0.005, 0.010, 0.020])  # zener current
    Rs   = round((Vin - vz) / Iz) if (Vin - vz) > 0 else 1000
    if mistake == "wrong_value":
        Rs = round(Rs * random.uniform(0.1, 10.0))
    polarity_err = 0
    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": Vin, "waveform": "DC"}},
        {"comp_id": "R1",  "type": "resistor",       "properties": {"resistance_ohm": Rs}},
        {"comp_id": "D1",  "type": "diode",          "properties": {"model": "zener"}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if mistake == "polarity_reversed":
        polarity_err = 1
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1",  "pin": "1"}},
            {"from": {"comp_id": "R1", "pin": "2"},        "to": {"comp_id": "D1",  "pin": "cathode"}},
            {"from": {"comp_id": "D1", "pin": "anode"},    "to": {"comp_id": "GND", "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": polarity_err, "_type_mismatch": 0}
    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1",  "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}
    # Correct: zener cathode to high side (reverse biased in regulation)
    connections = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},        "to": {"comp_id": "D1",  "pin": "anode"}},
        {"from": {"comp_id": "D1", "pin": "cathode"},  "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
    ]
    Vout = vz if mistake != "wrong_value" else vz * random.uniform(0.5, 2.0)
    return {"components": components, "connections": connections, "_measured": Vout,
            "_polarity_error": polarity_err, "_type_mismatch": 0}


def make_bjt_common_base(mistake=None):
    """Common-base BJT: emitter input, collector output. Current gain α < 1."""
    Vcc  = 12.0
    Re   = random.choice([470, 1000, 2200])
    Rc   = random.choice([2200, 4700, 10000])
    Rb   = random.choice([47000, 100000])
    polarity_err  = 0
    type_mismatch = 0
    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": Vcc,  "waveform": "DC"}},
        {"comp_id": "Re",  "type": "resistor",       "properties": {"resistance_ohm": Re}},
        {"comp_id": "Rc",  "type": "resistor",       "properties": {"resistance_ohm": Rc}},
        {"comp_id": "Rb",  "type": "resistor",       "properties": {"resistance_ohm": Rb}},
        {"comp_id": "Q1",  "type": "bjt_npn",        "properties": {"model": "2N2222"}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "Rc",  "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}
    # Common-base: base is AC ground, emitter = input, collector = output
    connections = [
        {"from": {"comp_id": "V1",  "pin": "positive"},  "to": {"comp_id": "Rc",  "pin": "1"}},
        {"from": {"comp_id": "Rc",  "pin": "2"},          "to": {"comp_id": "Q1",  "pin": "collector"}},
        {"from": {"comp_id": "Q1",  "pin": "emitter"},    "to": {"comp_id": "Re",  "pin": "1"}},
        {"from": {"comp_id": "Re",  "pin": "2"},          "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "Q1",  "pin": "base"},       "to": {"comp_id": "Rb",  "pin": "1"}},
        {"from": {"comp_id": "Rb",  "pin": "2"},          "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1",  "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    alpha = 0.98  # typical common-base current gain
    return {"components": components, "connections": connections, "_measured": alpha,
            "_polarity_error": polarity_err, "_type_mismatch": type_mismatch}


def make_schmitt_trigger(mistake=None):
    """Op-amp Schmitt trigger: POSITIVE feedback. Hysteresis = ±Vcc*R1/(R1+R2)."""
    Vcc  = 12.0
    R1   = random.choice([10000, 22000, 47000])
    R2   = random.choice([10000, 47000, 100000])
    if mistake == "wrong_value":
        R2 = R2 * random.uniform(0.1, 10.0)
    polarity_err  = 0
    type_mismatch = 0
    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": Vcc,  "waveform": "sine"}},
        {"comp_id": "R1",  "type": "resistor",       "properties": {"resistance_ohm": R1}},
        {"comp_id": "R2",  "type": "resistor",       "properties": {"resistance_ohm": R2}},
        {"comp_id": "OA1", "type": "op_amp",         "properties": {"model": "ideal"}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1",  "pin": "positive"}, "to": {"comp_id": "OA1", "pin": "inverting"}},
            {"from": {"comp_id": "V1",  "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": 0}
    # Positive feedback: output → R1 → non-inverting input
    connections = [
        {"from": {"comp_id": "V1",  "pin": "positive"},    "to": {"comp_id": "OA1", "pin": "inverting"}},
        {"from": {"comp_id": "OA1", "pin": "output"},      "to": {"comp_id": "R1",  "pin": "1"}},
        {"from": {"comp_id": "R1",  "pin": "2"},           "to": {"comp_id": "OA1", "pin": "non_inverting"}},
        {"from": {"comp_id": "R2",  "pin": "1"},           "to": {"comp_id": "OA1", "pin": "non_inverting"}},
        {"from": {"comp_id": "R2",  "pin": "2"},           "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1",  "pin": "negative"},   "to": {"comp_id": "GND", "pin": "1"}},
    ]
    # Hysteresis threshold voltage
    hysteresis = Vcc * R1 / (R1 + R2) if (R1+R2) > 0 else 0
    return {"components": components, "connections": connections, "_measured": hysteresis,
            "_polarity_error": polarity_err, "_type_mismatch": type_mismatch}


def make_colpitts_oscillator(target_freq=100000, mistake=None):
    """Colpitts oscillator: BJT + L + C1||C2 tank. f = 1/(2π√(L*Ceq))."""
    L    = random.choice([0.001, 0.005, 0.01, 0.05])
    Ceq  = 1.0 / ((2 * math.pi * target_freq) ** 2 * L)
    # C1 = C2 = 2*Ceq for equal split
    C1   = 2 * Ceq * random.uniform(0.9, 1.1)
    C2   = 2 * Ceq * random.uniform(0.9, 1.1)
    Rb   = random.choice([22000, 47000, 100000])
    Rc   = random.choice([1000, 2200, 4700])
    Vcc  = 12.0
    if mistake == "wrong_value":
        C1 = C1 * random.uniform(0.1, 10.0)
    type_mismatch = 0
    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": Vcc,  "waveform": "DC"}},
        {"comp_id": "Q1",  "type": "bjt_npn",        "properties": {"model": "BC547"}},
        {"comp_id": "L1",  "type": "inductor",       "properties": {"inductance_henry": L}},
        {"comp_id": "C1",  "type": "capacitor",      "properties": {"capacitance_farad": C1}},
        {"comp_id": "C2",  "type": "capacitor",      "properties": {"capacitance_farad": C2}},
        {"comp_id": "Rb",  "type": "resistor",       "properties": {"resistance_ohm": Rb}},
        {"comp_id": "Rc",  "type": "resistor",       "properties": {"resistance_ohm": Rc}},
    ]
    if mistake != "missing_ground":
        components.append({"comp_id": "GND", "type": "ground", "properties": {}})
    if mistake == "floating_component":
        connections = [
            {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "Rc",  "pin": "1"}},
            {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
        ]
        return {"components": components, "connections": connections, "_measured": None,
                "_polarity_error": 0, "_type_mismatch": type_mismatch}
    connections = [
        {"from": {"comp_id": "V1",  "pin": "positive"},  "to": {"comp_id": "Rc",  "pin": "1"}},
        {"from": {"comp_id": "Rc",  "pin": "2"},          "to": {"comp_id": "Q1",  "pin": "collector"}},
        {"from": {"comp_id": "Q1",  "pin": "base"},       "to": {"comp_id": "Rb",  "pin": "1"}},
        {"from": {"comp_id": "Rb",  "pin": "2"},          "to": {"comp_id": "V1",  "pin": "positive"}},
        {"from": {"comp_id": "Q1",  "pin": "emitter"},    "to": {"comp_id": "C1",  "pin": "1"}},
        {"from": {"comp_id": "C1",  "pin": "2"},          "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "Q1",  "pin": "collector"},  "to": {"comp_id": "L1",  "pin": "1"}},
        {"from": {"comp_id": "L1",  "pin": "2"},          "to": {"comp_id": "C2",  "pin": "1"}},
        {"from": {"comp_id": "C2",  "pin": "2"},          "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1",  "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    # Ceq = C1*C2/(C1+C2); f = 1/(2π√(L*Ceq))
    Ceq_actual = (C1 * C2) / (C1 + C2) if (C1 + C2) > 0 else Ceq
    f0 = 1.0 / (2 * math.pi * math.sqrt(L * Ceq_actual)) if (L * Ceq_actual) > 0 else 0
    return {"components": components, "connections": connections, "_measured": f0,
            "_polarity_error": 0, "_type_mismatch": type_mismatch}


# ── Mistake Distribution ───────────────────────────────────────────────────────

MISTAKES = [
    None, None, None, None,              # 35% correct/near-correct
    "wrong_value", "wrong_value",        # 20% wrong values
    "missing_ground",                    # 10% missing ground
    "missing_feedback",                  # 5%  no feedback (op-amp only)
    "floating_component", "floating_component", # 15% floating
    "polarity_reversed",                 # 7%  polarity error
    "wrong_component_type",              # 5%  wrong type
    "extra_component",                   # 3%  over-engineered  ← NEW
]

# 20 question configs × 3000 ≈ 60,000 samples
QUESTION_CONFIGS = [
    # Op-amp gain check — 4 variants
    {"type": "gain_check",      "expected": {"value": -10,   "tolerance": 0.05}, "make": lambda m: make_op_amp_circuit(-10,  m), "difficulty": 2},
    {"type": "gain_check",      "expected": {"value": -5,    "tolerance": 0.05}, "make": lambda m: make_op_amp_circuit(-5,   m), "difficulty": 2},
    {"type": "gain_check",      "expected": {"value": -2,    "tolerance": 0.05}, "make": lambda m: make_op_amp_circuit(-2,   m), "difficulty": 1},
    {"type": "gain_check",      "expected": {"value": -20,   "tolerance": 0.05}, "make": lambda m: make_op_amp_circuit(-20,  m), "difficulty": 3},
    # Voltage divider — 3 variants
    {"type": "voltage_divider", "expected": {"value": 2.5,   "tolerance": 0.05}, "make": lambda m: make_voltage_divider(2.5,  5.0, m), "difficulty": 1},
    {"type": "voltage_divider", "expected": {"value": 3.3,   "tolerance": 0.05}, "make": lambda m: make_voltage_divider(3.3,  5.0, m), "difficulty": 1},
    {"type": "voltage_divider", "expected": {"value": 1.8,   "tolerance": 0.05}, "make": lambda m: make_voltage_divider(1.8,  5.0, m), "difficulty": 2},
    # RLC circuits — 2 variants
    {"type": "rlc_analysis",    "expected": {"value": 1000,  "tolerance": 0.05}, "make": lambda m: make_rlc_circuit(1000,  m), "difficulty": 2},
    {"type": "rlc_analysis",    "expected": {"value": 5000,  "tolerance": 0.05}, "make": lambda m: make_rlc_circuit(5000,  m), "difficulty": 3},
    # LED circuit — 1 variant
    {"type": "led_circuit",     "expected": {"value": 0.015, "tolerance": 0.20}, "make": lambda m: make_led_circuit(m), "difficulty": 1},
    # BJT amplifier — 1 variant
    {"type": "bjt_amplifier",   "expected": {"value": -10,   "tolerance": 0.10}, "make": lambda m: make_bjt_amplifier(10.0, m), "difficulty": 3},
    # RC low-pass filter — 1 variant
    {"type": "rc_filter",       "expected": {"value": 1000,  "tolerance": 0.10}, "make": lambda m: make_rc_filter(1000,  m), "difficulty": 2},
    # Rectifier — 1 variant
    {"type": "rectifier",       "expected": {"value": 3.6,   "tolerance": 0.15}, "make": lambda m: make_half_wave_rectifier(m), "difficulty": 2},
    # Power supply filter — 1 variant
    {"type": "power_supply",    "expected": {"value": 11.3,  "tolerance": 0.10}, "make": lambda m: make_power_supply_filter(m), "difficulty": 2},
    # ── 6 NEW circuit types ─────────────────────────────────────────────────────
    {"type": "wheatstone",      "expected": {"value": 0.0,   "tolerance": 0.10}, "make": lambda m: make_wheatstone_bridge(1.0, m), "difficulty": 3},
    {"type": "full_rectifier",  "expected": {"value": 15.5,  "tolerance": 0.10}, "make": lambda m: make_full_wave_rectifier(m), "difficulty": 2},
    {"type": "zener",           "expected": {"value": 5.1,   "tolerance": 0.05}, "make": lambda m: make_zener_regulator(5.1, m), "difficulty": 2},
    {"type": "common_base",     "expected": {"value": 0.98,  "tolerance": 0.05}, "make": lambda m: make_bjt_common_base(m), "difficulty": 3},
    {"type": "schmitt",         "expected": {"value": 2.0,   "tolerance": 0.10}, "make": lambda m: make_schmitt_trigger(m), "difficulty": 3},
    {"type": "oscillator",      "expected": {"value": 100000,"tolerance": 0.10}, "make": lambda m: make_colpitts_oscillator(100000, m), "difficulty": 3},
]


def generate_dataset(n_per_config=N_SAMPLES_PER_CONFIG):
    rows    = []
    records = []  # raw circuit JSON records for GNN training

    for cfg in QUESTION_CONFIGS:
        difficulty = cfg.get("difficulty", 2)
        for _ in range(n_per_config):
            mistake = random.choice(MISTAKES)
            # missing_feedback only applies to gain_check
            if cfg["type"] != "gain_check" and mistake == "missing_feedback":
                mistake = "wrong_value"
            # extra_component: add an extra floating component to circuit
            extra_added = False
            circuit = cfg["make"](mistake if mistake != "extra_component" else None)
            if mistake == "extra_component":
                circuit["components"].append({
                    "comp_id": "X1", "type": "inductor",
                    "properties": {"inductance_henry": 0.01}
                })
                extra_added = True

            measured = circuit.get("_measured", None)
            behavior = {"question_difficulty": difficulty}
            feat     = extract_features(circuit, cfg["type"], cfg["expected"], behavior)
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

            # Save raw circuit for GNN training
            records.append({
                "components":  circuit["components"],
                "connections": circuit["connections"],
                "score":       score,
                "verdict":     verdict,
                "question_type": cfg["type"],
            })

    return rows, records


def main():
    print("=" * 70)
    print("  Circuit Evaluation Dataset Generator — 60 Features, 60k+ Samples")
    print("=" * 70)
    rows, records = generate_dataset()

    # ── Write CSV ─────────────────────────────────────────────────────────────
    out_path   = Path(__file__).parent / "circuit_training_data.csv"
    fieldnames = list(rows[0].keys())
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # ── Write JSON records for GNN ────────────────────────────────────────────
    gnn_path = Path(__file__).parent / "circuit_graph_records.json"
    with open(gnn_path, "w", encoding="utf-8") as f:
        json.dump(records, f)

    print(f"\n[OK] Generated {len(rows):,} samples  → {out_path}")
    print(f"[OK] GNN records saved      → {gnn_path}")
    verdicts = [r["verdict"] for r in rows]
    scores   = [r["score"]   for r in rows]
    print(f"     Correct:      {verdicts.count(2):,}")
    print(f"     Partial:      {verdicts.count(1):,}")
    print(f"     Incorrect:    {verdicts.count(0):,}")
    print(f"     Score range:  {min(scores):.1f} – {max(scores):.1f} | Mean: {sum(scores)/len(scores):.1f}")
    print(f"     Features:     {len(FEATURE_COLS)} (expanded from 35)")
    print(f"     Circuit types:{len(QUESTION_CONFIGS)} (expanded from 14)")


if __name__ == "__main__":
    main()
