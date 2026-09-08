const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');

// GET /api/alerts/all
// Fetch all security alerts
router.get('/all', async (req, res) => {
    try {
        const alerts = await Alert.find()
            .populate('candidate', 'name email')
            .populate({
                path: 'session',
                populate: { path: 'question', select: 'title' }
            })
            .sort({ createdAt: -1 });
        res.json(alerts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
