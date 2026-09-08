const TelemetryLog = require('../models/TelemetryLog');
const Alert = require('../models/Alert');
const CodingSession = require('../models/CodingSession');

/**
 * Computes keystroke burstiness (coefficient of variation of inter-key intervals).
 * A real human has natural variance (burstiness > 0.05).
 * A bot or copy-paster has very uniform or zero intervals (burstiness ≈ 0).
 * 
 * Formula: CV = stddev(intervals) / mean(intervals)
 * Capped at 1.0 for normalization.
 */
function computeBurstiness(intervals) {
  if (!intervals || intervals.length < 5) return null; // not enough data
  const n = intervals.length;
  const mean = intervals.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  const variance = intervals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const stddev = Math.sqrt(variance);
  // Coefficient of Variation (CV) — normalized by mean
  // Human typing CV typically 0.3–1.5, bots < 0.05
  return parseFloat(Math.min(2.0, stddev / mean).toFixed(4));
}

const setupSocket = (io) => {
  io.on('connection', (socket) => {

    // ── TELEMETRY: Real-time batch event ingestion ──────────────────────────
    socket.on('telemetry_batch', async (payload) => {
      const { sessionId, events } = payload;
      if (!sessionId || !events?.length) return;

      try {
        const telemetry = await TelemetryLog.findOne({ session: sessionId });
        if (!telemetry) return;

        // Append all raw events (for full burstiness computation at submit time)
        telemetry.events.push(...events);

        // Collect inter-key intervals from this batch for live burstiness
        const batchIntervals = [];

        // ── Process each event type ──────────────────────────────────────────
        for (const event of events) {
          switch (event.type) {

            // Individual keypress (character typed)
            case 'keypress':
              telemetry.totalKeystrokes++;
              telemetry.totalCharsTyped++;
              break;

            // Backspace / delete
            case 'backspace':
              telemetry.totalBackspaces++;
              telemetry.totalKeystrokes++;
              break;

            // Batch of inter-key intervals (emitted every 10 keystrokes)
            case 'keypress_interval_batch':
              if (Array.isArray(event.data?.intervals)) {
                batchIntervals.push(...event.data.intervals);
                // Store intervals compactly in a running array on the telemetry doc
                if (!telemetry.keypressIntervals) telemetry.keypressIntervals = [];
                telemetry.keypressIntervals.push(...event.data.intervals);
                // Update running average pause
                const validIntervals = event.data.intervals.filter(i => i > 0 && i < 5000);
                if (validIntervals.length > 0) {
                  const batchAvg = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
                  telemetry.averagePause = telemetry.averagePause === 0
                    ? batchAvg
                    : Math.round(telemetry.averagePause * 0.8 + batchAvg * 0.2);
                }
              }
              break;

            // Paste event (✅ matches frontend 'paste')
            case 'paste':
              telemetry.totalPasteCount++;
              telemetry.totalPasteChars += event.data?.length || event.data?.chars || 0;
              telemetry.totalCharsTyped += event.data?.length || 0;
              if ((event.data?.length || 0) > 100) {
                await Alert.create({
                  session: sessionId,
                  candidate: telemetry.candidate,
                  type: 'large_paste',
                  severity: 'high',
                  message: `Large paste detected: ${event.data.length} characters`,
                  timestamp: event.timestamp || Date.now(),
                });
              }
              break;

            // Tab switch / focus loss (✅ matches frontend 'tab_switch')
            case 'tab_switch':
              if (event.data?.state === 'hidden') {
                telemetry.totalBlurEvents++;
                telemetry.totalTabSwitches = (telemetry.totalTabSwitches || 0) + 1;
                await Alert.create({
                  session: sessionId,
                  candidate: telemetry.candidate,
                  type: 'tab_switch',
                  severity: 'medium',
                  message: 'Tab switch detected',
                  timestamp: event.timestamp || Date.now(),
                });
              }
              break;

            // Off-screen gaze from camera proctoring
            case 'off_screen_gaze':
              telemetry.totalOffScreenEvents = (telemetry.totalOffScreenEvents || 0) + 1;
              await Alert.create({
                session: sessionId,
                candidate: telemetry.candidate,
                type: 'off_screen_gaze',
                severity: 'medium',
                message: 'Off-screen gaze detected',
                timestamp: event.timestamp || Date.now(),
              });
              break;

            // Audio volume spike / background noise
            case 'audio_noise_spike':
              telemetry.totalAudioNoiseEvents = (telemetry.totalAudioNoiseEvents || 0) + 1;
              break;

            // Voice / Speech detected
            case 'speech_detected':
              telemetry.totalSpeechDetectedEvents = (telemetry.totalSpeechDetectedEvents || 0) + 1;
              await Alert.create({
                session: sessionId,
                candidate: telemetry.candidate,
                type: 'speech_detected',
                severity: 'high',
                message: `Secondary speech / voice activity detected during coding session`,
                timestamp: event.timestamp || Date.now(),
              });
              break;

            // Head / body movement delta
            case 'head_movement':
              telemetry.headMovementIntensity = (telemetry.headMovementIntensity || 0) + Math.min(50, Math.round(event.data?.delta || 0));
              break;

            // Candidate Initial Photo Snapshot
            case 'candidate_snapshot':
              if (event.data?.snapshot && !telemetry.candidateSnapshot) {
                telemetry.candidateSnapshot = event.data.snapshot;
              }
              break;

            // Live Eye Deviation & Head Pose Angle in Degrees
            case 'gaze_pose_degrees':
              if (typeof event.data?.eyeDeviation === 'number') {
                telemetry.eyeDeviationDegrees = Math.max(telemetry.eyeDeviationDegrees || 0, event.data.eyeDeviation);
              }
              if (typeof event.data?.headMovement === 'number') {
                telemetry.headMovementDegrees = Math.max(telemetry.headMovementDegrees || 0, event.data.headMovement);
              }
              if (typeof event.data?.faceScale === 'number') {
                telemetry.faceScale = event.data.faceScale;
              }
              break;

            // Idle pause longer than 5 seconds
            case 'idle_pause':
              telemetry.totalIdleTime = (telemetry.totalIdleTime || 0) + (event.data?.duration || 0);
              if ((event.data?.duration || 0) > 60000) {
                await Alert.create({
                  session: sessionId,
                  candidate: telemetry.candidate,
                  type: 'excessive_idle',
                  severity: 'medium',
                  message: `Idle pause: ${Math.round((event.data?.duration||0)/1000)}s`,
                  timestamp: event.timestamp || Date.now(),
                });
              }
              break;

            // Compilation attempt
            case 'compile':
              telemetry.compilationCount++;
              break;
          }
        }

        // ── Compute live keystroke_burstiness and store it ──────────────────
        // Use all accumulated intervals if we have a big enough sample
        const allIntervals = telemetry.keypressIntervals || [];
        if (allIntervals.length >= 10) {
          const burstiness = computeBurstiness(allIntervals);
          if (burstiness !== null) {
            telemetry.keystrokeBurstiness = burstiness;
          }
        }

        telemetry.updatedAt = new Date();
        await telemetry.save();

      } catch (err) {
        console.error('Telemetry error:', err.message);
      }
    });

    socket.on('disconnect', () => {});
  });
};

module.exports = { setupSocket };
