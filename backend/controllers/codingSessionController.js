const CodingSession = require('../models/CodingSession');
const CodingQuestion = require('../models/CodingQuestion');
const CodingAssessment = require('../models/CodingAssessment');
const Student = require('../models/Student');

const TelemetryLog = require('../models/TelemetryLog');
const MLPrediction = require('../models/MLPrediction');
const Alert = require('../models/Alert');

const { extractFeatures, detectAlerts } = require('../utils/featureExtractor');
const { predictAuthenticity, generateConceptualQuestions } = require('../services/mlService');
const { analyzeCode } = require('../services/codeAnalysisService');
const { runTestCases } = require('../services/executionService');
const { generateReport } = require('../services/pdfService');

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const computeFinalScore = (authenticityScore, codeQualityScore, testCasesPassed, totalTestCases) => {
  const testScore = totalTestCases > 0 ? (testCasesPassed / totalTestCases) * 100 : 50;
  const combined  = authenticityScore * 0.40 + codeQualityScore * 0.35 + testScore * 0.25;
  return Math.round(Math.min(100, Math.max(0, combined)));
};

// ─── POST /api/coding/sessions/start ─────────────────────────────────────────────────
const startSession = async (req, res) => {
  try {
    const { questionId, language } = req.body;
    const studentId = req.student ? req.student._id : req.user.id;

    const existing = await CodingSession.findOne({
      candidate: studentId,
      question:  questionId,
      status:    { $in: ['submitted', 'evaluated'] },
    });
    if (existing) {
      return res.status(403).json({ message: 'You have already completed an assessment for this question.' });
    }

    const question = await CodingQuestion.findById(questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const session = await CodingSession.create({
      candidate:      studentId,
      question:       questionId,
      language,
      status:         'in_progress',
      startTime:      new Date(),
      totalTestCases: question.testCases.length,
    });

    await TelemetryLog.create({ session: session._id, candidate: studentId, events: [] });

    res.status(201).json({ session, starterCode: question.starterCode[language] || '' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/coding/sessions/:id/submit ────────────────────────────────────────────
const submitSession = async (req, res) => {
  try {
    const { code, conceptualAnswers, telemetryData } = req.body;
    const session = await CodingSession.findById(req.params.id).populate('question candidate');
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const endTime  = new Date();
    const duration = Math.round((endTime - session.startTime) / 1000);
    const question = session.question;

    const { results, passed } = await runTestCases(code, session.language, question.testCases);
    
    // ── 2. Get telemetry & extract behavioral features ──
    const dbTelemetryDoc = await TelemetryLog.findOne({ session: session._id });
    const dbObj = dbTelemetryDoc ? dbTelemetryDoc.toObject() : {};

    const telemetry = {
      ...dbObj,
      totalCharsTyped: Math.max(dbObj.totalCharsTyped || 0, telemetryData?.totalKeystrokes || 0),
      totalKeystrokes: Math.max(dbObj.totalKeystrokes || 0, telemetryData?.totalKeystrokes || 0),
      totalPasteCount: Math.max(dbObj.totalPasteCount || 0, telemetryData?.totalPasteCount || 0),
      totalPasteChars: Math.max(dbObj.totalPasteChars || 0, telemetryData?.totalPasteChars || (telemetryData?.totalPasteCount || 0) * 50),
      totalBlurEvents: Math.max(dbObj.totalBlurEvents || 0, telemetryData?.totalTabSwitches || 0),
      totalOffScreenEvents: dbObj.totalOffScreenEvents || 0,
      totalAudioNoiseEvents: dbObj.totalAudioNoiseEvents || 0,
      totalSpeechDetectedEvents: dbObj.totalSpeechDetectedEvents || 0,
      headMovementIntensity: dbObj.headMovementIntensity || 0,
      compilationCount: Math.max(dbObj.compilationCount || 0, telemetryData?.compilationCount || 0),
      averagePause: telemetryData?.averagePause || dbObj.averagePause || 0,
      keypressIntervals: dbObj.keypressIntervals || [],
      keystrokeBurstiness: dbObj.keystrokeBurstiness ?? null,
      events: dbObj.events || [],
    };
    const features = extractFeatures(telemetry, duration);

    // ── 3. Behavioral ML prediction & Code Analysis (parallel) ──
    const [prediction, codeAnalysis] = await Promise.all([
      predictAuthenticity(features),
      analyzeCode(code, session.language, passed, question.testCases.length),
    ]);

    // ── 4. Detect rule-based alerts ──
    const alerts = detectAlerts(telemetry || {});

    // ── 5. Compute combined final score ──
    const codeQualityScore = codeAnalysis.code_quality_score || 50;
    const finalScore = computeFinalScore(
      prediction.authenticityScore,
      codeQualityScore,
      passed,
      question.testCases.length
    );

    // ── 6. Save ML prediction ──
    const mlPrediction = await MLPrediction.create({
      session:   session._id,
      candidate: session.candidate._id,
      features: {
        ...features,
        off_screen_events_count: features.off_screen_events_count || 0,
      },
      authenticityScore: prediction.authenticityScore,
      classification:    prediction.classification,
      confidence:        prediction.confidence,
      riskLevel:         prediction.riskLevel,
      featureImportance: prediction.featureImportance || {},
      codeAnalysis,
      finalScore,
      alerts: Array.isArray(alerts) ? alerts : [],
    });

    // ── 7. Save behavioral alerts ──
    for (const alert of alerts) {
      await Alert.create({
        session:   session._id,
        candidate: session.candidate._id,
        ...alert,
        timestamp: duration * 1000,
      });
    }

    session.status              = 'submitted';
    session.endTime             = endTime;
    session.duration            = duration;
    session.finalCode           = code;
    session.testCasesPassed     = passed;
    session.compilationAttempts = telemetry?.compilationCount || 0;
    session.runtimeErrors       = telemetry?.errorCount       || 0;
    session.authenticityScore   = prediction.authenticityScore;
    session.classification      = prediction.classification;
    session.confidence          = prediction.confidence;
    session.riskLevel           = prediction.riskLevel;
    session.codeQualityScore    = codeQualityScore;
    session.finalScore          = finalScore;
    session.updatedAt           = new Date();
    // ── Save paste, audio, head motion & keystroke telemetry for Admin AI modal ──
    session.totalPasteCount     = telemetry?.totalPasteCount   || 0;
    session.totalPasteChars     = telemetry?.totalPasteChars   || 0;
    session.totalKeystrokes     = telemetry?.totalCharsTyped   || 0;
    session.totalTabSwitches    = telemetry?.totalBlurEvents   || 0;
    session.totalOffScreenEvents = features?.off_screen_events_count || 0;
    session.totalAudioNoiseEvents = telemetry?.totalAudioNoiseEvents || 0;
    session.totalSpeechDetectedEvents = telemetry?.totalSpeechDetectedEvents || 0;
    session.headMovementIntensity = dbObj?.headMovementIntensity || 0;
    session.candidateSnapshot    = dbObj?.candidateSnapshot || telemetryData?.candidateSnapshot || '';
    session.eyeDeviationDegrees  = dbObj?.eyeDeviationDegrees || 0;
    session.headMovementDegrees  = dbObj?.headMovementDegrees || 0;
    session.faceScale            = dbObj?.faceScale || 0.2;
    session.features            = features; // store full feature vector for SHAP display

    // ── Build Line-by-Line Code Authenticity Heatmap ───────────────────
    const codeLines = (code || '').split('\n');
    const pastedLinesSet = new Set(telemetryData?.pastedLineNumbers || []);
    const editedLinesSet = new Set(telemetryData?.editedLineNumbers || []);
    const pasteCount = telemetry?.totalPasteCount || 0;

    const lineOrigins = codeLines.map((lineText, idx) => {
      const lineNum = idx + 1;
      let type = 'typed';
      if (pastedLinesSet.has(lineNum)) {
        type = 'pasted';
      } else if (editedLinesSet.has(lineNum)) {
        type = 'edited';
      }
      return { lineNumber: lineNum, type };
    });
    session.lineOrigins = lineOrigins;

    if (conceptualAnswers && Array.isArray(conceptualAnswers)) {
      session.conceptualAnswers = conceptualAnswers.map(ans => ({
        questionText: ans.questionText,
        candidateAnswer: ans.candidateAnswer || '',
        aiFeedback: (ans.candidateAnswer || '').trim().length > 30 
          ? "Detailed explanation provided. Awaiting evaluator verification."
          : "Short response provided. Review recommended.",
        score: null
      }));
    }

    await session.save();

    // ── 9. Generate PDF report ──
    const student = await Student.findById(session.candidate._id);
    const { filename } = await generateReport(session, telemetry, mlPrediction, student, question);
    session.reportPath      = filename;
    session.reportGenerated = true;
    await session.save();

    res.json({
      session,
      testResults:    results,
      prediction,
      codeAnalysis,
      finalScore,
      reportFilename: filename,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMySessions = async (req, res) => {
  try {
    const studentId = req.student ? req.student._id : req.user.id;
    const sessions = await CodingSession.find({ candidate: studentId })
      .populate('question', 'title difficulty tags')
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSession = async (req, res) => {
  try {
    const session = await CodingSession.findById(req.params.id)
      .populate('question candidate', 'title difficulty tags name email');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const startSessionFromAssessment = async (req, res) => {
  try {
    const { assessmentId, questionId, language } = req.body;
    const studentId = req.student ? req.student._id : req.user.id;

    if (!assessmentId || !questionId || !language) {
      return res.status(400).json({ message: 'assessmentId, questionId, and language are required' });
    }

    const existing = await CodingSession.findOne({
      candidate: studentId,
      question:  questionId,
      status:    { $in: ['submitted', 'evaluated'] },
    });
    if (existing) return res.status(403).json({ message: 'Already completed this question' });

    const question = await CodingQuestion.findById(questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const session = await CodingSession.create({
      candidate:      studentId,
      question:       questionId,
      language,
      status:         'in_progress',
      startTime:      new Date(),
      totalTestCases: question.testCases.length,
    });

    await TelemetryLog.create({ session: session._id, candidate: studentId, events: [] });

    res.status(201).json({
      session,
      starterCode: question.starterCode[language] || '',
      question: {
        id:          question._id,
        title:       question.title,
        description: question.description,
        examples:    question.examples,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllSessions = async (req, res) => {
  try {
    const sessions = await CodingSession.find({})
      .populate('question', 'title difficulty tags')
      .populate('candidate', 'name email')
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  startSession, submitSession, getMySessions, getSession, startSessionFromAssessment, getAllSessions
};
