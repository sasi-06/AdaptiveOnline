const CodingSession = require('../models/CodingSession');
const { calculateJaccardSimilarity, findMatchingBlocks } = require('../services/plagiarismService');

/**
 * GET /api/plagiarism/matrix
 * Generates cross-candidate plagiarism matrix ONLY for students who took the SAME question/exam,
 * deduplicating multiple attempts per student so each candidate pair is compared exactly once.
 */
const getPlagiarismMatrix = async (req, res) => {
  try {
    const { questionId } = req.query;
    const filter = questionId ? { question: questionId } : {};

    const sessions = await CodingSession.find(filter)
      .populate('candidate', 'name email department')
      .populate('question', 'title')
      .sort({ createdAt: -1 })
      .lean();

    if (sessions.length < 2) {
      return res.json({ matrix: [], candidates: [], questions: [], message: 'At least 2 submissions are required to generate a similarity matrix.' });
    }

    // 1. Group sessions by Question ID, keeping ONLY the latest submission per student per question
    const groupedByQuestion = {};
    const questionListMap = {};

    sessions.forEach(s => {
      const qId = s.question?._id ? String(s.question._id) : (s.question || 'unknown');
      const qTitle = s.question?.title || 'Coding Question';
      const studentEmail = s.candidate?.email || s.student?.email || String(s.candidate || 'unknown');

      if (!groupedByQuestion[qId]) {
        groupedByQuestion[qId] = {};
        questionListMap[qId] = { id: qId, title: qTitle };
      }

      // Deduplicate: Keep latest attempt per student per question
      if (!groupedByQuestion[qId][studentEmail] && s.finalCode) {
        groupedByQuestion[qId][studentEmail] = {
          sessionId: s._id,
          studentId: s.candidate?._id || s.student?._id,
          name: s.candidate?.name || s.student?.name || 'Candidate',
          email: studentEmail,
          questionId: qId,
          questionTitle: qTitle,
          language: s.language || 'python',
          score: s.finalScore || 0,
          code: s.finalCode || ''
        };
      }
    });

    const matrix = [];
    let highRiskCount = 0;

    // 2. Perform pairwise comparison ONLY between distinct candidates of the SAME question
    Object.keys(groupedByQuestion).forEach(qId => {
      const candidates = Object.values(groupedByQuestion[qId]);
      
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const cA = candidates[i];
          const cB = candidates[j];

          // Skip if comparing same student against themselves
          if (cA.email === cB.email) continue;

          const similarity = calculateJaccardSimilarity(cA.code, cB.code, cA.language);
          let riskLevel = 'Low';
          if (similarity >= 75) { riskLevel = 'High'; highRiskCount++; }
          else if (similarity >= 40) { riskLevel = 'Medium'; }

          matrix.push({
            sessionA: cA.sessionId,
            candidateA: cA.name,
            emailA: cA.email,
            sessionB: cB.sessionId,
            candidateB: cB.name,
            emailB: cB.email,
            questionId: qId,
            questionTitle: cA.questionTitle,
            language: cA.language,
            similarityScore: similarity,
            riskLevel,
            codeA: cA.code,
            codeB: cB.code
          });
        }
      }
    });

    res.json({
      totalSubmissions: sessions.length,
      totalPairs: matrix.length,
      highRiskCount,
      questions: Object.values(questionListMap),
      matrix
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/plagiarism/compare
 * Side-by-side code diff analysis between two sessions
 */
const compareSessions = async (req, res) => {
  try {
    const { sessionAId, sessionBId } = req.body;
    const sessionA = await CodingSession.findById(sessionAId).populate('candidate question');
    const sessionB = await CodingSession.findById(sessionBId).populate('candidate question');

    if (!sessionA || !sessionB) {
      return res.status(404).json({ message: 'One or both sessions not found.' });
    }

    const similarityScore = calculateJaccardSimilarity(sessionA.finalCode, sessionB.finalCode, sessionA.language);
    const { matchesA, matchesB } = findMatchingBlocks(sessionA.finalCode, sessionB.finalCode);

    res.json({
      sessionA: {
        id: sessionA._id,
        candidateName: sessionA.candidate?.name || 'Candidate A',
        email: sessionA.candidate?.email,
        code: sessionA.finalCode,
        matches: matchesA
      },
      sessionB: {
        id: sessionB._id,
        candidateName: sessionB.candidate?.name || 'Candidate B',
        email: sessionB.candidate?.email,
        code: sessionB.finalCode,
        matches: matchesB
      },
      similarityScore,
      riskLevel: similarityScore >= 75 ? 'High' : similarityScore >= 40 ? 'Medium' : 'Low'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPlagiarismMatrix, compareSessions };
