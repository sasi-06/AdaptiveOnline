const CodingQuestion = require('../models/CodingQuestion');
const Student = require('../models/Student');

// GET /api/coding/questions
const getQuestions = async (req, res) => {
  try {
    const { difficulty, tag, search, department, domain_type, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (difficulty) filter.difficulty = difficulty;
    if (tag) filter.tags = tag;
    if (domain_type) filter.domain_type = domain_type;

    // ── 🔒 STRICT DOMAIN & DEPARTMENT ISOLATION ──
    const isStudentRole = req.user?.role === 'student' || (!req.admin && (req.student || req.user?.id));

    if (isStudentRole) {
      let studentObj = req.student;
      if (!studentObj && req.user?.id) {
        studentObj = await Student.findById(req.user.id).select('department');
      }

      const studentDeptRaw = (studentObj?.department || req.user?.department || '').toUpperCase().trim();
      const isEce = studentDeptRaw.includes('ECE') || studentDeptRaw.includes('ELECTRONIC');
      const isEee = studentDeptRaw.includes('EEE') || studentDeptRaw.includes('ELECTRICAL');

      if (isEce) {
        // ECE Students get ONLY ECE domain & shared embedded C / verilog / dsp questions
        filter.department = { $in: ['ECE', 'General'] };
        filter.domain_type = { $in: ['verilog', 'embedded_c', 'dsp', 'hardware_image_analysis', 'software'] };
        if (department && department.toUpperCase() === 'ECE') filter.department = 'ECE';
      } else if (isEee) {
        // EEE Students get ONLY EEE domain & shared control / embedded C questions
        filter.department = { $in: ['EEE', 'General'] };
        filter.domain_type = { $in: ['embedded_c', 'control_systems', 'software'] };
        if (department && department.toUpperCase() === 'EEE') filter.department = 'EEE';
      } else {
        // Non-ECE/EEE Students (CSE, IT, General, etc.) MUST NOT see ECE/EEE circuit/hardware questions!
        filter.department = { $nin: ['ECE', 'EEE'] };
        filter.domain_type = { $nin: ['verilog', 'embedded_c', 'dsp', 'control_systems', 'hardware_image_analysis'] };
        if (department && !['ECE', 'EEE'].includes(department.toUpperCase())) {
          filter.department = department;
        }
      }
    } else if (department) {
      filter.department = department;
    }

    // Full-text search by title, description, or tags
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchFilter = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
        delete filter.$or;
      } else {
        filter.$or = searchFilter;
      }
    }

    const skip = (page - 1) * limit;
    const questions = await CodingQuestion.find(filter)
      .select('-testCases')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await CodingQuestion.countDocuments(filter);

    res.json({
      questions,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/coding/questions/:id
const getQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    // ── 🔒 Security Check: Restrict questions strictly by student department domain ──
    const isStudentRole = req.user?.role === 'student' || (!req.admin && (req.student || req.user?.id));
    if (isStudentRole) {
      let studentObj = req.student;
      if (!studentObj && req.user?.id) {
        studentObj = await Student.findById(req.user.id).select('department');
      }
      const studentDeptRaw = (studentObj?.department || req.user?.department || '').toUpperCase().trim();
      const isEce = studentDeptRaw.includes('ECE') || studentDeptRaw.includes('ELECTRONIC');
      const isEee = studentDeptRaw.includes('EEE') || studentDeptRaw.includes('ELECTRICAL');

      const qDept = (question.department || '').toUpperCase();
      const qDomain = (question.domain_type || '').toLowerCase();

      const isEceQuestion = qDept === 'ECE' || ['verilog', 'dsp', 'hardware_image_analysis'].includes(qDomain);
      const isEeeQuestion = qDept === 'EEE' || ['control_systems'].includes(qDomain);
      const isSharedEmbeddedC = ['embedded_c'].includes(qDomain);

      if (isEce) {
        if (qDept === 'EEE' && !isSharedEmbeddedC) {
          return res.status(403).json({ message: 'Access Restricted: ECE students can only access ECE domain questions.' });
        }
      } else if (isEee) {
        if (qDept === 'ECE' && !isSharedEmbeddedC) {
          return res.status(403).json({ message: 'Access Restricted: EEE students can only access EEE domain questions.' });
        }
      } else {
        if (isEceQuestion || isEeeQuestion || isSharedEmbeddedC) {
          return res.status(403).json({ message: 'Access Restricted: Non-ECE/EEE students cannot access hardware domain questions.' });
        }
      }
    }

    // Hide expected output for hidden test cases
    const safeQuestion = question.toObject();
    safeQuestion.testCases = safeQuestion.testCases.map(tc => tc.isHidden ? { ...tc, expectedOutput: '***' } : tc);
    res.json(safeQuestion);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/coding/questions (admin only)
const createQuestion = async (req, res) => {
  try {
    const { assessmentId, ...questionData } = req.body;
    const question = await CodingQuestion.create({ ...questionData, createdBy: req.admin._id });
    
    // Link to assessment if provided
    if (assessmentId) {
      const CodingAssessment = require('../models/CodingAssessment');
      await CodingAssessment.findByIdAndUpdate(assessmentId, {
        $push: { questions: question._id }
      });
    }
    
    res.status(201).json(question);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/coding/questions/:id (update question)
const updateQuestion = async (req, res) => {
  try {
    const { title, description, difficulty, tags, examples, testCases, starterCode, timeLimit, memoryLimit, languagesSupported } = req.body;
    const question = await CodingQuestion.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    // Only creator can update
    if (question.createdBy && question.createdBy.toString() !== req.admin._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this question' });
    }
    
    if (title) question.title = title;
    if (description) question.description = description;
    if (difficulty) question.difficulty = difficulty;
    if (tags) question.tags = tags;
    if (examples) question.examples = examples;
    if (testCases) question.testCases = testCases;
    if (starterCode) question.starterCode = { ...question.starterCode, ...starterCode };
    if (timeLimit) question.timeLimit = timeLimit;
    if (memoryLimit) question.memoryLimit = memoryLimit;
    if (languagesSupported) question.languagesSupported = languagesSupported;
    
    await question.save();
    res.json(question);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/coding/questions/:id
const deleteQuestion = async (req, res) => {
  try {
    await CodingQuestion.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Question deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion };
