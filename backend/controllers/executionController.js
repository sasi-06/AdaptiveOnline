const { executeCode, runTestCases } = require('../services/executionService');
const { generateConceptualQuestions } = require('../services/mlService');
const CodingQuestion = require('../models/CodingQuestion');

// POST /api/coding/execute/conceptual
const generateConceptual = async (req, res) => {
  try {
    const { code, questionId, language } = req.body;
    const question = await CodingQuestion.findById(questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });
    
    const lang = language || question.language || 'python';
    const dept = question.department || 'General';
    const domain = question.domain_type || 'software';

    const questions = await generateConceptualQuestions(
      question.description, 
      code, 
      lang,
      new Set(),
      dept,
      domain
    );
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/coding/execute
const runCode = async (req, res) => {
  try {
    const { code, language, customInput, runType, questionId } = req.body;
    if (!code || !language) return res.status(400).json({ message: 'code and language are required' });

    if (runType === 'testcases') {
       if (!questionId) return res.status(400).json({ message: 'questionId required for testcases runType' });
       const question = await CodingQuestion.findById(questionId);
       if (!question) return res.status(404).json({ message: 'Question not found' });
       
       // Only run against public test cases for the frontend "Run Code"
       const publicTestCases = question.testCases.filter(tc => !tc.isHidden);
       const result = await runTestCases(code, language, publicTestCases);
       return res.json(result);
    } else {
       const result = await executeCode(code, language, customInput || '');
       return res.json(result);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { runCode, generateConceptual };
