const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const fs = require('fs');
require('./models/Student');
require('./models/InterviewDefinition');
const InterviewSession = require('./models/InterviewSession');
const MONGO_URI = 'mongodb+srv://ProductDevelopment:saj123@cluster0.qkaxnyb.mongodb.net/Exams';
async function run() {
    await mongoose.connect(MONGO_URI);
    const session = await InterviewSession.findOne({ status: 'completed' }).populate('student', 'name email').populate('interview', 'title').lean();
    const doc = new PDFDocument({ margin: 50, size: 'A4', compress: false });
    const writeStream = fs.createWriteStream('test_uncompressed.pdf');
    doc.pipe(writeStream);
    doc.fontSize(20).fillColor('#1e293b').text('AI Technical Interview Report', { align: 'center' });
    doc.fontSize(11).fillColor('#64748b').text(session.interview?.title || 'Interview Round', { align: 'center' });
    doc.text(`Role: ${session.selectedRole || 'General'}`);
    (session.qa_pairs || []).forEach((qa, idx) => {
        doc.text(`Q${idx + 1}: ${qa.question}`);
    });
    doc.end();
    writeStream.on('finish', () => process.exit(0));
}
run();
