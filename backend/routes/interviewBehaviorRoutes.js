const express = require('express');
const router = express.Router();
const {
    logInterviewBehavior,
    getInterviewBehaviorLogs,
    getAllInterviewBehaviorLogs,
} = require('../controllers/interviewBehaviorController');

// If your other routes use an auth/role middleware (e.g. verifyToken, requireAdmin),
// import and apply it the same way here for consistency:
// const { verifyToken, requireAdmin } = require('../middleware/auth');

// POST /api/interviews/behavior/log  → called from InterviewPage.jsx (student)
router.post('/log', /* verifyToken, */ logInterviewBehavior);

// GET /api/interviews/behavior/all   → optional, all logs (admin)
router.get('/all', /* verifyToken, requireAdmin, */ getAllInterviewBehaviorLogs);

// GET /api/interviews/behavior/:sessionId → one session's logs (admin)
router.get('/:sessionId', /* verifyToken, requireAdmin, */ getInterviewBehaviorLogs);

module.exports = router;