const Result = require('../models/Result');
const Question = require('../models/Question');
const BehaviorLog = require('../models/BehaviorLog');
const riskEngine = require('../services/riskEngine');

// @desc  Submit exam and calculate result
exports.submitResult = async (req, res) => {
    try {
        const { student_id, exam_id, answers } = req.body;
        // answers: [{ question_id, selected_option }]

        let score = 0;
        let total_marks = 0;
        const processedAnswers = [];

        for (const ans of answers) {
            const question = await Question.findById(ans.question_id);
            if (!question) continue;
            let is_correct = false;
            if (question.correct_answer && ans.selected_option) {
                const ca = String(question.correct_answer).trim().toLowerCase();
                const sa = String(ans.selected_option).trim().toLowerCase();
                if (ca === sa) {
                    is_correct = true;
                } else {
                    const options = question.options || [];
                    const selIndex = options.findIndex(opt => String(opt).trim().toLowerCase() === sa);
                    if (selIndex !== -1) {
                        const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
                        if (ca === letters[selIndex] || ca === String(selIndex + 1)) {
                            is_correct = true;
                        } else if (sa.startsWith(ca + ')') || sa.startsWith(ca + '.') || sa.startsWith(ca + ' ')) {
                            is_correct = true;
                        }
                    } else {
                        // fallback if option exact match fails
                        if (sa.startsWith(ca + ')') || sa.startsWith(ca + '.') || sa.startsWith(ca + ' ')) {
                           is_correct = true;
                        }
                    }
                }
            }
            const marks_awarded = is_correct ? question.marks : 0;
            score += marks_awarded;
            total_marks += question.marks;
            processedAnswers.push({ 
                question_id: ans.question_id, 
                selected_option: ans.selected_option, 
                is_correct, 
                marks_awarded,
                time_taken: ans.time_taken || 0
            });
        }

        // Behavior risk summary
        const logs = await BehaviorLog.find({ student_id, exam_id });
        const riskScores = logs.map(l => l.riskScore);
        const average_risk = riskScores.length ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;
        const max_risk = riskScores.length ? Math.max(...riskScores) : 0;
        const RISK_THRESHOLD = parseFloat(process.env.RISK_THRESHOLD) || 70;
        const flagged_count = riskScores.filter(r => r >= RISK_THRESHOLD).length;

        const result = await Result.create({
            student_id, exam_id,
            score, total_marks,
            answers: processedAnswers,
            behaviorRiskSummary: { average_risk, max_risk, flagged_count },
        });

        // Update student's MCQ Test round progress
        const Student = require('../models/Student');
        const student = await Student.findById(student_id);
        if (student) {
            let updated = false;
            student.round_progress = (student.round_progress || []).map(rp => {
                if (rp.round_name.toLowerCase().includes('mcq')) {
                    rp.status = 'Completed';
                    rp.score = `${score}/${total_marks}`;
                    updated = true;
                }
                return rp;
            });
            if (!updated) {
                student.round_progress.push({
                    round_name: 'MCQ Test',
                    status: 'Completed',
                    score: `${score}/${total_marks}`
                });
            }
            await student.save();
        }

        // Clear per-student EMA smoothing state for this exam session
        riskEngine.resetSmoothing(student_id);

        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Get result for a student exam
exports.getResult = async (req, res) => {
    try {
        const result = await Result.findOne({ student_id: req.params.studentId, exam_id: req.params.examId })
            .populate('student_id', 'name email')
            .populate('exam_id', 'title duration')
            .populate('answers.question_id', 'question_text correct_answer options marks');
        if (!result) return res.status(404).json({ message: 'Result not found' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Get all results (admin)
exports.getAllResults = async (req, res) => {
    try {
        const results = await Result.find()
            .populate('student_id', 'name email')
            .populate('exam_id', 'title')
            .sort({ createdAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
