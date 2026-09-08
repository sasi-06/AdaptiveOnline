const mongoose = require('mongoose');

const PinSchema = new mongoose.Schema({
    id:       { type: String, required: true },
    label:    { type: String },
    position: { x: Number, y: Number },
    electrical_type: { type: String, default: 'bidirectional' }
}, { _id: false });

const EditablePropSchema = new mongoose.Schema({
    key:        { type: String },
    label:      { type: String },
    input_type: { type: String },
    default:    mongoose.Schema.Types.Mixed,
    min:        Number,
    max:        Number,
    options:    [String],
    show_if:    String
}, { _id: false });

const ExpectedBehaviorSchema = new mongoose.Schema({
    type:             { type: String, required: true }, // gain_check | voltage_divider | rlc_analysis | boolean_logic
    formula:          { type: String },
    expected_gain:    { type: Number },
    expected_voltage: { type: Number },
    expected_freq:    { type: Number },
    tolerance_percent:{ type: Number, default: 5 }
}, { _id: false });

const CircuitQuestionSchema = new mongoose.Schema({
    title:            { type: String, required: true },
    description:      { type: String, required: true },
    topic:            { type: String, default: 'General' },
    difficulty:       { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    hint_text:        { type: String, default: '' },

    // Which component types students may use
    visible_palette:  [{ type: String }],

    // Max instances per type, e.g. { "op_amp": 1, "resistor": 5 }
    max_instances:    { type: Map, of: Number, default: {} },

    expected_behavior: { type: ExpectedBehaviorSchema, required: true },

    // Hidden reference solution (never sent to students)
    reference_solution: {
        components:  { type: mongoose.Schema.Types.Mixed },
        connections: { type: mongoose.Schema.Types.Mixed }
    },

    // The exam this question belongs to (optional — can be standalone)
    exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('CircuitQuestion', CircuitQuestionSchema);
