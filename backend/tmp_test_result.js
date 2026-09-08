const mongoose = require('mongoose');
const Result = require('c:/Users/Anitha/Desktop/AdaptiveOnlineExam (1)/AdaptiveOnlineExam/backend/models/Result');
require('dotenv').config({ path: 'c:/Users/Anitha/Desktop/AdaptiveOnlineExam (1)/AdaptiveOnlineExam/backend/.env' });

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/adaptive_exam');
    console.log('Connected to DB');

    const result = await Result.findOne({})
        .populate('answers.question_id', 'question_text correct_answer options marks');
    
    if (!result) {
        console.log('No results found.');
    } else {
        console.log('Found Result ID:', result._id);
        if (result.answers && result.answers.length > 0) {
            console.log('First answer question populated data:', result.answers[0].question_id);
        } else {
            console.log('Result has no answers.');
        }
    }
    await mongoose.disconnect();
}

run().catch(console.error);
