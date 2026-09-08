const mongoose = require('mongoose');

const trainingDataSchema = new mongoose.Schema({
  session:   { type: mongoose.Schema.Types.ObjectId, ref: 'CodingSession', required: true },
  student:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  
  behavioralFeatures: {
    typing_speed:            { type: Number, default: 0 },
    average_pause_duration:  { type: Number, default: 0 },
    paste_ratio:             { type: Number, default: 0 },
    edit_frequency:          { type: Number, default: 0 },
    compile_attempts:        { type: Number, default: 0 },
    error_frequency:         { type: Number, default: 0 },
    code_growth_rate:        { type: Number, default: 0 },
    idle_ratio:              { type: Number, default: 0 },
    focus_loss_count:        { type: Number, default: 0 },
    off_screen_events_count: { type: Number, default: 0 },
    backspace_ratio:         { type: Number, default: 0 }
  },

  codeFeatures: {
    cyclomatic_complexity: { type: Number, default: 0 },
    logical_lines_of_code: { type: Number, default: 0 },
    halstead_effort:       { type: Number, default: 0 },
    halstead_bugs:         { type: Number, default: 0 }
  },

  humanLabel:   { type: String, enum: ['Genuine', 'Review Needed', 'Suspicious'], required: true },
  numericLabel: { type: Number, required: true }, // 2=Genuine, 1=Review Needed, 0=Suspicious
  mlLabel:      { type: String },
  mlScore:      { type: Number },
  wasCorrect:   { type: Boolean },
  
  language:        { type: String },
  testCasesPassed: { type: Number, default: 0 },
  totalTestCases:  { type: Number, default: 0 },
  finalScore:      { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TrainingData', trainingDataSchema);
