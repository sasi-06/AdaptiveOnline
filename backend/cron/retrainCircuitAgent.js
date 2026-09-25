/**
 * retrainCircuitAgent.js
 *
 * Self-improvement loop trigger for the circuit evaluation agent.
 * Periodically calls the local Python ML service to retrain flat and GNN models
 * using accumulated student submissions and synthetic data.
 */

'use strict';

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001';

async function triggerRetrain() {
    console.log('[CircuitAgent Retrain] Triggering local agent retraining...');
    try {
        const res = await axios.post(`${ML_SERVICE_URL}/retrain-circuit-agent`, {}, { timeout: 600000 });
        console.log('[CircuitAgent Retrain] Success:', res.data.status);
        return res.data;
    } catch (err) {
        console.error('[CircuitAgent Retrain] Retrain failed:', err.response?.data || err.message);
        throw err;
    }
}

// Scheduled check: Runs once every 24 hours to check if monthly trigger is reached (or can be triggered on demand)
function initCircuitRetrainSchedule() {
    console.log('[CircuitAgent Retrain] Retrain scheduler initialized.');
    
    // Check every 24 hours: if today is 1st of month, trigger retrain
    setInterval(() => {
        const now = new Date();
        if (now.getDate() === 1 && now.getHours() === 2) {
            triggerRetrain().catch(() => {});
        }
    }, 60 * 60 * 1000); // Hourly check
}

module.exports = { triggerRetrain, initCircuitRetrainSchedule };
