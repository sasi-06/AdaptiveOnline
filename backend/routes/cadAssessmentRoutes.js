const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
    getCadAssessments,
    getCadAssessmentById,
    createCadAssessment,
    updateCadAssessment,
    deleteCadAssessment,
    assignCadAssessment,
    getStudentCadAssessments,
    getCadQuestions,
    createCadQuestion,
    updateCadQuestion,
    deleteCadQuestion,
    saveCadDraft,
    getCadDraft,
    getStudentCadSubmissions,
    submitCadAssessment,
    getCadSubmissionsForAdmin
} = require('../controllers/cadAssessmentController');

// Multer storage for CAD reference drawing image/photo uploads
const uploadDir = path.join(__dirname, '../uploads/cad');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `cad_img_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const upload = multer({ storage });

// Assessment Routes
router.get('/', protect, adminOnly, getCadAssessments);
router.get('/student/:studentId', protect, getStudentCadAssessments);
router.get('/assessments/student/:studentId', protect, getStudentCadAssessments);
router.get('/:id', protect, getCadAssessmentById);
router.post('/', protect, adminOnly, createCadAssessment);
router.put('/assign', protect, adminOnly, assignCadAssessment);
router.put('/:id', protect, adminOnly, updateCadAssessment);
router.delete('/:id', protect, adminOnly, deleteCadAssessment);

// CAD Question Routes
router.get('/:id/questions', protect, getCadQuestions);
router.get('/questions/:id', protect, getCadQuestions);
router.get('/assessments/:id/questions', protect, getCadQuestions);
router.post('/:id/questions', protect, adminOnly, upload.single('image'), createCadQuestion);
router.post('/assessments/:id/questions', protect, adminOnly, upload.single('image'), createCadQuestion);
router.put('/questions/:questionId', protect, adminOnly, upload.single('image'), updateCadQuestion);
router.delete('/questions/:questionId', protect, adminOnly, deleteCadQuestion);

// CAD Submission Routes
router.post('/submissions/draft', protect, saveCadDraft);
router.post('/assessments/submissions/draft', protect, saveCadDraft);
router.get('/submissions/draft/:studentId/:assessmentId/:questionId', protect, getCadDraft);
router.get('/assessments/submissions/draft/:studentId/:assessmentId/:questionId', protect, getCadDraft);
router.get('/submissions/student/:studentId/assessment/:assessmentId', protect, getStudentCadSubmissions);
router.get('/assessments/submissions/student/:studentId/assessment/:assessmentId', protect, getStudentCadSubmissions);
router.post('/submissions/submit', protect, submitCadAssessment);
router.post('/assessments/submissions/submit', protect, submitCadAssessment);

// Admin Results Routes
router.get('/assessments/:assessmentId/all-submissions', protect, adminOnly, getCadSubmissionsForAdmin);
router.get('/:assessmentId/all-submissions', protect, adminOnly, getCadSubmissionsForAdmin);

module.exports = router;


