"""
circuit_ml_model.py
─────────────────────────────────────────────────────────────────────────────
Trains an ensemble circuit evaluation model:

  Score Regressor:
    - MLP (512→256→128→64→32, ReLU, Adam)
    - GradientBoostingRegressor (ensemble member)
    → Final score = weighted average of both

  Verdict Classifier:
    - MLP (512→256→128→64→32, ReLU, Adam)
    - RandomForestClassifier (ensemble member)
    → Final verdict = majority vote

Features: 35 (expanded from 25)
Training data: ~50,000 samples (14 circuit configs)

Run:  python circuit_ml_model.py
Saves: circuit_score_model.pkl
       circuit_verdict_model.pkl
       circuit_feature_scaler.pkl
       circuit_model_metadata.json
"""

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.neural_network import MLPRegressor, MLPClassifier
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestClassifier
from sklearn.preprocessing  import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error, r2_score, mean_squared_error,
    accuracy_score, classification_report
)

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
    # Extended features
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

DATA_PATH = Path(__file__).parent / "circuit_training_data.csv"
MODEL_DIR = Path(__file__).parent


def load_data():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Training data not found at {DATA_PATH}. "
            "Run circuit_dataset_generator.py first."
        )
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df):,} samples with {len(df.columns)} columns.")

    missing = [col for col in FEATURE_COLS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns in CSV: {missing}")

    return df


def train(df):
    X = df[FEATURE_COLS].values.astype(np.float32)
    y_score   = df["score"].values.astype(np.float32)
    y_verdict = df["verdict"].values.astype(int)

    print(f"\nDataset statistics:")
    print(f"  Samples:   {len(X):,}")
    print(f"  Features:  {X.shape[1]}")
    print(f"  Score range: {y_score.min():.1f} – {y_score.max():.1f} | Mean: {y_score.mean():.1f}")
    print(f"  Verdict: Incorrect={sum(y_verdict==0):,} | Partial={sum(y_verdict==1):,} | Correct={sum(y_verdict==2):,}")

    # Train/test split (80/20 stratified)
    X_tr, X_te, ys_tr, ys_te, yv_tr, yv_te = train_test_split(
        X, y_score, y_verdict,
        test_size=0.20, random_state=42,
        stratify=y_verdict
    )

    # Feature scaling
    scaler   = StandardScaler()
    X_tr_s   = scaler.fit_transform(X_tr)
    X_te_s   = scaler.transform(X_te)

    # ── Score Regressor: MLP ────────────────────────────────────────────────────
    print("\n-- Training Score Regressor: MLP (256->128->64) --")
    mlp_score = MLPRegressor(
        hidden_layer_sizes=(256, 128, 64),
        activation="relu",
        solver="adam",
        learning_rate="adaptive",
        learning_rate_init=0.001,
        max_iter=500,
        batch_size=256,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=25,
        random_state=42,
        verbose=False,
    )
    mlp_score.fit(X_tr_s, ys_tr)

    mlp_pred = np.clip(mlp_score.predict(X_te_s), 0, 100)
    mlp_mae  = mean_absolute_error(ys_te, mlp_pred)
    mlp_r2   = r2_score(ys_te, mlp_pred)
    print(f"   MLP  — MAE: {mlp_mae:.3f} | R²: {mlp_r2:.4f}")

    # ── Score Regressor: HistGradientBoosting (fast GPU-like boosting) ──────────
    print("-- Training Score Regressor: HistGradientBoostingRegressor --")
    gbr_score = HistGradientBoostingRegressor(
        max_iter=150,
        learning_rate=0.08,
        max_depth=6,
        min_samples_leaf=30,
        random_state=42,
    )
    gbr_score.fit(X_tr_s, ys_tr)

    gbr_pred = np.clip(gbr_score.predict(X_te_s), 0, 100)
    gbr_mae  = mean_absolute_error(ys_te, gbr_pred)
    gbr_r2   = r2_score(ys_te, gbr_pred)
    print(f"   GBR  — MAE: {gbr_mae:.3f} | R²: {gbr_r2:.4f}")

    # Ensemble: weighted average (GBR usually more accurate for tabular data)
    ensemble_pred = 0.4 * mlp_pred + 0.6 * gbr_pred
    mae  = float(mean_absolute_error(ys_te, ensemble_pred))
    rmse = float(np.sqrt(mean_squared_error(ys_te, ensemble_pred)))
    r2   = float(r2_score(ys_te, ensemble_pred))
    print(f"\n   Ensemble Score — MAE: {mae:.3f} | RMSE: {rmse:.3f} | R²: {r2:.4f}")

    # Save both score models as a tuple (MLP, GBR)
    score_model = (mlp_score, gbr_score)

    # ── Verdict Classifier: MLP ─────────────────────────────────────────────────
    print("\n-- Training Verdict Classifier: MLP (256->128->64) --")
    mlp_verdict = MLPClassifier(
        hidden_layer_sizes=(256, 128, 64),
        activation="relu",
        solver="adam",
        learning_rate="adaptive",
        learning_rate_init=0.001,
        max_iter=500,
        batch_size=256,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=25,
        random_state=42,
        verbose=False,
    )
    mlp_verdict.fit(X_tr_s, yv_tr)

    # ── Verdict Classifier: RandomForest ───────────────────────────────────────
    print("-- Training Verdict Classifier: RandomForestClassifier (150 trees) --")
    rf_verdict = RandomForestClassifier(
        n_estimators=150,
        max_depth=20,
        min_samples_leaf=3,
        n_jobs=-1,
        random_state=42,
    )
    rf_verdict.fit(X_tr_s, yv_tr)

    # Ensemble verdict: majority vote
    mlp_v_pred = mlp_verdict.predict(X_te_s)
    rf_v_pred  = rf_verdict.predict(X_te_s)

    # Weighted majority vote: GBR-based verdict from RF, MLP weighted
    # Simple: if both agree → that class; if not → take RF (more stable)
    ensemble_v = np.where(mlp_v_pred == rf_v_pred, mlp_v_pred, rf_v_pred)
    acc = float(accuracy_score(yv_te, ensemble_v))
    print(f"\n   Ensemble Verdict Accuracy: {acc*100:.2f}%")
    print(classification_report(
        yv_te, ensemble_v,
        target_names=["incorrect", "partially_correct", "correct"]
    ))

    verdict_model = (mlp_verdict, rf_verdict)

    meta = {
        "mae":              round(mae,  3),
        "rmse":             round(rmse, 3),
        "r2":               round(r2,   4),
        "verdict_accuracy": round(acc,  4),
        "n_train":          len(X_tr),
        "n_test":           len(X_te),
        "n_features":       len(FEATURE_COLS),
        "feature_cols":     FEATURE_COLS,
        "hidden_layers":    [256, 128, 64],
        "activation":       "relu",
        "solver":           "adam",
        "score_regressor":    "Ensemble(MLP_256->128->64 + HistGBR_150iter)",
        "verdict_classifier": "Ensemble(MLP_256->128->64 + RF_150est)",
        "dataset_size":     len(df),
        "labelling_method": "physics_based_deterministic",
    }

    return scaler, score_model, verdict_model, meta


def save(scaler, score_model, verdict_model, meta):
    joblib.dump(scaler,        MODEL_DIR / "circuit_feature_scaler.pkl")
    joblib.dump(score_model,   MODEL_DIR / "circuit_score_model.pkl")
    joblib.dump(verdict_model, MODEL_DIR / "circuit_verdict_model.pkl")
    with open(MODEL_DIR / "circuit_model_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n[OK] Models saved to {MODEL_DIR}")
    print(f"   circuit_score_model.pkl    (Ensemble: MLP + GBR)")
    print(f"   circuit_verdict_model.pkl  (Ensemble: MLP + RF)")
    print(f"   circuit_feature_scaler.pkl (StandardScaler)")
    print(f"   circuit_model_metadata.json")


def main():
    print("=" * 70)
    print("  Circuit Evaluation Ensemble Training (35 features, 50k+ samples)")
    print("=" * 70)

    df = load_data()
    scaler, score_model, verdict_model, meta = train(df)
    save(scaler, score_model, verdict_model, meta)

    print("\nFinal Metadata:")
    import sys
    sys.stdout.reconfigure(errors='replace') if hasattr(sys.stdout, 'reconfigure') else None
    print(json.dumps({k: v for k, v in meta.items() if k != "feature_cols"}, indent=2))


if __name__ == "__main__":
    main()
