const CodingAssessment = require('../models/CodingAssessment');

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
    await CodingAssessment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Assessment deleted' });
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
