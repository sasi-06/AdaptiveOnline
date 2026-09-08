const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Analyze submitted code quality via the ML service /analyze-code endpoint.
 * Falls back to a lightweight rule-based scorer if ML service is unavailable.
 */
const analyzeCode = async (code, language, testCasesPassed = 0, totalTestCases = 0) => {
  try {
    const response = await axios.post(
      `${ML_URL}/analyze-code`,
      {
        code,
        language,
        test_cases_passed: testCasesPassed,
        total_test_cases:  totalTestCases,
      },
      { timeout: 10000 }
    );
    return response.data;
  } catch (err) {
    console.warn('⚠️  Code analysis service unavailable, using fallback...');
    return _fallbackCodeAnalysis(code, language, testCasesPassed, totalTestCases);
  }
};

/**
 * Simple rule-based fallback code analyzer (runs in Node.js when ML service is down).
 */
const _fallbackCodeAnalysis = (code, language, testCasesPassed, totalTestCases) => {
  const lines       = code.split('\n');
  const codeLines   = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#'));

  // Count basic structures
  const ifCount   = (code.match(/\bif\b/g) || []).length;
  const forCount  = (code.match(/\bfor\b/g) || []).length;
  const complexity = 1 + ifCount + forCount;

  // Detect functions
  const hasFunctions = /function\b|def\b|=>/.test(code);

  // Naming quality: average word length
  const words = code.match(/\b[a-z_][a-z0-9_]{2,}\b/gi) || [];
  const avgLen = words.reduce((s, w) => s + w.length, 0) / Math.max(words.length, 1);

  let quality = 50;
  if (hasFunctions)              quality += 15;
  if (avgLen >= 4)               quality += 12;
  if (commentLines.length > 0)   quality += 8;
  if (complexity <= 10)          quality += 5;
  if (codeLines.length < 3)      quality -= 20;

  const correctness = totalTestCases > 0 ? (testCasesPassed / totalTestCases) * 100 : 50;
  const codeQualityScore = Math.round(
    Math.min(100, Math.max(0, quality * 0.6 + correctness * 0.4))
  );

  return {
    syntax_error:       false,
    syntax_error_msg:   null,
    complexity,
    function_count:     hasFunctions ? 1 : 0,
    class_count:        0,
    has_functions:      hasFunctions,
    has_classes:        false,
    avg_name_length:    parseFloat(avgLen.toFixed(2)),
    good_naming:        avgLen >= 4,
    comment_ratio:      parseFloat((commentLines.length / Math.max(lines.length, 1)).toFixed(3)),
    total_lines:        lines.length,
    code_lines:         codeLines.length,
    nested_depth:       0,
    loop_count:         forCount,
    condition_count:    ifCount,
    return_count:       (code.match(/\breturn\b/g) || []).length,
    try_except_count:   (code.match(/\btry\b/g) || []).length,
    quality_score:      Math.round(Math.min(100, Math.max(0, quality))),
    code_quality_score: codeQualityScore,
  };
};

module.exports = { analyzeCode };
