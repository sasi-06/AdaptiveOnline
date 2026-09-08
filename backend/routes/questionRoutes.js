const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const {
    addQuestion, bulkUploadQuestions, getQuestions, getQuestion, updateQuestion, deleteQuestion,
} = require('../controllers/questionController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
    .get(getQuestions)
    .post(adminOnly, addQuestion);

router.post('/bulk', adminOnly, bulkUploadQuestions);

router.route('/:id')
    .get(getQuestion)
    .put(adminOnly, updateQuestion)
    .delete(adminOnly, deleteQuestion);
router.post('/bulk', protect, adminOnly, async (req, res) => {
    try {
        const { questions, examId } = req.body;
        if (!questions?.length)
            return res.status(400).json({ message: 'No questions provided' });
 
        let questionsToInsert = questions;
        if (examId) {
            questionsToInsert = questions.map(q => ({ ...q, examId }));
        }
 
        const created = await Question.insertMany(questionsToInsert);
 
        res.status(201).json({
            message: `${created.length} question(s) uploaded`,
            questions: created,   // ← full objects with _id — required by frontend
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
 
module.exports = router;
