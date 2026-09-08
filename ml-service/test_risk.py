import urllib.request
import json
import time

BASE_URL = "http://localhost:8001"

def simulate_behavior(student_id, steps):
    print(f"--- Simulating Behavior for {student_id} ---")
    for i, step in enumerate(steps):
        payload = {
            "student_id": student_id,
            "eye_deviation": step.get("eye", 0.0),
            "head_movement": step.get("head", 0.0),
            "mouse_idle_time": step.get("mouse", 0.0),
            "response_time": step.get("res", 60.0),
            "tab_switches": step.get("tabs", 0),
            "fullscreen_exits": step.get("fs", 0),
            "face_scale": step.get("scale", 0.2),
            "difficulty": "medium",
            "is_answered": step.get("ans", False)
        }
        
        try:
            req = urllib.request.Request(f"{BASE_URL}/analyze", data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                print(f"Step {i+1}: Risk={data['risk_score']} | Level={data['risk_level']} | Msgs={data['messages']}")
        except Exception as e:
            print(f"Error at step {i+1}: {e}")
        
        time.sleep(1.0) # Normal interval

# 1. Normal behavior
normal_steps = [{"eye": 5, "head": 5}] * 5

# 2. Looking away behavior (Minor but persistent - should stay in medium)
looking_away_steps = [{"eye": 40, "head": 10}] * 10

# 3. Tab switch event (One-off but permanent increase)
tab_switch_steps = [{"tabs": 0}] * 2 + [{"tabs": 1}] + [{"tabs": 1}] * 2

if __name__ == "__main__":
    print("Testing ML Service Risk Calculation Performance...\n")
    simulate_behavior("student_normal", normal_steps)
    print("\n")
    simulate_behavior("student_distracted", looking_away_steps)
    print("\n")
    simulate_behavior("student_tab_switcher", tab_switch_steps)
