const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    duration: { type: Number, default: 0 },  // in minutes
    total_questions: { type: Number, default: 0 },
    difficulty_distribution: {
        easy: { type: Number, default: 0 },
        medium: { type: Number, default: 0 },
        hard: { type: Number, default: 0 },
    },
    per_question_time: {
        easy: { type: Number, required: true },
        medium: { type: Number, required: true },
        hard: { type: Number, required: true },
    },
    assigned_students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    // Recruitment Drive Rounds
    rounds: {
        mcq: { type: Boolean, default: true },
        coding: { type: Boolean, default: false },
        simulation: { type: Boolean, default: false },
        technical: { type: Boolean, default: false },
    },
}, { timestamps: true });

module.exports = mongoose.model('Exam', ExamSchema);
