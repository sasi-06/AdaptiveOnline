const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  interview: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewDefinition', required: true },
  selectedRole: { type: String, default: '' },
  status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
  totalQuestionsConfigured: { type: Number, default: 5 },
  
  // Extracted from Resume
  resumeText: { type: String, default: '' },
  extractedData: { type: Object, default: {} }, // skills, projects, experience
  
  // Q&A
  qa_pairs: [{
      question: String,
      expectedAnswer: String,
      answer: String,
      score: Number,
      feedback: String,
      timeTaken: Number
  }],
  
  // Cheating incidents
  cheatingClips: [{
    videoUrl: String,
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Final Evaluation
  finalScore: { type: Number, default: 0 },
  report: {
    strengths: [String],
    weaknesses: [String],
    suggestions: [String],
    hiringRecommendation: String
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
