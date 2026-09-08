from model import train_and_save, predict_risk
import sys
import os

# Change to the ml-service dir so pkl paths resolve correctly
os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 55)
print("Retraining model with improved synthetic data...")
print("=" * 55)
clf, scaler = train_and_save()
print("Model retrained and saved.\n")

print("=" * 55)
print("Verification: risk scores for key scenarios")
print("=" * 55)

tests = [
    ("Very normal (5°, 5°, 5s, 45s)",       {"eye_deviation": 5,   "head_movement": 5,   "mouse_idle_time": 5,   "response_time": 45}),
    ("Slightly off (20°, 12°, 80s, 25s)",    {"eye_deviation": 20,  "head_movement": 12,  "mouse_idle_time": 80,  "response_time": 25}),
    ("Medium concern (30°, 20°, 100s, 60s)", {"eye_deviation": 30,  "head_movement": 20,  "mouse_idle_time": 100, "response_time": 60}),
    ("Clear anomaly (60°, 55°, 200s, 2s)",   {"eye_deviation": 60,  "head_movement": 55,  "mouse_idle_time": 200, "response_time": 2}),
    ("Extreme anomaly (90°, 80°, 400s, 1s)", {"eye_deviation": 90,  "head_movement": 80,  "mouse_idle_time": 400, "response_time": 1}),
    ("Only eyes off (50°, 5°, 10s, 60s)",    {"eye_deviation": 50,  "head_movement": 5,   "mouse_idle_time": 10,  "response_time": 60}),
    ("Only idle high (5°, 5°, 300s, 60s)",   {"eye_deviation": 5,   "head_movement": 5,   "mouse_idle_time": 300, "response_time": 60}),
    ("Fast answer (5°, 5°, 5s, 1s)",         {"eye_deviation": 5,   "head_movement": 5,   "mouse_idle_time": 5,   "response_time": 1}),
]

THRESHOLD = 0.6
all_pass = True
for label, feat in tests:
    score = predict_risk(feat)
    flag_str = "FLAGGED" if score >= THRESHOLD else "ok"
    print(f"  {label:<45} score={score:.4f}  [{flag_str}]")

print()
# Sanity check
normal_score = predict_risk({"eye_deviation": 5, "head_movement": 5, "mouse_idle_time": 5, "response_time": 45})
anomalous_score = predict_risk({"eye_deviation": 90, "head_movement": 80, "mouse_idle_time": 400, "response_time": 1})

if normal_score < THRESHOLD and anomalous_score >= THRESHOLD:
    print("PASS: Normal is below threshold, anomalous is above threshold.")
else:
    print("FAIL: Scores may not be calibrated correctly.")
    print(f"  Normal: {normal_score}, Anomalous: {anomalous_score}")
    all_pass = False

sys.exit(0 if all_pass else 1)
