const InterviewBehaviorLog = require('../models/InterviewBehaviorLog');

/**
 * Weighted-severity risk scoring, same idea as the MCQ exam side.
 * Each active anomaly adds points and pushes a matching event tag —
 * the tags match the keys already defined in BehaviorTimeline.jsx's eventMap,
 * so the frontend timeline renders these identically to MCQ logs.
 */
function computeRisk(payload, previousTabSwitches = 0) {
    let score = 0;
    const events = [];

    if (payload.faceNotDetected) {
        score += 25;
        events.push('face_missing');
    }
    if (payload.multipleFacesDetected) {
        score += 30;
        events.push('multiple_faces');
    }
    if (payload.phoneDetected) {
        score += 30;
        events.push('phone_detected');
    }
    if (payload.identity_mismatch) {
        score += 35;
        events.push('identity_mismatch');
    }
    // In an oral interview, speech during answering is expected!
    // Only penalize multiple voices (someone coaching candidate) or unexpected external chatter
    if (payload.multiple_voices) {
        score += 30;
        events.push('multiple_voices');
    } else if (payload.unexpected_speech) {
        score += 15;
        events.push('speech_detected');
    }
    if ((payload.eyeDeviation || 0) > 30) {
        score += 10;
        events.push('gaze_away');
    }
    if ((payload.headMovement || 0) > 25) {
        score += 10;
        events.push('head_turn');
    }
    if ((payload.tabSwitches || 0) > previousTabSwitches) {
        score += 15;
        events.push('fullscreen_exit');
    }
    if ((payload.mouseIdleTime || 0) > 60) {
        score += 5;
        // no dedicated icon/tag for idle time, but it still shows in the
        // "Evidence" line via BehaviorTimeline's getHumanMetrics()
    }

    return { riskScore: Math.min(100, score), events };
}

function buildMessages(events) {
    if (events.length === 0) return ['Behavior appears normal.'];
    const labelMap = {
        face_missing: 'Face not detected in frame',
        multiple_faces: 'Multiple faces detected',
        phone_detected: 'Phone detected in frame',
        identity_mismatch: 'Identity does not match reference',
        speech_detected: 'Speech detected in background',
        multiple_voices: 'Multiple voices detected',
        gaze_away: 'Eyes deviated from screen',
        head_turn: 'Excessive head movement',
        fullscreen_exit: 'Tab switch / fullscreen exit',
    };
    return events.map((e) => labelMap[e] || e);
}

/**
 * POST /api/interviews/behavior/log
 * Called every ~5s from InterviewPage.jsx while the candidate is answering.
 */
exports.logInterviewBehavior = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload.session_id) {
            return res.status(400).json({ message: 'session_id is required' });
        }

        // Look at the most recent log for this session to detect NEW tab switches
        // (tabSwitches sent from the client is a running total, not a delta)
        const lastLog = await InterviewBehaviorLog.findOne({ session_id: payload.session_id })
            .sort({ timestamp: -1 })
            .lean();
        const previousTabSwitches = lastLog?.tabSwitches || 0;

        const { riskScore, events } = computeRisk(payload, previousTabSwitches);

        const log = await InterviewBehaviorLog.create({
            ...payload,
            riskScore,
            events,
            timestamp: new Date(),
        });

        return res.json({
            riskScore,
            messages: buildMessages(events),
            logId: log._id,
        });
    } catch (err) {
        console.error('logInterviewBehavior error:', err);
        return res.status(500).json({ message: 'Failed to log interview behavior' });
    }
};

/**
 * GET /api/interviews/behavior/:sessionId
 * Powers the Admin "Analyze Timeline" modal for one session.
 */
exports.getInterviewBehaviorLogs = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const logs = await InterviewBehaviorLog.find({ session_id: sessionId })
            .sort({ timestamp: 1 })
            .lean();
        return res.json(logs);
    } catch (err) {
        console.error('getInterviewBehaviorLogs error:', err);
        return res.status(500).json({ message: 'Failed to fetch interview behavior logs' });
    }
};

/**
 * GET /api/interviews/behavior
 * Optional: all logs across all sessions (e.g. for a future "all alerts" view,
 * mirroring AdminAlerts.jsx / AdminLiveProctor.jsx patterns).
 */
exports.getAllInterviewBehaviorLogs = async (req, res) => {
    try {
        const logs = await InterviewBehaviorLog.find({})
            .sort({ timestamp: -1 })
            .limit(500)
            .lean();
        return res.json(logs);
    } catch (err) {
        console.error('getAllInterviewBehaviorLogs error:', err);
        return res.status(500).json({ message: 'Failed to fetch interview behavior logs' });
    }
};