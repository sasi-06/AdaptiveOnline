const PDFDocument = require('pdfkit');
// Adjust this path/name to match your actual interview session model file.
const InterviewSession = require('../models/InterviewSession');

/**
 * GET /api/interviews/session/:sessionId/report-pdf
 *
 * Generates a PDF report on demand (not pre-stored like the coding round's
 * reportPath — this builds it fresh each time, which is simpler and always
 * reflects the latest data). Streams it straight back as a download.
 *
 * Requires: npm install pdfkit
 */
exports.generateInterviewReportPdf = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await InterviewSession.findById(sessionId)
            .populate('student', 'name email')
            .populate('interview', 'title')
            .lean();

        if (!session) {
            return res.status(404).json({ message: 'Interview session not found' });
        }

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const fileName = `Interview_Report_${(session.student?.name || 'Candidate').replace(/\s+/g, '_')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        doc.pipe(res);

        // ── Header ──
        doc.fontSize(20).fillColor('#1e293b').text('AI Technical Interview Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor('#64748b').text(session.interview?.title || 'Interview Round', { align: 'center' });
        doc.moveDown(1.2);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        // ── Candidate info ──
        doc.fontSize(13).fillColor('#0f172a').text(`Candidate: ${session.student?.name || 'Unknown'}`);
        doc.fontSize(10).fillColor('#64748b').text(`Email: ${session.student?.email || 'N/A'}`);
        doc.text(`Role: ${session.selectedRole || 'General'}`);
        doc.text(`Date: ${new Date(session.updatedAt).toLocaleString()}`);
        doc.moveDown(1);

        // ── Score & recommendation ──
        const scoreColor = session.finalScore >= 80 ? '#10b981' : session.finalScore >= 60 ? '#f59e0b' : '#ef4444';
        doc.fontSize(16).fillColor(scoreColor).text(`Final Score: ${session.finalScore || 0}/100`);
        doc.fontSize(11).fillColor('#0f172a').text(`Hiring Recommendation: ${session.report?.hiringRecommendation || 'N/A'}`);
        doc.moveDown(1);

        // ── Strengths / Weaknesses ──
        doc.fontSize(12).fillColor('#10b981').text('Strengths', { underline: true });
        doc.fontSize(10).fillColor('#334155');
        (session.report?.strengths || ['None noted']).forEach((s) => doc.text(`• ${s}`));
        doc.moveDown(0.6);

        doc.fontSize(12).fillColor('#ef4444').text('Weaknesses', { underline: true });
        doc.fontSize(10).fillColor('#334155');
        (session.report?.weaknesses || ['None noted']).forEach((w) => doc.text(`• ${w}`));
        doc.moveDown(1);

        // ── Q&A Matrix ──
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(0.6);
        doc.fontSize(14).fillColor('#0f172a').text('Detailed Q&A Mapping', { underline: true });
        doc.moveDown(0.5);

        (session.qa_pairs || []).forEach((qa, idx) => {
            if (doc.y > 700) doc.addPage(); // simple page-break guard

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

        // ── Proctoring summary ──
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
    } catch (err) {
        console.error('generateInterviewReportPdf error:', err);
        // Note: if headers are already sent (mid-stream), this won't reach the client cleanly.
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate PDF report' });
        }
    }
};