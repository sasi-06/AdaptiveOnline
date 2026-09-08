import ast
import re
import random
import os
import requests
import json

def parse_python_code(code: str):
    """Analyze Python code using AST to find functions, variables, and loops."""
    functions = []
    variables = set()
    loops = []
    conditionals = []

    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                functions.append(node.name)
            elif isinstance(node, (ast.For, ast.While)):
                loops.append({
                    "type": "for" if isinstance(node, ast.For) else "while",
                    "line": getattr(node, "lineno", 0)
                })
            elif isinstance(node, ast.If):
                conditionals.append(getattr(node, "lineno", 0))
            elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                if len(node.id) > 1 and not node.id.isupper():
                    variables.add(node.id)
    except SyntaxError:
        pass

    return {
        "functions": functions,
        "variables": list(variables),
        "loops": loops,
        "conditionals": conditionals
    }

def parse_regex_code(code: str, language: str):
    """Analyze JavaScript, Java, and C++ code using regex to locate elements."""
    lines = code.split('\n')
    functions = []
    variables = set()
    loops = []
    conditionals = []

    # Detect loops
    for idx, line in enumerate(lines):
        line_num = idx + 1
        if re.search(r'\bfor\s*\(', line):
            loops.append({"type": "for", "line": line_num})
        elif re.search(r'\bwhile\s*\(', line):
            loops.append({"type": "while", "line": line_num})
        elif re.search(r'\bif\s*\(', line):
            conditionals.append(line_num)

    # Detect functions
    if language in ["javascript", "js", "typescript", "ts"]:
        fn_matches = re.findall(r'\b(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)', code)
        for m in fn_matches:
            name = m[0] or m[1]
            if name:
                functions.append(name)
        var_matches = re.findall(r'\b(?:let|const|var)\s+(\w+)', code)
        variables.update(var_matches)
    elif language == "java":
        fn_matches = re.findall(r'(?:public|private|protected|static)\s+\w[\w<>\[\]]*\s+(\w+)\s*\(', code)
        functions.extend(fn_matches)
        var_matches = re.findall(r'\b(?:int|String|boolean|double|float|long|List|Map|Set)\s+(\w+)', code)
        variables.update(var_matches)
    elif language in ["cpp", "c++", "c"]:
        fn_matches = re.findall(r'\w[\w\s:*&]*\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{', code)
        functions.extend(fn_matches)
        var_matches = re.findall(r'\b(?:int|double|float|char|string|auto|vector|map|set)\s+(\w+)', code)
        variables.update(var_matches)

    # Filter out main methods
    functions = [f for f in functions if f not in ["main", "main.py", "anonymous"]]
    variables = [v for v in variables if len(v) > 1]

    return {
        "functions": functions,
        "variables": list(variables),
        "loops": loops,
        "conditionals": conditionals
    }

def generate_questions_llm(question_desc: str, code: str, language: str, api_key: str) -> list:
    """Call Google Gemini API to generate 2 code-specific, non-generic conceptual questions."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    prompt = f"""
You are an advanced technical interviewer evaluating a candidate's code submission.
Coding Task:
{question_desc}

Programming Language: {language}

Candidate's Code Submission:
```
{code}
```

Generate exactly 2 conceptual, follow-up questions for this candidate.
Guidelines:
1. The questions must be completely specific to the candidate's implementation logic.
2. Do NOT generate generic questions (like "What is the time complexity?" or "Explain how your code works").
3. Each question must target a specific variable, loop, conditional, data structure, or algorithm they chose in their code.
4. Point out potential bugs, trade-offs, edge-cases, or design choices in their code.
5. Format the output as a JSON array of strings containing exactly 2 questions. Example:
[
  "On line 8, you used a while loop to iterate over the input. What would happen if the input was empty, and how does your logic handle it?",
  "You chose to use a HashMap for lookup. Can you explain the trade-off of this memory overhead versus a binary search?"
]
"""

    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=8.0)
        if response.status_code == 200:
            data = response.json()
            text = data['candidates'][0]['content']['parts'][0]['text'].strip()
            
            # Extract JSON from markdown code block if present
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
                
            questions = json.loads(text)
            if isinstance(questions, list) and len(questions) > 0:
                return [{"questionText": q} for q in questions[:2]]
    except Exception as e:
        print(f"Error calling LLM API: {e}")
    
    return []

def generate_questions_ast(question_desc: str, code: str, language: str) -> list:
    """Generate tailored questions using AST/Regex parser fallback."""
    lang = language.lower().strip()
    
    if lang == "python":
        analysis = parse_python_code(code)
    else:
        analysis = parse_regex_code(code, lang)
        
    questions = []
    
    # 1. Ask about a specific function
    if analysis["functions"]:
        func = random.choice(analysis["functions"])
        questions.append({
            "questionText": f"In your implementation, explain the design choice behind the '{func}' function. How does it handle edge cases like null/empty inputs?",
            "contextCodeSnippet": f"function {func}"
        })
        
    # 2. Ask about a specific loop
    if analysis["loops"]:
        loop = random.choice(analysis["loops"])
        questions.append({
            "questionText": f"On line {loop['line']}, you used a '{loop['type']}' loop. What is the precise termination condition of this loop, and how could it be optimized?",
            "contextCodeSnippet": f"line {loop['line']}"
        })
        
    # 3. Ask about a specific variable
    if len(questions) < 2 and analysis["variables"]:
        var = random.choice(analysis["variables"])
        questions.append({
            "questionText": f"You defined the variable '{var}'. How is its value mutated, and does it represent an invariant state during execution?",
            "contextCodeSnippet": f"variable {var}"
        })
        
    # 4. Fallback if code is very short/unparseable
    while len(questions) < 2:
        if len(questions) == 0:
            questions.append({
                "questionText": "Looking at your code design, explain why you chose this specific approach over other potential design patterns or algorithms?",
                "contextCodeSnippet": "General implementation approach"
            })
        else:
            questions.append({
                "questionText": "If the size of the input elements scales to 1,000,000, how would your code perform in terms of time and space constraints?",
                "contextCodeSnippet": "Time/Space Scaling"
            })
            
    return questions[:2]

def generate_conceptual_questions(question_desc: str, code: str, language: str) -> list:
    """Entry point: try LLM first if API key is set, otherwise fallback to AST parser."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        try:
            dotenv_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
            if os.path.exists(dotenv_path):
                with open(dotenv_path, "r") as f:
                    for line in f:
                        if line.strip().startswith("GEMINI_API_KEY=") or line.strip().startswith("OPENAI_API_KEY="):
                            parts = line.split("=", 1)
                            if len(parts) == 2:
                                api_key = parts[1].strip()
                                if api_key:
                                    break
        except Exception:
            pass

    if api_key:
        questions = generate_questions_llm(question_desc, code, language, api_key)
        if questions:
            return questions
            
    return generate_questions_ast(question_desc, code, language)
