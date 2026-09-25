"""
circuit_gnn_model.py
Two-head Graph Convolutional Network for circuit evaluation.

  Head 1: Score regressor  (0-100)
  Head 2: Verdict classifier (0=incorrect, 1=partial, 2=correct)

Architecture:
  GCNConv(15->64) -> BatchNorm -> ReLU -> Dropout
  GCNConv(64->128)-> BatchNorm -> ReLU -> Dropout
  GCNConv(128->64)-> BatchNorm -> ReLU
  GlobalMeanPool -> [64]
  Score:   FC(64->32)->ReLU->FC(32->1)->Sigmoid*100
  Verdict: FC(64->32)->ReLU->FC(32->3)

Train: python train_circuit_gnn.py
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv, global_mean_pool, BatchNorm


class CircuitGCN(nn.Module):
    def __init__(self, in_feats=15):
        super().__init__()
        self.conv1 = GCNConv(in_feats, 64)
        self.bn1   = BatchNorm(64)
        self.conv2 = GCNConv(64, 128)
        self.bn2   = BatchNorm(128)
        self.conv3 = GCNConv(128, 64)
        self.bn3   = BatchNorm(64)
        self.drop  = nn.Dropout(0.3)

        self.score_head = nn.Sequential(
            nn.Linear(64, 32), nn.ReLU(), nn.Dropout(0.2), nn.Linear(32, 1)
        )
        self.verdict_head = nn.Sequential(
            nn.Linear(64, 32), nn.ReLU(), nn.Dropout(0.2), nn.Linear(32, 3)
        )

    def encode(self, x, edge_index, batch):
        x = self.drop(F.relu(self.bn1(self.conv1(x, edge_index))))
        x = self.drop(F.relu(self.bn2(self.conv2(x, edge_index))))
        x = F.relu(self.bn3(self.conv3(x, edge_index)))
        return global_mean_pool(x, batch)          # [B, 64]

    def forward(self, data):
        emb     = self.encode(data.x, data.edge_index, data.batch)
        score   = torch.sigmoid(self.score_head(emb)) * 100   # [B, 1]
        verdict = self.verdict_head(emb)                        # [B, 3] logits
        return score.squeeze(-1), verdict

    @torch.no_grad()
    def predict_single(self, graph_data):
        """Predict on a single Data object (no batch dimension)."""
        self.eval()
        from torch_geometric.data import Batch
        batch        = Batch.from_data_list([graph_data])
        score, v_log = self.forward(batch)
        probs        = F.softmax(v_log, dim=1)[0]
        verdict_cls  = int(probs.argmax())
        confidence   = float(probs.max())
        return float(score[0]), verdict_cls, confidence


def load_gnn_model(path="circuit_gnn_model.pt", in_feats=15):
    """Load a saved GCN checkpoint. Returns None if file not found."""
    import os
    if not os.path.exists(path):
        return None
    model = CircuitGCN(in_feats=in_feats)
    model.load_state_dict(torch.load(path, map_location="cpu"))
    model.eval()
    return model
