"""
generate_realistic_dataset.py
------------------------------
Generates a realistic synthetic behavioral dataset for eye deviation and
head movement that mirrors real-world exam proctoring distributions.

DISTRIBUTIONS MODELED:
  - Focused students:        eye_deviation  5-22 deg, head_movement  3-18 deg
  - Reading question:        eye_deviation 10-30 deg, head_movement  5-25 deg
  - Thinking / planning:     eye_deviation 14-34 deg, head_movement  8-30 deg
  - Distracted (not cheating):eye_deviation 22-50 deg, head_movement 14-40 deg
  - Suspicious gaze away:    eye_deviation 38-75 deg, head_movement  5-25 deg
  - Suspicious head turn:    eye_deviation  5-28 deg, head_movement 35-65 deg
  - Ghost (face missing):    eye_deviation  0-2  deg, head_movement  0-2  deg
  - Fast copy-paste:         eye_deviation  2-18 deg, head_movement  2-14 deg (very fast response_time)

OUTPUT FILES (separate - does NOT overwrite existing files):
  realistic_behavior_dataset.csv  <-- new dataset
  isolation_forest_v2.pkl         <-- new model
  scaler_v2.pkl                   <-- new scaler
"""

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

np.random.seed(2024)

FEATURES = ['eye_deviation', 'head_movement', 'face_scale', 'mouse_idle_time', 'response_time']


def clamp(arr, lo, hi):
    return np.clip(arr, lo, hi)


def make_focused_student(n=350):
    """Fully focused student — low eye/head deviation, natural face scale."""
    return pd.DataFrame({
        "eye_deviation":   clamp(np.random.normal(12, 5, n), 2, 25),
        "head_movement":   clamp(np.random.normal(9,  4, n), 2, 18),
        "face_scale":      clamp(np.random.normal(0.25, 0.04, n), 0.14, 0.45),
        "mouse_idle_time": clamp(np.random.exponential(8, n), 0, 40),
        "response_time":   clamp(np.random.normal(45, 18, n), 8, 150),
    })


def make_reading_student(n=250):
    """Student looking at problem statement occasionally (slightly off-center)."""
    return pd.DataFrame({
        "eye_deviation":   clamp(np.random.normal(18, 6, n), 6, 30),
        "head_movement":   clamp(np.random.normal(12, 5, n), 4, 24),
        "face_scale":      clamp(np.random.normal(0.23, 0.04, n), 0.13, 0.42),
        "mouse_idle_time": clamp(np.random.exponential(12, n), 0, 60),
        "response_time":   clamp(np.random.normal(65, 22, n), 15, 200),
    })


def make_thinking_student(n=180):
    """Student thinking — slight natural gaze and small head tilt."""
    return pd.DataFrame({
        "eye_deviation":   clamp(np.random.normal(22, 7, n), 8, 34),
        "head_movement":   clamp(np.random.normal(16, 6, n), 5, 30),
        "face_scale":      clamp(np.random.normal(0.22, 0.05, n), 0.12, 0.40),
        "mouse_idle_time": clamp(np.random.exponential(20, n), 0, 90),
        "response_time":   clamp(np.random.normal(90, 30, n), 20, 250),
    })


def make_distracted_student(n=140):
    """Distracted but not cheating — looking away noticeably."""
    return pd.DataFrame({
        "eye_deviation":   clamp(np.random.normal(34, 8, n), 20, 52),
        "head_movement":   clamp(np.random.normal(26, 8, n), 12, 42),
        "face_scale":      clamp(np.random.normal(0.20, 0.05, n), 0.10, 0.38),
        "mouse_idle_time": clamp(np.random.exponential(30, n), 5, 120),
        "response_time":   clamp(np.random.normal(100, 40, n), 25, 280),
    })


def make_suspicious_gaze(n=90):
    """High gaze deviation — looking at another screen/phone."""
    return pd.DataFrame({
        "eye_deviation":   clamp(np.random.normal(52, 10, n), 36, 75),
        "head_movement":   clamp(np.random.normal(14,  6, n),  4, 28),
        "face_scale":      clamp(np.random.normal(0.21, 0.04, n), 0.11, 0.37),
        "mouse_idle_time": clamp(np.random.exponential(50, n), 10, 200),
        "response_time":   clamp(np.random.normal(18, 8, n), 2, 55),
    })


def make_suspicious_head_turn(n=90):
    """Head strongly rotated — looking at someone else or secondary monitor."""
    return pd.DataFrame({
        "eye_deviation":   clamp(np.random.normal(14,  5, n),  4, 26),
        "head_movement":   clamp(np.random.normal(50, 10, n), 34, 68),
        "face_scale":      clamp(np.random.normal(0.19, 0.05, n), 0.09, 0.34),
        "mouse_idle_time": clamp(np.random.exponential(40, n), 5, 150),
        "response_time":   clamp(np.random.normal(24, 10, n), 3, 65),
    })


def make_ghost_no_face(n=60):
    """Student stepped away — face not visible in frame at all."""
    return pd.DataFrame({
        "eye_deviation":   clamp(np.random.normal(0, 1, n), 0, 3),
        "head_movement":   clamp(np.random.normal(0, 1, n), 0, 3),
        "face_scale":      clamp(np.random.normal(0.02, 0.01, n), 0.0, 0.06),
        "mouse_idle_time": clamp(np.random.exponential(120, n), 60, 350),
        "response_time":   clamp(np.random.normal(200, 60, n), 60, 400),
    })


def make_copy_paste_cheater(n=70):
    """Copy-pasted answer instantly — near-zero response time, low movement."""
    return pd.DataFrame({
        "eye_deviation":   clamp(np.random.normal(10, 4, n), 2, 20),
        "head_movement":   clamp(np.random.normal(8,  3, n), 2, 15),
        "face_scale":      clamp(np.random.normal(0.24, 0.04, n), 0.13, 0.38),
        "mouse_idle_time": clamp(np.random.exponential(3, n), 0, 14),
        "response_time":   clamp(np.random.normal(5, 2, n), 1, 12),
    })


# ─── Build dataset ────────────────────────────────────────────────────────────

df = pd.concat([
    make_focused_student(350),
    make_reading_student(250),
    make_thinking_student(180),
    make_distracted_student(140),
    make_suspicious_gaze(90),
    make_suspicious_head_turn(90),
    make_ghost_no_face(60),
    make_copy_paste_cheater(70),
], ignore_index=True)

df = df[FEATURES].fillna(0.0)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

print("\n=== Realistic Behavioral Dataset Generated ===")
print(f"Total rows: {len(df)}")
print(df.describe().round(2))

# Save new dataset — does NOT overwrite behavior_dataset.csv
df.to_csv("realistic_behavior_dataset.csv", index=False)
print("\n[SAVED] realistic_behavior_dataset.csv")

# ─── Train Model v2 ───────────────────────────────────────────────────────────

scaler_v2 = MinMaxScaler()
X_scaled = scaler_v2.fit_transform(df[FEATURES])

clf_v2 = IsolationForest(
    n_estimators=400,
    contamination=0.15,
    max_samples="auto",
    random_state=42,
    n_jobs=-1
)

print("\n[TRAINING] Fitting IsolationForest v2 on realistic dataset...")
clf_v2.fit(X_scaled)
print("[DONE] Training complete.")

# Save new model/scaler — does NOT overwrite isolation_forest_model.pkl / scaler.pkl
joblib.dump(clf_v2, "isolation_forest_v2.pkl")
joblib.dump(scaler_v2, "scaler_v2.pkl")
print("[SAVED] isolation_forest_v2.pkl")
print("[SAVED] scaler_v2.pkl")

# ─── Inference Validation ─────────────────────────────────────────────────────

scores = clf_v2.decision_function(X_scaled)
lo, hi = scores.min(), scores.max()

test_cases = [
    ("Focused   (14 eye / 10 head)", [14.0, 10.0, 0.25,  5,  40]),
    ("Reading   (20 eye / 14 head)", [20.0, 14.0, 0.23, 12,  65]),
    ("Thinking  (24 eye / 17 head)", [24.0, 17.0, 0.22, 20,  90]),
    ("Distracted(36 eye / 28 head)", [36.0, 28.0, 0.20, 35, 110]),
    ("GazeAway  (55 eye / 12 head)", [55.0, 12.0, 0.21, 50,  18]),
    ("HeadTurn  (12 eye / 50 head)", [12.0, 50.0, 0.19, 40,  22]),
    ("Ghost     ( 0 eye /  0 head)", [ 0.0,  0.0, 0.01,200, 200]),
    ("CopyPaste ( 9 eye /  7 head)", [ 9.0,  7.0, 0.24,  2,   4]),
]

print("\n=== Model v2 — Validation Inference ===")
print(f"{'Scenario':<35} | {'Risk %':>8} | Status")
print("-" * 62)
for name, vec in test_cases:
    vec_df = pd.DataFrame([dict(zip(FEATURES, vec))])
    vec_scaled = scaler_v2.transform(vec_df)
    raw = clf_v2.decision_function(vec_scaled)[0]
    risk_pct = float(np.clip(((hi - raw) / (hi - lo)) * 100, 0, 100))
    label = "[FLAGGED]" if risk_pct > 55 else "[SECURE] "
    print(f"{name:<35} | {risk_pct:>7.1f}% | {label}")

print("\n=== Existing model files are UNTOUCHED ===")
print("  isolation_forest_model.pkl  -- original, unchanged")
print("  scaler.pkl                  -- original, unchanged")
print("  behavior_dataset.csv        -- original, unchanged")
print("\nNew files created:")
print("  isolation_forest_v2.pkl     -- new realistic model")
print("  scaler_v2.pkl               -- new scaler")
print("  realistic_behavior_dataset.csv -- new dataset")
