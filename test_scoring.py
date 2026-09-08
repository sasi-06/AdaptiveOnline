import requests
import time

URL = "http://localhost:8001/analyze"
STUDENT_ID = "test_user_001"

def send_payload(desc, payload):
    print(f"\n--- {desc} ---")
    payload["student_id"] = STUDENT_ID
    try:
        start_t = time.time()
        res = requests.post(URL, json=payload)
        res.raise_for_status()
        data = res.json()
        print(f"Risk Score: {data['risk_score']} | Level: {data['risk_level']} | Flagged: {data['is_flagged']}")
        print(f"Message: {data['message']}")
    except Exception as e:
        print(f"Error: {e}")

# 1. Normal behavior
send_payload("1. Normal Behavior", {
    "eye_deviation": 5,
    "head_movement": 2,
    "mouse_idle_time": 10,
    "response_time": 20,
    "tab_switches": 0,
    "face_not_detected": False
})

time.sleep(2)

# 2. Stay Normal (Should stay 0)
send_payload("2. Still Normal Behavior (testing decay at floor 0)", {
    "eye_deviation": 4,
    "head_movement": 1,
    "mouse_idle_time": 12,
    "response_time": 25,
    "tab_switches": 0,
    "face_not_detected": False
})

time.sleep(2)

# 3. Tab Switch Detected! (+15 points)
send_payload("3. Tab Switch Detected!", {
    "eye_deviation": 5,
    "head_movement": 2,
    "mouse_idle_time": 15,
    "response_time": 30,
    "tab_switches": 1,
    "face_not_detected": False
})

time.sleep(2)

# 4. Another Tab Switch + Face Missing (+15 + 10 = +25 points)
send_payload("4. Another Tab Switch AND Face Missing!", {
    "eye_deviation": 8,
    "head_movement": 5,
    "mouse_idle_time": 20,
    "response_time": 35,
    "tab_switches": 2,
    "face_not_detected": True
})

time.sleep(4) # Wait 4 seconds to test decay well

# 5. Normal Behavior Again (Should decay!)
send_payload("5. Normal Behavior After Violations (testing decay)", {
    "eye_deviation": 5,
    "head_movement": 2,
    "mouse_idle_time": 5,
    "response_time": 40,
    "tab_switches": 2,
    "face_not_detected": False
})

time.sleep(3)

# 6. Checking further decay
send_payload("6. Checking further decay", {
    "eye_deviation": 3,
    "head_movement": 1,
    "mouse_idle_time": 10,
    "response_time": 45,
    "tab_switches": 2,
    "face_not_detected": False
})

# 7. Heavy Anomaly / Extreme Cheating (Trigger MAX cap)
send_payload("7. Extreme Cheating Triggered (eyes, head, tab switch)", {
    "eye_deviation": 60,
    "head_movement": 45,
    "mouse_idle_time": 5,
    "response_time": 10,
    "tab_switches": 3,
    "face_not_detected": True
})
