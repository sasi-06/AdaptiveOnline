import model

print("MODEL_PATH =", model.MODEL_PATH)
print("SCALER_PATH=", model.SCALER_PATH)
print()

test_cases = [
    ("Focused   (14 eye / 10 head)", {"eye_deviation": 14.0, "head_movement": 10.0, "face_scale": 0.25, "mouse_idle_time": 5,   "response_time": 40}),
    ("Reading   (20 eye / 14 head)", {"eye_deviation": 20.0, "head_movement": 14.0, "face_scale": 0.23, "mouse_idle_time": 12,  "response_time": 65}),
    ("Thinking  (24 eye / 17 head)", {"eye_deviation": 24.0, "head_movement": 17.0, "face_scale": 0.22, "mouse_idle_time": 20,  "response_time": 90}),
    ("Distracted(36 eye / 28 head)", {"eye_deviation": 36.0, "head_movement": 28.0, "face_scale": 0.20, "mouse_idle_time": 35,  "response_time": 110}),
    ("GazeAway  (55 eye / 12 head)", {"eye_deviation": 55.0, "head_movement": 12.0, "face_scale": 0.21, "mouse_idle_time": 50,  "response_time": 18}),
    ("HeadTurn  (12 eye / 50 head)", {"eye_deviation": 12.0, "head_movement": 50.0, "face_scale": 0.19, "mouse_idle_time": 40,  "response_time": 22}),
    ("Ghost     ( 0 eye /  0 head)", {"eye_deviation":  0.0, "head_movement":  0.0, "face_scale": 0.01, "mouse_idle_time": 200, "response_time": 200}),
]

print("Scenario                            |  Risk Score | Status")
print("-" * 60)
for name, feats in test_cases:
    risk = model.predict_risk(feats)
    label = "[FLAGGED]" if risk > 0.55 else "[SECURE] "
    print(f"{name:<35} | {risk:>10.4f}  | {label}")
