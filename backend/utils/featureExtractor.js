/**
 * Extracts ML feature vector from raw telemetry log
 */
const extractFeatures = (telemetry, durationSeconds) => {
  const {
    totalCharsTyped = 0,
    totalPasteCount = 0,
    totalPasteChars = 0,
    totalBackspaces = 0,
    totalBlurEvents = 0,
    totalOffScreenEvents = 0,
    totalIdleTime = 0,
    totalActiveTime = 1,
    compilationCount = 0,
    errorCount = 0,
    averagePause = 0,
    events = [],
  } = telemetry;

  const totalTime = durationSeconds || 1;
  const activeTimeSec = totalActiveTime / 1000 || 1;

  // Typing speed: chars per second (excluding paste)
  const genuineChars = Math.max(0, totalCharsTyped - totalPasteChars);
  const typing_speed = genuineChars / totalTime;

  // Average pause in seconds
  const average_pause_duration = averagePause / 1000;

  // Paste ratio: fraction of chars that were pasted
  const paste_ratio = totalCharsTyped > 0 ? totalPasteChars / totalCharsTyped : 0;

  // Edit frequency: backspaces per minute
  const edit_frequency = (totalBackspaces / totalTime) * 60;

  // Compile attempts per minute
  const compile_attempts = compilationCount;

  // Error frequency: errors per compile
  const error_frequency = compilationCount > 0 ? errorCount / compilationCount : 0;

  // Code growth rate: chars typed per second
  const code_growth_rate = totalCharsTyped / totalTime;

  // Idle ratio: fraction of time idle
  const idle_ratio = totalIdleTime / (totalTime * 1000);

  // Focus loss events
  const focus_loss_count = totalBlurEvents;

  // Off screen gaze events
  const off_screen_events_count = totalOffScreenEvents;

  // Backspace ratio: backspaces vs total keystrokes
  const backspace_ratio = totalCharsTyped > 0 ? totalBackspaces / totalCharsTyped : 0;

  // Keystroke burstiness: coefficient of variation (stddev/mean) of inter-key timings
  let keystroke_burstiness = telemetry.keystrokeBurstiness;
  if (keystroke_burstiness === null || keystroke_burstiness === undefined) {
    let intervals = telemetry.keypressIntervals || [];
    if (!intervals.length && Array.isArray(events)) {
      const batches = events.filter(e => e.type === 'keypress_interval_batch');
      for (const b of batches) {
        if (Array.isArray(b.data?.intervals)) intervals.push(...b.data.intervals);
      }
    }
    if (intervals.length >= 5) {
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (mean > 0) {
        const variance = intervals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / intervals.length;
        keystroke_burstiness = parseFloat(Math.min(2.0, Math.sqrt(variance) / mean).toFixed(4));
      } else {
        keystroke_burstiness = 0;
      }
    } else {
      // If candidate pasted everything or barely typed, burstiness is 0
      keystroke_burstiness = totalPasteCount > 0 ? 0.0 : (totalCharsTyped > 20 ? 0.25 : 0.0);
    }
  }

  // Backspace revision ratio
  const backspace_revision_ratio = parseFloat((totalCharsTyped > 0 ? totalBackspaces / totalCharsTyped : 0).toFixed(4));

  // Multi-Modal Proctoring Extra Features
  const gaze_deviation_ratio = parseFloat((totalOffScreenEvents / Math.max(1, totalTime / 60)).toFixed(4));
  const audioEvents = events.filter(e => e.type === 'speech_detected' || e.type === 'audio_warning').length;
  const audio_speech_ratio = parseFloat((audioEvents / Math.max(1, totalTime / 60)).toFixed(4));
  const multi_face_count = events.filter(e => e.type === 'multiple_faces').length;

  // AST Code Intelligence Extra Features
  const comment_density = parseFloat((events.filter(e => e.type === 'comment_added').length / Math.max(1, totalCharsTyped / 20)).toFixed(4));
  const syntax_recovery_speed = compilationCount > 0 ? parseFloat((errorCount / compilationCount).toFixed(2)) : 0;
  const cyclomatic_complexity = Math.min(25, Math.max(1, Math.round(totalCharsTyped / 45)));

  return {
    typing_speed: parseFloat(typing_speed.toFixed(4)),
    average_pause_duration: parseFloat(average_pause_duration.toFixed(4)),
    paste_ratio: parseFloat(Math.min(paste_ratio, 1).toFixed(4)),
    edit_frequency: parseFloat(edit_frequency.toFixed(4)),
    compile_attempts,
    error_frequency: parseFloat(error_frequency.toFixed(4)),
    code_growth_rate: parseFloat(code_growth_rate.toFixed(4)),
    idle_ratio: parseFloat(Math.min(idle_ratio, 1).toFixed(4)),
    focus_loss_count,
    off_screen_events_count,
    backspace_ratio: parseFloat(backspace_ratio.toFixed(4)),
    // 🌟 EXTRA MULTI-MODAL PROCTORING ML FEATURES 🌟
    keystroke_burstiness,
    backspace_revision_ratio,
    gaze_deviation_ratio,
    audio_speech_ratio,
    multi_face_count,
    eye_deviation: telemetry.eyeDeviationDegrees || 0,
    head_movement: telemetry.headMovementDegrees || 0,
    cyclomatic_complexity,
    syntax_recovery_speed,
    comment_density,
  };
};

/**
 * Compute rule-based authenticity score as fallback when ML service is down
 */
const computeFallbackScore = (features) => {
  const {
    typing_speed,
    average_pause_duration,
    paste_ratio,
    edit_frequency,
    compile_attempts,
    error_frequency,
    idle_ratio,
    focus_loss_count,
    off_screen_events_count = 0,
  } = features;

  // Score each feature 0-100
  const typingScore = Math.min(100, typing_speed * 20); // 5 chars/sec = 100
  const pauseScore = Math.max(0, 100 - average_pause_duration * 10);
  const pasteScore = Math.max(0, 100 - paste_ratio * 150);
  const editScore = Math.min(100, edit_frequency * 5);
  const compileScore = Math.min(100, compile_attempts * 15);
  const idleScore = Math.max(0, 100 - idle_ratio * 200);
  const focusScore = Math.max(0, 100 - focus_loss_count * 15);
  const offScreenScore = Math.max(0, 100 - off_screen_events_count * 20);

  const score =
    0.20 * typingScore +
    0.15 * pauseScore +
    0.20 * pasteScore +
    0.15 * editScore +
    0.10 * compileScore +
    0.05 * idleScore +
    0.05 * focusScore +
    0.10 * offScreenScore;

  const finalScore = Math.round(Math.min(100, Math.max(0, score)));

  let classification, riskLevel;
  if (finalScore >= 80) { classification = 'Genuine'; riskLevel = 'Low'; }
  else if (finalScore >= 50) { classification = 'Review Needed'; riskLevel = 'Medium'; }
  else { classification = 'Suspicious'; riskLevel = 'High'; }

  return { authenticityScore: finalScore, classification, riskLevel, confidence: 75 };
};

/**
 * Detect and generate suspicious alerts from events
 */
const detectAlerts = (telemetry) => {
  const alerts = [];
  const { totalPasteChars = 0, totalBlurEvents = 0, totalOffScreenEvents = 0, totalIdleTime = 0, totalPasteCount = 0, events = [] } = telemetry;

  if (totalPasteChars > 200) {
    alerts.push({ type: 'large_paste', severity: 'high', message: `Large code block pasted (${totalPasteChars} chars)` });
  }
  if (totalBlurEvents > 5) {
    alerts.push({ type: 'focus_loss', severity: 'medium', message: `Excessive focus loss detected (${totalBlurEvents} times)` });
  }
  if (totalIdleTime > 120000) {
    alerts.push({ type: 'excessive_idle', severity: 'medium', message: `Excessive idle time: ${Math.round(totalIdleTime / 1000)}s` });
  }
  if (totalPasteCount > 3) {
    alerts.push({ type: 'suspicious_pattern', severity: 'high', message: `${totalPasteCount} paste events detected` });
  }
  if (totalOffScreenEvents > 0) {
    alerts.push({ type: 'off_screen_gaze', severity: 'high', message: `Candidate looked away from screen ${totalOffScreenEvents} time(s)` });
  }

  return alerts;
};

module.exports = { extractFeatures, computeFallbackScore, detectAlerts };
