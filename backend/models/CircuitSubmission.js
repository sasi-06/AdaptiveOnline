const mongoose = require('mongoose');

// Mirrors Section 4 of the master prompt exactly
const ComponentSchema = new mongoose.Schema({
    comp_id:    { type: String, required: true },
    type:       { type: String, required: true },
    properties: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    position:   { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
    rotation:   { type: Number, default: 0 }  // degrees: 0 | 90 | 180 | 270
}, { _id: false });

const ConnectionEndpointSchema = new mongoose.Schema({
    comp_id: { type: String, required: true },
    pin:     { type: String, required: true }
}, { _id: false });

const ConnectionSchema = new mongoose.Schema({
    id:   { type: String },
    from: { type: ConnectionEndpointSchema, required: true },
    to:   { type: ConnectionEndpointSchema, required: true }
}, { _id: false });

const IssueSchema = new mongoose.Schema({
    type:               { type: String }, // topology | component_value | missing_ground | wrong_component | floating_pin
    component_involved: { type: String },
    explanation:        { type: String }
}, { _id: false });

const EvaluationSchema = new mongoose.Schema({
    score:                      { type: Number, min: 0, max: 100 },
    verdict:                    { type: String, enum: ['correct', 'partially_correct', 'incorrect'] },
    summary:                    { type: String },
    issues_found:               [IssueSchema],
    feedback_for_student:       { type: String },
    concepts_to_review:         [String],
    ml_confidence:              { type: Number },
    shap_explanation:           { type: mongoose.Schema.Types.Mixed },
    viva_questions:             { type: [mongoose.Schema.Types.Mixed] },
    model_votes:                { type: mongoose.Schema.Types.Mixed },
    disagreement_flag:          { type: Boolean, default: false },
    instructor_review_required: { type: Boolean, default: false },
    sim_result: {
        engine:         { type: String },
        measured_gain:  { type: Number },
        output_voltage: { type: Number },
        status:         { type: String }
    },
    evaluated_at: { type: Date }
}, { _id: false, strict: false });

const CircuitSubmissionSchema = new mongoose.Schema({
    submission_id:  { type: String, unique: true, sparse: true },
    student_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    question_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'CircuitQuestion', required: true },
    exam_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },

    components:     [ComponentSchema],
    connections:    [ConnectionSchema],

    status:         { type: String, enum: ['draft', 'submitted', 'evaluated'], default: 'draft' },
    evaluation:     { type: EvaluationSchema },

    submitted_at:   { type: Date },
    attempt_number: { type: Number, default: 1 }
}, { timestamps: true });

// Compound index: one draft per student per question
CircuitSubmissionSchema.index({ student_id: 1, question_id: 1 });

module.exports = mongoose.model('CircuitSubmission', CircuitSubmissionSchema);
