import numpy as np  # type: ignore
import pandas as pd  # type: ignore
from sklearn.ensemble import IsolationForest  # type: ignore
from sklearn.preprocessing import MinMaxScaler  # type: ignore
import joblib  # type: ignore
import os

# Feature columns
FEATURES = ['eye_deviation', 'head_movement', 'face_scale', 'mouse_idle_time', 'response_time']

# ── Synthetic training data ─────────────────────────────────────────────────
# Normal ranges are calibrated to real exam-taking behaviour:
#   eye_deviation  : 0–20°  (small natural gaze shifts)
#   head_movement  : 0–15°  (nodding, slight shifts)
#   face_scale     : 0.15–0.25 (calibrated screen distance)
#   mouse_idle_time: 0–90s      (pausing between questions is common)
#   response_time  : 10–180s    (varies by question difficulty)
#
# Anomalous ranges (clear cheating / distraction signals):
#   eye_deviation  : 35–100°    (looking far away from screen)
#   head_movement  : 30–100°    (turning head significantly)
#   face_scale     : 0.00–0.10  (moving far away from cam)
#   mouse_idle_time: 150–600s   (very long idle — away from desk)
#   response_time  : 1–5s   (impossibly fast answers)
def _synthetic_training_data(n=2000):
    """Generate realistic synthetic training data.
    If realistic_behavior_dataset.csv exists, load it directly.
    Otherwise fall back to programmatic generation.
    """
    rng = np.random.default_rng(42)

    # ── Realistic behavioral populations ─────────────────────────────────────
    def clamp(arr, lo, hi):
        return np.clip(arr, lo, hi)

    share = n // 8

    # Focused student: eye 2-25°, head 2-18°
    focused = pd.DataFrame({
        'eye_deviation':   clamp(rng.normal(12, 5, share*3),   2, 25),
        'head_movement':   clamp(rng.normal(9,  4, share*3),   2, 18),
        'face_scale':      clamp(rng.normal(0.25, 0.04, share*3), 0.14, 0.45),
        'mouse_idle_time': clamp(rng.exponential(8, share*3),  0, 40),
        'response_time':   clamp(rng.normal(45, 18, share*3),  8, 150),
    })
    # Reading question: eye 6-30°, head 4-24°
    reading = pd.DataFrame({
        'eye_deviation':   clamp(rng.normal(18, 6, share*2),   6, 30),
        'head_movement':   clamp(rng.normal(12, 5, share*2),   4, 24),
        'face_scale':      clamp(rng.normal(0.23, 0.04, share*2), 0.13, 0.42),
        'mouse_idle_time': clamp(rng.exponential(12, share*2), 0, 60),
        'response_time':   clamp(rng.normal(65, 22, share*2),  15, 200),
    })
    # Thinking: eye 8-34°, head 5-30°
    thinking = pd.DataFrame({
        'eye_deviation':   clamp(rng.normal(22, 7, share),     8, 34),
        'head_movement':   clamp(rng.normal(16, 6, share),     5, 30),
        'face_scale':      clamp(rng.normal(0.22, 0.05, share), 0.12, 0.40),
        'mouse_idle_time': clamp(rng.exponential(20, share),   0, 90),
        'response_time':   clamp(rng.normal(90, 30, share),    20, 250),
    })
    # Suspicious: gaze far away (eye 36-75°)
    suspicious_eye = pd.DataFrame({
        'eye_deviation':   clamp(rng.normal(52, 10, share),    36, 75),
        'head_movement':   clamp(rng.normal(14,  6, share),     4, 28),
        'face_scale':      clamp(rng.normal(0.21, 0.04, share), 0.11, 0.37),
        'mouse_idle_time': clamp(rng.exponential(50, share),   10, 200),
        'response_time':   clamp(rng.normal(18,  8, share),     2, 55),
    })
    # Suspicious: head strongly turned (head 34-68°)
    suspicious_head = pd.DataFrame({
        'eye_deviation':   clamp(rng.normal(14,  5, share),     4, 26),
        'head_movement':   clamp(rng.normal(50, 10, share),    34, 68),
        'face_scale':      clamp(rng.normal(0.19, 0.05, share), 0.09, 0.34),
        'mouse_idle_time': clamp(rng.exponential(40, share),    5, 150),
        'response_time':   clamp(rng.normal(24, 10, share),     3, 65),
    })
    # Ghost — face absent
    ghost = pd.DataFrame({
        'eye_deviation':   clamp(rng.normal(0, 1, share//2),   0, 3),
        'head_movement':   clamp(rng.normal(0, 1, share//2),   0, 3),
        'face_scale':      clamp(rng.normal(0.02, 0.01, share//2), 0.0, 0.06),
        'mouse_idle_time': clamp(rng.exponential(120, share//2), 60, 350),
        'response_time':   clamp(rng.normal(200, 60, share//2), 60, 400),
    })

    return pd.concat([focused, reading, thinking, suspicious_eye, suspicious_head, ghost], ignore_index=True)



def apply_smote_balancing(df: pd.DataFrame, feature_cols: list, label_col: str = 'label'):
    """
    Synthetic Minority Over-sampling Technique (SMOTE) implementation for multi-class balancing.
    Interpolates minority class feature vectors using KNN to achieve 1:1:1 class balance ratio.
    """
    if label_col not in df.columns or df[label_col].isnull().all():
        print("SMOTE: No label column present, skipping class rebalancing.")
        return df, {"smote_applied": False, "added_samples": 0}

    classes = df[label_col].unique()
    counts = df[label_col].value_counts().to_dict()
    max_count = max(counts.values()) if counts else 0

    if max_count == 0:
        return df, {"smote_applied": False, "added_samples": 0}

    synthetic_rows = []
    rng = np.random.default_rng(42)

    for cls in classes:
        cls_df = df[df[label_col] == cls]
        cls_count = len(cls_df)
        needed = max_count - cls_count

        if needed > 0 and cls_count > 0:
            print(f"SMOTE: Synthesizing {needed} minority samples for class '{cls}' (Current: {cls_count} -> Target: {max_count})...")
            X_cls = cls_df[feature_cols].values
            
            for _ in range(needed):
                idx = rng.integers(0, cls_count)
                sample = X_cls[idx]
                
                # Pick neighbor
                neighbor_idx = rng.integers(0, cls_count)
                neighbor = X_cls[neighbor_idx]
                
                # KNN feature interpolation: x_new = x + lambda * (neighbor - x)
                lam = rng.uniform(0.1, 0.9)
                synth_sample = sample + lam * (neighbor - sample)
                
                row_dict = {f: float(val) for f, val in zip(feature_cols, synth_sample)}
                row_dict[label_col] = cls
                synthetic_rows.append(row_dict)

    if synthetic_rows:
        synth_df = pd.DataFrame(synthetic_rows)
        balanced_df = pd.concat([df, synth_df], ignore_index=True)
        print(f"SMOTE Complete. Total samples after 1:1:1 balancing: {len(balanced_df)} (Added {len(synthetic_rows)} SMOTE synthetic vectors).")
        return balanced_df, {"smote_applied": True, "added_samples": len(synthetic_rows), "total_balanced": len(balanced_df)}
    
    return df, {"smote_applied": True, "added_samples": 0, "total_balanced": len(df)}


# Prefer the realistic v2 model trained on proper eye/head distributions
# Falls back to original if v2 not found
MODEL_PATH  = 'isolation_forest_v2.pkl'  if os.path.exists('isolation_forest_v2.pkl')  else 'isolation_forest_model.pkl'
SCALER_PATH = 'scaler_v2.pkl'            if os.path.exists('scaler_v2.pkl')            else 'scaler.pkl'

# Prefer the new realistic dataset if available
DATA_PATH = 'realistic_behavior_dataset.csv' if os.path.exists('realistic_behavior_dataset.csv') else 'behavior_dataset.csv'

def train_and_save(human_samples=None, include_synthetic=True):
    """Train Isolation Forest on real-world human feedback + synthetic fallback with SMOTE balancing."""
    df_list = []
    is_synthetic_only = True

    # 1. Process human samples if provided
    if human_samples and len(human_samples) > 0:
        print(f"Loading {len(human_samples)} human-labeled samples...")
        try:
            human_df = pd.DataFrame(human_samples)
            
            # Ensure all required features are present; if missing, fill with defaults
            for f in FEATURES:
                if f not in human_df.columns:
                    print(f"Warning: Missing feature '{f}' in human samples. Filling with 0.")
                    human_df[f] = 0.0

            # Drop rows with NaN
            human_df = human_df.dropna(subset=FEATURES)
            
            if 'label' in human_df.columns:
                # Apply SMOTE class balancing to human dataset
                balanced_human_df, smote_info = apply_smote_balancing(human_df, FEATURES, label_col='label')
                df_list.append(balanced_human_df[FEATURES])
                is_synthetic_only = False
                print(f"SMOTE balanced human samples loaded successfully. Info: {smote_info}")
        except Exception as e:
            print(f"Error processing human samples: {e}")

    # 2. Add synthetic data if requested or if no human data exists
    if include_synthetic or is_synthetic_only:
        print("Adding synthetic baseline data...")
        df_list.append(_synthetic_training_data())
        
    if not df_list:
        raise ValueError("No data available to train the model!")
        
    df = pd.concat(df_list, ignore_index=True)

    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(df)

    contamination_rate = 0.15 if is_synthetic_only else 0.12

    clf = IsolationForest(
        n_estimators=300,
        contamination=contamination_rate,
        max_samples='auto',
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_scaled)

    joblib.dump(clf, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"Model saved to {MODEL_PATH}")

    # ── Dynamic Calibration ──────────────────────────────────────────────────
    # We calibrate the risk bounds based on the actual distribution of our data
    scores = clf.decision_function(X_scaled)
    lo, hi = float(np.percentile(scores, 1)), float(np.percentile(scores, 95))
    
    # Store these bounds in a config file so predict_risk can use them
    calibration = {"score_lo": lo, "score_hi": hi}
    joblib.dump(calibration, 'calibration.pkl')
    
    print(f"Calibration Complete. Bound (1st-95th percentile): [{lo:.4f}, {hi:.4f}]")
    return clf, scaler


def load_or_train():
    """Load persisted model or train a fresh one."""
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        clf    = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
    else:
        clf, scaler = train_and_save()
    return clf, scaler


# ── Score calibration bounds ─────────────────────────────────────────────────
# decision_function output is approximately normally distributed around 0.
# Typical IsolationForest range across a broad feature spread:
#   Highly anomalous → around -0.15 to -0.30
#   Normal           → around +0.05 to +0.20
# We map [SCORE_LO, SCORE_HI] linearly to [1.0, 0.0] (high risk → low score).
SCORE_LO = -0.20   # most anomalous expected score  → risk 1.0
SCORE_HI =  0.15   # most normal expected score      → risk 0.0


def predict_risk(features: dict) -> float:
    """
    features keys: eye_deviation, head_movement, mouse_idle_time, response_time
    Returns: risk_score in [0.0, 1.0]  (smoothed, stable)
    """
    clf, scaler = load_or_train()
    
    # Load dynamic calibration bounds
    if os.path.exists('calibration.pkl'):
        cal = joblib.load('calibration.pkl')
        lo, hi = cal['score_lo'], cal['score_hi']
    else:
        lo, hi = -0.20, 0.15 # Fallback defaults

    row = np.array([[
        features.get('eye_deviation',   0),
        features.get('head_movement',   0),
        features.get('face_scale',      0.2), # Default to mid-range normal
        features.get('mouse_idle_time', 0),
        features.get('response_time',   60),
    ]])

    row_scaled = scaler.transform(row)

    # Isolation Forest: positive = normal, negative = anomaly
    raw_score = clf.decision_function(row_scaled)[0]

    # Linear mapping: hi → 0.0 (safe), lo → 1.0 (high risk)
    span = hi - lo
    risk_score = float(np.clip((hi - raw_score) / span, 0.0, 1.0))

    return float(f"{risk_score:.4f}")
