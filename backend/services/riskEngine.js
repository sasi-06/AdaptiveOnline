const axios = require('axios');

/**
 * Sends behavior features to the Python ML microservice.
 * The ML microservice now maintains the continuous state and decay.
 */
const getRiskScore = async ({ 
    eyeDeviation, headMovement, faceScale, mouseIdleTime, responseTime, 
    tabSwitches, fullscreenExits, difficulty, faceNotDetected, multipleFacesDetected, 
    phoneDetected, identity_mismatch, speech_detected, multiple_voices, speech_level, 
    studentId, questionId, isAnswered 
}) => {
    let riskData;

    try {
        const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
        const response = await axios.post(`${ML_SERVICE_URL}/analyze`, {
            student_id:      studentId      || 'anonymous',
            question_id:     questionId     || 'none',
            is_answered:     isAnswered     || false,
            eye_deviation:   eyeDeviation   ?? 0,
            head_movement:   headMovement   ?? 0,
            face_scale:      faceScale      ?? 0,
            mouse_idle_time: mouseIdleTime  ?? 0,
            response_time:   responseTime   ?? 60,
            tab_switches:    tabSwitches    ?? 0,
            fullscreen_exits: fullscreenExits ?? 0,
            difficulty:      difficulty     || 'medium',
            face_not_detected: faceNotDetected ?? false,
            multiple_faces_detected: multipleFacesDetected ?? false,
            phone_detected: phoneDetected ?? false,
            identity_mismatch: identity_mismatch ?? false,
            speech_detected: speech_detected ?? false,
            multiple_voices: multiple_voices ?? false,
            speech_level: speech_level ?? 0,
        }, { timeout: 5000 });
        riskData = response.data;
    } catch (error) {
        console.error('ML service error:', error.message);
        // Fallback
        const fallbackRisk = Math.min(
            (tabSwitches > 0 ? tabSwitches * 15 : 0) +
            (fullscreenExits > 0 ? fullscreenExits * 10 : 0) +
            (faceScale > 0 && faceScale < 0.1 ? 20 : 0) +
            (faceNotDetected ? 20 : 0) +
            (eyeDeviation  > 35 ? 30 : 0) +
            (headMovement  > 30 ? 25 : 0) +
            (multipleFacesDetected ? 50 : 0) +
            (identity_mismatch ? 95 : 0) +
            (phoneDetected ? 80 : 0) +
            (speech_detected ? 25 : 0) +
            (multiple_voices ? 50 : 0),
            100
        );

        const fallbackMessages = [];
        if (tabSwitches > 0) fallbackMessages.push("Tab switch detected. Please stay on the exam page.");
        if (fullscreenExits > 0) fallbackMessages.push("Fullscreen exit detected. Please stay in fullscreen mode.");
        if (faceNotDetected) fallbackMessages.push("Face not detected!");
        if (multipleFacesDetected) fallbackMessages.push("MULTIPLE FACES DETECTED!");
        if (identity_mismatch) fallbackMessages.push("IDENTITY MISMATCH DETECTED!");
        if (phoneDetected) fallbackMessages.push("CELL PHONE DETECTED!");
        if (speech_detected) fallbackMessages.push("Talking detected!");
        if (multiple_voices) fallbackMessages.push("MULTIPLE VOICES DETECTED!");
        if (eyeDeviation > 35) fallbackMessages.push("Looking away from screen detected.");
        if (headMovement > 30) fallbackMessages.push("Head turned away detected.");

        riskData = { 
            risk_score: fallbackRisk, 
            messages: fallbackMessages.length > 0 ? fallbackMessages : ['Behavior appears normal.'], 
            risk_level: fallbackRisk > 70 ? 'high' : fallbackRisk > 30 ? 'medium' : 'low' 
        };
    }

    // Ensure risk score is parsed cleanly
    if (riskData.risk_score !== undefined) {
        riskData.risk_score = parseFloat(riskData.risk_score.toFixed(2));
    }
    
    return riskData;
};

/**
 * No local smoothing needed anymore. Placeholder to avoid breaking other files.
 */
const resetSmoothing = (studentId) => {
    // The ML microservice could be called here to clear state if needed
};

module.exports = { getRiskScore, resetSmoothing };
