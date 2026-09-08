const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Student = require('../models/Student');

const mongoose = require('mongoose');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            if (!token || token === 'undefined' || token === 'null') {
                return res.status(401).json({ message: 'Not authorized, invalid token format' });
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;

            if (!decoded.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
                return res.status(401).json({ message: 'Not authorized, invalid token payload' });
            }

            if (decoded.role === 'admin') {
                req.admin = await Admin.findById(decoded.id).select('-password');
                if (!req.admin) {
                    return res.status(401).json({ message: 'Not authorized, admin user not found' });
                }
            } else if (decoded.role === 'student') {
                req.student = await Student.findById(decoded.id).select('-password');
                if (!req.student) {
                    return res.status(401).json({ message: 'Not authorized, student user not found' });
                }
            }
            return next();
        } catch (err) {
            console.error('Auth verification error:', err.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
};

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    res.status(403).json({ message: 'Admin access only' });
};

const studentOnly = (req, res, next) => {
    if (req.user && req.user.role === 'student') return next();
    res.status(403).json({ message: 'Student access only' });
};

module.exports = { protect, adminOnly, studentOnly };
