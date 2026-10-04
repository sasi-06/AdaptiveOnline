const mongoose = require('mongoose');

const CadSubmissionSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    assessment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CadAssessment', required: true },
    question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CadQuestion', required: true },
    drawing_data: {
        objects: { type: Array, default: [] },
        layers: { type: Array, default: [] },
        viewport: { type: Object, default: {} }
    },
    preview_image: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
    time_spent: { type: Number, default: 0 },
    submitted_at: { type: Date }
}, { timestamps: true });

CadSubmissionSchema.index({ student_id: 1, assessment_id: 1, question_id: 1 }, { unique: true });

module.exports = mongoose.model('CadSubmission', CadSubmissionSchema);
