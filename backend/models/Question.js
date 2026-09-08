const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    question_text: { type: String, required: true },
    options: [{ type: String }],
    correct_answer: { type: String, required: true },
    topic: { type: String, required: true },
    concept: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'validation'], required: true },
    structure_type: { type: String, required: true },  // e.g., 'mcq', 'true_false', 'scenario', 'circuit_analysis'
    department: { type: String, enum: ['CSE', 'ECE', 'EEE', 'IT', 'General'], default: 'General' },
    circuit_diagram_url: { type: String, default: null },
    domain_type: { type: String, enum: ['mcq', 'circuit_analysis', 'true_false', 'scenario'], default: 'mcq' },
    marks: { type: Number, default: 1 },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Question', QuestionSchema);
