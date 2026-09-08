const mongoose = require('mongoose');

const telemetryLogSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingSession', required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  events: [
    {
      type: { type: String, required: true }, // keypress, paste, blur, focus, compile, etc.
      timestamp: { type: Number, required: true }, // ms since session start
      data: { type: mongoose.Schema.Types.Mixed }, // event-specific payload
    },
  ],
  // Aggregated feature snapshot (updated in real-time)
  totalKeystrokes: { type: Number, default: 0 },
  totalCharsTyped: { type: Number, default: 0 },
  totalPasteCount: { type: Number, default: 0 },
  totalPasteChars: { type: Number, default: 0 },
  totalBackspaces: { type: Number, default: 0 },
  totalTabSwitches: { type: Number, default: 0 },
  totalBlurEvents: { type: Number, default: 0 },
  totalOffScreenEvents: { type: Number, default: 0 },
  totalAudioNoiseEvents: { type: Number, default: 0 },
  totalSpeechDetectedEvents: { type: Number, default: 0 },
  headMovementIntensity: { type: Number, default: 0 },
  candidateSnapshot: { type: String, default: '' },
  eyeDeviationDegrees: { type: Number, default: 0 },
  headMovementDegrees: { type: Number, default: 0 },
  faceScale: { type: Number, default: 0.2 },
  totalIdleTime: { type: Number, default: 0 }, // ms
  totalActiveTime: { type: Number, default: 0 }, // ms
  compilationCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  longestPause: { type: Number, default: 0 }, // ms
  averagePause: { type: Number, default: 0 }, // ms
  keypressIntervals: [{ type: Number }], // array of inter-key timings in ms
  keystrokeBurstiness: { type: Number, default: null }, // coefficient of variation (stddev/mean)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('TelemetryLog', telemetryLogSchema);
