const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    score: { type: Number, default: 0 },
    total_marks: { type: Number, default: 0 },
    answers: [
        {
            question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
            selected_option: String,
            is_correct: Boolean,
            marks_awarded: Number,
            time_taken: { type: Number, default: 0 }, // in seconds
        }
    ],
    behaviorRiskSummary: {
        average_risk: { type: Number, default: 0 },
        max_risk: { type: Number, default: 0 },
        flagged_count: { type: Number, default: 0 },
    },
}, { timestamps: true });

module.exports = mongoose.model('Result', ResultSchema);
