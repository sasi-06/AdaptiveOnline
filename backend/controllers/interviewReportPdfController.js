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

        // ── Resume Insights (Extracted Data) ──
        if (session.extractedData) {
            doc.fontSize(12).fillColor('#4338ca').text('Resume Insights', { underline: true });
            doc.moveDown(0.4);
            doc.fontSize(10).fillColor('#334155');
            doc.text(`Experience Level: ${session.extractedData.experience || 'Not specified'}`);
            doc.moveDown(0.2);
            doc.text(`Key Skills: ${(session.extractedData.skills || []).join(', ') || 'None extracted'}`);
            doc.moveDown(0.2);
            doc.text(`Detected Projects: ${(session.extractedData.projects || []).join(', ') || 'None extracted'}`);
            doc.moveDown(1);
        }

        // ── Score & recommendation ──
        const scoreColor = session.finalScore >= 80 ? '#10b981' : session.finalScore >= 60 ? '#f59e0b' : '#ef4444';
        doc.fontSize(16).fillColor(scoreColor).text(`Final Score: ${session.finalScore || 0}/100`);
        doc.fontSize(11).fillColor('#0f172a').text(`Hiring Recommendation: ${session.report?.hiringRecommendation || 'N/A'}`);
        doc.moveDown(1);

        // ── Strengths / Weaknesses ──
        doc.fontSize(12).fillColor('#10b981').text('Strengths', { underline: true });
        doc.fontSize(10).fillColor('#334155');
        (session.report?.strengths || ['None noted']).forEach((s) => doc.text(`• ${String(s)}`));
        doc.moveDown(0.6);

        doc.fontSize(12).fillColor('#ef4444').text('Weaknesses', { underline: true });
        doc.fontSize(10).fillColor('#334155');
        (session.report?.weaknesses || ['None noted']).forEach((w) => doc.text(`• ${String(w)}`));
        doc.moveDown(1);

        // ── Q&A Matrix ──
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(0.6);
        doc.fontSize(14).fillColor('#0f172a').text('Detailed Q&A Mapping', { underline: true });
        doc.moveDown(0.5);

        (session.qa_pairs || []).forEach((qa, idx) => {
            if (doc.y > 680) doc.addPage(); // Adjusted page-break guard

            doc.fontSize(11).fillColor('#4338ca').text(`Q${idx + 1}: ${String(qa.question || 'No question recorded')}`);
            
            doc.fontSize(9).fillColor('#64748b').text(`Relevance Score: ${qa.score || 0}/100`, { continued: true });
            doc.text(`  |  Time Taken: ${qa.timeTaken || 0}s`);
            
            doc.moveDown(0.3);
            doc.fontSize(10).fillColor('#059669').text('Expected Answer (AI):');
            doc.fontSize(9).fillColor('#334155').text(String(qa.expectedAnswer || 'No expected answer generated.'));
            
            doc.moveDown(0.3);
            doc.fontSize(10).fillColor('#0f172a').text("Candidate's Transcript:");
            doc.fontSize(9).fillColor('#334155').text(String(qa.answer || 'No answer provided.'));
            
            if (qa.feedback) {
                doc.moveDown(0.2);
                doc.fontSize(9).fillColor('#64748b').text(`Feedback: ${String(qa.feedback)}`);
            }
            doc.moveDown(0.8);
        });

        // ── Behavior Timeline / Proctoring Flags ──
        if (session.cheatingClips && session.cheatingClips.length > 0) {
            if (doc.y > 600) doc.addPage();
            doc.moveDown(1);
            doc.fontSize(14).fillColor('#ef4444').text('Behavior Timeline (Proctoring Flags)', { underline: true });
            doc.moveDown(0.8);
            
            session.cheatingClips.forEach((c) => {
                if (doc.y > 650) doc.addPage();
                
                const dotX = 55;
                const textX = 75;
                
                // Draw Timeline Dot
                doc.circle(dotX, doc.y + 4, 3).lineWidth(2).strokeColor('#ef4444').stroke();
                
                doc.fontSize(10).fillColor('#10b981').text(new Date(c.timestamp).toLocaleTimeString(), textX, doc.y);
                doc.moveDown(0.2);
                doc.fontSize(11).fillColor('#0f172a').text(`Violation: ${String(c.reason || 'Anomaly Detected')}`, textX, doc.y);
                doc.moveDown(0.4);
                
                if (c.videoUrl) {
                    try {
                        let imagePathOrBuffer = null;
                        if (c.videoUrl.startsWith('data:image')) {
                            const base64Data = c.videoUrl.replace(/^data:image\/\w+;base64,/, '');
                            imagePathOrBuffer = Buffer.from(base64Data, 'base64');
                        } else if (c.videoUrl.startsWith('/uploads')) {
                            const fs = require('fs');
                            const path = require('path');
                            const localPath = path.join(__dirname, '..', c.videoUrl);
                            if (fs.existsSync(localPath)) {
                                imagePathOrBuffer = localPath;
                            }
                        }
                        
                        if (imagePathOrBuffer) {
                            doc.fontSize(9).fillColor('#64748b').text('Visual Proof Snapshot:', textX, doc.y);
                            doc.moveDown(0.4);
                            
                            // Load buffer to check signature
                            let bufferToCheck = imagePathOrBuffer;
                            if (typeof imagePathOrBuffer === 'string') {
                                bufferToCheck = require('fs').readFileSync(imagePathOrBuffer);
                            }
                            
                            // Check if JPEG (FF D8 FF) or PNG (89 50 4E 47)
                            const isJpeg = bufferToCheck.length >= 3 && bufferToCheck[0] === 0xFF && bufferToCheck[1] === 0xD8 && bufferToCheck[2] === 0xFF;
                            const isPng = bufferToCheck.length >= 4 && bufferToCheck[0] === 0x89 && bufferToCheck[1] === 0x50 && bufferToCheck[2] === 0x4E && bufferToCheck[3] === 0x47;
                            
                            if (isJpeg || isPng) {
                                // Check space for image (approx 180pt height)
                                if (doc.y + 180 > 750) {
                                    doc.addPage();
                                }
                                
                                // Let pdfkit flow the image naturally so it updates doc.y
                                doc.x = textX;
                                doc.image(bufferToCheck, { width: 250 });
                                doc.x = 50; // reset
                            } else {
                                doc.fontSize(9).fillColor('#ef4444').text('[Image format not supported in PDF]', textX, doc.y);
                            }
                        }
                    } catch (imgErr) {
                        console.warn('PDF Image embed error:', imgErr.message);
                    }
                }
                
                doc.moveDown(1.5);
            });
        }

        doc.end();
    } catch (err) {
        console.error('generateInterviewReportPdf error:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate PDF report' });
        }
    }
};