const express = require('express');
const router = express.Router();
const {
    createExam, getExams, getExam, updateExam, deleteExam, assignExam, getStudentExams,
} = require('../controllers/examController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const Exam = require('../models/Exam');

router.use(protect);

router.route('/')
    .get(getExams)
    .post(adminOnly, createExam);

router.put('/assign', adminOnly, assignExam);
router.get('/student/:studentId', getStudentExams);

router.route('/:id')
    .get(getExam)
    .put(adminOnly, updateExam)
    .delete(adminOnly, deleteExam);


router.put('/:id/questions', protect, adminOnly, async (req, res) => {
    try {
        const { questionIds } = req.body; // array of _id strings
        
        // 1. Update questions first
        const exam = await Exam.findByIdAndUpdate(
            req.params.id,
            { $set: { questions: questionIds } },
            { new: true }
        ).populate('questions');
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        // 2. Recalculate metadata based on actual questions and per_question_time
        const counts = { easy: 0, medium: 0, hard: 0 };
        exam.questions.forEach(q => {
            if (q.difficulty) counts[q.difficulty]++;
        });

        const pqt = exam.per_question_time || { easy: 60, medium: 120, hard: 180 };
        const totalSecs = (counts.easy * (pqt.easy || 60)) + 
                          (counts.medium * (pqt.medium || 120)) + 
                          (counts.hard * (pqt.hard || 180));
        
        exam.total_questions = questionIds.length;
        exam.difficulty_distribution = counts;
        exam.duration = Math.ceil(totalSecs / 60);

        await exam.save();

        res.json({ message: 'Questions saved and metadata synchronized', exam });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
