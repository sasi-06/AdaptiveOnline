const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Student = require('../models/Student');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

// @desc  Admin login
exports.adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin || !(await admin.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        res.json({ token: generateToken(admin._id, 'admin'), role: 'admin', name: admin.username, id: admin._id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc  Student login
exports.studentLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const student = await Student.findOne({ email });
        if (!student || !(await student.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        res.json({
            token: generateToken(student._id, 'student'),
            role: 'student',
            name: student.name,
            id: student._id,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
