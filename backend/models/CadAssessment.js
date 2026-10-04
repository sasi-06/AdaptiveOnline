const mongoose = require('mongoose');

const CadAssessmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    instructions: { type: String, default: '' },
    total_questions: { type: Number, default: 0 },
    duration: { type: Number, default: 60 }, // in minutes
    cad_level: { 
        type: String, 
        enum: ['Level 1 — Basic', 'Level 2 — Intermediate', 'Level 3 — Advanced'],
        default: 'Level 1 — Basic' 
    },
    category: { type: String, default: 'Civil Engineering Assessments' },
    assessment_type: { type: String, default: 'AutoCAD / 2D Drawing Assessment' },
    assigned_students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CadQuestion' }],
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

CadAssessmentSchema.index({ assigned_students: 1 });

module.exports = mongoose.model('CadAssessment', CadAssessmentSchema);
