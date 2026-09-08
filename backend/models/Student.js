const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rollno: { type: String, required: false },
    gender: { type: String, default: '' },
    age: { type: Number, required: false },
    phone_number: { type: String, required: false },
    department: { type: String, required: false },
    year_of_study: { type: String, required: false },
    college: { type: String, required: false },

    assigned_exams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],

    round_progress: [{
        round_name: { type: String, required: true },
        status: { type: String, default: 'Pending' }, // Pending, In Progress, Completed, Cleared, Failed
        score: { type: String, default: '' }
    }],
}, { timestamps: true });

StudentSchema.pre('save', async function (next) {
    // Only hash if the password is not already hashed
    // (not bcrypt hash format = not hashed yet)
    if (!this.password.startsWith('$2')) {
        if (!this.isModified('password')) return next();
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

StudentSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Student', StudentSchema);
