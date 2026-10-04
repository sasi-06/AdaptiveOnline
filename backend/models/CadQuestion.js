const mongoose = require('mongoose');

const CadQuestionSchema = new mongoose.Schema({
    assessment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CadAssessment', required: true },
    question_text: { type: String, required: true },
    instructions: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    image_url: { type: String, default: '' },
    marks: { type: Number, default: 10 },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

CadQuestionSchema.index({ assessment_id: 1 });

module.exports = mongoose.model('CadQuestion', CadQuestionSchema);
