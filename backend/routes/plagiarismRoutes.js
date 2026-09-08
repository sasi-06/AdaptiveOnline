const express = require('express');
const router = express.Router();
const { getPlagiarismMatrix, compareSessions } = require('../controllers/plagiarismController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/matrix', protect, adminOnly, getPlagiarismMatrix);
router.post('/compare', protect, adminOnly, compareSessions);

module.exports = router;
