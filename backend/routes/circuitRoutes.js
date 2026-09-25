/**
 * circuitRoutes.js — REST API for Circuit Design & Evaluation
 *
 * All routes require JWT auth (student or admin as noted).
 *
 * GET    /api/circuit/questions             → list all questions (admin)
 * GET    /api/circuit/questions/exam/:examId → questions for exam (student + admin)
 * GET    /api/circuit/questions/:id         → single question
 * POST   /api/circuit/questions             → create question (admin)
 * PUT    /api/circuit/questions/:id         → update question (admin)
 * DELETE /api/circuit/questions/:id         → delete question (admin)
 *
 * POST   /api/circuit/submissions              → save / upsert draft
 * GET    /api/circuit/submissions/:studentId/:questionId → get student's draft
 * POST   /api/circuit/submissions/:id/submit   → lock + evaluate
 * GET    /api/circuit/submissions/student/:sid → all by student
 * GET    /api/circuit/submissions/exam/:examId → all for exam (admin)
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');

const CircuitQuestion   = require('../models/CircuitQuestion');
const CircuitSubmission = require('../models/CircuitSubmission');
const Student           = require('../models/Student');
const Exam              = require('../models/Exam');
const { evaluate }      = require('../services/circuitAgent');
const { protect }       = require('../middleware/authMiddleware');

// ─── ASSIGNMENT ───────────────────────────────────────────────────────────────

// POST /api/circuit/assign — admin assign circuit question/exam to selected students
router.post('/assign', protect, async (req, res) => {
    try {
        const { questionId, examId, studentIds } = req.body;
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'studentIds array is required' });
        }

        let targetExamId = examId;

        if (questionId && !targetExamId) {
            const q = await CircuitQuestion.findById(questionId);
            if (!q) return res.status(404).json({ message: 'Circuit question not found' });
            
            if (q.exam_id) {
                targetExamId = q.exam_id;
            } else {
                const newExam = await Exam.create({
                    title: `Circuit Test: ${q.title}`,
                    description: q.description || 'Circuit Design Evaluation Test',
                    total_questions: 1,
                    duration: 30,
                    per_question_time: { easy: 60, medium: 120, hard: 180 },
                    rounds: { mcq: false, coding: false, simulation: true, technical: false }
                });
                q.exam_id = newExam._id;
                await q.save();
                targetExamId = newExam._id;
            }
        }

        if (targetExamId) {
            const exam = await Exam.findById(targetExamId);
            if (exam) {
                if (!exam.assigned_students) exam.assigned_students = [];
                for (const sid of studentIds) {
                    await Student.findByIdAndUpdate(sid, { $addToSet: { assigned_exams: targetExamId } });
                    if (!exam.assigned_students.includes(sid)) {
                        exam.assigned_students.push(sid);
                    }
                }
                await exam.save();
            }
        }

        res.json({ message: `Circuit exam assigned successfully to ${studentIds.length} student(s)!` });
    } catch (err) {
        console.error('Circuit assignment error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

// GET /api/circuit/questions  — admin: all questions
router.get('/questions', protect, async (req, res) => {
    try {
        const qs = await CircuitQuestion.find().sort({ createdAt: -1 });
        res.json(qs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/circuit/questions/exam/:examId — questions tied to a specific exam
router.get('/questions/exam/:examId', protect, async (req, res) => {
    try {
        const { examId } = req.params;
        const qs = await CircuitQuestion.find({ exam_id: examId })
            .select('-reference_solution')
            .sort({ createdAt: -1 });
        res.json(qs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/circuit/questions/:id — single question (omit reference solution for students)
router.get('/questions/:id', protect, async (req, res) => {
    try {
        const q = await CircuitQuestion.findById(req.params.id).select('-reference_solution');
        if (!q) return res.status(404).json({ message: 'Question not found' });
        res.json(q);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/circuit/questions — admin create
router.post('/questions', protect, async (req, res) => {
    try {
        const q = await CircuitQuestion.create(req.body);
        res.status(201).json(q);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/circuit/questions/:id — admin update
router.put('/questions/:id', protect, async (req, res) => {
    try {
        const q = await CircuitQuestion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!q) return res.status(404).json({ message: 'Question not found' });
        res.json(q);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/circuit/questions/:id — admin delete
router.delete('/questions/:id', protect, async (req, res) => {
    try {
        await CircuitQuestion.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── SUBMISSIONS ──────────────────────────────────────────────────────────────

// POST /api/circuit/submissions — create or update draft
router.post('/submissions', protect, async (req, res) => {
    try {
        const { student_id, question_id, exam_id, components, connections } = req.body;

        if (!student_id || !question_id) {
            return res.status(400).json({ message: 'student_id and question_id are required' });
        }

        const studentObjId  = new mongoose.Types.ObjectId(student_id);
        const questionObjId = new mongoose.Types.ObjectId(question_id);

        // Upsert: find existing draft for this student+question, or create new
        const submission = await CircuitSubmission.findOneAndUpdate(
            { student_id: studentObjId, question_id: questionObjId, status: 'draft' },
            {
                $set: {
                    components:  components  || [],
                    connections: connections || [],
                    exam_id:     exam_id ? new mongoose.Types.ObjectId(exam_id) : undefined,
                    status:      'draft'
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(submission);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/circuit/submissions/student/:sid — all submissions by a student
router.get('/submissions/student/:sid', protect, async (req, res) => {
    try {
        const subs = await CircuitSubmission.find({ student_id: req.params.sid })
            .populate('question_id', 'title topic difficulty')
            .sort({ updatedAt: -1 });
        res.json(subs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/circuit/submissions/all — all submissions for admin view
router.get('/submissions/all', protect, async (req, res) => {
    try {
        const subs = await CircuitSubmission.find()
            .populate('student_id', 'name email rollno department')
            .populate('question_id', 'title topic difficulty')
            .sort({ updatedAt: -1 });
        res.json(subs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/circuit/submissions/exam/:examId — all submissions for an exam (admin)
router.get('/submissions/exam/:examId', protect, async (req, res) => {
    try {
        const subs = await CircuitSubmission.find({ exam_id: req.params.examId })
            .populate('student_id', 'name email rollno department')
            .populate('question_id', 'title topic difficulty')
            .sort({ updatedAt: -1 });
        res.json(subs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/circuit/submissions/:studentId/:questionId — get specific draft
router.get('/submissions/:studentId/:questionId', protect, async (req, res) => {
    try {
        const { studentId, questionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(questionId)) {
            return res.json(null);
        }
        const sub = await CircuitSubmission.findOne({
            student_id:  studentId,
            question_id: questionId
        }).sort({ updatedAt: -1 });

        res.json(sub || null);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/circuit/submissions/:id/submit — lock + evaluate
router.post('/submissions/:id/submit', protect, async (req, res) => {
    try {
        const submission = await CircuitSubmission.findById(req.params.id);
        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        if (submission.status === 'evaluated') {
            return res.json(submission); // Already evaluated — return cached result
        }

        const question = await CircuitQuestion.findById(submission.question_id);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        // Convert Map properties to plain objects for evaluator
        const plainComponents = submission.components.map(c => ({
            ...c.toObject ? c.toObject() : c,
            properties: c.properties instanceof Map
                ? Object.fromEntries(c.properties)
                : c.properties
        }));

        // Run self-contained evaluation agent (3-model ensemble + logging)
        const evaluation = await evaluate(
            question,
            plainComponents,
            submission.connections,
            submission.student_id,
            req.body && req.body.behavior ? req.body.behavior : {}
        );

        // Persist result
        submission.status       = 'evaluated';
        submission.submitted_at = new Date();
        submission.evaluation   = evaluation;
        await submission.save();

        res.json(submission);
    } catch (err) {
        console.error('Circuit evaluation error:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
