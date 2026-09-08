const mongoose = require('mongoose');

const codingSessionSchema = new mongoose.Schema({
  candidate:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  recruiter:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  question:   { type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion', required: true },
  language:   { type: String, enum: ['python', 'javascript', 'java', 'cpp', 'verilog', 'c_embedded'], required: true },
  status:     { type: String, enum: ['not_started', 'in_progress', 'submitted', 'evaluated'], default: 'not_started' },

  startTime:  { type: Date },
  endTime:    { type: Date },
  duration:   { type: Number }, // seconds

  finalCode:         { type: String, default: '' },
  testCasesPassed:   { type: Number, default: 0 },
  totalTestCases:    { type: Number, default: 0 },
  compilationAttempts: { type: Number, default: 0 },
  runtimeErrors:     { type: Number, default: 0 },
  executionTime:     { type: Number, default: 0 }, // ms
  memoryUsage:       { type: Number, default: 0 }, // KB

  // ML behavioral score
  authenticityScore: { type: Number, default: null },
  classification:    { type: String, enum: ['Genuine', 'Review Needed', 'Suspicious'], default: null },
  confidence:        { type: Number, default: null },
  riskLevel:         { type: String, enum: ['Low', 'Medium', 'High'], default: null },

  // Code quality score (from AST analysis)
  codeQualityScore:  { type: Number, default: null },

  // Combined final score (behavioral 40% + code quality 35% + test cases 25%)
  finalScore:        { type: Number, default: null },

  // Human-verified label (set by recruiter during review — used as ML training label)
  humanLabel:        { type: String, enum: ['Genuine', 'Review Needed', 'Suspicious'], default: null },

  // Recruiter review
  recruiterNotes:    { type: String, default: '' },

  // Dynamic AI-Generated Questions
  aiGeneratedQuestions: [
    {
      questionText: { type: String, required: true },
      contextCodeSnippet: { type: String, default: '' }
    }
  ],
  conceptualAnswers: [
    {
      questionText: { type: String, required: true },
      candidateAnswer: { type: String, default: '' },
      aiFeedback: { type: String, default: '' },
      score: { type: Number, default: null }
    }
  ],

  reportGenerated:   { type: Boolean, default: false },
  reportPath:        { type: String, default: '' },

  // ── Paste & Keystroke Telemetry (stored for Admin AI modal) ──
  totalPasteCount:      { type: Number, default: 0 },  // number of paste events
  totalPasteChars:      { type: Number, default: 0 },  // actual characters pasted
  totalKeystrokes:      { type: Number, default: 0 },  // total keys typed
  totalTabSwitches:     { type: Number, default: 0 },  // focus loss / tab switch count
  totalOffScreenEvents: { type: Number, default: 0 },  // gaze off-screen events
  totalAudioNoiseEvents:{ type: Number, default: 0 },  // audio volume spikes
  totalSpeechDetectedEvents:{ type: Number, default: 0 }, // speech / voice detected events
  headMovementIntensity:{ type: Number, default: 0 },  // accumulated head / body movement delta
  candidateSnapshot:    { type: String, default: '' }, // candidate initial photo snapshot
  eyeDeviationDegrees:  { type: Number, default: 0 },  // eye gaze deviation angle in degrees
  headMovementDegrees:  { type: Number, default: 0 },  // head rotation deviation angle in degrees
  faceScale:            { type: Number, default: 0.2 },// face scale in video frame
  lineOrigins:          [{ lineNumber: Number, type: { type: String, enum: ['typed', 'edited', 'pasted'] } }], // line-by-line authenticity heatmap
  features:             { type: mongoose.Schema.Types.Mixed, default: {} }, // full ML feature vector

  createdAt:         { type: Date, default: Date.now },
  updatedAt:         { type: Date, default: Date.now },
});

module.exports = mongoose.model('CodingSession', codingSessionSchema);
