const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/adaptive_exam').then(async () => {
    const Result = require('./models/Result');
    const Question = require('./models/Question');
    const results = await Result.find();
    let updated = 0;
    for (const r of results) {
        let score = 0;
        let total_marks = 0;
        for (const ans of r.answers) {
            const question = await Question.findById(ans.question_id);
            if (!question) continue;
            let is_correct = false;
            if (question.correct_answer && ans.selected_option) {
                const ca = String(question.correct_answer).trim().toLowerCase();
                const sa = String(ans.selected_option).trim().toLowerCase();
                if (ca === sa) {
                    is_correct = true;
                } else {
                    const options = question.options || [];
                    const selIndex = options.findIndex(opt => String(opt).trim().toLowerCase() === sa);
                    if (selIndex !== -1) {
                        const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
                        if (ca === letters[selIndex] || ca === String(selIndex + 1)) {
                            is_correct = true;
                        } else if (sa.startsWith(ca + ')') || sa.startsWith(ca + '.') || sa.startsWith(ca + ' ')) {
                            is_correct = true;
                        }
                    } else {
                        if (sa.startsWith(ca + ')') || sa.startsWith(ca + '.') || sa.startsWith(ca + ' ')) {
                           is_correct = true;
                        }
                    }
                }
            }
            const marks_awarded = is_correct ? question.marks : 0;
            ans.is_correct = is_correct;
            ans.marks_awarded = marks_awarded;
            score += marks_awarded;
            total_marks += question.marks;
        }
        r.score = score;
        r.total_marks = total_marks;
        await r.save();
        updated++;
    }
    console.log(`Re-evaluated ${updated} results.`);
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
