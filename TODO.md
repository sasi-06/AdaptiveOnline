# Fix Exam Question Selection Save Issue

## Steps:
- [x] Step 1: Edit frontend/src/pages/ExamConfig.jsx - Update handleSave to split updateExam (form) + updateExamQuestions (questions), improve error handling. ✅
- [ ] Step 2: Test changes - Navigate to exam config, select questions, save, verify no error and exam.questions updates.
- [ ] Step 3: Optional - Add ObjectId casting in backend/controllers/examController.js for safety.

