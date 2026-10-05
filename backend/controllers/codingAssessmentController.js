const CodingAssessment = require('../models/CodingAssessment');
const CodingQuestion = require('../models/CodingQuestion');
const CodingSession = require('../models/CodingSession');
const BehaviorLog = require('../models/BehaviorLog');
const Alert = require('../models/Alert');
const TelemetryLog = require('../models/TelemetryLog');
const MLPrediction = require('../models/MLPrediction');
const Result = require('../models/Result');
const mongoose = require('mongoose');

// GET /api/coding/assessments
const getAssessments = async (req, res) => {
  try {
    const assessments = await CodingAssessment.find()
      .populate('recruiter', 'name email')
      .populate('candidates', 'name email rollno')
      .populate('questions')
      .sort({ createdAt: -1 });
    res.json(assessments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/coding/assessments
const createAssessment = async (req, res) => {
  try {
    const { title, instructions, deadline } = req.body;
    const assessment = await CodingAssessment.create({
      title,
      instructions,
      deadline,
      recruiter: req.admin._id
    });
    res.status(201).json(assessment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/coding/assessments/assign
const assignAssessment = async (req, res) => {
  try {
    const { assessmentId, studentIds } = req.body;
    const assessment = await CodingAssessment.findById(assessmentId);
    
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Append new studentIds avoiding duplicates
    const existingIds = assessment.candidates.map(id => id.toString());
    studentIds.forEach(id => {
      if (!existingIds.includes(id)) {
        assessment.candidates.push(id);
      }
    });

    await assessment.save();
    res.json({ message: 'Students assigned successfully', assessment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/coding/assessments/:id/questions
const updateAssessmentQuestions = async (req, res) => {
  try {
    const { questionIds } = req.body;
    const assessment = await CodingAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    assessment.questions = questionIds;
    await assessment.save();
    
    res.json({ message: 'Questions updated successfully', assessment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/coding/assessments/:id
const deleteAssessment = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const idListStr = [String(assessmentId)];
    const idListObj = mongoose.Types.ObjectId.isValid(assessmentId) ? [new mongoose.Types.ObjectId(assessmentId)] : [];
    const idListAll = [...idListStr, ...idListObj];

    const assessment = await CodingAssessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: 'Coding Assessment not found' });
    }

    const questionIds = (assessment.questions || []).map(q => q.toString());
    const questionObjIds = questionIds
      .filter(q => mongoose.Types.ObjectId.isValid(q))
      .map(q => new mongoose.Types.ObjectId(q));
    const allQuestionIds = [...questionIds, ...questionObjIds];

    // Find all coding sessions tied to questions in this assessment
    let sessionIds = [];
    if (allQuestionIds.length > 0) {
      const sessions = await CodingSession.find({ question: { $in: allQuestionIds } }).select('_id');
      sessionIds = sessions.map(s => s._id);
    }
    const sessionIdsStr = sessionIds.map(s => s.toString());

    // 1. Delete associated Coding Sessions (student attempts, evaluation results, code, scores)
    if (allQuestionIds.length > 0) {
      await CodingSession.deleteMany({ question: { $in: allQuestionIds } });
    }

    // 2. Delete associated behavior logs
    await BehaviorLog.deleteMany({ exam_id: { $in: idListStr } });

    // 3. Delete associated alerts
    await Alert.deleteMany({ exam_id: { $in: idListStr } });

    // 4. Delete associated telemetry logs
    await TelemetryLog.deleteMany({
      $or: [
        { session: { $in: [...sessionIds, ...sessionIdsStr] } },
        { exam_id: { $in: idListStr } },
        { assessmentId: { $in: idListStr } }
      ]
    });

    // 5. Delete ML predictions
    if (sessionIds.length > 0) {
      await MLPrediction.deleteMany({
        $or: [
          { session: { $in: [...sessionIds, ...sessionIdsStr] } },
          { assessmentId: { $in: idListStr } }
        ]
      });
    }

    // 6. Delete general results if any
    await Result.deleteMany({ exam_id: { $in: idListStr } });

    // 7. Delete the CodingAssessment itself
    await CodingAssessment.findByIdAndDelete(assessmentId);

    res.json({ message: 'Coding Assessment and all corresponding data (sessions, results, logs) deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAssessments,
  createAssessment,
  assignAssessment,
  updateAssessmentQuestions,
  deleteAssessment
};
