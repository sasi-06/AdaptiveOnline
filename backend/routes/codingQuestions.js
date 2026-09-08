const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { getQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion } = require('../controllers/codingQuestionController');

router.get('/', protect, getQuestions);
router.get('/:id', protect, getQuestion);
router.post('/', protect, adminOnly, createQuestion);
router.put('/:id', protect, adminOnly, updateQuestion);
router.delete('/:id', protect, adminOnly, deleteQuestion);

module.exports = router;
