const Department = require('../models/Department');
const Student = require('../models/Student');
const Result = require('../models/Result');
const Exam = require('../models/Exam');

// @desc Sync a single student's rounds and exam assignments
const syncStudentProgress = async (student) => {
    if (!student.department) return;
    const dept = await Department.findOne({ name: student.department });
    if (!dept) return;

    // Fetch existing results for this student
    const results = await Result.find({ student_id: student._id });
    
    // Map current round progress to preserve status where applicable
    const progressMap = new Map((student.round_progress || []).map(p => [p.round_name, p]));

    student.round_progress = dept.rounds.map(rname => {
        const isMCQ = rname.toLowerCase().includes('mcq');
        
        if (isMCQ) {
            // Find if student completed the exam linked to this department, or any exam
            const mcqRes = results.find(res => {
                if (dept.examId) {
                    return String(res.exam_id?._id || res.exam_id) === String(dept.examId);
                }
                return true;
            });
            if (mcqRes) {
                return {
                    round_name: rname,
                    status: 'Completed',
                    score: `${mcqRes.score}/${mcqRes.total_marks}`
                };
            }
        }
        
        const existing = progressMap.get(rname);
        return {
            round_name: rname,
            status: existing ? existing.status : 'Pending',
            score: existing ? existing.score : ''
        };
    });

    // Auto-assign the department's MCQ Exam to this student
    if (dept.examId) {
        const examIdStr = String(dept.examId);
        const assignedIds = student.assigned_exams.map(e => String(e._id || e));
        if (!assignedIds.includes(examIdStr)) {
            student.assigned_exams.push(dept.examId);
            await Exam.findByIdAndUpdate(dept.examId, { $addToSet: { assigned_students: student._id } });
        }
    }
};

// @desc Sync all students belonging to a specific department
const syncDepartmentStudents = async (deptName) => {
    const students = await Student.find({ department: deptName });
    for (const student of students) {
        await syncStudentProgress(student);
        await student.save();
    }
};

// @desc Get all departments
exports.getDepartments = async (req, res) => {
    try {
        const depts = await Department.find().populate('examId', 'title');
        res.json(depts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Create a department
exports.createDepartment = async (req, res) => {
    try {
        const { name, rounds, examId } = req.body;
        const exists = await Department.findOne({ name });
        if (exists) return res.status(400).json({ message: 'Department already exists' });
        
        const dept = await Department.create({
            name,
            rounds: rounds || [],
            examId: examId || null
        });

        // Sync existing students matching this department name
        await syncDepartmentStudents(name);

        res.status(201).json(dept);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Update department
exports.updateDepartment = async (req, res) => {
    try {
        const { rounds, examId } = req.body;
        const dept = await Department.findById(req.params.id);
        if (!dept) return res.status(404).json({ message: 'Department not found' });
        
        dept.rounds = rounds || dept.rounds;
        dept.examId = examId !== undefined ? examId : dept.examId;
        await dept.save();

        // Sync all students of this department
        await syncDepartmentStudents(dept.name);

        const updatedDept = await Department.findById(req.params.id).populate('examId', 'title');
        res.json(updatedDept);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Delete department
exports.deleteDepartment = async (req, res) => {
    try {
        const dept = await Department.findById(req.params.id);
        if (!dept) return res.status(404).json({ message: 'Department not found' });

        await Department.findByIdAndDelete(req.params.id);
        res.json({ message: 'Department removed successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc Update a student's round progress manually
exports.updateStudentRoundProgress = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { roundName, status, score } = req.body;

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found' });

        let found = false;
        student.round_progress = student.round_progress.map(rp => {
            if (rp.round_name === roundName) {
                rp.status = status || rp.status;
                if (score !== undefined) rp.score = score;
                found = true;
            }
            return rp;
        });

        if (!found) {
            student.round_progress.push({
                round_name: roundName,
                status: status || 'Pending',
                score: score || ''
            });
        }

        await student.save();
        res.json({ message: 'Round progress updated successfully', round_progress: student.round_progress });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Export helpers to use in other controllers
exports.syncStudentProgress = syncStudentProgress;
exports.syncDepartmentStudents = syncDepartmentStudents;
