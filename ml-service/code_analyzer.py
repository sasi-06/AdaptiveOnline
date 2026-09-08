"""
code_analyzer.py
Real-time code quality analysis using Python AST and regex-based parsers.
Supports: Python (full AST), JavaScript, Java, C++ (regex-based).
"""

import ast
import re
import math


# ─── PYTHON AST ANALYZER ──────────────────────────────────────────────────────

def _get_nesting_depth(node, depth=0):
    """Recursively compute max nesting depth."""
    max_d = depth
    for child in ast.iter_child_nodes(node):
        if isinstance(child, (ast.If, ast.For, ast.While, ast.With, ast.Try)):
            max_d = max(max_d, _get_nesting_depth(child, depth + 1))
    return max_d


def analyze_python_code(code: str) -> dict:
    """Full AST analysis for Python code."""
    lines = code.split('\n')
    comment_lines = [l for l in lines if l.strip().startswith('#')]
    code_lines = [l for l in lines if l.strip() and not l.strip().startswith('#')]

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {
            "syntax_error": True,
            "syntax_error_msg": str(e),
            "complexity": 0,
            "function_count": 0,
            "class_count": 0,
            "has_functions": False,
            "has_classes": False,
            "avg_name_length": 0.0,
            "good_naming": False,
            "comment_ratio": round(len(comment_lines) / max(len(lines), 1), 3),
            "total_lines": len(lines),
            "code_lines": len(code_lines),
            "nested_depth": 0,
            "loop_count": 0,
            "condition_count": 0,
            "return_count": 0,
            "try_except_count": 0,
            "quality_score": 10,
        }

    # Cyclomatic complexity
    branch_nodes = (ast.If, ast.For, ast.While, ast.Try, ast.ExceptHandler,
                    ast.With, ast.Assert, ast.comprehension)
    branches = sum(1 for n in ast.walk(tree) if isinstance(n, branch_nodes))
    complexity = 1 + branches

    functions = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
    classes   = [n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]

    # Variable naming quality
    names = [n.id for n in ast.walk(tree)
             if isinstance(n, ast.Name) and len(n.id) > 1 and not n.id.isupper()]
    avg_name_length = sum(len(n) for n in names) / max(len(names), 1)
    good_naming = avg_name_length >= 4.0

    loop_count      = sum(1 for n in ast.walk(tree) if isinstance(n, (ast.For, ast.While)))
    condition_count = sum(1 for n in ast.walk(tree) if isinstance(n, ast.If))
    return_count    = sum(1 for n in ast.walk(tree) if isinstance(n, ast.Return))
    try_count       = sum(1 for n in ast.walk(tree) if isinstance(n, ast.Try))
    nested_depth    = _get_nesting_depth(tree)

    # Quality scoring
    q = 50
    if len(functions) > 0:   q += 15
    if len(classes) > 0:     q += 8
    if good_naming:           q += 12
    if len(comment_lines) > 0: q += 8
    if return_count > 0:      q += 5
    if complexity <= 10:      q += 7
    elif complexity > 20:     q -= 15
    if nested_depth > 4:      q -= 12
    if len(code_lines) < 3:   q -= 20

    return {
        "syntax_error": False,
        "syntax_error_msg": None,
        "complexity": complexity,
        "function_count": len(functions),
        "class_count": len(classes),
        "has_functions": len(functions) > 0,
        "has_classes": len(classes) > 0,
        "avg_name_length": round(avg_name_length, 2),
        "good_naming": good_naming,
        "comment_ratio": round(len(comment_lines) / max(len(lines), 1), 3),
        "total_lines": len(lines),
        "code_lines": len(code_lines),
        "nested_depth": nested_depth,
        "loop_count": loop_count,
        "condition_count": condition_count,
        "return_count": return_count,
        "try_except_count": try_count,
        "quality_score": min(100, max(0, round(q))),
    }


# ─── JAVASCRIPT ANALYZER ──────────────────────────────────────────────────────

def analyze_javascript_code(code: str) -> dict:
    """Regex-based analysis for JavaScript / TypeScript."""
    lines = code.split('\n')
    comment_lines = [l for l in lines
                     if l.strip().startswith('//') or l.strip().startswith('*')]
    code_lines = [l for l in lines
                  if l.strip() and not l.strip().startswith('//') and not l.strip().startswith('*')]

    fn_patterns = [
        r'\bfunction\s+\w+\s*\(',
        r'\bconst\s+\w+\s*=\s*(?:async\s*)?\(',
        r'\bconst\s+\w+\s*=\s*(?:async\s*)?\w+\s*=>',
        r'\b\w+\s*:\s*(?:async\s*)?function\s*\(',
        r'\b(?:async\s+)?(?:get|set|static)?\s*\w+\s*\([^)]*\)\s*\{',
    ]
    fn_count = sum(len(re.findall(p, code)) for p in fn_patterns)
    class_count  = len(re.findall(r'\bclass\s+\w+', code))
    if_count     = len(re.findall(r'\bif\s*\(', code))
    for_count    = len(re.findall(r'\bfor\s*\(', code))
    while_count  = len(re.findall(r'\bwhile\s*\(', code))
    try_count    = len(re.findall(r'\btry\s*\{', code))
    return_count = len(re.findall(r'\breturn\b', code))
    complexity   = 1 + if_count + for_count + while_count + try_count

    var_names = re.findall(r'\b(?:let|const|var)\s+(\w+)', code)
    avg_nl = sum(len(n) for n in var_names) / max(len(var_names), 1)
    good_naming = avg_nl >= 4.0

    q = 50
    if fn_count > 0:          q += 15
    if class_count > 0:       q += 8
    if good_naming:            q += 12
    if len(comment_lines) > 0: q += 8
    if return_count > 0:       q += 5
    if complexity <= 10:       q += 7
    elif complexity > 20:      q -= 15
    if len(code_lines) < 3:    q -= 20

    return {
        "syntax_error": False,
        "syntax_error_msg": None,
        "complexity": complexity,
        "function_count": fn_count,
        "class_count": class_count,
        "has_functions": fn_count > 0,
        "has_classes": class_count > 0,
        "avg_name_length": round(avg_nl, 2),
        "good_naming": good_naming,
        "comment_ratio": round(len(comment_lines) / max(len(lines), 1), 3),
        "total_lines": len(lines),
        "code_lines": len(code_lines),
        "nested_depth": 0,
        "loop_count": for_count + while_count,
        "condition_count": if_count,
        "return_count": return_count,
        "try_except_count": try_count,
        "quality_score": min(100, max(0, round(q))),
    }


# ─── JAVA ANALYZER ────────────────────────────────────────────────────────────

def analyze_java_code(code: str) -> dict:
    lines = code.split('\n')
    comment_lines = [l for l in lines
                     if l.strip().startswith('//') or l.strip().startswith('*')]
    code_lines = [l for l in lines
                  if l.strip() and not l.strip().startswith('//') and not l.strip().startswith('*')]

    method_count = len(re.findall(
        r'(?:public|private|protected|static)\s+\w[\w<>\[\]]*\s+\w+\s*\(', code))
    class_count  = len(re.findall(r'\bclass\s+\w+', code))
    if_count     = len(re.findall(r'\bif\s*\(', code))
    for_count    = len(re.findall(r'\bfor\s*\(', code))
    while_count  = len(re.findall(r'\bwhile\s*\(', code))
    try_count    = len(re.findall(r'\btry\s*\{', code))
    return_count = len(re.findall(r'\breturn\b', code))
    complexity   = 1 + if_count + for_count + while_count + try_count

    var_names = re.findall(
        r'\b(?:int|String|boolean|double|float|long|List|Map|Set)\s+(\w+)', code)
    avg_nl = sum(len(n) for n in var_names) / max(len(var_names), 1)
    good_naming = avg_nl >= 4.0

    q = 50
    if method_count > 0:       q += 15
    if class_count > 0:        q += 10
    if good_naming:             q += 12
    if len(comment_lines) > 0: q += 8
    if return_count > 0:       q += 5
    if complexity <= 10:       q += 7
    elif complexity > 20:      q -= 15

    return {
        "syntax_error": False,
        "syntax_error_msg": None,
        "complexity": complexity,
        "function_count": method_count,
        "class_count": class_count,
        "has_functions": method_count > 0,
        "has_classes": class_count > 0,
        "avg_name_length": round(avg_nl, 2),
        "good_naming": good_naming,
        "comment_ratio": round(len(comment_lines) / max(len(lines), 1), 3),
        "total_lines": len(lines),
        "code_lines": len(code_lines),
        "nested_depth": 0,
        "loop_count": for_count + while_count,
        "condition_count": if_count,
        "return_count": return_count,
        "try_except_count": try_count,
        "quality_score": min(100, max(0, round(q))),
    }


# ─── C++ ANALYZER ─────────────────────────────────────────────────────────────

def analyze_cpp_code(code: str) -> dict:
    lines = code.split('\n')
    comment_lines = [l for l in lines
                     if l.strip().startswith('//') or l.strip().startswith('*')]
    code_lines = [l for l in lines
                  if l.strip() and not l.strip().startswith('//') and not l.strip().startswith('*')]

    fn_count     = len(re.findall(r'\w[\w\s:*&]*\s+\w+\s*\([^)]*\)\s*(?:const\s*)?\{', code))
    class_count  = len(re.findall(r'\bclass\s+\w+', code))
    if_count     = len(re.findall(r'\bif\s*\(', code))
    for_count    = len(re.findall(r'\bfor\s*\(', code))
    while_count  = len(re.findall(r'\bwhile\s*\(', code))
    try_count    = len(re.findall(r'\btry\s*\{', code))
    return_count = len(re.findall(r'\breturn\b', code))
    complexity   = 1 + if_count + for_count + while_count + try_count

    q = 50
    if fn_count > 0:           q += 15
    if class_count > 0:        q += 8
    if len(comment_lines) > 0: q += 10
    if return_count > 0:       q += 5
    if complexity <= 10:       q += 12
    elif complexity > 20:      q -= 15

    return {
        "syntax_error": False,
        "syntax_error_msg": None,
        "complexity": complexity,
        "function_count": fn_count,
        "class_count": class_count,
        "has_functions": fn_count > 0,
        "has_classes": class_count > 0,
        "avg_name_length": 5.0,
        "good_naming": True,
        "comment_ratio": round(len(comment_lines) / max(len(lines), 1), 3),
        "total_lines": len(lines),
        "code_lines": len(code_lines),
        "nested_depth": 0,
        "loop_count": for_count + while_count,
        "condition_count": if_count,
        "return_count": return_count,
        "try_except_count": try_count,
        "quality_score": min(100, max(0, round(q))),
    }


# ─── VERILOG / HDL ANALYZER ──────────────────────────────────────────────────

def analyze_verilog_code(code: str) -> dict:
    """Analysis for Verilog HDL digital logic code."""
    lines = code.split('\n')
    comment_lines = [l for l in lines if l.strip().startswith('//') or l.strip().startswith('*')]
    code_lines = [l for l in lines if l.strip() and not l.strip().startswith('//') and not l.strip().startswith('*')]

    module_count   = len(re.findall(r'\bmodule\s+\w+', code))
    input_count    = len(re.findall(r'\binput\b', code))
    output_count   = len(re.findall(r'\boutput\b', code))
    always_blocks  = len(re.findall(r'\balways\s*@', code))
    assign_count   = len(re.findall(r'\bassign\b', code))
    reg_count      = len(re.findall(r'\breg\b', code))
    wire_count     = len(re.findall(r'\bwire\b', code))
    case_count     = len(re.findall(r'\bcase\b', code))
    if_count       = len(re.findall(r'\bif\s*\(', code))
    nonblocking    = len(re.findall(r'<=', code))

    complexity = 1 + always_blocks + assign_count + case_count + if_count

    q = 50
    if module_count > 0:       q += 15
    if input_count > 0 and output_count > 0: q += 15
    if always_blocks > 0:      q += 10
    if nonblocking > 0:        q += 10
    if len(comment_lines) > 0: q += 5
    if len(code_lines) < 4:    q -= 20

    return {
        "syntax_error": False,
        "syntax_error_msg": None,
        "complexity": complexity,
        "function_count": module_count,
        "class_count": 0,
        "has_functions": module_count > 0,
        "has_classes": False,
        "avg_name_length": 4.5,
        "good_naming": True,
        "comment_ratio": round(len(comment_lines) / max(len(lines), 1), 3),
        "total_lines": len(lines),
        "code_lines": len(code_lines),
        "nested_depth": 0,
        "loop_count": always_blocks,
        "condition_count": if_count + case_count,
        "return_count": 0,
        "try_except_count": 0,
        "quality_score": min(100, max(0, round(q))),
    }


# ─── EMBEDDED C ANALYZER ─────────────────────────────────────────────────────

def analyze_embedded_c_code(code: str) -> dict:
    """Analysis for Embedded C microcontroller code (Registers, GPIO, ISR)."""
    lines = code.split('\n')
    comment_lines = [l for l in lines if l.strip().startswith('//') or l.strip().startswith('*')]
    code_lines = [l for l in lines if l.strip() and not l.strip().startswith('//') and not l.strip().startswith('*')]

    fn_count       = len(re.findall(r'\w+\s+\w+\s*\([^)]*\)\s*\{', code))
    isr_count      = len(re.findall(r'\b(?:ISR|__interrupt)\b', code))
    bitops_count   = len(re.findall(r'(?:<<|>>|&=|\|=|~)', code))
    while_count    = len(re.findall(r'\bwhile\s*\(', code))
    if_count       = len(re.findall(r'\bif\s*\(', code))
    register_access = len(re.findall(r'\b(?:PORT\w*|DDR\w*|PIN\w*|TCCR\w*|ADMUX|ADCSRA|TIMSK\w*)\b', code))

    complexity = 1 + fn_count + isr_count + while_count + if_count

    q = 50
    if fn_count > 0:           q += 15
    if isr_count > 0:          q += 10
    if bitops_count > 0:       q += 10
    if register_access > 0:    q += 10
    if len(comment_lines) > 0: q += 5
    if len(code_lines) < 3:    q -= 20

    return {
        "syntax_error": False,
        "syntax_error_msg": None,
        "complexity": complexity,
        "function_count": fn_count + isr_count,
        "class_count": 0,
        "has_functions": (fn_count + isr_count) > 0,
        "has_classes": False,
        "avg_name_length": 4.2,
        "good_naming": True,
        "comment_ratio": round(len(comment_lines) / max(len(lines), 1), 3),
        "total_lines": len(lines),
        "code_lines": len(code_lines),
        "nested_depth": 0,
        "loop_count": while_count,
        "condition_count": if_count,
        "return_count": len(re.findall(r'\breturn\b', code)),
        "try_except_count": 0,
        "quality_score": min(100, max(0, round(q))),
    }


# ─── COMBINED QUALITY SCORE ───────────────────────────────────────────────────

def compute_final_code_score(analysis: dict, test_cases_passed: int, total_test_cases: int) -> int:
    """
    Combine code quality + test correctness into final code score.
    quality_score (60%) + correctness (40%)
    """
    quality = analysis.get("quality_score", 50)
    if total_test_cases > 0:
        correctness = round((test_cases_passed / total_test_cases) * 100)
    else:
        correctness = 50
    final = quality * 0.6 + correctness * 0.4
    return min(100, max(0, round(final)))


# ─── MAIN DISPATCHER ──────────────────────────────────────────────────────────

def analyze_code(code: str, language: str,
                 test_cases_passed: int = 0, total_test_cases: int = 0) -> dict:
    """Dispatch to language-specific analyzer and compute final quality score."""
    lang = language.lower().strip()

    if lang == "python":
        result = analyze_python_code(code)
    elif lang in ("javascript", "js", "typescript", "ts"):
        result = analyze_javascript_code(code)
    elif lang == "java":
        result = analyze_java_code(code)
    elif lang in ("cpp", "c++", "c"):
        result = analyze_cpp_code(code)
    elif lang in ("verilog", "v", "hdl"):
        result = analyze_verilog_code(code)
    elif lang in ("c_embedded", "embedded_c"):
        result = analyze_embedded_c_code(code)
    else:
        result = analyze_python_code(code)  # safe fallback

    result["code_quality_score"] = compute_final_code_score(
        result, test_cases_passed, total_test_cases
    )
    return result
