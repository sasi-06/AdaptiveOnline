const mongoose = require('mongoose');

const interviewDefinitionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  roles: [{ type: String }],
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  duration: { type: Number, default: 30 }, // in minutes
  numQuestions: { type: Number, default: 5 },
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  status: { type: String, enum: ['draft', 'active', 'completed', 'archived'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

interviewDefinitionSchema.index({ recruiter: 1, status: 1 });
interviewDefinitionSchema.index({ candidates: 1 });

module.exports = mongoose.model('InterviewDefinition', interviewDefinitionSchema);
