const mongoose = require('mongoose');
const BehaviorLog = require('../models/BehaviorLog');
const riskEngine = require('../services/riskEngine');
const adaptiveQuestionEngine = require('../services/adaptiveQuestionEngine');

// @desc  Log behavior data and trigger adaptive engine
exports.logBehavior = async (req, res) => {
    try {
    const { 
        student_id, exam_id, question_id, answers, 
        eyeDeviation, headMovement, faceScale, 
        mouseIdleTime, responseTime, tabSwitches, fullscreenExits, 
        difficulty, faceNotDetected, multipleFacesDetected, phoneDetected, 
        identity_mismatch, speech_detected, multiple_voices, speech_level,
        snapshot
    } = req.body;

    const currentAnswer = answers ? (answers[question_id] || answers[String(question_id)]) : null;
    const isAnswered = currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '';

    // Call ML service for risk score
    const riskData = await riskEngine.getRiskScore({
        eyeDeviation, headMovement, faceScale, mouseIdleTime, responseTime, tabSwitches, fullscreenExits, 
        difficulty: difficulty || 'medium', faceNotDetected, multipleFacesDetected, phoneDetected, 
        identity_mismatch, speech_detected, multiple_voices, speech_level,
        studentId: student_id, questionId: question_id, isAnswered,
    });
        const riskScore = riskData.risk_score;
        const messages = riskData.messages || [];

        // Generate events array for comprehensive logging
        const events = [];
        if (faceNotDetected) events.push('face_missing');
        if (headMovement > 15) events.push('head_turn');
        if (eyeDeviation > 20) events.push('gaze_away');
        if (multipleFacesDetected) events.push('multiple_faces');
        if (phoneDetected) events.push('phone_detected');
        if (identity_mismatch) events.push('identity_mismatch');
        if (speech_detected) events.push('speech_detected');
        if (multiple_voices) events.push('multiple_voices');
        if (fullscreenExits > 0 || tabSwitches > 0) events.push('fullscreen_exit');

        // Save behavior log
        const log = await BehaviorLog.create({
            student_id, exam_id, question_id,
            eyeDeviation, headMovement, faceScale, mouseIdleTime, responseTime,
            tabSwitches, fullscreenExits,
            riskScore,
            events,
            snapshot
        });

        // Compute real-time performance score if answers provided
        let performanceScore = -1; // -1 means no answers yet
        if (answers && Object.keys(answers).length > 0) {
            const questionIds = Object.keys(answers);
            const questions = await require('../models/Question').find({ _id: { $in: questionIds } });
            let correctCount = 0;
            questions.forEach(q => {
                const selected = answers[q._id.toString()] || answers[q._id];
                if (selected) {
                    const ansStr = String(selected).trim().toLowerCase();
                    const correctStr = String(q.correct_answer).trim().toLowerCase();
                    // Basic match or option index match
                    const optIdx = q.options ? q.options.findIndex(o => String(o).trim().toLowerCase() === ansStr) : -1;
                    const letterMatch = ['a','b','c','d','e','f'][optIdx];
                    
                    if (ansStr === correctStr || letterMatch === correctStr || String(optIdx + 1) === correctStr) {
                        correctCount++;
                    }
                }
            });
            performanceScore = correctCount / questions.length;
        }

        // -- Adaptive Risk Adjustment --
        let adjustedRiskScore = riskScore;
        if (question_id) {
            const q = await require('../models/Question').findById(question_id);
            if (q && q.difficulty === 'validation' && isAnswered) {
                const isCorrect = String(currentAnswer).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
                if (isCorrect) {
                    adjustedRiskScore = Math.max(0, adjustedRiskScore - 15);
                    messages.push("Integrity verified via validation question. Risk score reduced.");
                } else {
                    adjustedRiskScore = Math.min(100, adjustedRiskScore + 10);
                    messages.push("Validation question answered incorrectly. Risk score increased.");
                }
            }
        }

        res.json({ log, riskScore: adjustedRiskScore, messages });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @route POST /api/behavior/get-next-question
// @desc Force change a question dynamically based on risk score thresholds
exports.getNextAdaptiveQuestion = async (req, res) => {
    try {
        const { student_id, exam_id, current_question_id, risk_score, current_exam_question_ids } = req.body;

        const currentQ = await require('../models/Question').findById(current_question_id);
        if (!currentQ) return res.status(404).json({ message: 'Current question not found' });

        // Logic: Fetch question with same topic, same concept, and difficulty = "validation"
        let alternative = await require('../models/Question').findOne({
            topic: currentQ.topic,
            concept: currentQ.concept,
            difficulty: 'validation',
            _id: { $nin: current_exam_question_ids }
        });

        // 1st fallback: Same topic, difficulty = "validation"
        if (!alternative) {
            alternative = await require('../models/Question').findOne({
                topic: currentQ.topic,
                difficulty: 'validation',
                _id: { $nin: current_exam_question_ids }
            });
        }
        
        // 2nd fallback: Any unused validation question
        if (!alternative) {
            alternative = await require('../models/Question').findOne({
                difficulty: 'validation',
                _id: { $nin: current_exam_question_ids }
            });
        }

        // Log adaptive switch
        if (alternative) {
            // Requirement 5: Shuffle options before sending
            if (alternative.options && Array.isArray(alternative.options)) {
                alternative.options = [...alternative.options].sort(() => Math.random() - 0.5);
            }

            await require('../models/BehaviorLog').create({
                student_id, exam_id, question_id: current_question_id,
                riskScore: risk_score,
                events: ['ADAPTIVE_VALIDATION_TRIGGERED', `REPLACED_WITH_${alternative._id}`]
            });
        }

        res.json({ newQuestion: alternative });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Get behavior logs for a student exam
exports.getBehaviorLogs = async (req, res) => {
    try {
        const { studentId, examId } = req.params;
        const sStr = String(studentId);
        const eStr = String(examId);

        const stId = mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : null;
        const exId = mongoose.Types.ObjectId.isValid(examId) ? new mongoose.Types.ObjectId(examId) : null;

        const studentQuery = stId ? [sStr, stId] : [sStr];
        const examQuery = exId ? [eStr, exId] : [eStr];

        let logs = await BehaviorLog.find({
            student_id: { $in: studentQuery },
            exam_id: { $in: examQuery }
        })
        .populate('question_id', 'question_text')
        .sort({ timestamp: 1 });

        // Fallback: If no logs found for specific exam_id, fetch recent logs for student
        if (logs.length === 0) {
            logs = await BehaviorLog.find({
                student_id: { $in: studentQuery }
            })
            .populate('question_id', 'question_text')
            .sort({ timestamp: 1 });
        }

        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Get all behavior logs (admin)
exports.getAllBehaviorLogs = async (req, res) => {
    try {
        const logs = await BehaviorLog.find()
            .populate('student_id', 'name email')
            .populate('exam_id', 'title')
            .populate('question_id', 'question_text')
            .sort({ timestamp: -1 });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
