const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' }],
  status: { type: String, enum: ['draft', 'active', 'completed', 'archived'], default: 'active' },
  deadline: { type: Date },
  instructions: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

assessmentSchema.index({ recruiter: 1, status: 1 });
assessmentSchema.index({ candidates: 1 });

module.exports = mongoose.model('CodingAssessment', assessmentSchema);
