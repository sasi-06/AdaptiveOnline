const express = require('express');
const router = express.Router();
const { 
    createInterview, 
    getInterviews, 
    assignInterview, 
    deleteInterview,
    getStudentInterviews
} = require('../controllers/interviewController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ dest: 'uploads/interviews/' });

const {
    initSession,
    uploadResume,
    generateQuestion,
    submitAnswer,
    uploadCheatClip,
    endSession,
    getAllSessions
} = require('../controllers/interviewSessionController');

router.post('/', protect, adminOnly, createInterview);
router.get('/', protect, adminOnly, getInterviews);
router.put('/assign', protect, adminOnly, assignInterview);
router.delete('/:id', protect, adminOnly, deleteInterview);
router.get('/student/:studentId', protect, getStudentInterviews);

// Session Routes
router.get('/session/all', protect, adminOnly, getAllSessions);
router.post('/session/init', protect, initSession);
router.post('/session/:id/resume', protect, upload.single('resume'), uploadResume);
router.post('/session/:id/question', protect, generateQuestion);
router.post('/session/:id/answer', protect, submitAnswer);
router.post('/session/:id/cheat-clip', protect, upload.single('video'), uploadCheatClip);
router.post('/session/:id/end', protect, endSession);

module.exports = router;
