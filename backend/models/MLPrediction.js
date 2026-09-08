const mongoose = require('mongoose');

const mlPredictionSchema = new mongoose.Schema({
  session:   { type: mongoose.Schema.Types.ObjectId, ref: 'CodingSession', required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },

  // Behavioral feature vector (11 features)
  features: {
    typing_speed:            Number,
    average_pause_duration:  Number,
    paste_ratio:             Number,
    edit_frequency:          Number,
    compile_attempts:        Number,
    error_frequency:         Number,
    code_growth_rate:        Number,
    idle_ratio:              Number,
    focus_loss_count:        Number,
    off_screen_events_count: Number,
    backspace_ratio:         Number,
  },

  // Behavioral ML output
  authenticityScore: { type: Number, required: true },
  classification:    { type: String, enum: ['Genuine', 'Review Needed', 'Suspicious'] },
  confidence:        { type: Number },
  riskLevel:         { type: String, enum: ['Low', 'Medium', 'High'] },
  featureImportance: { type: mongoose.Schema.Types.Mixed },

  // Code analysis (AST-based)
  codeAnalysis: {
    syntax_error:       { type: Boolean, default: false },
    syntax_error_msg:   { type: String },
    complexity:         { type: Number },
    function_count:     { type: Number },
    class_count:        { type: Number },
    has_functions:      { type: Boolean },
    has_classes:        { type: Boolean },
    avg_name_length:    { type: Number },
    good_naming:        { type: Boolean },
    comment_ratio:      { type: Number },
    total_lines:        { type: Number },
    code_lines:         { type: Number },
    nested_depth:       { type: Number },
    loop_count:         { type: Number },
    condition_count:    { type: Number },
    return_count:       { type: Number },
    try_except_count:   { type: Number },
    quality_score:      { type: Number },
    code_quality_score: { type: Number },
  },

  // Combined final score (behavioral 40% + code quality 35% + test cases 25%)
  finalScore: { type: Number },

  alerts: [{
    type:     { type: String },
    severity: String,
    message:  String,
  }],

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MLPrediction', mlPredictionSchema);
