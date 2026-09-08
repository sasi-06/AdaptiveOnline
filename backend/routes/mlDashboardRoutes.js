const express = require('express');
const router = express.Router();
const TrainingData = require('../models/TrainingData');
const CodingSession = require('../models/CodingSession');
const MLPrediction = require('../models/MLPrediction');
const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001';
const LABEL_MAP = { 'Genuine': 2, 'Review Needed': 1, 'Suspicious': 0 };

// POST /api/ml/review/:sessionId
// Save a human-reviewed label for a session and create TrainingData
router.post('/review/:sessionId', async (req, res) => {
  try {
    const { classification, notes } = req.body; // 'Genuine', 'Review Needed', 'Suspicious'
    const session = await CodingSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (classification) {
      session.classification = classification;
      session.humanLabel     = classification; // Ground truth label
    }
    if (notes) session.recruiterNotes = notes;
    session.updatedAt = new Date();
    await session.save();

    // Create a training data sample
    if (classification) {
      const mlPrediction = await MLPrediction.findOne({ session: session._id });
      const existing = await TrainingData.findOne({ session: session._id });
      
      if (!existing && mlPrediction) {
        const numericLabel = LABEL_MAP[classification] ?? 1;

        await TrainingData.create({
          session: session._id,
          student: session.candidate,
          behavioralFeatures: mlPrediction.features || {},
          codeFeatures: mlPrediction.codeAnalysis || {},
          humanLabel: classification,
          numericLabel,
          mlLabel: mlPrediction.classification,
          mlScore: mlPrediction.authenticityScore,
          wasCorrect: mlPrediction.classification === classification,
          language: session.language,
          testCasesPassed: session.testCasesPassed,
          totalTestCases: session.totalTestCases,
          finalScore: session.finalScore,
        });
      }
    }
    res.json({ message: 'Session review updated', session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/ml/stats
// Get model accuracy and training sample counts
router.get('/stats', async (req, res) => {
  try {
    const totalSamples = await TrainingData.countDocuments();
    const genuineCount = await TrainingData.countDocuments({ humanLabel: 'Genuine' });
    const suspiciousCount = await TrainingData.countDocuments({ humanLabel: 'Suspicious' });
    const reviewCount = await TrainingData.countDocuments({ humanLabel: 'Review Needed' });
    const correctCount = await TrainingData.countDocuments({ wasCorrect: true });
    const modelAccuracy = totalSamples > 0 ? ((correctCount / totalSamples) * 100).toFixed(1) : 0;

    let mlStats = null;
    try {
      const { data } = await axios.get(`${ML_URL}/model-stats`, { timeout: 5000 });
      mlStats = data;
    } catch (_) {
      mlStats = { model_loaded: false, model_type: 'Unknown', last_trained: null, accuracy: 0 };
    }

    res.json({
      trainingData: {
        total: totalSamples,
        genuine: genuineCount,
        suspicious: suspiciousCount,
        reviewNeeded: reviewCount,
        modelAccuracyOnRealData: parseFloat(modelAccuracy),
      },
      mlService: mlStats,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/ml/retrain
// Sends all labeled TrainingData to ML service for retraining
router.post('/retrain', async (req, res) => {
  try {
    const samples = await TrainingData.find().lean();
    if (samples.length === 0 && !req.body.forceWithSynthetic) {
      return res.status(400).json({
        message: 'No labeled training data yet. Review and confirm some sessions first, or pass forceWithSynthetic:true.',
      });
    }

    const mlSamples = samples.map(s => ({
      eye_deviation:   s.behavioralFeatures?.off_screen_events_count ? s.behavioralFeatures.off_screen_events_count * 10 : 0,
      head_movement:   s.behavioralFeatures?.focus_loss_count ? s.behavioralFeatures.focus_loss_count * 10 : 0,
      face_scale:      0.2,
      mouse_idle_time: s.behavioralFeatures?.average_pause_duration ? s.behavioralFeatures.average_pause_duration / 1000 : 0,
      response_time:   s.duration || 60,
      label:           s.numericLabel ?? 1,
    }));

    const { data } = await axios.post(
      `${ML_URL}/retrain`,
      {
        samples: mlSamples,
        include_synthetic: true,
        synthetic_boost: req.body.syntheticBoost || 500,
      },
      { timeout: 120000 }
    );

    res.json(data);
  } catch (err) {
    console.error('Retrain error:', err.message);
    res.status(500).json({ message: err.response?.data?.detail || err.message });
  }
});

module.exports = router;
