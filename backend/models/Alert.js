const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingSession', required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  type: {
    type: String,
    enum: [
      'large_paste',
      'excessive_idle',
      'tab_switch',
      'instant_solution',
      'rapid_compile',
      'focus_loss',
      'suspicious_pattern',
      'off_screen_gaze',
      'camera_denied',
    ],
    required: true,
  },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  message: { type: String, required: true },
  timestamp: { type: Number }, // ms since session start
  acknowledged: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Alert', alertSchema);
