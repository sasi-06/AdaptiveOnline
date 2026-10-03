const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const fs = require('fs');
require('./models/Student');
require('./models/InterviewDefinition');
const InterviewSession = require('./models/InterviewSession');

const MONGO_URI = 'mongodb+srv://ProductDevelopment:saj123@cluster0.qkaxnyb.mongodb.net/Exams';

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    const session = await InterviewSession.findOne({ status: 'completed' })
        .populate('student', 'name email')
        .populate('interview', 'title')
        .lean();

    if (!session) {
        console.log('No completed session found');
        process.exit(0);
    }

    console.log('Session ID:', session._id);
    
    try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const writeStream = fs.createWriteStream('test_output.pdf');
        doc.pipe(writeStream);

        doc.fontSize(20).fillColor('#1e293b').text('AI Technical Interview Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor('#64748b').text(session.interview?.title || 'Interview Round', { align: 'center' });
        doc.moveDown(1.2);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(13).fillColor('#0f172a').text(`Candidate: ${session.student?.name || 'Unknown'}`);
        doc.fontSize(10).fillColor('#64748b').text(`Email: ${session.student?.email || 'N/A'}`);
        doc.text(`Role: ${session.selectedRole || 'General'}`);
        doc.text(`Date: ${new Date(session.updatedAt).toLocaleString()}`);
        doc.moveDown(1);

        const scoreColor = session.finalScore >= 80 ? '#10b981' : session.finalScore >= 60 ? '#f59e0b' : '#ef4444';
        doc.fontSize(16).fillColor(scoreColor).text(`Final Score: ${session.finalScore || 0}/100`);
        doc.fontSize(11).fillColor('#0f172a').text(`Hiring Recommendation: ${session.report?.hiringRecommendation || 'N/A'}`);
        doc.moveDown(1);

        doc.fontSize(12).fillColor('#10b981').text('Strengths', { underline: true });
        doc.fontSize(10).fillColor('#334155');
        (session.report?.strengths || ['None noted']).forEach((s) => doc.text(`• ${s}`));
        doc.moveDown(0.6);

        doc.fontSize(12).fillColor('#ef4444').text('Weaknesses', { underline: true });
        doc.fontSize(10).fillColor('#334155');
        (session.report?.weaknesses || ['None noted']).forEach((w) => doc.text(`• ${w}`));
        doc.moveDown(1);

        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(0.6);
        doc.fontSize(14).fillColor('#0f172a').text('Detailed Q&A Mapping', { underline: true });
        doc.moveDown(0.5);

        (session.qa_pairs || []).forEach((qa, idx) => {
            if (doc.y > 700) doc.addPage();

            doc.fontSize(11).fillColor('#4338ca').text(`Q${idx + 1}: ${qa.question}`);
            doc.fontSize(9).fillColor('#64748b').text(`Relevance Score: ${qa.score || 0}/100`);
            doc.moveDown(0.3);
            doc.fontSize(10).fillColor('#059669').text('Expected Answer (AI):', { continued: false });
            doc.fontSize(9).fillColor('#334155').text(qa.expectedAnswer || 'No expected answer generated.');
            doc.moveDown(0.3);
            doc.fontSize(10).fillColor('#0f172a').text("Candidate's Transcript:");
            doc.fontSize(9).fillColor('#334155').text(qa.answer || 'No answer provided.');
            if (qa.feedback) {
                doc.moveDown(0.2);
                doc.fontSize(9).fillColor('#64748b').text(`Feedback: ${qa.feedback}`);
            }
            doc.moveDown(0.8);
        });

        if (session.cheatingClips && session.cheatingClips.length > 0) {
            if (doc.y > 650) doc.addPage();
            doc.moveDown(0.4);
            doc.fontSize(14).fillColor('#ef4444').text('Proctoring Flags', { underline: true });
            doc.moveDown(0.4);
            session.cheatingClips.forEach((c) => {
                doc.fontSize(9).fillColor('#334155').text(
                    `• ${c.reason} — ${new Date(c.timestamp).toLocaleString()}`
                );
            });
        }

        doc.end();
        
        writeStream.on('finish', () => {
            console.log('PDF generated successfully');
            process.exit(0);
        });
        
    } catch (err) {
        console.error('Error generating PDF:', err);
    }
}

run();
