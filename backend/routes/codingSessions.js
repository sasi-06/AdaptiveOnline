const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { 
  startSession, submitSession, getMySessions, getSession, startSessionFromAssessment, getAllSessions
} = require('../controllers/codingSessionController');

router.post('/start', protect, startSession);
router.post('/start-from-assessment', protect, startSessionFromAssessment);
router.post('/:id/submit', protect, submitSession);
router.get('/my', protect, getMySessions);
router.get('/all', protect, adminOnly, getAllSessions);
router.get('/:id', protect, getSession);

module.exports = router;
