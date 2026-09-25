"""
test_evaluator_agent.py
Tests the 60-feature 3-model ensemble evaluator, SHAP explainability,
and viva question generation end-to-end.
"""

import json
from circuit_evaluator_ml import evaluate_circuit, get_model_stats

def run_tests():
    print("=" * 65)
    print("  TEST 1: Model Stats & Metadata Verification")
    print("=" * 65)
    stats = get_model_stats()
    print(f"Loaded:           {stats.get('loaded')}")
    print(f"Features:         {stats.get('n_features')} columns")
    print(f"Score MAE:        {stats.get('mae')}")
    print(f"Score R2:         {stats.get('r2')}")
    print(f"Verdict Accuracy: {stats.get('verdict_accuracy') * 100:.2f}%")
    print(f"Score Model:      {stats.get('score_model')}")
    print(f"Verdict Model:    {stats.get('verdict_model')}")
    assert stats.get("loaded") is True, "Models failed to load!"
    assert stats.get("n_features") == 60, f"Expected 60 features, got {stats.get('n_features')}"

    print("\n" + "=" * 65)
    print("  TEST 2: Correct Inverting Op-Amp Circuit (Gain = -10)")
    print("=" * 65)
    # Target: Gain = -10. Rin = 1000, Rf = 10000 -> -10000/1000 = -10
    components = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": 1.0, "waveform": "sine"}},
        {"comp_id": "Rin", "type": "resistor",       "properties": {"resistance_ohm": 1000}},
        {"comp_id": "Rf",  "type": "resistor",       "properties": {"resistance_ohm": 10000}},
        {"comp_id": "OA1", "type": "op_amp",         "properties": {"model": "ideal"}},
        {"comp_id": "GND", "type": "ground",         "properties": {}},
    ]
    connections = [
        {"from": {"comp_id": "V1",  "pin": "positive"},  "to": {"comp_id": "Rin", "pin": "1"}},
        {"from": {"comp_id": "Rin", "pin": "2"},         "to": {"comp_id": "OA1", "pin": "inverting"}},
        {"from": {"comp_id": "OA1", "pin": "inverting"}, "to": {"comp_id": "Rf",  "pin": "1"}},
        {"from": {"comp_id": "Rf",  "pin": "2"},         "to": {"comp_id": "OA1", "pin": "output"}},
        {"from": {"comp_id": "OA1", "pin": "non_inverting"}, "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1",  "pin": "negative"},  "to": {"comp_id": "GND", "pin": "1"}},
    ]
    
    result = evaluate_circuit(
        components=components,
        connections=connections,
        question_type="gain_check",
        expected={"value": -10.0, "tolerance": 0.05},
        measured=-10.0
    )
    
    print(f"Score:       {result['score']}/100")
    print(f"Verdict:     {result['verdict']}")
    print(f"Summary:     {result['summary']}")
    print(f"Confidence:  {result['ml_confidence'] * 100:.1f}%")
    print(f"Model Votes: {result['model_votes']}")
    print(f"Disagreement Flag: {result['disagreement_flag']}")
    
    print("\n--- SHAP Top Contributors ---")
    shap_info = result.get("shap_explanation", {})
    for item in shap_info.get("top_positive", []):
        print(f"  [+] {item['label']}: +{item['shap_value']:.2f} pts")
    for item in shap_info.get("top_negative", []):
        print(f"  [-] {item['label']}: {item['shap_value']:.2f} pts")

    print("\n--- Local Viva Defense Questions ---")
    for i, q in enumerate(result.get("viva_questions", [])):
        print(f"  Q{i+1}: {q['questionText']}")

    assert result["score"] >= 85, f"Expected high score for correct circuit, got {result['score']}"
    assert result["verdict"] == "correct", f"Expected 'correct', got {result['verdict']}"
    assert len(result.get("viva_questions", [])) == 2, "Expected 2 viva questions"

    print("\n" + "=" * 65)
    print("  TEST 3: Faulty Circuit — Missing Ground & Wrong Gain")
    print("=" * 65)
    # Missing ground and Rf=20k (Gain -20 instead of -10)
    components_faulty = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": 1.0, "waveform": "sine"}},
        {"comp_id": "Rin", "type": "resistor",       "properties": {"resistance_ohm": 1000}},
        {"comp_id": "Rf",  "type": "resistor",       "properties": {"resistance_ohm": 20000}},
        {"comp_id": "OA1", "type": "op_amp",         "properties": {"model": "ideal"}},
    ]
    connections_faulty = [
        {"from": {"comp_id": "V1",  "pin": "positive"},  "to": {"comp_id": "Rin", "pin": "1"}},
        {"from": {"comp_id": "Rin", "pin": "2"},         "to": {"comp_id": "OA1", "pin": "inverting"}},
        {"from": {"comp_id": "OA1", "pin": "inverting"}, "to": {"comp_id": "Rf",  "pin": "1"}},
        {"from": {"comp_id": "Rf",  "pin": "2"},         "to": {"comp_id": "OA1", "pin": "output"}},
    ]
    
    result_faulty = evaluate_circuit(
        components=components_faulty,
        connections=connections_faulty,
        question_type="gain_check",
        expected={"value": -10.0, "tolerance": 0.05},
        measured=-20.0
    )
    print(f"Faulty Score:   {result_faulty['score']}/100")
    print(f"Faulty Verdict: {result_faulty['verdict']}")
    print(f"Issues Count:   {len(result_faulty['issues_found'])}")
    for issue in result_faulty["issues_found"]:
        print(f"  * [{issue['type']}]: {issue['explanation']}")
    print(f"Feedback:       {result_faulty['feedback_for_student']}")

    assert result_faulty["score"] < 50, f"Expected low score for faulty circuit, got {result_faulty['score']}"
    assert result_faulty["verdict"] in ("incorrect", "partially_correct")

    print("\n" + "=" * 65)
    print("  TEST 4: Voltage Divider Circuit (5V to 2.5V)")
    print("=" * 65)
    components_vd = [
        {"comp_id": "V1",  "type": "voltage_source", "properties": {"voltage": 5.0}},
        {"comp_id": "R1",  "type": "resistor",       "properties": {"resistance_ohm": 10000}},
        {"comp_id": "R2",  "type": "resistor",       "properties": {"resistance_ohm": 10000}},
        {"comp_id": "GND", "type": "ground",         "properties": {}},
    ]
    connections_vd = [
        {"from": {"comp_id": "V1", "pin": "positive"}, "to": {"comp_id": "R1", "pin": "1"}},
        {"from": {"comp_id": "R1", "pin": "2"},        "to": {"comp_id": "R2", "pin": "1"}},
        {"from": {"comp_id": "R2", "pin": "2"},        "to": {"comp_id": "GND", "pin": "1"}},
        {"from": {"comp_id": "V1", "pin": "negative"}, "to": {"comp_id": "GND", "pin": "1"}},
    ]
    result_vd = evaluate_circuit(
        components=components_vd,
        connections=connections_vd,
        question_type="voltage_divider",
        expected={"value": 2.5, "tolerance": 0.05},
        measured=2.5
    )
    print(f"Divider Score:   {result_vd['score']}/100")
    print(f"Divider Verdict: {result_vd['verdict']}")
    print(f"Divider Viva Qs: {len(result_vd['viva_questions'])}")
    for i, q in enumerate(result_vd["viva_questions"]):
        print(f"  Q{i+1}: {q['questionText']}")

    assert result_vd["score"] >= 85, f"Expected high score for divider, got {result_vd['score']}"
    assert result_vd["verdict"] == "correct"

    print("\n" + "=" * 65)
    print("  ALL TESTS PASSED SUCCESSFULLY! [OK]")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
