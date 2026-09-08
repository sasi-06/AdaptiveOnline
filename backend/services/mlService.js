const axios = require('axios');
const { computeFallbackScore } = require('../utils/featureExtractor');

const predictAuthenticity = async (features) => {
  try {
    const response = await axios.post(
      `${process.env.ML_SERVICE_URL || 'http://localhost:8000'}/predict`,
      features,
      { timeout: 8000 }
    );
    return response.data;
  } catch (error) {
    console.warn('⚠️  ML service unavailable, using fallback scoring...');
    return computeFallbackScore(features);
  }
};

const parseCodeLocal = (code, language) => {
  const lines = (code || '').split('\n');
  const functions = [];
  const variables = new Set();
  const loops = [];
  const conditions = [];
  const dataStructures = [];
  const returns = [];
  const recursiveCalls = new Set();
  const errorHandling = [];
  const lang = (language || '').toLowerCase().trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Detect loops
    if (/\b(for|while)\b/.test(line)) {
      loops.push({ type: line.includes('while') ? 'while' : 'for', line: lineNum, content: trimmed.slice(0, 60) });
    }

    // Detect conditionals
    if (/\b(if|elif|else if|switch)\b/.test(line)) {
      conditions.push({ line: lineNum, content: trimmed.slice(0, 60) });
    }

    // Detect data structures
    if (/(\[\]|{|}|\bdict\b|\bmap\b|\bHashMap\b|\bSet\b|\bList\b|\bStack\b|\bQueue\b|\bvector\b|\barray\b)/.test(line)) {
      dataStructures.push({ line: lineNum, content: trimmed.slice(0, 60) });
    }

    // Detect return statements
    if (/\breturn\b/.test(line)) {
      returns.push({ line: lineNum, content: trimmed.slice(0, 60) });
    }

    // Detect error handling
    if (/\b(try|catch|except|finally|raise|throw)\b/.test(line)) {
      errorHandling.push({ line: lineNum, content: trimmed.slice(0, 60) });
    }

    if (lang === 'python') {
      const fnMatch = line.match(/^\s*def\s+(\w+)\s*\(/);
      if (fnMatch) {
        functions.push({ name: fnMatch[1], line: lineNum });
        // Detect recursion
        if (lines.slice(i + 1).some(l => l.includes(fnMatch[1] + '('))) {
          recursiveCalls.add(fnMatch[1]);
        }
      }
      const varMatch = line.match(/^\s*(\w+)\s*=/);
      if (varMatch && varMatch[1].length > 1 && !/^[A-Z0-9_]+$/.test(varMatch[1]) && varMatch[1] !== 'self') {
        variables.add({ name: varMatch[1], line: lineNum });
      }
    } else if (['javascript', 'js', 'typescript', 'ts'].includes(lang)) {
      const fnMatch = line.match(/\b(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/);
      if (fnMatch) {
        const name = fnMatch[1] || fnMatch[2];
        if (name) {
          functions.push({ name, line: lineNum });
          if (lines.slice(i + 1).some(l => l.includes(name + '('))) recursiveCalls.add(name);
        }
      }
      const varMatch = line.match(/\b(?:let|const|var)\s+(\w+)\b/);
      if (varMatch) variables.add({ name: varMatch[1], line: lineNum });
    } else if (lang === 'java') {
      const fnMatch = line.match(/(?:public|private|protected|static)\s+\w[\w<>\[\]]*\s+(\w+)\s*\(/);
      if (fnMatch && fnMatch[1] !== 'main') {
        functions.push({ name: fnMatch[1], line: lineNum });
        if (lines.slice(i + 1).some(l => l.includes(fnMatch[1] + '('))) recursiveCalls.add(fnMatch[1]);
      }
      const varMatch = line.match(/\b(?:int|String|boolean|double|float|long|List|Map|Set|HashMap)\s+(\w+)\b/);
      if (varMatch) variables.add({ name: varMatch[1], line: lineNum });
    } else if (['cpp', 'c++', 'c'].includes(lang)) {
      const fnMatch = line.match(/\w[\w\s:*&]*\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{/);
      if (fnMatch && fnMatch[1] !== 'main') {
        functions.push({ name: fnMatch[1], line: lineNum });
        if (lines.slice(i + 1).some(l => l.includes(fnMatch[1] + '('))) recursiveCalls.add(fnMatch[1]);
      }
      const varMatch = line.match(/\b(?:int|double|float|char|string|auto|vector|map|set|unordered_map)\s+(\w+)\b/);
      if (varMatch) variables.add({ name: varMatch[1], line: lineNum });
    }
  }

  return {
    functions,
    variables: Array.from(variables).filter(v => v.name.length > 1),
    loops,
    conditions,
    dataStructures,
    returns,
    recursiveCalls: Array.from(recursiveCalls),
    errorHandling,
    totalLines: lines.length,
    codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#')).length,
  };
};

const generateLocalFallbackQuestions = (code, language, usedQuestions = new Set(), department = 'General', domainType = 'software') => {
  const parsed = parseCodeLocal(code, language);
  const { functions, variables, loops, conditions, dataStructures, returns, recursiveCalls, errorHandling, totalLines } = parsed;
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const questionPool = [];
  const lang = (language || '').toLowerCase();
  const dept = (department || '').toUpperCase();
  const domain = (domainType || '').toLowerCase();

  // ── 1. ECE DEPARTMENT & VERILOG / EMBEDDED C / CIRCUIT DOMAINS ─────────────
  if (dept === 'ECE' || lang === 'verilog' || lang === 'c_embedded' || domain === 'verilog' || domain === 'embedded_c' || domain === 'circuit_analysis') {
    if (lang === 'verilog' || domain === 'verilog') {
      questionPool.push({
        questionText: `In your Verilog HDL design, explain how setup and hold time constraints ($t_{setup}, t_{hold}$) are satisfied across clock edges. What happens if a metastability condition occurs on the reset signal?`,
        contextCodeSnippet: `Verilog Timing Analysis`
      });
      questionPool.push({
        questionText: `Walk through the sensitivity list of your \`always\` block. Why did you choose non-blocking (\`<=\`) vs blocking (\`=\`) assignments for your hardware registers?`,
        contextCodeSnippet: `Verilog Non-Blocking Assignment`
      });
      questionPool.push({
        questionText: `How does your HDL code prevent unwanted transparent latch generation? Explain why all conditional branches (\`if/else\` or \`case\`) must cover all possible input states.`,
        contextCodeSnippet: `Verilog Latch Avoidance`
      });
    }

    if (lang === 'c_embedded' || domain === 'embedded_c') {
      questionPool.push({
        questionText: `In your Embedded C firmware, explain how your GPIO register initialization configures pin directions and interrupt flags. What is the estimated interrupt latency of your ISR?`,
        contextCodeSnippet: `Embedded C GPIO/ISR`
      });
      questionPool.push({
        questionText: `Why did you use specific bitwise mask operations (\`|\`, \`&\`, \`~\`) to manipulate microcontroller register bits? How do you prevent atomic write race conditions during register writes?`,
        contextCodeSnippet: `Embedded C Bit Manipulation`
      });
    }

    questionPool.push({
      questionText: `For the ECE circuit schematic analyzed in this challenge, explain how component values (capacitors, resistors, op-amp feedback $R_f$) affect the frequency bandwidth, phase margin, or signal gain.`,
      contextCodeSnippet: `ECE Circuit & Frequency Response`
    });
  }

  // ── 2. EEE DEPARTMENT & POWER ELECTRONICS / MOTORS / CONTROL DOMAINS ────────
  if (dept === 'EEE' || domain === 'control_systems' || domain === 'power_electronics') {
    questionPool.push({
      questionText: `In the Power Electronics converter / circuit analyzed, explain how changing the switching frequency $f$ or duty cycle $D$ impacts inductor current ripple $\\Delta I_L$ and MOSFET switching losses.`,
      contextCodeSnippet: `EEE Power Converter Analysis`
    });
    questionPool.push({
      questionText: `What is the role of the freewheeling diode / snubbing circuit in protecting switching transistors against inductive back-EMF voltage spikes?`,
      contextCodeSnippet: `EEE Inductive Load Protection`
    });
    questionPool.push({
      questionText: `In the PID / Motor Control system, explain how adjusting the proportional gain $K_p$ vs integral gain $K_i$ affects steady-state error and overshoot damping.`,
      contextCodeSnippet: `EEE Control System Tuning`
    });
    questionPool.push({
      questionText: `Explain the phase angle relationship ($\\alpha$) and line vs phase current relations ($I_L = \\sqrt{3} I_{ph}$) in the 3-Phase load circuit analyzed.`,
      contextCodeSnippet: `EEE 3-Phase Power System`
    });
  }

  // ── 3. CSE & IT SOFTWARE / ALGORITHM DOMAINS ──────────────────────────────
  if (dept === 'CSE' || dept === 'IT' || domain === 'software') {
    // Function-specific
    if (functions.length > 0) {
      const fn = pickRandom(functions);
      questionPool.push({
        questionText: `Your function \`${fn.name}\` is defined on line ${fn.line}. Walk me through exactly what it does step by step, and explain how it handles edge cases like empty inputs or null values.`,
        contextCodeSnippet: `function: ${fn.name} (line ${fn.line})`
      });
      questionPool.push({
        questionText: `What is the asymptotic time complexity $O(N)$ of your \`${fn.name}\` function (line ${fn.line})? Could you achieve the same result with better Big-O performance?`,
        contextCodeSnippet: `function: ${fn.name} (line ${fn.line})`
      });
    }

    // Recursion
    if (recursiveCalls.length > 0) {
      const recFn = recursiveCalls[0];
      questionPool.push({
        questionText: `Your \`${recFn}\` function appears to be recursive. What is the base case that stops the recursion, and what happens if the input never reaches that base case?`,
        contextCodeSnippet: `recursive function: ${recFn}`
      });
    }

    // Loops
    if (loops.length > 0) {
      const loop = pickRandom(loops);
      questionPool.push({
        questionText: `On line ${loop.line} you used a \`${loop.type}\` loop. Precisely what is the termination condition of this loop, and what happens if that condition is never met?`,
        contextCodeSnippet: `${loop.type} loop at line ${loop.line}`
      });
    }

    // Variables
    if (variables.length > 0) {
      const v = pickRandom(Array.from(variables));
      questionPool.push({
        questionText: `You declared the variable \`${v.name}\` on line ${v.line}. Explain exactly what it stores, how its value changes throughout the execution, and why you chose that specific name for it.`,
        contextCodeSnippet: `variable: ${v.name} (line ${v.line})`
      });
    }
  }

  // ── 4. FALLBACK GENERAL QUESTIONS ───────────────────────────────────────────
  if (questionPool.length < 2) {
    questionPool.push({
      questionText: `Your solution is ${totalLines} lines long. Is there any part of this code or circuit design you feel could be simplified or refactored without changing the final output? Walk me through which section and why.`,
      contextCodeSnippet: `Total lines: ${totalLines}`
    });
    questionPool.push({
      questionText: `Without looking at the problem statement, describe what your implementation does in plain English as if you were explaining it to a non-technical peer. Start from the very first line.`,
      contextCodeSnippet: `Full code walkthrough`
    });
    questionPool.push({
      questionText: `What is the single most fragile or risky part of your solution — the part most likely to fail on an unexpected input or transient fault? How would you make it more robust?`,
      contextCodeSnippet: `Implementation robustness analysis`
    });
  }

  // Shuffle, then filter out any question already asked
  const shuffled = questionPool.sort(() => Math.random() - 0.5);
  const fresh = shuffled.filter(
    q => !usedQuestions.has(q.questionText.trim().toLowerCase())
  );

  const finalPool = fresh.length >= 2 ? fresh : shuffled;
  return finalPool.slice(0, 2);
};

const generateConceptualQuestions = async (
  questionDescription, code, language, usedQuestions = new Set(), department = 'General', domainType = 'software'
) => {
  try {
    const response = await axios.post(
      `${process.env.ML_SERVICE_URL || 'http://localhost:8001'}/generate-questions`,
      { question_description: questionDescription, code, language, department, domain_type: domainType },
      { timeout: 10000 }
    );
    const questions = response.data.questions || [];
    const fresh = questions.filter(
      q => !usedQuestions.has((q.questionText || '').trim().toLowerCase())
    );
    return fresh.length >= 2 ? fresh.slice(0, 2) : generateLocalFallbackQuestions(code, language, usedQuestions, department, domainType);
  } catch (error) {
    console.warn('⚠️ ML Service offline/error. Running department-aware AST fallback to generate dynamic questions...');
    return generateLocalFallbackQuestions(code, language, usedQuestions, department, domainType);
  }
};

module.exports = { predictAuthenticity, generateConceptualQuestions };
