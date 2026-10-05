const CadAssessment = require('../models/CadAssessment');
const CadQuestion = require('../models/CadQuestion');
const CadSubmission = require('../models/CadSubmission');
const mongoose = require('mongoose');

// @desc Get all CAD Assessments (for Admin)
const getCadAssessments = async (req, res) => {
    try {
        const assessments = await CadAssessment.find()
            .populate('assigned_students', 'name email rollno department')
            .populate('questions')
            .sort({ createdAt: -1 });
        res.json(assessments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Get CAD Assessment by ID
const getCadAssessmentById = async (req, res) => {
    try {
        const assessment = await CadAssessment.findById(req.params.id)
            .populate('assigned_students', 'name email rollno department')
            .populate('questions');
        if (!assessment) {
            return res.status(404).json({ message: 'AutoCAD Assessment not found' });
        }
        res.json(assessment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Create a new CAD Assessment
const createCadAssessment = async (req, res) => {
    try {
        const { title, description, instructions, total_questions, duration, cad_level } = req.body;
        if (!title) {
            return res.status(400).json({ message: 'Assessment Name is required' });
        }

        const assessment = await CadAssessment.create({
            title,
            description: description || instructions || '',
            instructions: instructions || description || '',
            total_questions: Number(total_questions) || 0,
            duration: Number(duration) || 60,
            cad_level: cad_level || 'Level 1 — Basic',
            created_by: req.admin ? req.admin._id : null
        });

        res.status(201).json(assessment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Update CAD Assessment
const updateCadAssessment = async (req, res) => {
    try {
        const { title, description, instructions, total_questions, duration, cad_level } = req.body;
        const assessment = await CadAssessment.findByIdAndUpdate(
            req.params.id,
            { title, description, instructions, total_questions, duration, cad_level },
            { new: true, runValidators: true }
        )
        .populate('assigned_students', 'name email rollno department')
        .populate('questions');

        if (!assessment) {
            return res.status(404).json({ message: 'AutoCAD Assessment not found' });
        }

        res.json(assessment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Delete CAD Assessment
const deleteCadAssessment = async (req, res) => {
    try {
        const assessment = await CadAssessment.findByIdAndDelete(req.params.id);
        if (!assessment) {
            return res.status(404).json({ message: 'AutoCAD Assessment not found' });
        }

        // Delete associated questions
        await CadQuestion.deleteMany({ assessment_id: req.params.id });

        res.json({ message: 'AutoCAD Assessment and questions deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Assign CAD Assessment to students
const assignCadAssessment = async (req, res) => {
    try {
        const { assessmentId, studentIds } = req.body;
        const assessment = await CadAssessment.findById(assessmentId);
        if (!assessment) {
            return res.status(404).json({ message: 'AutoCAD Assessment not found' });
        }

        assessment.assigned_students = studentIds || [];
        await assessment.save();

        const updated = await CadAssessment.findById(assessmentId)
            .populate('assigned_students', 'name email rollno department')
            .populate('questions');

        res.json({ message: 'Students assigned successfully to AutoCAD Assessment', assessment: updated });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Get CAD Assessments assigned to a specific student
// @desc Get CAD Assessments assigned to a specific student
const getStudentCadAssessments = async (req, res) => {
    try {
        const studentId = req.params.studentId;
        const queryList = [studentId];
        if (mongoose.Types.ObjectId.isValid(studentId)) {
            queryList.push(new mongoose.Types.ObjectId(studentId));
        }

        const assessments = await CadAssessment.find({
            assigned_students: { $in: queryList }
        })
        .populate('questions')
        .sort({ createdAt: -1 });

        // Check submission status for each assessment
        const enrichedAssessments = await Promise.all(assessments.map(async (asm) => {
            const asmObj = asm.toObject();
            const asmIdList = [asm._id, asm._id.toString()];
            if (mongoose.Types.ObjectId.isValid(asm._id)) {
                asmIdList.push(new mongoose.Types.ObjectId(asm._id));
            }

            const submissions = await CadSubmission.find({
                student_id: { $in: queryList },
                assessment_id: { $in: asmIdList }
            });

            const submittedSub = submissions.find(s => s.status === 'submitted');
            asmObj.isSubmitted = !!submittedSub;
            asmObj.submittedAt = submittedSub ? submittedSub.submitted_at || submittedSub.updatedAt : null;
            asmObj.submissionsCount = submissions.length;
            return asmObj;
        }));

        res.json(enrichedAssessments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ──────────────── CAD QUESTION CONTROLLER FUNCTIONS ────────────────

// @desc Get CAD questions for an assessment
const getCadQuestions = async (req, res) => {
    try {
        const questions = await CadQuestion.find({ assessment_id: req.params.id }).sort({ createdAt: 1 });
        res.json(questions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Create a CAD question for an assessment
const createCadQuestion = async (req, res) => {
    try {
        const assessmentId = req.params.id;
        const { question_text, instructions, difficulty, marks } = req.body;

        if (!question_text) {
            return res.status(400).json({ message: 'Question prompt text is required' });
        }

        const image_url = req.file ? `/uploads/cad/${req.file.filename}` : '';

        const question = await CadQuestion.create({
            assessment_id: assessmentId,
            question_text,
            instructions: instructions || '',
            difficulty: difficulty || 'medium',
            marks: Number(marks) || 10,
            image_url,
            created_by: req.admin ? req.admin._id : null
        });

        // Update CadAssessment's questions array & total_questions count
        const allQuestions = await CadQuestion.find({ assessment_id: assessmentId });
        await CadAssessment.findByIdAndUpdate(assessmentId, {
            questions: allQuestions.map(q => q._id),
            total_questions: allQuestions.length
        });

        res.status(201).json(question);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Update CAD question
const updateCadQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { question_text, instructions, difficulty, marks } = req.body;

        const updateData = {
            question_text,
            instructions,
            difficulty,
            marks: Number(marks) || 10
        };

        if (req.file) {
            updateData.image_url = `/uploads/cad/${req.file.filename}`;
        }

        const question = await CadQuestion.findByIdAndUpdate(questionId, updateData, { new: true });
        if (!question) {
            return res.status(404).json({ message: 'CAD question not found' });
        }

        res.json(question);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Delete CAD question
const deleteCadQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const question = await CadQuestion.findByIdAndDelete(questionId);
        if (!question) {
            return res.status(404).json({ message: 'CAD question not found' });
        }

        // Update CadAssessment questions array & count
        const allQuestions = await CadQuestion.find({ assessment_id: question.assessment_id });
        await CadAssessment.findByIdAndUpdate(question.assessment_id, {
            questions: allQuestions.map(q => q._id),
            total_questions: allQuestions.length
        });

        res.json({ message: 'CAD question deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ──────────────── CAD SUBMISSION CONTROLLER FUNCTIONS ────────────────

// @desc Save / Upsert CAD Draft
const saveCadDraft = async (req, res) => {
    try {
        let { student_id, assessment_id, question_id, drawing_data, preview_image, time_spent, activity_events } = req.body;
        if (!student_id && (req.student?._id || req.user?.id)) {
            student_id = req.student?._id || req.user?.id;
        }
        if (!student_id || !assessment_id || !question_id) {
            return res.status(400).json({ message: 'student_id, assessment_id, and question_id are required' });
        }

        const stId = mongoose.Types.ObjectId.isValid(student_id) ? new mongoose.Types.ObjectId(student_id) : student_id;
        const asmId = mongoose.Types.ObjectId.isValid(assessment_id) ? new mongoose.Types.ObjectId(assessment_id) : assessment_id;
        const qId = mongoose.Types.ObjectId.isValid(question_id) ? new mongoose.Types.ObjectId(question_id) : question_id;

        // Check if existing submission is already submitted
        const existing = await CadSubmission.findOne({
            student_id: { $in: [student_id, stId] },
            assessment_id: { $in: [assessment_id, asmId] },
            question_id: { $in: [question_id, qId] }
        });

        const statusToSet = (existing && existing.status === 'submitted') ? 'submitted' : 'draft';

        const updateFields = {
            drawing_data: drawing_data || { objects: [], layers: [], viewport: {} },
            preview_image: preview_image || '',
            time_spent: Number(time_spent) || 0,
            status: statusToSet
        };

        if (Array.isArray(activity_events)) {
            updateFields.activity_events = activity_events;
        }

        const submission = await CadSubmission.findOneAndUpdate(
            { student_id: stId, assessment_id: asmId, question_id: qId },
            { $set: updateFields },
            { new: true, upsert: true, runValidators: true }
        );

        res.json(submission);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Save or append Activity Events for CAD Question
const saveActivityEvents = async (req, res) => {
    try {
        let { student_id, assessment_id, question_id, activity_events } = req.body;
        if (!student_id && (req.student?._id || req.user?.id)) {
            student_id = req.student?._id || req.user?.id;
        }
        if (!student_id || !assessment_id || !question_id) {
            return res.status(400).json({ message: 'student_id, assessment_id, and question_id are required' });
        }

        const stId = mongoose.Types.ObjectId.isValid(student_id) ? new mongoose.Types.ObjectId(student_id) : student_id;
        const asmId = mongoose.Types.ObjectId.isValid(assessment_id) ? new mongoose.Types.ObjectId(assessment_id) : assessment_id;
        const qId = mongoose.Types.ObjectId.isValid(question_id) ? new mongoose.Types.ObjectId(question_id) : question_id;

        const submission = await CadSubmission.findOneAndUpdate(
            { student_id: stId, assessment_id: asmId, question_id: qId },
            { $set: { activity_events: Array.isArray(activity_events) ? activity_events : [] } },
            { new: true, upsert: true }
        );

        res.json({ message: 'Activity events persisted successfully', count: submission.activity_events?.length || 0, submission });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Get Activity History for a specific CAD Question Attempt
const getCadActivityHistory = async (req, res) => {
    try {
        const { studentId, assessmentId, questionId } = req.params;
        const stId = mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : studentId;
        const asmId = mongoose.Types.ObjectId.isValid(assessmentId) ? new mongoose.Types.ObjectId(assessmentId) : assessmentId;
        const qId = mongoose.Types.ObjectId.isValid(questionId) ? new mongoose.Types.ObjectId(questionId) : questionId;

        const submission = await CadSubmission.findOne({
            student_id: { $in: [studentId, stId] },
            assessment_id: { $in: [assessmentId, asmId] },
            question_id: { $in: [questionId, qId] }
        });

        if (!submission) {
            return res.json([]);
        }

        res.json(submission.activity_events || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Get CAD Draft for a question
const getCadDraft = async (req, res) => {
    try {
        const { studentId, assessmentId, questionId } = req.params;
        const stId = mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : studentId;
        const asmId = mongoose.Types.ObjectId.isValid(assessmentId) ? new mongoose.Types.ObjectId(assessmentId) : assessmentId;
        const qId = mongoose.Types.ObjectId.isValid(questionId) ? new mongoose.Types.ObjectId(questionId) : questionId;

        const submission = await CadSubmission.findOne({
            student_id: { $in: [studentId, stId] },
            assessment_id: { $in: [assessmentId, asmId] },
            question_id: { $in: [questionId, qId] }
        });
        res.json(submission || null);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Get all CAD submissions/drafts for a student on an assessment
const getStudentCadSubmissions = async (req, res) => {
    try {
        const { studentId, assessmentId } = req.params;
        const stId = mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : studentId;
        const asmId = mongoose.Types.ObjectId.isValid(assessmentId) ? new mongoose.Types.ObjectId(assessmentId) : assessmentId;

        const submissions = await CadSubmission.find({
            student_id: { $in: [studentId, stId] },
            assessment_id: { $in: [assessmentId, asmId] }
        }).populate('question_id');
        res.json(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Final Submit CAD Assessment
const submitCadAssessment = async (req, res) => {
    try {
        let { student_id, assessment_id } = req.body;
        if (!student_id && (req.student?._id || req.user?.id)) {
            student_id = req.student?._id || req.user?.id;
        }
        if (!student_id || !assessment_id) {
            return res.status(400).json({ message: 'student_id and assessment_id are required' });
        }

        const stId = mongoose.Types.ObjectId.isValid(student_id) ? new mongoose.Types.ObjectId(student_id) : student_id;
        const asmId = mongoose.Types.ObjectId.isValid(assessment_id) ? new mongoose.Types.ObjectId(assessment_id) : assessment_id;
        const studentQueryList = [student_id, stId];
        const asmQueryList = [assessment_id, asmId];

        const questions = await CadQuestion.find({ assessment_id: { $in: asmQueryList } });
        const submissionDate = new Date();

        if (questions.length > 0) {
            for (const q of questions) {
                const qId = mongoose.Types.ObjectId.isValid(q._id) ? new mongoose.Types.ObjectId(q._id) : q._id;
                await CadSubmission.findOneAndUpdate(
                    { student_id: stId, assessment_id: asmId, question_id: qId },
                    {
                        $set: {
                            status: 'submitted',
                            submitted_at: submissionDate
                        },
                        $setOnInsert: {
                            drawing_data: { objects: [], layers: [], viewport: {} },
                            preview_image: '',
                            time_spent: 0
                        }
                    },
                    { upsert: true, new: true }
                );
            }
        }

        // Also update any other submissions/drafts for this student + assessment
        await CadSubmission.updateMany(
            { student_id: { $in: studentQueryList }, assessment_id: { $in: asmQueryList } },
            { $set: { status: 'submitted', submitted_at: submissionDate } }
        );

        const submissions = await CadSubmission.find({ student_id: { $in: studentQueryList }, assessment_id: { $in: asmQueryList } });
        res.json({ message: 'CAD Assessment submitted successfully', submissions });
    } catch (err) {
        console.error('Error submitting CAD assessment:', err);
        res.status(500).json({ message: err.message });
    }
};

// @desc Get all CAD Submissions for an assessment (Admin view)
const getCadSubmissionsForAdmin = async (req, res) => {
    try {
        const { assessmentId } = req.params;
        let filter = {};
        const paramStr = String(assessmentId || '').trim();

        if (paramStr && !['ALL', 'all', 'undefined', 'null'].includes(paramStr)) {
            if (mongoose.Types.ObjectId.isValid(paramStr)) {
                filter.assessment_id = { $in: [new mongoose.Types.ObjectId(paramStr), paramStr] };
            } else {
                filter.assessment_id = paramStr;
            }
        }

        const submissions = await CadSubmission.find(filter)
            .populate('student_id', 'name email rollno department')
            .populate('assessment_id', 'title cad_level duration category')
            .populate('question_id', 'question_text marks difficulty image_url')
            .sort({ updatedAt: -1 });

        // Group by student + assessment composite key
        const studentMap = {};

        for (const sub of submissions) {
            const stId = sub.student_id?._id?.toString() || sub.student_id?.toString() || (sub._id ? sub._id.toString() : Math.random().toString());
            const asmId = sub.assessment_id?._id?.toString() || sub.assessment_id?.toString() || 'unknown';
            const key = `${stId}_${asmId}`;

            let studentObj = sub.student_id;
            if (!studentObj || typeof studentObj !== 'object' || !studentObj.name) {
                const rawStId = sub.student_id;
                if (rawStId && mongoose.Types.ObjectId.isValid(rawStId)) {
                    const stDoc = await Student.findById(rawStId).select('name email rollno department');
                    if (stDoc) studentObj = stDoc;
                }
            }

            let asmObj = sub.assessment_id;
            if (!asmObj || typeof asmObj !== 'object' || !asmObj.title) {
                const rawAsmId = sub.assessment_id;
                if (rawAsmId && mongoose.Types.ObjectId.isValid(rawAsmId)) {
                    const asmDoc = await CadAssessment.findById(rawAsmId).select('title cad_level duration category');
                    if (asmDoc) asmObj = asmDoc;
                }
            }

            if (!studentMap[key]) {
                studentMap[key] = {
                    _id: key,
                    student: studentObj,
                    assessment: asmObj,
                    status: sub.status || 'submitted',
                    submitted_at: sub.submitted_at || sub.updatedAt,
                    updatedAt: sub.updatedAt,
                    drawings: []
                };
            }

            if (sub.status === 'submitted') {
                studentMap[key].status = 'submitted';
            }
            if (sub.submitted_at && (!studentMap[key].submitted_at || new Date(sub.submitted_at) > new Date(studentMap[key].submitted_at))) {
                studentMap[key].submitted_at = sub.submitted_at;
            }

            if (sub.question_id || sub.drawing_data) {
                studentMap[key].drawings.push({
                    _id: sub._id,
                    question: sub.question_id,
                    drawing_data: sub.drawing_data,
                    preview_image: sub.preview_image,
                    activity_events: sub.activity_events || [],
                    time_spent: sub.time_spent,
                    status: sub.status,
                    updatedAt: sub.updatedAt
                });
            }
        }

        const results = Object.values(studentMap);
        res.json(results);
    } catch (err) {
        console.error('Error in getCadSubmissionsForAdmin:', err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
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
    getCadSubmissionsForAdmin,
    saveActivityEvents,
    getCadActivityHistory
};

