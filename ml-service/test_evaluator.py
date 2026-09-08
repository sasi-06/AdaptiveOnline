import sys
sys.stdout.reconfigure(encoding='utf-8')
from circuit_evaluator_ml import evaluate_circuit

components = [
    {'comp_id': 'V1',  'type': 'voltage_source', 'properties': {'voltage': 5, 'waveform': 'DC'}},
    {'comp_id': 'R1',  'type': 'resistor',        'properties': {'resistance_ohm': 1000}},
    {'comp_id': 'R2',  'type': 'resistor',        'properties': {'resistance_ohm': 10000}},
    {'comp_id': 'OA1', 'type': 'op_amp',          'properties': {'model': 'ideal'}},
    {'comp_id': 'GND', 'type': 'ground',           'properties': {}},
]
connections = [
    {'from': {'comp_id': 'V1',  'pin': 'positive'},     'to': {'comp_id': 'R1',  'pin': '1'}},
    {'from': {'comp_id': 'R1',  'pin': '2'},             'to': {'comp_id': 'OA1', 'pin': 'inverting'}},
    {'from': {'comp_id': 'OA1', 'pin': 'inverting'},     'to': {'comp_id': 'R2',  'pin': '1'}},
    {'from': {'comp_id': 'R2',  'pin': '2'},             'to': {'comp_id': 'OA1', 'pin': 'output'}},
    {'from': {'comp_id': 'V1',  'pin': 'negative'},      'to': {'comp_id': 'GND', 'pin': '1'}},
    {'from': {'comp_id': 'OA1', 'pin': 'non_inverting'}, 'to': {'comp_id': 'GND', 'pin': '1'}},
]

r = evaluate_circuit(components, connections, 'gain_check', {'value': -10, 'tolerance': 0.05}, measured=-10.0)
da = r.get('design_analysis', {})
print("SCORE:", r['score'])
print("VERDICT:", r['verdict'])
print("GRADE:", da.get('design_grade'))
print("ASSESSMENT:", da.get('grade_assessment'))
print("SIGNAL_PATH:", da.get('signal_path_description'))
print("TOPOLOGY_PCT:", da.get('topology_quality_pct'))
print("VALUE_PCT:", da.get('value_accuracy_pct'))
print("COMPLETENESS:", da.get('circuit_completeness_pct'))
print("COMPONENTS:", len(da.get('component_analysis', [])))
for comp in da.get('component_analysis', []):
    status = comp["status"]
    cid = comp["comp_id"]
    note = comp["note"]
    print(f"  [{status}] {cid}: {note}")
print("SUGGESTIONS:")
for s in da.get('improvement_suggestions', []):
    print("  -", s)
print("APPS:", da.get('real_world_applications'))

print()
print("--- Bad circuit (missing ground, missing feedback) ---")
bad_comps = [
    {'comp_id': 'V1',  'type': 'voltage_source', 'properties': {'voltage': 5}},
    {'comp_id': 'R1',  'type': 'resistor',        'properties': {'resistance_ohm': 1000}},
    {'comp_id': 'OA1', 'type': 'op_amp',          'properties': {}},
]
bad_conns = [
    {'from': {'comp_id': 'V1', 'pin': 'positive'}, 'to': {'comp_id': 'R1', 'pin': '1'}},
]
r2 = evaluate_circuit(bad_comps, bad_conns, 'gain_check', {'value': -10, 'tolerance': 0.05})
da2 = r2.get('design_analysis', {})
print("BAD SCORE:", r2['score'], "| GRADE:", da2.get('design_grade'))
print("BAD ISSUES:", [i['type'] for i in r2['issues_found']])
print("BAD SUGGESTIONS:")
for s in da2.get('improvement_suggestions', []):
    print("  -", s)
