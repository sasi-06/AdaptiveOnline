const express = require('express');
const router = express.Router();
const { 
    getDepartments, createDepartment, updateDepartment, deleteDepartment, updateStudentRoundProgress 
} = require('../controllers/departmentController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Require authentication for all routes
router.use(protect);

router.get('/', getDepartments);
router.post('/', adminOnly, createDepartment);
router.put('/:id', adminOnly, updateDepartment);
router.delete('/:id', adminOnly, deleteDepartment);

// Manual round progress tracking route for admin
router.put('/student/:studentId/progress', adminOnly, updateStudentRoundProgress);

module.exports = router;
