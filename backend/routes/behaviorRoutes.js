const express = require('express');
const router = express.Router();
const BehaviorLog = require('../models/BehaviorLog'); // ← must be imported
const { logBehavior, getBehaviorLogs, getAllBehaviorLogs, getNextAdaptiveQuestion } = require('../controllers/behaviorController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/',                        logBehavior);
router.post('/get-next-question',       getNextAdaptiveQuestion);
router.get('/all',        adminOnly,    getAllBehaviorLogs);

const mongoose = require('mongoose');

// ── Student-scoped logs (must come BEFORE /:studentId/:examId) ──
router.get('/student/:studentId', async (req, res) => {
    try {
        if (!req.params.studentId || req.params.studentId === 'undefined' || !mongoose.Types.ObjectId.isValid(req.params.studentId)) {
            return res.status(400).json({ message: 'Invalid Student ID' });
        }
        const logs = await BehaviorLog.find({ student_id: req.params.studentId })
            .populate('exam_id', 'title')
            .sort({ timestamp: -1 })
            .limit(200);
        res.json(logs);
    } catch (err) {
        console.error('Error fetching student behavior logs:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/:studentId/:examId',       getBehaviorLogs);

module.exports = router;