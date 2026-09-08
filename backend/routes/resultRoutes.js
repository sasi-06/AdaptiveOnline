const express = require('express');
const router = express.Router();
const Result = require('../models/Result'); // ← was missing!
const { submitResult, getResult, getAllResults } = require('../controllers/resultController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/',                        submitResult);
router.get('/all',        adminOnly,    getAllResults);

const mongoose = require('mongoose');

// ── Student-scoped results (must come BEFORE /:studentId/:examId) ──
router.get('/student/:studentId', async (req, res) => {
    try {
        if (!req.params.studentId || req.params.studentId === 'undefined' || !mongoose.Types.ObjectId.isValid(req.params.studentId)) {
            return res.status(400).json({ message: 'Invalid Student ID' });
        }
        const results = await Result.find({ student_id: req.params.studentId })
            .populate('exam_id', 'title duration total_questions')
            .sort({ createdAt: -1 });
        res.json(results);
    } catch (err) {
        console.error('Error fetching student results:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/:studentId/:examId',       getResult);

module.exports = router;