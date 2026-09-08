const Student = require('../models/Student');
const Exam = require('../models/Exam');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');

// @desc  Create student (Admin only)
exports.createStudent = async (req, res) => {
    try {
        const { name, email, password, rollno, gender, age, phone_number, department, year_of_study, college } = req.body;
        const exists = await Student.findOne({ email });
        if (exists) return res.status(400).json({ message: 'Student already exists' });
                const student = new Student({ 
            name, 
            email, 
            password, 
            rollno: rollno || '',
            gender: gender || '',
            age: age || null,
            phone_number: phone_number || '',
            department: department || '',
            year_of_study: year_of_study || '',
            college: college || ''
        });
        const { syncStudentProgress } = require('./departmentController');
        await syncStudentProgress(student);
        await student.save();
        res.status(201).json({ 
            _id: student._id, 
            name: student.name, 
            email: student.email,
            rollno: student.rollno,
            gender: student.gender,
            age: student.age,
            phone_number: student.phone_number,
            department: student.department,
            year_of_study: student.year_of_study,
            college: student.college
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Bulk upload students from Excel file
exports.bulkUploadStudents = async (req, res) => {
    try {
        console.log('=== BULK UPLOAD START ===');
        console.log('Request file:', req.file ? 'exists' : 'missing');
        console.log('Request body:', req.body);
        
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('File details:', {
            name: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // Read the Excel file
        let workbook;
        try {
            workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        } catch (readErr) {
            console.error('Error reading Excel file:', readErr);
            return res.status(400).json({ message: 'Invalid Excel file format' });
        }

        const sheetName = workbook.SheetNames[0];
        console.log('Sheet name:', sheetName);
        
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const studentsData = XLSX.utils.sheet_to_json(worksheet, { 
            defval: '',  // Default value for empty cells
            raw: false   // Don't preserve raw values
        });

        console.log('=== PARSED DATA ===');
        console.log('Total rows:', studentsData.length);
        console.log('First row sample:', studentsData[0]);
        console.log('====================');

        if (!studentsData || studentsData.length === 0) {
            return res.status(400).json({ message: 'Excel file has no data rows' });
        }

        const errors = [];
        const createdStudents = [];

        // Process each row
        for (let i = 0; i < studentsData.length; i++) {
            const studentData = studentsData[i];
            const rowNumber = i + 2; // Excel rows start at 1, plus header row

            try {
                // Get values - handle different possible column name variations
                // Note: Excel columns might have different cases
                const name = String(
                    studentData.name || 
                    studentData.Name || 
                    studentData.NAME || 
                    studentData['Full Name'] || 
                    studentData['full name'] || 
                    studentData['FULL NAME'] || 
                    ''
                ).trim();
                const email = String(studentData.email || studentData.Email || studentData.EMAIL || studentData.Email || '').trim().toLowerCase();
                const password = String(studentData.password || studentData.Password || studentData.Password || '').trim();

                console.log(`Row ${rowNumber}: name="${name}", email="${email}", password="${password ? 'set' : 'missing'}"`);

                // Validate required fields
                if (!name || !email || !password) {
                    errors.push(`Row ${rowNumber}: Missing required fields - name: "${name || 'MISSING'}", email: "${email || 'MISSING'}", password: "${password ? '***' : 'MISSING'}"`);
                    continue;
                }

                // Check if student already exists
                const exists = await Student.findOne({ email: email.toLowerCase() });
                if (exists) {
                    errors.push(`Row ${rowNumber}: Student with email ${email} already exists`);
                    continue;
                }

                // Don't hash here - the model's pre-save hook will handle it
                const student = new Student({
                    name: name,
                    email: email.toLowerCase(),
                    password: password,
                    rollno: studentData.rollno || studentData.Rollno || studentData['Roll No'] || studentData.rollno || '',
                    gender: studentData.gender || studentData.Gender || studentData.sex || studentData.Sex || '',
                    age: (studentData.age || studentData.Age) ? parseInt(studentData.age || studentData.Age) : null,
                    phone_number: studentData.phone_number || studentData.phone || studentData.Phone || studentData['Phone Number'] || studentData['Mobile'] || '',
                    department: studentData.department || studentData.Department || studentData.dept || studentData.Dept || '',
                    year_of_study: studentData.year_of_study || studentData.year || studentData.Year || studentData['Year of Study'] || '',
                    college: studentData.college || studentData.College || studentData.institution || studentData.Institution || studentData['College Name'] || ''
                });

                const { syncStudentProgress } = require('./departmentController');
                await syncStudentProgress(student);
                await student.save();

                createdStudents.push({
                    name: student.name,
                    email: student.email
                });
            } catch (err) {
                console.error(`Error creating student at row ${rowNumber}:`, err);
                errors.push(`Row ${rowNumber}: ${err.message}`);
            }
        }

        console.log('=== UPLOAD COMPLETE ===');
        console.log('Created:', createdStudents.length);
        console.log('Errors:', errors.length);
        console.log('========================');

        res.status(201).json({
            message: `Successfully created ${createdStudents.length} students. ${errors.length} errors.`,
            created: createdStudents,
            errors: errors.length > 0 ? errors : undefined,
            totalCreated: createdStudents.length,
            totalErrors: errors.length
        });
    } catch (err) {
        console.error('Bulk upload error:', err);
        res.status(500).json({ message: err.message });
    }
};

// @desc  Get all students
exports.getStudents = async (req, res) => {
    try {
        const students = await Student.find().select('-password').populate('assigned_exams', 'title');
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Get single student
exports.getStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .select('-password')
            .populate('assigned_exams');
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });

        // Update fields
        Object.keys(req.body).forEach(key => {
            student[key] = req.body[key];
        });

        // Sync department progress if department changed
        const { syncStudentProgress } = require('./departmentController');
        await syncStudentProgress(student);

        await student.save();
        
        // Return updated student (excluding password)
        const updated = await Student.findById(student._id).select('-password');
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Delete student
exports.deleteStudent = async (req, res) => {
    try {
        await Student.findByIdAndDelete(req.params.id);
        res.json({ message: 'Student removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
