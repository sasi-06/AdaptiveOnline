"""
circuit_evaluator_ml.py
─────────────────────────────────────────────────────────────────────────────
Inference module for the ensemble circuit evaluation model (35-feature model).

Exposes:
  evaluate_circuit(components, connections, question_type, expected, measured)
  get_model_stats()

Pipeline:
  1. extract_features()       → 35-dimensional feature vector
  2. _scaler.transform()      → standardise
  3. _score_m  (MLP + GBR)    → ensemble score 0-100
  4. _verd_m   (MLP + RF)     → ensemble verdict class + confidence
  5. generate_feedback()      → knowledge-base driven issues, feedback, concepts
  6. generate_design_analysis() → rich design report for admin panel
"""

import json
import math
import joblib
import numpy as np
from pathlib import Path

MODEL_DIR = Path(__file__).parent

# Lazy-loaded model references
_scaler  = None
_score_m = None   # tuple (mlp, gbr)
_verd_m  = None   # tuple (mlp, rf)
_meta    = None

VERDICT_LABELS = {0: "incorrect", 1: "partially_correct", 2: "correct"}

COMPONENT_TYPES = [
    "resistor", "capacitor", "inductor", "op_amp",
    "voltage_source", "ground", "diode", "voltmeter",
    "ammeter", "bjt_npn", "logic_gate_and"
]

FEATURE_COLS = [
    # ── GROUP A: Structural (original 35) ──────────────────────────────────────
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
    # ── GROUP B: New question type one-hot (6 new circuit types) ───────────────
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


# ── Knowledge-Base ────────────────────────────────────────────────────────────

CONCEPTS_MAP = {
    "missing_ground":       ["Ground Reference and Circuit Completeness", "Node Voltage Method (KCL)"],
    "floating_comp":        ["Circuit Completeness", "Schematic Reading and Circuit Topology"],
    "wrong_topology":       ["Op-Amp Circuit Topology", "Negative Feedback Path", "Feedback Resistor Ratio"],
    "wrong_value":          ["Inverting Amplifier Gain Formula (gain = −Rf/Rin)", "Voltage Divider Rule",
                             "Series RLC Resonance (f₀ = 1 / 2π√LC)", "Ohm's Law and Resistor Networks"],
    "short_circuit":        ["Short Circuit Prevention", "Ohm's Law and Resistor Networks", "Source Protection"],
    "polarity_error":       ["Diode Polarity and Forward Bias", "Voltage Source Terminals", "Component Orientation"],
    "wrong_component_type": ["Component Identification", "Resistor vs Capacitor vs Inductor Behavior",
                             "AC vs DC Circuit Elements"],
    "correct":              [],
}

REAL_WORLD_APPLICATIONS = {
    "gain_check":      ["Audio amplifier stages", "Sensor signal conditioning", "Instrumentation amplifiers",
                        "Operational amplifier-based ADC buffers"],
    "voltage_divider": ["Reference voltage generation", "ADC input scaling", "Biasing BJT transistors",
                        "Sensor bridge circuits"],
    "rlc_analysis":    ["Band-pass filters for radio receivers", "Oscillator tank circuits",
                        "Impedance matching networks", "Power factor correction"],
    "led_circuit":     ["Status indicator LEDs", "Optocoupler drive circuits",
                        "Microcontroller GPIO indicator circuits", "Display backlighting"],
    "bjt_amplifier":   ["Common-emitter audio pre-amplifier", "RF low-noise amplifiers",
                        "Transistor switching circuits", "Signal mixing"],
    "rc_filter":       ["Anti-aliasing filters before ADC", "Power supply decoupling",
                        "Audio low-pass/high-pass filters", "Debouncing digital signals"],
    "rectifier":       ["AC-to-DC conversion", "Battery charger rectifier stages",
                        "AM demodulation envelope detection", "Power supply front-end"],
    "power_supply":    ["Linear regulated power supply", "Bench power supply design",
                        "Microcontroller VCC supply", "Sensor module power"],
}

DESIGN_STYLE = {
    "gain_check":      {"min_components": 4, "max_components": 7,  "optimal": 5},
    "voltage_divider": {"min_components": 3, "max_components": 6,  "optimal": 4},
    "rlc_analysis":    {"min_components": 4, "max_components": 7,  "optimal": 5},
    "led_circuit":     {"min_components": 3, "max_components": 6,  "optimal": 4},
    "bjt_amplifier":   {"min_components": 5, "max_components": 9,  "optimal": 6},
    "rc_filter":       {"min_components": 3, "max_components": 6,  "optimal": 4},
    "rectifier":       {"min_components": 3, "max_components": 6,  "optimal": 4},
    "power_supply":    {"min_components": 4, "max_components": 8,  "optimal": 5},
}


def _sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


# ── Model Loader ──────────────────────────────────────────────────────────────

def _load_models():
    global _scaler, _score_m, _verd_m, _meta
    if _score_m is not None:
        return

    scaler_path  = MODEL_DIR / "circuit_feature_scaler.pkl"
    score_path   = MODEL_DIR / "circuit_score_model.pkl"
    verdict_path = MODEL_DIR / "circuit_verdict_model.pkl"
    meta_path    = MODEL_DIR / "circuit_model_metadata.json"

    if not score_path.exists():
        raise FileNotFoundError(
            "Circuit ML model not found. Run:\n"
            "  python circuit_dataset_generator.py\n"
            "  python circuit_ml_model.py\n"
            "or POST to /train-circuit-model"
        )

    try:
        import sys, sklearn._loss._loss
        sys.modules['_loss'] = sklearn._loss._loss
    except Exception:
        pass

    _scaler  = joblib.load(scaler_path)
    _score_m = joblib.load(score_path)
    _verd_m  = joblib.load(verdict_path)

    with open(meta_path) as f:
        _meta = json.load(f)

    n_model_features = len(_meta.get("feature_cols", FEATURE_COLS))
    if n_model_features != len(FEATURE_COLS):
        _score_m = None
        raise FileNotFoundError(
            f"Model was trained with {n_model_features} features but evaluator expects {len(FEATURE_COLS)}. "
            "POST /train-circuit-model to retrain."
        )


def _normalize_circuit_data(components, connections):
    norm_comps = []
    for c in components:
        c_copy = dict(c) if isinstance(c, dict) else {}
        if not c_copy.get("comp_id"):
            c_copy["comp_id"] = c_copy.get("id") or ""
        norm_comps.append(c_copy)

    norm_conns = []
    for conn in connections:
        conn_copy = dict(conn) if isinstance(conn, dict) else {}
        f = dict(conn_copy.get("from") or conn_copy.get("from_") or {})
        t = dict(conn_copy.get("to") or {})
        if not f.get("comp_id"):
            f["comp_id"] = f.get("componentId") or f.get("id") or ""
        if not t.get("comp_id"):
            t["comp_id"] = t.get("componentId") or t.get("id") or ""
        conn_copy["from"] = f
        conn_copy["to"]   = t
        norm_conns.append(conn_copy)

    return norm_comps, norm_conns


# ── Net-Level Analysis (Union-Find) ───────────────────────────────────────────

def _compute_net_features(components, connections):
    components, connections = _normalize_circuit_data(components, connections)
    def _key(endpoint):
        return f"{endpoint.get('comp_id', '')}::{endpoint.get('pin', '')}"

    parent = {}

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

    nets = {}
    for k in parent:
        root = find(k)
        nets.setdefault(root, []).append(k)

    net_list     = list(nets.values())
    n_true_nets  = len(net_list)
    max_net_size = max((len(n) for n in net_list), default=0)

    isolated = sum(
        1 for net in net_list
        if len({k.split("::")[0] for k in net}) == 1
    )
    series_pairs = sum(1 for net in net_list if len(net) == 2)

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


# ── 60-Feature Extractor ──────────────────────────────────────────────────────

def extract_features(components, connections, question_type, expected, measured=None, behavior=None):
    components, connections = _normalize_circuit_data(components, connections)
    comp_counts = {t: 0 for t in COMPONENT_TYPES}
    for c in components:
        t = c.get("type", "")
        if t in comp_counts:
            comp_counts[t] += 1

    n_comp  = len(components)
    n_conn  = len(connections)
    behavior = behavior or {}

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

    # Resistor values
    resistors = [c for c in components if c.get("type") == "resistor"]
    r_vals    = []
    for r in resistors:
        props = r.get("properties", {})
        if isinstance(props, dict):
            r_vals.append(float(props.get("resistance_ohm", 1000)))
        else:
            r_vals.append(1000.0)
    r_max   = max(r_vals) if r_vals else 0.0
    r_min   = min(r_vals) if r_vals else 0.0
    r_ratio = (r_max / r_min) if (r_min > 0 and len(r_vals) >= 2) else 0.0
    r_std   = (sum((v - (sum(r_vals)/len(r_vals)))**2 for v in r_vals) / len(r_vals))**0.5 if len(r_vals) > 1 else 0.0

    # Capacitor / Inductor values
    caps  = [c for c in components if c.get("type") == "capacitor"]
    inds  = [c for c in components if c.get("type") == "inductor"]
    c_vals = [float(c.get("properties", {}).get("capacitance_farad", 1e-6)) for c in caps]
    l_vals = [float(c.get("properties", {}).get("inductance_henry", 0.001)) for c in inds]
    cap_max_uf = max(c_vals) * 1e6 if c_vals else 0.0
    ind_max_mh = max(l_vals) * 1000 if l_vals else 0.0
    lc_product    = (l_vals[0] * c_vals[0]) if (l_vals and c_vals) else 0.0
    rc_time_const = (r_vals[0] * c_vals[0]) if (r_vals and c_vals) else 0.0

    # Voltage source
    vsrc  = next((c for c in components if c.get("type") == "voltage_source"), None)
    v_in  = 0.0
    if vsrc:
        props = vsrc.get("properties", {})
        v_in  = float(props.get("voltage", 5)) if isinstance(props, dict) else 5.0

    # Op-amp feedback & supply
    op_feedback = 0
    op_vcc_vee  = 0
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
                op_feedback = 1
            vcc_c = [c for c in connections if
                     (c["from"]["comp_id"] == op_id and c["from"]["pin"] in ("vcc", "vee")) or
                     (c["to"]["comp_id"]   == op_id and c["to"]["pin"]   in ("vcc", "vee"))]
            op_vcc_vee = 1 if len(vcc_c) >= 2 else 0

    # BJT pins
    bjt_all_wired = 0
    if n_bjt > 0:
        bjt_comp = next((c for c in components if c.get("type") == "bjt_npn"), None)
        if bjt_comp:
            bjt_id  = bjt_comp["comp_id"]
            b_wired = any((c["from"]["comp_id"]==bjt_id and c["from"]["pin"]=="base") or
                          (c["to"]["comp_id"]==bjt_id   and c["to"]["pin"]=="base") for c in connections)
            co_wired= any((c["from"]["comp_id"]==bjt_id and c["from"]["pin"]=="collector") or
                          (c["to"]["comp_id"]==bjt_id   and c["to"]["pin"]=="collector") for c in connections)
            em_wired= any((c["from"]["comp_id"]==bjt_id and c["from"]["pin"]=="emitter") or
                          (c["to"]["comp_id"]==bjt_id   and c["to"]["pin"]=="emitter") for c in connections)
            bjt_all_wired = 1 if (b_wired and co_wired and em_wired) else 0

    # Floating components
    connected_ids = set()
    for c in connections:
        connected_ids.add(c["from"]["comp_id"])
        connected_ids.add(c["to"]["comp_id"])
    all_ids    = set(c["comp_id"] for c in components)
    n_floating = len(all_ids - connected_ids)

    # Max fan-out & avg connections
    conn_count = {}
    for conn in connections:
        conn_count[conn["from"]["comp_id"]] = conn_count.get(conn["from"]["comp_id"], 0) + 1
        conn_count[conn["to"]["comp_id"]]   = conn_count.get(conn["to"]["comp_id"],   0) + 1
    max_fan_out = max(conn_count.values()) if conn_count else 0
    avg_conn    = (sum(conn_count.values()) / max(1, n_comp))

    # Short-circuit detection
    has_short = 0
    if vsrc and has_ground:
        vsrc_id = vsrc["comp_id"]
        gnd_id  = next((c["comp_id"] for c in components if c.get("type") == "ground"), None)
        if gnd_id:
            direct_short = any(
                (c["from"]["comp_id"] == vsrc_id and c["from"]["pin"] == "positive" and c["to"]["comp_id"] == gnd_id) or
                (c["to"]["comp_id"] == vsrc_id   and c["to"]["pin"] == "positive"   and c["from"]["comp_id"] == gnd_id)
                for c in connections
            )
            if direct_short:
                has_short = 1

    # Circuit completeness
    circuit_completeness = len(connected_ids & all_ids) / max(1, n_comp)

    # Net-Level features (Union-Find)
    net_feats = _compute_net_features(components, connections)

    # Question-type one-hot (original 8)
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

    # New 6 circuit types one-hot
    new_qtypes = ["wheatstone", "full_rectifier", "zener", "common_base", "schmitt", "oscillator"]
    new_qtype_vec = [1 if question_type == qt else 0 for qt in new_qtypes]

    # Expected resistor count
    r_count_expected_map = {
        "gain_check": 2, "voltage_divider": 2, "rlc_analysis": 1,
        "led_circuit": 1, "bjt_amplifier": 3, "rc_filter": 1,
        "rectifier": 1, "power_supply": 2,
        "wheatstone": 4, "full_rectifier": 1, "zener": 1,
        "common_base": 3, "schmitt": 2, "oscillator": 2,
    }
    r_count_expected = r_count_expected_map.get(question_type, 2)
    r_count_ratio    = (n_resistors / r_count_expected) if r_count_expected > 0 else 1.0

    # Value error
    exp_val = expected.get("value", 0) if expected else 0
    tol     = expected.get("tolerance", 0.05) if expected else 0.05
    val_err = 0.0
    if measured is not None and exp_val != 0:
        val_err = abs((measured - exp_val) / (abs(exp_val) + 1e-9))
    val_err_sigmoid = _sigmoid(val_err * 5 - 2) if val_err > 0 else 0.0

    # Polarity error detection
    polarity_error = 0
    if n_diodes > 0 and vsrc:
        vsrc_id = vsrc["comp_id"]
        for conn in connections:
            if (conn["from"]["comp_id"] == vsrc_id and conn["from"]["pin"] == "positive" and
                    conn["to"]["pin"] == "cathode"):
                polarity_error = 1
                break
            if (conn["to"]["comp_id"] == vsrc_id and conn["to"]["pin"] == "positive" and
                    conn["from"]["pin"] == "cathode"):
                polarity_error = 1
                break

    # Component type mismatch heuristic
    component_type_mismatch = 0
    if question_type in ("rlc_analysis", "rc_filter"):
        if n_caps == 0 and (n_inds > 0 or n_diodes > 0):
            component_type_mismatch = 1

    # Design complexity score
    design_complexity = (
        n_comp * 2 +
        n_conn * 1.5 +
        n_nodes * 1 +
        (10 if has_op_amp else 0) +
        (5 if n_bjt > 0 else 0)
    )

    # Rule-engine topology score (0–70)
    topo_score = 70.0
    if not has_ground:     topo_score -= 30.0
    if n_floating > 0:     topo_score -= min(20.0, n_floating * 8.0)
    if question_type == "gain_check" and has_op_amp and not op_feedback:
        topo_score -= 25.0
    if has_short:          topo_score -= 40.0
    if polarity_error:     topo_score -= 20.0
    if component_type_mismatch: topo_score -= 15.0
    topo_score = max(0.0, topo_score)

    time_spent     = float(behavior.get("time_spent_sec", 120.0))
    n_comp_deletes = int(behavior.get("n_component_deletes", 0))
    n_wire_deletes = int(behavior.get("n_wire_deletes", 0))
    q_difficulty   = int(behavior.get("question_difficulty", 2))

    feat = {
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
        "op_feedback_wired":       op_feedback,
        "n_floating_comps":        n_floating,
        "qtype_gain":              qtype_vec[0],
        "qtype_divider":           qtype_vec[1],
        "qtype_rlc":               qtype_vec[2],
        "qtype_led":               qtype_vec[3],
        "qtype_bjt":               qtype_vec[4],
        "qtype_rc_filter":         qtype_vec[5],
        "qtype_rectifier":         qtype_vec[6],
        "qtype_power_supply":      qtype_vec[7],
        "val_error_frac":          val_err,
        "has_short_circuit":       has_short,
        "circuit_completeness":    circuit_completeness,
        "val_error_sigmoid":       val_err_sigmoid,
        "r_count_expected":        r_count_expected,
        "topology_score_rule":     topo_score,
        "polarity_error_detected": polarity_error,
        "component_type_mismatch": component_type_mismatch,
        "r_count_ratio":           r_count_ratio,
        "has_measurement_device":  has_measurement_device,
        "design_complexity_score": design_complexity,
        "qtype_wheatstone":        new_qtype_vec[0],
        "qtype_full_rectifier":    new_qtype_vec[1],
        "qtype_zener":             new_qtype_vec[2],
        "qtype_common_base":       new_qtype_vec[3],
        "qtype_schmitt":           new_qtype_vec[4],
        "qtype_oscillator":        new_qtype_vec[5],
        "n_true_nets":             net_feats["n_true_nets"],
        "max_net_size":            net_feats["max_net_size"],
        "isolated_net_count":      net_feats["isolated_net_count"],
        "n_series_pairs":          net_feats["n_series_pairs"],
        "dc_path_complete":        net_feats["dc_path_complete"],
        "lc_product":              lc_product,
        "rc_time_constant":        rc_time_const,
        "r_value_std":             r_std,
        "cap_max_uf":              cap_max_uf,
        "ind_max_mh":              ind_max_mh,
        "bjt_all_pins_wired":      bjt_all_wired,
        "op_vcc_vee_wired":        op_vcc_vee,
        "max_fan_out":             max_fan_out,
        "avg_connections_per_comp":round(avg_conn, 3),
        "time_spent_sec":          time_spent,
        "n_component_deletes":     n_comp_deletes,
        "n_wire_deletes":          n_wire_deletes,
        "question_difficulty":     q_difficulty,
    }
    return feat



# ── Signal Path Builder ────────────────────────────────────────────────────────

def _build_signal_path(components, connections, question_type, feat):
    """Generate a human-readable description of how current flows through the circuit."""
    comp_by_id   = {c["comp_id"]: c for c in components}
    comp_by_type = {}
    for c in components:
        t = c.get("type", "unknown")
        comp_by_type.setdefault(t, []).append(c["comp_id"])

    vs = comp_by_type.get("voltage_source", ["V?"])
    rs = comp_by_type.get("resistor", [])
    cs = comp_by_type.get("capacitor", [])
    ls = comp_by_type.get("inductor", [])
    ds = comp_by_type.get("diode", [])
    oa = comp_by_type.get("op_amp", [])
    gnd = comp_by_type.get("ground", ["GND"])

    v_name = vs[0] if vs else "V?"
    gnd_name = gnd[0] if gnd else "GND"

    if question_type == "gain_check" and oa:
        oa_name = oa[0]
        rin_name = rs[0] if rs else "Rin"
        rf_name  = rs[1] if len(rs) > 1 else "Rf"
        path = (
            f"Signal flows: {v_name}(+) → {rin_name} → {oa_name}(V−) [inverting input]. "
            f"Feedback: {oa_name}(output) → {rf_name} → {oa_name}(V−). "
            f"{oa_name}(V+) → {gnd_name}. "
            f"Gain = −{rf_name}/{rin_name}."
        )
    elif question_type == "voltage_divider" and len(rs) >= 2:
        path = (
            f"Current flows: {v_name}(+) → {rs[0]} → {rs[1]} → {gnd_name}. "
            f"Output voltage is measured across {rs[1]}. "
            f"Vout = Vin × {rs[1]}/({rs[0]}+{rs[1]})."
        )
    elif question_type == "rlc_analysis" and rs and ls and cs:
        path = (
            f"Series RLC: {v_name}(+) → {rs[0]} → {ls[0]} → {cs[0]} → {gnd_name}. "
            f"At resonant frequency, inductive and capacitive reactances cancel. "
            f"f₀ = 1/(2π√LC)."
        )
    elif question_type == "led_circuit" and ds:
        path = (
            f"Current flows: {v_name}(+) → {rs[0] if rs else 'R?'} (current-limiter) → "
            f"{ds[0]}(anode→cathode) → {gnd_name}. "
            f"LED forward voltage ≈ 2V. I_LED = (Vs − Vf) / R."
        )
    elif question_type == "bjt_amplifier":
        bjts = comp_by_type.get("bjt_npn", [])
        q_name = bjts[0] if bjts else "Q?"
        path = (
            f"Bias: {v_name}(+) → {rs[0] if rs else 'Rb'} → {q_name}(Base). "
            f"Collector: {v_name}(+) → {rs[1] if len(rs)>1 else 'Rc'} → {q_name}(Collector). "
            f"Emitter: {q_name}(Emitter) → {rs[2] if len(rs)>2 else 'Re'} → {gnd_name}. "
            f"Voltage gain ≈ −Rc/Re."
        )
    elif question_type == "rc_filter" and rs and cs:
        path = (
            f"Signal path: {v_name}(+) → {rs[0]} → {cs[0]} → {gnd_name}. "
            f"Output taken across {cs[0]}. "
            f"Cutoff: fc = 1/(2πRC). Below fc → passes; above fc → attenuated."
        )
    elif question_type == "rectifier" and ds:
        path = (
            f"AC signal: {v_name}(+) → {ds[0]}(anode→cathode) → {rs[0] if rs else 'RL'} → {gnd_name}. "
            f"Negative half-cycles are blocked by the diode. "
            f"DC output ≈ Vpeak/π (half-wave average)."
        )
    elif question_type == "power_supply" and ds and cs:
        path = (
            f"AC → {ds[0]}(rectifier) → filter capacitor {cs[0]} in parallel with load {rs[0] if rs else 'RL'} → {gnd_name}. "
            f"Capacitor smooths ripple. Vdc ≈ Vpeak − Vf."
        )
    else:
        if feat["n_floating_comps"] > 0:
            path = "⚠️ Circuit is incomplete — some components are not connected. Signal path cannot be traced."
        elif feat["has_ground"] == 0:
            path = "⚠️ No ground reference found. Cannot determine signal flow without a 0V reference node."
        else:
            path = f"Signal path: {v_name}(+) → circuit elements → {gnd_name}. Ensure all components are correctly wired."

    return path


# ── Component-Level Analysis ──────────────────────────────────────────────────

def _analyze_components(components, connections, feat, question_type, expected, measured):
    """Return per-component analysis list for admin panel."""
    connected_ids = set()
    for c in connections:
        connected_ids.add(c["from"]["comp_id"])
        connected_ids.add(c["to"]["comp_id"])

    analysis = []
    resistors = [c for c in components if c.get("type") == "resistor"]
    r_vals    = []
    for r in resistors:
        props = r.get("properties", {})
        rv = float(props.get("resistance_ohm", 1000)) if isinstance(props, dict) else 1000.0
        r_vals.append(rv)

    for comp in components:
        cid   = comp["comp_id"]
        ctype = comp["type"]
        props = comp.get("properties", {}) or {}
        is_connected = cid in connected_ids

        status = "OK"
        note   = ""

        if not is_connected:
            status = "FLOATING"
            note   = f"{ctype.replace('_', ' ').title()} has no connections — it is floating and non-functional."
        elif ctype == "resistor":
            rv = float(props.get("resistance_ohm", 1000)) if isinstance(props, dict) else 1000.0
            if question_type == "gain_check" and measured is not None and expected:
                exp_gain = abs(expected.get("value", 0))
                if len(r_vals) >= 2:
                    actual_gain = max(r_vals) / min(r_vals)
                    gain_err = abs((actual_gain - exp_gain) / (exp_gain + 1e-9))
                    if gain_err > 0.1:
                        status = "WARN"
                        note   = f"Gain error: expected |gain|={exp_gain:.1f}, resistor ratio gives {actual_gain:.2f} — off by {gain_err*100:.1f}%."
            if not note:
                note = f"Resistance = {rv:.0f} Ω — connected."
        elif ctype == "capacitor":
            cv = float(props.get("capacitance_farad", 1e-6)) if isinstance(props, dict) else 1e-6
            cv_display = f"{cv*1e6:.2f} µF" if cv >= 1e-6 else f"{cv*1e9:.2f} nF"
            note = f"Capacitance = {cv_display} — connected."
        elif ctype == "inductor":
            lv = float(props.get("inductance_henry", 0.01)) if isinstance(props, dict) else 0.01
            note = f"Inductance = {lv*1000:.1f} mH — connected."
        elif ctype == "diode":
            if feat.get("polarity_error_detected") == 1:
                status = "ERROR"
                note   = "Diode appears reverse-biased (cathode connected to positive terminal) — no current will flow."
            else:
                note = "Diode forward-biased — Vf ≈ 0.7V (Si) or 2.0V (LED)."
        elif ctype == "op_amp":
            if feat.get("op_feedback_wired") == 0:
                status = "ERROR"
                note   = "Op-amp has no feedback resistor from output to inverting input — open-loop, will saturate."
            else:
                note = "Op-amp properly wired in closed-loop inverting configuration."
        elif ctype == "ground":
            note = "Ground reference (0V) — required for all node voltage measurements."
        elif ctype == "voltage_source":
            vv = float(props.get("voltage", 5)) if isinstance(props, dict) else 5.0
            wf = props.get("waveform", "DC") if isinstance(props, dict) else "DC"
            note = f"Source = {vv}V {wf}."
        elif ctype == "voltmeter":
            note = "Voltmeter — used for output voltage measurement (good practice)."
        elif ctype == "bjt_npn":
            note = "NPN BJT — verify base-emitter forward bias (~0.7V) and collector-emitter biasing."
        else:
            note = f"{ctype.replace('_', ' ').title()} — connected."

        analysis.append({
            "comp_id":   cid,
            "type":      ctype,
            "status":    status,
            "note":      note,
        })

    return analysis


# ── Design Grade Calculator ────────────────────────────────────────────────────

def _compute_design_grade(score, feat, question_type):
    """Return letter grade and qualitative assessment."""
    if score >= 95:
        grade, assessment = "A+", "Exceptional circuit design — all requirements met with precision."
    elif score >= 85:
        grade, assessment = "A",  "Excellent circuit design — correct topology and accurate component values."
    elif score >= 75:
        grade, assessment = "B",  "Good circuit design — mostly correct with minor value deviations."
    elif score >= 60:
        grade, assessment = "C",  "Satisfactory — circuit topology present but values need adjustment."
    elif score >= 40:
        grade, assessment = "D",  "Partial credit — fundamental structure present but key issues remain."
    else:
        grade, assessment = "F",  "Circuit has critical design errors preventing proper operation."

    # Style assessment
    style_info = DESIGN_STYLE.get(question_type, {})
    n_comp = feat["n_components"]
    if style_info:
        if n_comp < style_info["min_components"]:
            style = "under-engineered (missing essential components)"
        elif n_comp > style_info["max_components"] + 2:
            style = "over-engineered (unnecessary components added)"
        else:
            style = "appropriately designed for the task"
    else:
        style = "design complexity within expected range"

    return grade, assessment, style


# ── Improvement Suggestions ────────────────────────────────────────────────────

def _generate_improvement_suggestions(feat, issues, question_type, score, expected, measured):
    """Generate 3 specific, actionable improvement suggestions."""
    suggestions = []

    issue_types = [i["type"] for i in issues]

    if "missing_ground" in issue_types:
        suggestions.append(
            "Add a ground (GND) component and connect it to the negative terminal of your voltage source — "
            "every circuit needs a 0V reference node for node voltage analysis."
        )

    if "short_circuit" in issue_types:
        suggestions.append(
            "Remove the direct connection between the voltage source positive terminal and ground. "
            "Insert a resistor or other impedance element in the current path to limit current flow."
        )

    if "topology" in issue_types and question_type == "gain_check":
        suggestions.append(
            "Connect a feedback resistor (Rf) from the op-amp output pin back to the inverting input (V−). "
            "Without this, the op-amp operates open-loop and will saturate to rail voltage."
        )

    if "floating_pin" in issue_types:
        n_float = int(feat["n_floating_comps"])
        suggestions.append(
            f"{n_float} component(s) are not connected. Ensure all component pins are wired: "
            "every resistor needs 2 connections, every op-amp needs V+, V−, output, and power pins connected."
        )

    if "polarity_error" in issue_types:
        suggestions.append(
            "Check diode orientation — the anode (+) should connect toward the positive voltage source "
            "and cathode (−) toward the load/ground for forward biasing."
        )

    if "wrong_component_type" in issue_types:
        suggestions.append(
            f"Review component selection for a {question_type.replace('_', ' ')} circuit. "
            "Make sure you are using the correct passive element (resistor vs capacitor vs inductor) "
            "for the intended frequency response behavior."
        )

    if "component_value" in issue_types and measured is not None and expected:
        exp_val = expected.get("value", 0)
        tol     = expected.get("tolerance", 0.05)
        val_err = abs((measured - exp_val) / (abs(exp_val) + 1e-9))

        if question_type == "gain_check":
            suggestions.append(
                f"Adjust your resistor ratio. Target gain = {exp_val}, achieved ≈ {measured:.3f} "
                f"(error {val_err*100:.1f}%). Use gain = −Rf/Rin. "
                f"Example: for gain −{abs(exp_val):.0f}, use Rin=1kΩ and Rf={abs(exp_val):.0f}kΩ."
            )
        elif question_type == "voltage_divider":
            suggestions.append(
                f"Adjust resistor ratio. Target Vout = {exp_val}V, achieved ≈ {measured:.3f}V. "
                f"Use Vout = Vin × R2/(R1+R2). Example: Vin=5V, target={exp_val}V → "
                f"R2/(R1+R2) = {exp_val/5:.2f}, try R1=1kΩ, R2={round(exp_val/(5-exp_val)*1000):.0f}Ω."
            )
        elif question_type == "rlc_analysis":
            suggestions.append(
                f"Adjust L or C values. Target f₀ = {exp_val:.0f}Hz, achieved ≈ {measured:.1f}Hz. "
                f"Formula: f₀ = 1/(2π√LC). "
                f"Example: L=10mH → C = 1/(4π²×{exp_val:.0f}²×0.01) = {1/(4*math.pi**2*exp_val**2*0.01)*1e6:.2f}µF."
            )

    if score >= 85 and not suggestions:
        suggestions = [
            "Your circuit is well-designed! Consider adding a voltmeter across the output node for measurement verification.",
            "For production-quality design, add decoupling capacitors (100nF) near power supply pins to reduce noise.",
            "Label all component values clearly on your schematic — professional schematics include component reference designators and values.",
        ]
    elif len(suggestions) < 3:
        generic = [
            "Double-check all component connections — each pin should have a specific electrical function.",
            "Verify all component values against the design specification before submitting.",
            "Add a voltmeter to measure the output node — this helps verify your circuit meets the target specification.",
        ]
        for g in generic:
            if len(suggestions) >= 3:
                break
            if g not in suggestions:
                suggestions.append(g)

    return suggestions[:3]


# ── Local Template NLG Knowledge Base ─────────────────────────────────────────

FEEDBACK_TEMPLATES = {
    ("missing_ground", "gain_check"): [
        "Your inverting amplifier has no 0V reference. Connect a ground symbol to the non-inverting input (V+) of OA1 AND to the return path of your voltage source.",
        "No GND component found. Every op-amp circuit needs a defined 0V reference. Connect V+ of the op-amp to ground.",
    ],
    ("missing_ground", "voltage_divider"): [
        "The bottom terminal of your divider resistor network has no ground connection. Without GND, no closed current loop exists and Vout is undefined.",
        "Ground reference is missing. Connect GND to the lower terminal of R2 to complete the divider return path.",
    ],
    ("missing_ground", "*"): [
        "Your circuit is missing a ground reference node (0V). Place a ground component connected to the negative terminal of the power supply.",
    ],
    ("topology", "gain_check"): [
        "Missing feedback resistor (Rf). An inverting amplifier requires Rf connecting the op-amp output pin back to the inverting input pin (V−). Gain = −Rf/Rin.",
        "Your op-amp is operating in open-loop mode (no Rf from output to V−). This causes saturation. Connect a feedback resistor from output to inverting input.",
    ],
    ("short_circuit", "*"): [
        "A direct short circuit was detected from V+ to GND. Never connect supply directly across ground without series resistance.",
    ],
    ("floating_pin", "*"): [
        "{n_float} component(s) have unconnected pins. Floating pins result in undefined node voltages. Ensure every resistor has 2 connections and active devices have all terminals wired.",
    ],
    ("polarity_error", "led_circuit"): [
        "Diode D1 is reverse-biased (cathode connected towards the positive supply). Reverse the diode so anode connects to positive supply.",
    ],
    ("polarity_error", "*"): [
        "Polarity error detected: diode or polarized element is reversed. Orient anode towards higher potential.",
    ],
    ("component_value", "gain_check"): [
        "Measured gain is {measured:.2f} (target: {expected}). Formula: Gain = −Rf/Rin. Current resistor ratio Rf/Rin is {r_ratio:.2f}. Adjust resistor values to meet target.",
    ],
    ("component_value", "voltage_divider"): [
        "Output voltage is {measured:.3f}V (target: {expected}V). Formula: Vout = Vin × R2/(R1+R2). Adjust R2 to achieve target division ratio.",
    ],
    ("component_value", "rlc_analysis"): [
        "Resonant frequency is {measured:.1f} Hz (target: {expected} Hz). Formula: f₀ = 1/(2π√LC). Adjust inductor or capacitor values.",
    ],
    ("component_value", "led_circuit"): [
        "LED current is {measured_ma:.1f} mA (target: {expected_ma:.1f} mA). Formula: I = (Vs − Vf) / R. Recalculate current limiting resistor R.",
    ],
}

def _pick_template(issue_type, question_type, fill_values=None):
    fill_values = fill_values or {}
    key = (issue_type, question_type)
    templates = FEEDBACK_TEMPLATES.get(key) or FEEDBACK_TEMPLATES.get((issue_type, "*"), [])
    if not templates:
        return f"Issue detected: {issue_type.replace('_', ' ')}."
    t = templates[0]
    try:
        return t.format(**fill_values)
    except Exception:
        return t


# ── Main Feedback Generator ────────────────────────────────────────────────────

def generate_feedback(score, verdict_idx, feat, question_type, expected, measured):
    """Physics-based feedback generation from real feature values."""
    issues   = []
    concepts = set()

    tol     = expected.get("tolerance", 0.05)
    exp_val = expected.get("value", 0)

    # Structural issues
    if feat["has_ground"] == 0:
        issues.append({
            "type": "missing_ground",
            "component_involved": None,
            "explanation": _pick_template("missing_ground", question_type)
        })
        concepts.update(CONCEPTS_MAP["missing_ground"])

    if feat["has_short_circuit"] == 1:
        issues.append({
            "type": "short_circuit",
            "component_involved": None,
            "explanation": _pick_template("short_circuit", question_type)
        })
        concepts.update(CONCEPTS_MAP["short_circuit"])

    if feat["n_floating_comps"] > 0:
        issues.append({
            "type": "floating_pin",
            "component_involved": None,
            "explanation": _pick_template("floating_pin", question_type, {"n_float": int(feat["n_floating_comps"])})
        })
        concepts.update(CONCEPTS_MAP["floating_comp"])

    if feat["polarity_error_detected"] == 1:
        issues.append({
            "type": "polarity_error",
            "component_involved": None,
            "explanation": _pick_template("polarity_error", question_type)
        })
        concepts.update(CONCEPTS_MAP["polarity_error"])

    if feat["component_type_mismatch"] == 1:
        issues.append({
            "type": "component_type_mismatch",
            "component_involved": None,
            "explanation": (
                f"A component type mismatch was detected for a {question_type.replace('_', ' ')} circuit. "
                "Verify you have used the correct component types (e.g. capacitor instead of inductor for RC filter)."
            )
        })
        concepts.update(CONCEPTS_MAP["wrong_component_type"])

    if question_type == "gain_check" and feat["has_op_amp"] and feat["op_feedback_wired"] == 0:
        issues.append({
            "type": "topology",
            "component_involved": "OA1",
            "explanation": _pick_template("topology", question_type)
        })
        concepts.update(CONCEPTS_MAP["wrong_topology"])

    # Value error
    if measured is not None and exp_val != 0:
        val_err = abs((measured - exp_val) / (abs(exp_val) + 1e-9))
        if val_err > tol and not issues:
            if question_type == "gain_check":
                issues.append({
                    "type": "component_value",
                    "component_involved": None,
                    "explanation": _pick_template("component_value", "gain_check", {
                        "measured": measured, "expected": exp_val, "r_ratio": feat.get("r_ratio", 1.0)
                    })
                })
            elif question_type == "voltage_divider":
                issues.append({
                    "type": "component_value",
                    "component_involved": None,
                    "explanation": _pick_template("component_value", "voltage_divider", {
                        "measured": measured, "expected": exp_val
                    })
                })
            elif question_type == "rlc_analysis":
                issues.append({
                    "type": "component_value",
                    "component_involved": None,
                    "explanation": _pick_template("component_value", "rlc_analysis", {
                        "measured": measured, "expected": exp_val
                    })
                })
            elif question_type == "led_circuit":
                issues.append({
                    "type": "component_value",
                    "component_involved": None,
                    "explanation": _pick_template("component_value", "led_circuit", {
                        "measured_ma": measured * 1000, "expected_ma": exp_val * 1000
                    })
                })
            else:
                issues.append({
                    "type": "component_value",
                    "component_involved": None,
                    "explanation": (
                        f"Measured value {measured:.4f} differs from target {exp_val} "
                        f"by {val_err*100:.1f}% (tolerance ±{tol*100:.0f}%). "
                        "Review your component values against the design formula."
                    )
                })
            concepts.update(CONCEPTS_MAP["wrong_value"])

    # Feedback narrative
    if verdict_idx == 2 and not issues:
        feedback = (
            "Excellent! Your circuit is correctly designed — the topology, component selection, "
            "and values all meet the specification requirements."
        )
    elif "missing_ground" in [i["type"] for i in issues]:
        feedback = _pick_template("missing_ground", question_type)
    elif "short_circuit" in [i["type"] for i in issues]:
        feedback = _pick_template("short_circuit", question_type)
    elif "topology" in [i["type"] for i in issues]:
        feedback = _pick_template("topology", question_type)
    elif "floating_pin" in [i["type"] for i in issues]:
        feedback = (
            f"{int(feat['n_floating_comps'])} component(s) are not connected to the circuit. "
            "Every component must have all its pins wired. Floating pins cause undefined node voltages."
        )
    elif "polarity_error" in [i["type"] for i in issues]:
        feedback = _pick_template("polarity_error", question_type)
    elif "component_type_mismatch" in [i["type"] for i in issues]:
        feedback = (
            "Wrong component type used. Make sure you have selected the correct component "
            "(resistor, capacitor, inductor) for the intended circuit behavior."
        )
    elif "component_value" in [i["type"] for i in issues]:
        feedback = issues[-1]["explanation"] + " Review the formula and recalculate component values."
    else:
        feedback = (
            "Review the circuit connections carefully. Ensure all components are properly wired, "
            "no pins are floating, and component values match the target specification."
        )

    # Summary sentence
    if verdict_idx == 2 and not issues:
        summary = f"Circuit correctly designed and meets all requirements. Score: {score}/100."
    elif issues:
        primary = issues[0]["type"].replace("_", " ")
        summary = f"Circuit has a {primary} issue — see detailed feedback below."
    else:
        summary = f"Circuit needs adjustments to meet the specification. Score: {score}/100."

    return issues, sorted(concepts), feedback, summary


# ── Viva Question Generator (Local, Rule-Based) ───────────────────────────────

def generate_local_viva_questions(components, connections, question_type, measured=None, expected=None):
    """
    Generate 2 circuit-specific viva questions using actual component values.
    Pure local logic, zero external API calls.
    """
    questions = []
    expected = expected or {}

    resistors  = [c for c in components if c.get("type") == "resistor"]
    capacitors = [c for c in components if c.get("type") == "capacitor"]
    inductors  = [c for c in components if c.get("type") == "inductor"]
    op_amps    = [c for c in components if c.get("type") == "op_amp"]
    bjts       = [c for c in components if c.get("type") == "bjt_npn"]
    vsrc       = next((c for c in components if c.get("type") == "voltage_source"), None)

    if question_type == "gain_check" and len(resistors) >= 2 and op_amps:
        r_vals = sorted([float(r.get("properties", {}).get("resistance_ohm", 1000)) for r in resistors])
        rin, rf = r_vals[0], r_vals[-1]
        questions.append({
            "questionText": (
                f"In your inverting amplifier design, you selected Rin = {rin:.0f} Ohm and Rf = {rf:.0f} Ohm. "
                f"What is the theoretical closed-loop gain? If Rf is doubled to {rf*2:.0f} Ohm, what happens to the output amplitude and bandwidth?"
            ),
            "contextCodeSnippet": f"Rin = {rin:.0f} Ohm, Rf = {rf:.0f} Ohm"
        })
        questions.append({
            "questionText": (
                "Explain the concept of 'virtual ground' at the inverting terminal of an op-amp. "
                "Why is the inverting terminal at 0V even though it is not directly wired to ground?"
            ),
            "contextCodeSnippet": "Op-Amp V- terminal (Virtual Ground)"
        })
    elif question_type == "voltage_divider" and len(resistors) >= 2 and vsrc:
        r_vals = [float(r.get("properties", {}).get("resistance_ohm", 1000)) for r in resistors]
        vin = float(vsrc.get("properties", {}).get("voltage", 5.0))
        r1, r2 = r_vals[0], r_vals[1]
        questions.append({
            "questionText": (
                f"With Vin = {vin}V, R1 = {r1:.0f} Ohm, and R2 = {r2:.0f} Ohm, calculate the unloaded output voltage. "
                f"If a finite load resistance RL = {r2:.0f} Ohm is placed across R2, how does the loaded output voltage change?"
            ),
            "contextCodeSnippet": f"Vin={vin}V, R1={r1:.0f} Ohm, R2={r2:.0f} Ohm"
        })
        questions.append({
            "questionText": (
                "What trade-off exists when choosing very small resistor values (e.g., 10 Ohm) versus very large values (e.g., 1M Ohm) for a voltage divider?"
            ),
            "contextCodeSnippet": "Divider power dissipation vs loading effect"
        })
    elif question_type == "rlc_analysis" and inductors and capacitors:
        L = float(inductors[0].get("properties", {}).get("inductance_henry", 0.01))
        C = float(capacitors[0].get("properties", {}).get("capacitance_farad", 1e-6))
        f0 = 1.0 / (2 * math.pi * math.sqrt(L * C)) if (L * C) > 0 else 0
        questions.append({
            "questionText": (
                f"Your circuit uses L = {L*1000:.2f}mH and C = {C*1e6:.2f}uF. "
                f"Calculate the theoretical resonance frequency f0 (approx {f0:.1f} Hz). What is the total circuit reactance at this frequency?"
            ),
            "contextCodeSnippet": f"L = {L*1000:.2f}mH, C = {C*1e6:.2f}uF"
        })
        questions.append({
            "questionText": (
                "In a series RLC circuit, how does increasing the resistance R affect the Quality Factor (Q) and the resonance bandwidth?"
            ),
            "contextCodeSnippet": "Q = (1/R)*sqrt(L/C)"
        })
    elif question_type == "led_circuit" and resistors:
        r_val = float(resistors[0].get("properties", {}).get("resistance_ohm", 220))
        vin = float(vsrc.get("properties", {}).get("voltage", 5.0)) if vsrc else 5.0
        questions.append({
            "questionText": (
                f"Assuming a forward voltage Vf = 2.0V for the diode and Vin = {vin}V with R = {r_val:.0f} Ohm, "
                f"what is the forward current I_LED? What happens if R is removed completely?"
            ),
            "contextCodeSnippet": f"Vin={vin}V, R={r_val:.0f} Ohm, Vf=2.0V"
        })

        questions.append({
            "questionText": (
                "Why must an LED always have a current-limiting resistor when powered from an ideal voltage source?"
            ),
            "contextCodeSnippet": "Diode exponential I-V characteristic"
        })
    else:
        questions.append({
            "questionText": (
                f"For this {question_type.replace('_', ' ')} circuit with {len(components)} components, "
                "trace the DC current return path starting from the voltage source positive terminal back to ground."
            ),
            "contextCodeSnippet": f"{len(components)} components placed"
        })
        questions.append({
            "questionText": (
                "How would you verify the operation of this circuit experimentally using an oscilloscope and a multimeter?"
            ),
            "contextCodeSnippet": "Lab measurement procedure"
        })

    return questions[:2]


# ── SHAP Feature Importance (Local, No External API) ──────────────────────────

def compute_shap_explanation(X_scaled, gbr_model, feature_cols):
    """
    SHAP TreeExplainer on HistGradientBoostingRegressor or graceful fallback.
    Fast, local, 0 external API calls.
    """
    FEATURE_LABELS = {
        "has_ground":              "Ground reference present",
        "op_feedback_wired":       "Feedback resistor connected",
        "n_floating_comps":        "Floating components",
        "has_short_circuit":       "Short circuit detected",
        "val_error_frac":          "Component value error",
        "topology_score_rule":     "Topology correctness",
        "has_measurement_device":  "Measurement device present",
        "circuit_completeness":    "Circuit completeness",
        "polarity_error_detected": "Polarity error",
        "component_type_mismatch": "Wrong component type",
        "dc_path_complete":        "DC current path",
        "n_true_nets":             "Electrical net count",
        "max_net_size":            "Largest net size",
        "bjt_all_pins_wired":      "BJT all pins connected",
        "op_vcc_vee_wired":        "Op-amp supply rails wired",
        "lc_product":              "LC resonant product",
        "rc_time_constant":        "RC time constant",
        "r_ratio":                 "Resistor ratio",
        "r_max":                   "Max resistance",
        "v_in":                    "Input voltage",
    }
    try:
        import shap
        explainer = shap.TreeExplainer(gbr_model)
        shap_values = explainer.shap_values(X_scaled)
        base_score = float(explainer.expected_value) if hasattr(explainer, "expected_value") else 50.0

        vals = shap_values[0] if len(getattr(shap_values, "shape", [])) > 1 else shap_values
        contributions = []
        for i, fc in enumerate(feature_cols):
            sv = float(vals[i])
            contributions.append({
                "feature":    fc,
                "label":      FEATURE_LABELS.get(fc, fc.replace("_", " ").title()),
                "shap_value": round(sv, 4),
                "raw_value":  round(float(X_scaled[0][i]), 4)
            })
        contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        return {
            "top_positive": [c for c in contributions if c["shap_value"] > 0][:4],
            "top_negative": [c for c in contributions if c["shap_value"] < 0][:4],
            "base_score":   round(base_score, 2),
            "engine":       "shap_tree_explainer"
        }
    except Exception as e:
        # Graceful local fallback
        return {
            "top_positive": [
                {"feature": "topology_score_rule", "label": "Topology correctness", "shap_value": 14.8, "raw_value": 1.0},
                {"feature": "circuit_completeness", "label": "Circuit completeness", "shap_value": 8.4, "raw_value": 1.0}
            ],
            "top_negative": [],
            "base_score": 50.0,
            "engine": "local_heuristic_fallback"
        }


# ── GNN Model Lazy Loader ─────────────────────────────────────────────────────

_gnn_model = None

def _load_gnn_model():
    global _gnn_model
    if _gnn_model is not None:
        return _gnn_model
    gnn_weights = MODEL_DIR / "circuit_gnn_model.pt"
    if gnn_weights.exists():
        try:
            import importlib
            torch = importlib.import_module("torch")
            circuit_gnn = importlib.import_module("circuit_gnn_model")
            CircuitGCN = getattr(circuit_gnn, "CircuitGCN")
            model = CircuitGCN(in_feats=15)
            model.load_state_dict(torch.load(gnn_weights, map_location="cpu"))
            model.eval()
            _gnn_model = model
            print("[GNN] Loaded circuit_gnn_model.pt successfully")
        except Exception as e:
            print(f"[GNN] Could not load model: {e}")
            _gnn_model = None
    return _gnn_model


# ── Design Analysis Generator ─────────────────────────────────────────────────

def generate_design_analysis(score, verdict_idx, feat, question_type, components, connections, issues, expected, measured):
    """Generate rich design analysis for admin evaluation panel."""
    grade, assessment, style = _compute_design_grade(score, feat, question_type)
    signal_path = _build_signal_path(components, connections, question_type, feat)
    comp_analysis = _analyze_components(components, connections, feat, question_type, expected, measured)
    suggestions = _generate_improvement_suggestions(feat, issues, question_type, score, expected, measured)
    apps = REAL_WORLD_APPLICATIONS.get(question_type, [])

    topo_pct  = round(feat["topology_score_rule"] / 70 * 100, 1)
    val_err   = feat["val_error_frac"]
    value_pct = round(max(0, (1 - val_err) * 100), 1) if val_err < 1 else 0.0

    return {
        "design_grade":              grade,
        "grade_assessment":          assessment,
        "design_style":              style,
        "signal_path_description":   signal_path,
        "topology_quality_pct":      topo_pct,
        "value_accuracy_pct":        value_pct,
        "component_analysis":        comp_analysis,
        "improvement_suggestions":   suggestions,
        "real_world_applications":   apps[:4],
        "total_components_placed":   feat["n_components"],
        "total_connections_made":    feat["n_connections"],
        "circuit_completeness_pct":  round(feat["circuit_completeness"] * 100, 1),
        "has_measurement_device":    bool(feat["has_measurement_device"]),
    }


# ── Main 3-Model Ensemble Inference ───────────────────────────────────────────

def evaluate_circuit(components, connections, question_type, expected, measured=None, behavior=None):
    """
    Run 3-Model Ensemble evaluation:
      Model 1: Flat Ensemble (MLP 256->128->64 + HistGBR)
      Model 2: Graph Neural Network (CircuitGCN on PyTorch) if available
      Model 3: Rule Engine (deterministic physical laws)

    Returns full evaluation dict with SHAP explainability, Viva questions, and Model voting.
    """
    _load_models()
    components, connections = _normalize_circuit_data(components, connections)

    feat  = extract_features(components, connections, question_type, expected or {}, measured, behavior)
    X     = np.array([[feat[col] for col in FEATURE_COLS]], dtype=np.float32)
    X_s   = _scaler.transform(X)

    # ── Model 1: Flat Ensemble Score & Verdict ──────────────────────────────────
    is_ensemble_score = isinstance(_score_m, (list, tuple)) and len(_score_m) == 2
    if is_ensemble_score:
        mlp_sc, gbr_sc = _score_m
        raw_mlp = float(mlp_sc.predict(X_s)[0])
        raw_gbr = float(gbr_sc.predict(X_s)[0])
        score_flat = 0.4 * raw_mlp + 0.6 * raw_gbr
    else:
        gbr_sc = _score_m
        score_flat = float(_score_m.predict(X_s)[0])

    is_ensemble_verdict = isinstance(_verd_m, (list, tuple)) and len(_verd_m) == 2
    if is_ensemble_verdict:
        mlp_vd, rf_vd = _verd_m
        mlp_pred   = int(mlp_vd.predict(X_s)[0])
        rf_pred    = int(rf_vd.predict(X_s)[0])
        verdict_flat = mlp_pred if mlp_pred == rf_pred else rf_pred

        mlp_proba  = mlp_vd.predict_proba(X_s)[0]
        rf_proba   = rf_vd.predict_proba(X_s)[0]
        avg_proba  = (mlp_proba + rf_proba) / 2.0
        conf_flat  = float(max(avg_proba))
        class_probs = {
            "incorrect":         round(float(avg_proba[0]), 4),
            "partially_correct": round(float(avg_proba[1]), 4),
            "correct":           round(float(avg_proba[2]), 4),
        }
    else:
        verdict_flat = int(_verd_m.predict(X_s)[0])
        proba = _verd_m.predict_proba(X_s)[0]
        conf_flat   = float(max(proba))
        class_probs = {
            "incorrect":         round(float(proba[0]), 4),
            "partially_correct": round(float(proba[1]), 4),
            "correct":           round(float(proba[2]), 4),
        }

    # ── Model 2: Graph Neural Network (Local GCN) ──────────────────────────────
    gnn_m = _load_gnn_model()
    has_gnn = False
    score_gnn, verdict_gnn, conf_gnn = score_flat, verdict_flat, conf_flat
    if gnn_m is not None:
        try:
            from circuit_graph_builder import build_graph
            graph_data = build_graph(components, connections)
            score_gnn, verdict_gnn, conf_gnn = gnn_m.predict_single(graph_data)
            has_gnn = True
        except Exception as e:
            print(f"[GNN] Inference error: {e}")

    # ── Model 3: Rule Engine (Deterministic) ───────────────────────────────────
    score_rule = float(feat["topology_score_rule"] + (30.0 if abs(feat["val_error_frac"]) < 0.05 else 0.0))
    verdict_rule = 2 if score_rule >= 85 else (1 if score_rule >= 40 else 0)

    # ── Weighted 3-Way Ensemble ────────────────────────────────────────────────
    if has_gnn:
        W_FLAT, W_GNN, W_RULE = 0.35, 0.45, 0.20
        raw_final = W_FLAT * score_flat + W_GNN * score_gnn + W_RULE * score_rule
        confidence = (conf_flat + conf_gnn) / 2.0
        votes = [verdict_flat, verdict_gnn, verdict_rule]
    else:
        W_FLAT, W_RULE = 0.60, 0.40
        raw_final = W_FLAT * score_flat + W_RULE * score_rule
        confidence = conf_flat
        votes = [verdict_flat, verdict_flat, verdict_rule]

    score = int(round(max(0.0, min(100.0, raw_final))))
    verdict_idx = max(set(votes), key=votes.count)
    disagreement = len(set(votes)) == 3

    # Score breakdown
    topo_score  = round(feat["topology_score_rule"], 1)
    value_score = round(max(0.0, score - topo_score), 1)

    # SHAP Explainability
    shap_exp = compute_shap_explanation(X_s, gbr_sc, FEATURE_COLS)

    # Viva Questions
    viva_qs = generate_local_viva_questions(components, connections, question_type, measured, expected)

    # Feedback
    issues, concepts, feedback, summary = generate_feedback(
        score, verdict_idx, feat, question_type, expected or {}, measured
    )

    # Rich design analysis (admin-only)
    design_analysis = generate_design_analysis(
        score, verdict_idx, feat, question_type,
        components, connections, issues, expected or {}, measured
    )

    return {
        "score":                 score,
        "verdict":               VERDICT_LABELS.get(verdict_idx, "incorrect"),
        "summary":               summary,
        "issues_found":          issues,
        "feedback_for_student":  feedback,
        "concepts_to_review":    concepts,
        "ml_confidence":         round(confidence, 4),
        "design_analysis":       design_analysis,
        "shap_explanation":      shap_exp,
        "viva_questions":        viva_qs,
        "model_votes": {
            "flat_ensemble": VERDICT_LABELS.get(verdict_flat, "incorrect"),
            "gnn":           VERDICT_LABELS.get(verdict_gnn, "incorrect") if has_gnn else "not_loaded",
            "rule_engine":   VERDICT_LABELS.get(verdict_rule, "incorrect"),
        },
        "disagreement_flag":          disagreement,
        "instructor_review_required": disagreement or confidence < 0.60,
        "model_info": {
            "engine":              "3-Model Ensemble (Flat MLP+HistGBR, GCN, Physics Rules)",
            "architecture":        "60-feat Flat + 3-layer GCN",
            "n_features":          len(FEATURE_COLS),
            "labelling_method":    "physics_based_deterministic",
            "class_probabilities": class_probs,
            "topology_score":      topo_score,
            "value_score":         value_score,
            "feature_vector":      {k: round(v, 4) if isinstance(v, float) else v
                                    for k, v in feat.items()},
        }
    }


def get_model_stats():
    """Return model metadata for the /circuit-model-stats endpoint."""
    try:
        _load_models()
        return {
            "loaded":            True,
            "mae":               _meta.get("mae"),
            "rmse":              _meta.get("rmse"),
            "r2":                _meta.get("r2"),
            "verdict_accuracy":  _meta.get("verdict_accuracy"),
            "n_train":           _meta.get("n_train"),
            "n_test":            _meta.get("n_test"),
            "n_features":        _meta.get("n_features", 60),
            "dataset_size":      _meta.get("dataset_size"),
            "labelling_method":  _meta.get("labelling_method", "physics_based_deterministic"),
            "architecture":      _meta.get("hidden_layers"),
            "feature_cols":      FEATURE_COLS,
            "score_model":       _meta.get("score_regressor"),
            "verdict_model":     _meta.get("verdict_classifier"),
            "gnn_loaded":        _gnn_model is not None,
        }
    except FileNotFoundError as e:
        return {"loaded": False, "error": str(e)}

