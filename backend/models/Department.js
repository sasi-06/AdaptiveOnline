const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // e.g. "CSE", "ECE", "EEE", "IT", "Mechanical", "Civil"
    rounds: [{ type: String }], // e.g. ["MCQ Test", "Coding Round", "Technical Interview"]
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', default: null } // Linked MCQ exam for the recruitment drive
}, { timestamps: true });

module.exports = mongoose.model('Department', DepartmentSchema);
