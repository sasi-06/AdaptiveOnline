const mongoose = require('mongoose');

const BehaviorLogSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    eyeDeviation: { type: Number, default: 0 },
    headMovement: { type: Number, default: 0 },
    mouseIdleTime: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 },
    tabSwitches: { type: Number, default: 0 },
    fullscreenExits: { type: Number, default: 0 },
    faceScale: { type: Number, default: 0 },
    faceNotDetected: { type: Boolean, default: false },
    multipleFacesDetected: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    riskScore: { type: Number, default: 0 },
    events: { type: [String], default: [] },
    snapshot: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('BehaviorLog', BehaviorLogSchema);
