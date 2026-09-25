"""
circuit_graph_builder.py
Converts circuit JSON (components + connections) to a
torch_geometric.data.Data object for GCN training / inference.

Node features per component (15 values):
  [11 type one-hot | R_norm | C_norm | L_norm | V_norm]

Edges: bidirectional (undirected graph).

Install once (CPU-only):
  pip install torch==2.1.0 --index-url https://download.pytorch.org/whl/cpu
  pip install torch_geometric
"""

try:
    import torch
    from torch_geometric.data import Data
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False

COMP_TYPE_IDX = {
    "resistor": 0, "capacitor": 1, "inductor": 2, "op_amp": 3,
    "voltage_source": 4, "ground": 5, "diode": 6, "voltmeter": 7,
    "ammeter": 8, "bjt_npn": 9, "logic_gate_and": 10,
}
N_NODE_FEAT = 15


def build_graph(components, connections):
    """
    Returns torch_geometric.data.Data with:
      x           : FloatTensor [n_components, 15]
      edge_index  : LongTensor  [2, 2*n_connections]  (bidirectional)
    Raises RuntimeError if torch / torch_geometric not installed.
    """
    if not _TORCH_AVAILABLE:
        raise RuntimeError(
            "PyTorch and torch_geometric are required for GNN inference.\n"
            "pip install torch==2.1.0 --index-url https://download.pytorch.org/whl/cpu\n"
            "pip install torch_geometric"
        )

    id_to_idx = {c["comp_id"]: i for i, c in enumerate(components)}

    x_rows = []
    for comp in components:
        onehot = [0.0] * 11
        t = comp.get("type", "")
        if t in COMP_TYPE_IDX:
            onehot[COMP_TYPE_IDX[t]] = 1.0

        props = comp.get("properties") or {}
        r = min(float(props.get("resistance_ohm",    0)) / 1_000_000, 1.0)
        c = min(float(props.get("capacitance_farad", 0)) * 1_000_000, 1.0)
        l = min(float(props.get("inductance_henry",  0)) * 1_000,     1.0)
        v = min(float(props.get("voltage",           0)) / 100.0,     1.0)
        x_rows.append(onehot + [r, c, l, v])

    src, dst = [], []
    for conn in connections:
        fi = id_to_idx.get(conn["from"]["comp_id"], -1)
        ti = id_to_idx.get(conn["to"]["comp_id"],   -1)
        if fi >= 0 and ti >= 0:
            src += [fi, ti]
            dst += [ti, fi]

    x          = torch.tensor(x_rows, dtype=torch.float)
    edge_index = (torch.tensor([src, dst], dtype=torch.long)
                  if src else torch.zeros((2, 0), dtype=torch.long))
    return Data(x=x, edge_index=edge_index)
