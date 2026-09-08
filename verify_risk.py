import requests
import time

URL = "http://localhost:8001/analyze"
STUDENT_ID = "test_student_123"

def test_risk(payload, description):
    print(f"\n--- Testing: {description} ---")
    payload["student_id"] = STUDENT_ID
    try:
        response = requests.post(URL, json=payload)
        response.raise_for_status()
        data = response.json()
        print(f"Payload: {payload}")
        print(f"Risk Score: {data['risk_score']}")
        print(f"Level: {data['risk_level']}")
        print(f"Messages: {data['messages']}")
        return data['risk_score']
    except Exception as e:
        print(f"Error: {e}")
        return None

# 13. Multi-Violation (Tab Switch + Side Look)
test_risk({
    "eye_deviation": 60, "head_movement": 10, "face_scale": 0.2, "response_time": 30,
    "tab_switches": 3, "fullscreen_exits": 1, "difficulty": "medium",
    "face_not_detected": False, "question_id": "q3", "is_answered": False
}, "Multi-Violation (Tab Switch + Side Look)")

# 14. Easy Question Timing (Fast < 4s)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "face_scale": 0.2, "response_time": 3,
    "tab_switches": 3, "fullscreen_exits": 1, "difficulty": "easy",
    "face_not_detected": False, "question_id": "q4", "is_answered": True
}, "Easy Question Timing (Fast < 4s)")

# 15. Hard Question Timing (Fast < 12s)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "face_scale": 0.2, "response_time": 10,
    "tab_switches": 3, "fullscreen_exits": 1, "difficulty": "hard",
    "face_not_detected": False, "question_id": "q5", "is_answered": True
}, "Hard Question Timing (Fast < 12s)")

# 1. Normal behavior
test_risk({
    "eye_deviation": 0, "head_movement": 0, "mouse_idle_time": 0, 
    "response_time": 45, "tab_switches": 0, "fullscreen_exits": 0, "difficulty": "medium"
}, "Normal Behavior")

# 2. Tab switch penalty (+15 first time)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "mouse_idle_time": 0, 
    "response_time": 45, "tab_switches": 1, "fullscreen_exits": 0, "difficulty": "medium"
}, "First Tab Switch")

# 3. Repeat tab switch (+20)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "mouse_idle_time": 0, 
    "response_time": 45, "tab_switches": 2, "fullscreen_exits": 0, "difficulty": "medium"
}, "Second Tab Switch")

# 4. Fullscreen exit (+10)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "mouse_idle_time": 0, 
    "response_time": 45, "tab_switches": 2, "fullscreen_exits": 1, "difficulty": "medium"
}, "Fullscreen Exit")

# 5. Fast response on Hard question (+10)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "mouse_idle_time": 0, 
    "response_time": 10, "tab_switches": 2, "fullscreen_exits": 1, "difficulty": "hard"
}, "Fast Response on Hard")

# 7. Persistent Face Missing (Risk should climb step by step)
for i in range(3):
    test_risk({
        "eye_deviation": 0, "head_movement": 0, "mouse_idle_time": 0, 
        "response_time": 45, "tab_switches": 2, "fullscreen_exits": 1, "difficulty": "medium",
        "face_not_detected": True, "question_id": "q1", "is_answered": False
    }, f"Face Missing Interval {i+1}")

# 8. Fast Response with is_answered=True (+15)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "mouse_idle_time": 0, 
    "response_time": 3, "tab_switches": 2, "fullscreen_exits": 1, "difficulty": "medium",
    "face_not_detected": False, "question_id": "q1", "is_answered": True
}, "Fast Response on q1 (Answered)")

# 9. Duplicate Penalty Prevention (Should NOT add risk again)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "mouse_idle_time": 0, 
    "response_time": 3, "tab_switches": 2, "fullscreen_exits": 1, "difficulty": "medium",
    "face_not_detected": False, "question_id": "q1", "is_answered": True
}, "Fast Response on q1 (Duplicate - Should ignore)")

# 10. New Question Penalty
test_risk({
    "eye_deviation": 0, "head_movement": 0, "face_scale": 0.2,
    "response_time": 3, "tab_switches": 2, "fullscreen_exits": 1, "difficulty": "medium",
    "face_not_detected": False, "question_id": "q2", "is_answered": True
}, "Fast Response on q2 (New Question)")

# 11. Moving Away (Low face_scale)
test_risk({
    "eye_deviation": 0, "head_movement": 0, "face_scale": 0.05,
    "response_time": 45, "tab_switches": 2, "fullscreen_exits": 1, "difficulty": "medium",
    "face_not_detected": False, "question_id": "q2", "is_answered": False
}, "Moving Away from Camera (Low Face Scale)")

# 12. Looking to Side (High Eye Deviation)
test_risk({
    "eye_deviation": 60, "head_movement": 0, "face_scale": 0.2,
    "response_time": 45, "tab_switches": 2, "fullscreen_exits": 1, "difficulty": "medium",
    "face_not_detected": False, "question_id": "q2", "is_answered": False
}, "Looking to the Side (High Eye Deviation)")
