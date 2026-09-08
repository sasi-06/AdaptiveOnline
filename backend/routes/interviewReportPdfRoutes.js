const express = require('express');
const router = express.Router();
const { generateInterviewReportPdf } = require('../controllers/interviewReportPdfController');

router.get('/session/:sessionId/report-pdf', generateInterviewReportPdf);

module.exports = router;