/**
 * plagiarismService.js
 * AST Tokenization & Cross-Candidate Code Similarity Engine
 */

/**
 * Normalize source code into generic AST-like token stream
 * Replaces variable names, function names, and literals with generic placeholders.
 */
const tokenizeCode = (code, language = 'python') => {
  if (!code) return [];
  let c = code;

  // Remove single line & multi-line comments
  c = c.replace(/\/\/*.*$/gm, '');
  c = c.replace(/#.*$/gm, '');
  c = c.replace(/\/\*[\s\S]*?\*\//g, '');

  // Normalize string and numeric literals
  c = c.replace(/["'](?:\\.|[^"'\\])*["']/g, 'STR_LIT');
  c = c.replace(/\b\d+(?:\.\d+)?\b/g, 'NUM_LIT');

  // Tokenize keywords & identifiers
  const tokens = c.match(/\b[a-zA-Z_]\w*\b|[{}()\[\];,+\-*\/%=<>!&|]/g) || [];

  // Keywords set for normalization
  const keywords = new Set([
    'def', 'function', 'class', 'return', 'if', 'else', 'elif', 'for', 'while',
    'import', 'from', 'as', 'try', 'except', 'catch', 'finally', 'const', 'let',
    'var', 'public', 'private', 'static', 'void', 'int', 'float', 'double', 'char',
    'bool', 'boolean', 'always', 'module', 'endmodule', 'assign', 'input', 'output',
    'reg', 'wire', 'begin', 'end', 'case', 'endcase'
  ]);

  const normalized = tokens.map(t => {
    if (keywords.has(t)) return t.toUpperCase();
    if (/^[a-zA-Z_]\w*$/.test(t)) return 'VAR_ID';
    return t;
  });

  return normalized;
};

/**
 * Generate N-grams (shingles) from token array
 */
const getNgrams = (tokens, n = 4) => {
  const nGrams = new Set();
  for (let i = 0; i <= tokens.length - n; i++) {
    const shingle = tokens.slice(i, i + n).join(' ');
    nGrams.add(shingle);
  }
  return nGrams;
};

/**
 * Jaccard Similarity Index: Intersection / Union of N-grams (0.0 to 1.0)
 */
const calculateJaccardSimilarity = (codeA, codeB, language = 'python') => {
  const tokensA = tokenizeCode(codeA, language);
  const tokensB = tokenizeCode(codeB, language);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = getNgrams(tokensA, 4);
  const setB = getNgrams(tokensB, 4);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  const similarity = union > 0 ? (intersection / union) * 100 : 0;
  return parseFloat(similarity.toFixed(1));
};

/**
 * Find matching code blocks between two code strings for side-by-side diff
 */
const findMatchingBlocks = (codeA, codeB) => {
  const linesA = (codeA || '').split('\n');
  const linesB = (codeB || '').split('\n');
  const matchesA = new Set();
  const matchesB = new Set();

  linesA.forEach((lA, idxA) => {
    const trimmedA = lA.trim();
    if (trimmedA.length > 10) {
      linesB.forEach((lB, idxB) => {
        if (lB.trim() === trimmedA) {
          matchesA.add(idxA);
          matchesB.add(idxB);
        }
      });
    }
  });

  return { matchesA: Array.from(matchesA), matchesB: Array.from(matchesB) };
};

module.exports = {
  tokenizeCode,
  calculateJaccardSimilarity,
  findMatchingBlocks
};
