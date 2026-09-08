const mongoose = require('mongoose');

/**
 * InterviewBehaviorLog
 * One document per polling interval (~every 5s) during an AI interview session.
 * Mirrors the shape BehaviorTimeline.jsx already expects, so the same
 * frontend component can render both MCQ exam logs and interview logs.
 */
const InterviewBehaviorLogSchema = new mongoose.Schema(
    {
        session_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InterviewSession', // adjust to your actual interview session model name
            required: true,
            index: true,
        },
        question_number: { type: Number, default: null },

        // Raw camera metrics (from CameraMonitor.jsx)
        eyeDeviation: { type: Number, default: 0 },
        headMovement: { type: Number, default: 0 },
        faceScale: { type: Number, default: 0 },
        faceNotDetected: { type: Boolean, default: false },
        multipleFacesDetected: { type: Boolean, default: false },
        phoneDetected: { type: Boolean, default: false },
        identity_mismatch: { type: Boolean, default: false },

        // Raw audio metrics (from AudioMonitor.jsx)
        speech_detected: { type: Boolean, default: false },
        multiple_voices: { type: Boolean, default: false },
        speech_level: { type: Number, default: 0 },

        // Raw browser metrics (from BehaviorTracker.js)
        mouseIdleTime: { type: Number, default: 0 },
        responseTime: { type: Number, default: 0 },
        tabSwitches: { type: Number, default: 0 },
        fullscreenExits: { type: Number, default: 0 },

        // Derived fields (computed server-side in the controller)
        events: [{ type: String }],       // e.g. ['gaze_away', 'phone_detected']
        riskScore: { type: Number, default: 0, min: 0, max: 100 },

        // Optional evidence image, only present when an anomaly was active
        snapshot: { type: String, default: null }, // base64 data URL or uploaded file URL

        timestamp: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// Fast lookup for "all logs for this session, in order"
InterviewBehaviorLogSchema.index({ session_id: 1, timestamp: 1 });

module.exports = mongoose.model('InterviewBehaviorLog', InterviewBehaviorLogSchema);