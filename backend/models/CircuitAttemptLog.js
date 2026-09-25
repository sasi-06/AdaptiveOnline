const mongoose = require('mongoose');

const CircuitAttemptLogSchema = new mongoose.Schema({
    student_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    question_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'CircuitQuestion' },
    submitted_at:   { type: Date, default: Date.now },

    // Raw circuit (stored for graph retraining)
    components:     { type: Array, required: true },
    connections:    { type: Array, required: true },

    // Physics-based ground truth (from rule engine — always reliable)
    score_label:    { type: Number, min: 0, max: 100 },
    verdict_label:  { type: Number, enum: [0, 1, 2] },  // 0: incorrect, 1: partial, 2: correct

    // Behavior signals
    time_spent_sec: { type: Number, default: 0 },
    n_deletes:      { type: Number, default: 0 },
    n_moves:        { type: Number, default: 0 },

    // Agent output (for drift monitoring)
    ml_score:       { type: Number },
    ml_confidence:  { type: Number },
    engine_used:    { type: String },

    // Multi-model disagreement flag
    disagreement_flag: { type: Boolean, default: false },

    // Instructor override (optional manual correction)
    human_score:    { type: Number, default: null },
    human_verified: { type: Boolean, default: false }
}, { timestamps: true });

CircuitAttemptLogSchema.index({ student_id: 1, question_id: 1 });

module.exports = mongoose.model('CircuitAttemptLog', CircuitAttemptLogSchema);
