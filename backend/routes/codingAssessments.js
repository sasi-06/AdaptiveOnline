const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { 
  getAssessments, 
  createAssessment, 
  assignAssessment, 
  updateAssessmentQuestions, 
  deleteAssessment 
} = require('../controllers/codingAssessmentController');

router.get('/', protect, adminOnly, getAssessments);
router.post('/', protect, adminOnly, createAssessment);
router.put('/assign', protect, adminOnly, assignAssessment);
router.put('/:id/questions', protect, adminOnly, updateAssessmentQuestions);
router.delete('/:id', protect, adminOnly, deleteAssessment);

module.exports = router;
