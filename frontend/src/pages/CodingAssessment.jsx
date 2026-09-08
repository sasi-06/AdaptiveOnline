import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { Play, Send, Clock, CheckCircle, AlertTriangle, Terminal, Loader, Brain, Shield, ArrowRight } from 'lucide-react';

import CodingNavbar from '../components/CodingNavbar';
import AlertBanner from '../components/AlertBanner';
import HardwareWaveformViewer from '../components/HardwareWaveformViewer';
import HardwareImageViewer from '../components/HardwareImageViewer';
import CircuitSchematicViewer from '../components/CircuitSchematicViewer';
import api from '../services/api';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

const LANGUAGES = [
  { value: 'python', label: 'Python 3', monacoLang: 'python', icon: '🐍' },
  { value: 'javascript', label: 'JavaScript', monacoLang: 'javascript', icon: 'JS' },
  { value: 'java', label: 'Java', monacoLang: 'java', icon: '☕' },
  { value: 'cpp', label: 'C++', monacoLang: 'cpp', icon: 'C++' },
  { value: 'verilog', label: 'Verilog HDL (ECE)', monacoLang: 'verilog', icon: '⚡' },
  { value: 'c_embedded', label: 'Embedded C (ECE/EEE)', monacoLang: 'cpp', icon: '🔌' },
];

export default function CodingAssessment() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();
  const { theme: t, isDarkMode } = useTheme();

  // State
  const [questions, setQuestions] = useState([]);
  const [selectedQ, setSelectedQ] = useState(null);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [session, setSessionState] = useState(null);
  const [phase, setPhase] = useState('select'); // select | coding | result | conceptual
  const [conceptualQuestions, setConceptualQuestions] = useState([]);
  const [conceptualAnswers, setConceptualAnswers] = useState({});
  const [timer, setTimer] = useState(0);
  const [output, setOutput] = useState('');
  const [runLoading, setRunLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [telemetryStats, setTelemetryStats] = useState({ 
    totalKeystrokes: 0, 
    totalPasteCount: 0, 
    totalPasteChars: 0,    // actual characters pasted (for ML paste_ratio)
    compilationCount: 0, 
    averagePause: 0, 
    totalTabSwitches: 0 
  });
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('description');
  const [userInput, setUserInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [recentSessions, setRecentSessions] = useState([]);
  const [assignedQuestions, setAssignedQuestions] = useState(new Set());
  const [cameraDenied, setCameraDenied] = useState(false);
  const [faceAlert, setFaceAlert] = useState(null); // null | 'no_face' | 'multiple_faces'
  const faceAlertTimeoutRef = useRef(null);

  // Refs for telemetry & socket
  const sessionRef = useRef(null);
  const startTimeRef = useRef(null);
  const telemetryBatch = useRef([]);
  const lastKeypressRef = useRef(null);
  const keypressIntervalsRef = useRef([]);  // ← stores real inter-key intervals (ms)
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const flushRef = useRef(null);
  const videoRef = useRef(null);
  const faceModelRef = useRef(null);
  const gazeLoopRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Telemetry: Flush batch to server
  const flushTelemetry = useCallback(() => {
    if (!sessionRef.current || !Array.isArray(telemetryBatch.current) || !telemetryBatch.current.length || !socketRef.current) return;
    socketRef.current.emit('telemetry_batch', { 
      sessionId: sessionRef.current._id, 
      events: [...telemetryBatch.current] 
    });
    telemetryBatch.current = [];
  }, []);

  // Telemetry: Add event to batch
  const addEvent = useCallback((type, data = {}) => {
    if (!startTimeRef.current) return;
    const timestamp = Date.now() - startTimeRef.current;
    telemetryBatch.current.push({ type, timestamp, data });
  }, []);

  // Load questions and previous sessions
  useEffect(() => {
    const fetchData = async () => {
       try {
          const [qRes, sRes] = await Promise.all([
             api.get('/coding/questions'),
             api.get('/coding/sessions/my')
          ]);
          
          const rawQuestions = Array.isArray(qRes.data?.questions) ? qRes.data.questions : (Array.isArray(qRes.data) ? qRes.data : []);
          const sessions = sRes.data || [];
          
          const completedQIds = new Set(
            sessions
              .filter(s => ['submitted', 'evaluated'].includes(s.status))
              .map(s => s.question?._id || s.question)
          );
          
          const sortedQuestions = [...rawQuestions].sort((a, b) => {
             const aComp = completedQIds.has(a._id);
             const bComp = completedQIds.has(b._id);
             if (aComp && !bComp) return 1;
             if (!aComp && bComp) return -1;
             return 0;
          });

          setQuestions(sortedQuestions);
          setRecentSessions(sessions);
          if (sortedQuestions.length > 0) setSelectedQ(sortedQuestions[0]);
       } catch (e) {
          console.error('Failed to load assessment data', e);
       }
    };
    fetchData();
  }, []);

  // Timer logic
  useEffect(() => {
    if (phase === 'coding') {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const candidateSnapshotRef = useRef('');
  const maxEyeDeviationRef = useRef(0);
  const maxHeadMovementRef = useRef(0);
  const faceScaleRef = useRef(0.2);
  const pastedLineNumbersRef = useRef(new Set());
  const editedLineNumbersRef = useRef(new Set());

  // AI Eye-Tracking / Gaze Detection
  useEffect(() => {
    if (phase !== 'coding') return;
    let offScreenCount = 0;
    let isActive = true;
    let audioContext, analyser, microphone, audioTimer, snapshotTimer;

    const startEyeTracking = async () => {
      try {
        const stream = cameraStreamRef.current || await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        
        // ── Web Audio API Proctoring Stream ──────────────────────────────────
        try {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
            microphone.connect(analyser);
            analyser.fftSize = 512;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            let audioSpikeCooldown = 0;

            audioTimer = setInterval(() => {
              if (!isActive) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
              const averageVolume = sum / bufferLength;

              if (audioSpikeCooldown > 0) audioSpikeCooldown--;

              if (averageVolume > 40 && audioSpikeCooldown === 0) {
                audioSpikeCooldown = 15; // 3 sec cooldown
                if (averageVolume > 65) {
                  addEvent('speech_detected', { volume: Math.round(averageVolume) });
                } else {
                  addEvent('audio_noise_spike', { volume: Math.round(averageVolume) });
                }
              }
            }, 200);
          }
        } catch (audioErr) {
          console.warn("Audio proctoring stream failed:", audioErr);
        }

        // ── Face Landmark & Motion Proctoring Stream ──────────────────────────
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig = { runtime: 'tfjs', maxFaces: 5, refineLandmarks: false };
        faceModelRef.current = await faceLandmarksDetection.createDetector(model, detectorConfig);
        
        let lastKeypoints = null;
        let movementCooldown = 0;
        let snapshotCaptured = false;
        let multipleFacesCooldown = 0; // throttle multiple-face event logging

        const captureCandidateSnapshot = () => {
          if (candidateSnapshotRef.current || !videoRef.current) return;
          const v = videoRef.current;
          if (v.videoWidth === 0 || v.videoHeight === 0) return;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = v.videoWidth || 320;
            canvas.height = v.videoHeight || 240;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            if (dataUrl && dataUrl.length > 200) {
              candidateSnapshotRef.current = dataUrl;
              try { localStorage.setItem('last_candidate_snapshot', dataUrl); } catch {}
              addEvent('candidate_snapshot', { snapshot: dataUrl });
            }
          } catch (e) {
            console.warn("Candidate photo snapshot error:", e);
          }
        };

        snapshotTimer = setInterval(() => {
          if (!isActive) return;
          if (!candidateSnapshotRef.current && videoRef.current && videoRef.current.videoWidth > 0) {
            captureCandidateSnapshot();
          }
        }, 300);

        const detectGaze = async () => {
          if (!isActive || !videoRef.current || !faceModelRef.current) return;
          
          if (videoRef.current && videoRef.current.readyState >= 2) {
             const faces = await faceModelRef.current.estimateFaces(videoRef.current);

             if (faces.length === 0) {
               // ── FACE NOT VISIBLE ─────────────────────────────────────
               offScreenCount++;
               if (offScreenCount > 10) {
                 setFaceAlert('no_face');
                 if (offScreenCount === 11) {
                   addEvent('face_not_detected', { count: offScreenCount });
                 }
               }
             } else if (faces.length > 1) {
               // ── MULTIPLE FACES DETECTED ───────────────────────────────
               offScreenCount = 0;
               setFaceAlert('multiple_faces');
               if (multipleFacesCooldown === 0) {
                 addEvent('multiple_faces_detected', { count: faces.length });
                 multipleFacesCooldown = 60;
               }
             } else {
               // ── SINGLE FACE — NORMAL (Instantly clears warnings) ──────
               offScreenCount = 0;
               setFaceAlert(null);

               // 📷 Capture Candidate Initial Exam Snapshot
               captureCandidateSnapshot();

               // 📐 MediaPipe 468 Landmark Geometry (Accurate 3D Angles)
               const kps = faces[0].keypoints;
               if (Array.isArray(kps) && kps.length >= 10) {
                 const videoW = videoRef.current.videoWidth  || 640;
                 const videoH = videoRef.current.videoHeight || 480;

                 // Landmark indices from MediaPipe 468 Face Mesh standard topology:
                 // 1   = Nose Tip
                 // 33  = Left Eye Outer Corner
                 // 263 = Right Eye Outer Corner
                 // 234 = Left Face Boundary (Ear / Cheek)
                 // 454 = Right Face Boundary (Ear / Cheek)
                 // 10  = Forehead Top
                 // 152 = Chin Bottom
                 const nose      = kps[1]   || kps[0];
                 const leftEye   = kps[33]  || kps[133] || kps[1];
                 const rightEye  = kps[263] || kps[362] || kps[0];
                 const leftEdge  = kps[234] || kps[127] || kps[33];
                 const rightEdge = kps[454] || kps[356] || kps[263];
                 const forehead  = kps[10]  || kps[1];
                 const chin      = kps[152] || kps[1];

                 if (nose && leftEye && rightEye && leftEdge && rightEdge) {
                   // ── 1. HEAD YAW (Left/Right Turn Degree 0°–90°) ──────
                   const faceWidth = Math.abs(rightEdge.x - leftEdge.x) || 1;
                   const faceMidlineX = (leftEdge.x + rightEdge.x) / 2;
                   const noseYawOffset = Math.abs(nose.x - faceMidlineX);
                   const yawRatio = noseYawOffset / (faceWidth / 2);
                   const headYawDeg = Math.min(90, Math.round(yawRatio * 90));

                   // ── 2. HEAD PITCH (Nodding Up/Down Degree 0°–45°) ───
                   const faceHeight = Math.abs((chin.y || 0) - (forehead.y || 0)) || 1;
                   const faceMidlineY = ((forehead.y || 0) + (chin.y || 0)) / 2;
                   const nosePitchOffset = Math.abs(nose.y - faceMidlineY);
                   const pitchRatio = nosePitchOffset / (faceHeight / 2);
                   const headPitchDeg = Math.min(45, Math.round(pitchRatio * 45));

                   const headMovementDeg = Math.max(headYawDeg, headPitchDeg);

                   // ── 3. EYE GAZE DEVIATION DEGREE (0°–90°) ─────────────
                   const eyeMidX = (leftEye.x + rightEye.x) / 2;
                   const gazeOffsetPx = Math.abs(eyeMidX - (videoW / 2));
                   const gazeRatio = gazeOffsetPx / (videoW / 2);
                   const eyeDeviationDeg = Math.min(90, Math.round(gazeRatio * 75));

                   // ── 4. FACE SCALE (Distance Proxy 0.0–1.0) ───────────
                   const faceScale = parseFloat(Math.min(1.0, faceWidth / videoW).toFixed(3));

                   // ── 5. LIVE REAL-TIME REF UPDATES ────────────────────
                   maxEyeDeviationRef.current  = Math.max(maxEyeDeviationRef.current,  eyeDeviationDeg);
                   maxHeadMovementRef.current  = Math.max(maxHeadMovementRef.current,  headMovementDeg);
                   faceScaleRef.current        = faceScale;

                   // Track frame-to-frame nose movement
                   if (lastKeypoints && nose) {
                     const dx = nose.x - (lastKeypoints.x || 0);
                     const dy = nose.y - (lastKeypoints.y || 0);
                     const delta = Math.sqrt(dx * dx + dy * dy);
                     if (delta > 8 && movementCooldown === 0) {
                       movementCooldown = 10;
                       addEvent('head_movement', { delta: Math.round(delta) });
                     }
                   }
                   lastKeypoints = { x: nose.x, y: nose.y };

                   // ── EMIT LIVE DEGREES PERIODICALLY ──────────────────────
                   if (Math.random() < 0.25) {
                     addEvent('gaze_pose_degrees', {
                       eyeDeviation:  eyeDeviationDeg,
                       headMovement:  headMovementDeg,
                       headYaw:       headYawDeg,
                       headPitch:     headPitchDeg,
                       faceScale
                     });
                   }
                 }
               }
             }
             if (movementCooldown > 0) movementCooldown--;
             if (multipleFacesCooldown > 0) multipleFacesCooldown--;
             
             if (offScreenCount > 30) {
                addEvent('off_screen_gaze', {});
                offScreenCount = 0;
             }
          }
          if (isActive) gazeLoopRef.current = requestAnimationFrame(detectGaze);
        };

        detectGaze();
      } catch (err) {
        console.warn("Camera/Audio access denied or model failed.");
        addEvent('camera_denied', {});
        setCameraDenied(true);
      }
    };

    startEyeTracking();

    return () => {
      isActive = false;
      if (snapshotTimer) clearInterval(snapshotTimer);
      if (audioTimer) clearInterval(audioTimer);
      if (audioContext) try { audioContext.close(); } catch {}
      if (gazeLoopRef.current) cancelAnimationFrame(gazeLoopRef.current);
      if (cameraStreamRef.current) {
         cameraStreamRef.current.getTracks().forEach(t => t.stop());
         cameraStreamRef.current = null;
      }
      if (videoRef.current?.srcObject) {
         videoRef.current.srcObject.getTracks().forEach(t => t.stop());
         videoRef.current.srcObject = null;
      }
    };
  }, [phase, addEvent]);

  const formatTimer = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleEditorMount = (editor, monaco) => {

    // ── KEYSTROKE TELEMETRY: record every key with real inter-key timing ──
    editor.onKeyDown((e) => {
      const now = Date.now();
      const isBackspace = e.keyCode === monaco.KeyCode.Backspace;
      const isNav = [monaco.KeyCode.UpArrow, monaco.KeyCode.DownArrow,
                     monaco.KeyCode.LeftArrow, monaco.KeyCode.RightArrow,
                     monaco.KeyCode.Home, monaco.KeyCode.End,
                     monaco.KeyCode.PageUp, monaco.KeyCode.PageDown].includes(e.keyCode);

      if (lastKeypressRef.current) {
        const intervalMs = now - lastKeypressRef.current;
        // Only track intervals ≤ 5 seconds (larger gaps are idle, not cadence)
        if (intervalMs <= 5000) {
          keypressIntervalsRef.current.push(intervalMs);
          // Emit inter_key_interval event every 10 keystrokes to reduce socket traffic
          if (keypressIntervalsRef.current.length % 10 === 0) {
            addEvent('keypress_interval_batch', {
              intervals: keypressIntervalsRef.current.slice(-10),
            });
          }
        } else if (intervalMs > 5000) {
          // Pause > 5 sec = idle event
          addEvent('idle_pause', { duration: intervalMs });
        }
        setTelemetryStats(s => ({
          ...s,
          averagePause: s.averagePause === 0 ? intervalMs : Math.round((s.averagePause * 0.9) + (intervalMs * 0.1)),
        }));
      }

      lastKeypressRef.current = now;
      const currentLine = editor.getPosition()?.lineNumber || 1;

      if (isBackspace) {
        editedLineNumbersRef.current.add(currentLine);
        addEvent('backspace', { timestamp: now, line: currentLine });
      } else if (!isNav) {
        // Emit a lightweight 'keypress' event for total count tracking
        addEvent('keypress', { t: now, line: currentLine }); // 't' is short to reduce payload size
      }
      setTelemetryStats(s => ({
        ...s,
        totalKeystrokes: s.totalKeystrokes + 1,
      }));
    });

    // ── PASTE TELEMETRY: capture real pasted character count & line ranges ──
    editor.onDidPaste((pasteEvent) => {
      const model = editor.getModel();
      let pastedChars = 0;
      if (model && pasteEvent && pasteEvent.range) {
        try {
          pastedChars = model.getValueInRange(pasteEvent.range).length;
          const startLine = pasteEvent.range.startLineNumber;
          const endLine = pasteEvent.range.endLineNumber;
          for (let l = startLine; l <= endLine; l++) {
            pastedLineNumbersRef.current.add(l);
          }
        } catch (_) { pastedChars = 50; }
      }
      if (pastedChars === 0) pastedChars = 50;
      // ✅ Use 'paste' (matches socket handler, not 'code_pasted')
      addEvent('paste', { length: pastedChars, chars: pastedChars });
      setTelemetryStats(s => ({
        ...s,
        totalPasteCount: s.totalPasteCount + 1,
        totalPasteChars: s.totalPasteChars + pastedChars,
      }));
      toast.error(`⚠️ Paste detected (${pastedChars} chars). Logged & flagged for AI review.`, { duration: 4000 });
    });

    // ── TAB-VISIBILITY TELEMETRY: detect when student switches away ──
    const onVisibilityChange = () => {
      if (!startTimeRef.current) return;
      // ✅ Use 'tab_switch' (matches socket handler)
      addEvent('tab_switch', { state: document.visibilityState });
      setTelemetryStats(s => ({
        ...s,
        totalTabSwitches: s.totalTabSwitches + (document.visibilityState === 'hidden' ? 1 : 0),
      }));
      if (document.visibilityState === 'hidden') {
        toast.error('⚠️ Tab switch detected. This event is logged.', { duration: 3000 });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Clean up listener when editor is unmounted
    editor.onDidDispose(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Flush remaining intervals
      if (keypressIntervalsRef.current.length > 0) {
        addEvent('keypress_interval_batch', { intervals: [...keypressIntervalsRef.current] });
      }
    });
  };

  // Start the session
  const startSession = async () => {
    try {
      const res = await api.post('/coding/sessions/start', {
        questionId: selectedQ._id,
        language: language
      });
      setSessionState(res.data);
      sessionRef.current = res.data;
      setCode(selectedQ.starterCode?.[language] || '');
      setPhase('coding');
      startTimeRef.current = Date.now();

      socketRef.current = getSocket();
      if (socketRef.current) {
         socketRef.current.emit('join_session', res.data.session._id);
         socketRef.current.on('proctor_alert', (alert) => {
            setLiveAlerts(prev => [...prev, alert]);
            toast(alert.message, { icon: '🛡️', style: { background: t.errorBg, color: t.errorText } });
         });
      }
      
      flushRef.current = setInterval(flushTelemetry, 5000);
      
      // Page Visibility (Tab switching)
      document.addEventListener('visibilitychange', () => {
         if (document.hidden) {
            addEvent('tab_switched', { state: 'hidden' });
            setTelemetryStats(s => ({ ...s, totalTabSwitches: s.totalTabSwitches + 1 }));
            toast.error('Tab switch detected! Return to the assessment immediately.', { icon: '🚨' });
         } else {
            addEvent('tab_switched', { state: 'visible' });
         }
      });
      
    } catch (err) {
      toast.error('Failed to start session');
    }
  };

  const runCode = async () => {
    setRunLoading(true);
    addEvent('compilation_attempt', { length: code.length });
    setTelemetryStats(s => ({ ...s, compilationCount: s.compilationCount + 1 }));
    flushTelemetry();
    
    try {
      const payload = {
        code,
        language,
        questionId: selectedQ._id,
        customInput: showCustomInput ? userInput : null,
        runType: showCustomInput ? 'custom' : 'testcases'
      };
      
      const res = await api.post('/coding/execute', payload);
      
      if (showCustomInput) {
        setOutput(`> Custom Execution Output:\n${res.data.actual || res.data.errorMessage || 'No output'}`);
      } else {
        const passed = res.data.results.filter(r => r.passed).length;
        const total = res.data.results.length;
        setOutput(`> Execution Complete: ${passed}/${total} Public Tests Passed\n\n` + 
           res.data.results.map((r, i) => `Test ${i+1}: ${r.passed ? '✅ PASSED' : '❌ FAILED'}\nOutput: ${r.actual || r.errorMessage}`).join('\n\n')
        );
      }
    } catch (err) {
      setOutput(`[System Error]\n${err.response?.data?.message || err.message}`);
    } finally {
      setRunLoading(false);
    }
  };

  const stopMediaRecording = () => {
    try {
      if (gazeLoopRef.current) {
        cancelAnimationFrame(gazeLoopRef.current);
        gazeLoopRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        cameraStreamRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        if (stream && stream.getTracks) {
          stream.getTracks().forEach(t => t.stop());
        }
        videoRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn("Error stopping camera/audio recording:", err);
    }
  };

  const submitCode = async (answersList = []) => {
    setSubmitLoading(true);
    flushTelemetry();
    clearInterval(flushRef.current);
    stopMediaRecording(); // 🛑 Stop camera & microphone recording immediately!
    
    try {
       const payload = {
         code,
         language,
         timeSpent: timer,
         telemetryData: {
           ...telemetryStats,
           candidateSnapshot: candidateSnapshotRef.current || '',
           eyeDeviationDegrees: maxEyeDeviationRef.current,
           headMovementDegrees: maxHeadMovementRef.current,
           faceScale: faceScaleRef.current || 0.22,
           pastedLineNumbers: Array.from(pastedLineNumbersRef.current || []),
           editedLineNumbers: Array.from(editedLineNumbersRef.current || []),
         },
         conceptualAnswers: answersList
       };
       
       const res = await api.post(`/coding/sessions/${sessionRef.current.session._id}/submit`, payload);
       setResult(res.data);
       setPhase('result');
    } catch (err) {
       toast.error('Submission failed. Please try again.');
    } finally {
       setSubmitLoading(false);
    }
  };

  const handleInitialSubmit = async () => {
    setSubmitLoading(true);
    try {
       const res = await api.post('/coding/execute/conceptual', { code, questionId: selectedQ._id, language });
       if (res.data && res.data.questions && res.data.questions.length > 0) {
          setConceptualQuestions(res.data.questions);
          setPhase('conceptual');
       } else {
          await submitCode([]);
       }
    } catch (err) {
       await submitCode([]);
    } finally {
       setSubmitLoading(false);
    }
  };

  const handleConceptualSubmit = async (e) => {
    e.preventDefault();
    const answersList = conceptualQuestions.map(q => ({
      questionText: q.questionText,
      contextCodeSnippet: q.contextCodeSnippet,
      candidateAnswer: conceptualAnswers[q.questionText] || ''
    }));
    
    const emptyCount = answersList.filter(a => !a.candidateAnswer.trim()).length;
    if (emptyCount > 0) {
      return toast.error('Please answer all questions before submitting.');
    }

    await submitCode(answersList);
  };

  // ── CSS INJECTION FOR ADAPTIVE UI ──
  const css = `
    .ca-root { min-height: 100vh; background: ${t.bg}; color: ${t.text}; font-family: 'Outfit', sans-serif; transition: background 0.4s, color 0.4s; display: flex; flex-direction: column; }
    .ca-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
    .ca-card-hover { transition: all 0.2s; cursor: pointer; }
    .ca-card-hover:hover { border-color: ${t.accent}; box-shadow: 0 8px 30px ${t.accentGlow}; transform: translateY(-2px); }
    .ca-card-active { border-color: ${t.accent}; background: ${t.tabActiveBg}; }
    .ca-input { background: ${t.inputBg}; border: 1.5px solid ${t.border}; border-radius: 9px; color: ${t.text}; padding: 12px 16px; outline: none; width: 100%; transition: all 0.2s; font-family: 'Outfit', sans-serif; }
    .ca-input:focus { border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.accentGlow}; }
    .ca-btn { padding: 12px 24px; border-radius: 9px; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .ca-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ca-btn-primary { background: ${t.gradient}; color: #fff; box-shadow: 0 4px 14px ${t.accentGlow}; }
    .ca-btn-primary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
    .ca-btn-secondary { background: ${t.surfaceAlt}; color: ${t.textMuted}; border: 1px solid ${t.border}; }
    .ca-btn-secondary:hover:not(:disabled) { color: ${t.text}; border-color: ${t.accent}; background: ${t.tabActiveBg}; }
    .ca-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .ca-badge-ok { background: ${t.tabActiveBg}; color: ${t.accent}; }
    .ca-title { font-size: 28px; font-weight: 800; color: ${t.text}; margin-bottom: 8px; letter-spacing: -0.5px; }
    .ca-subtitle { font-size: 15px; color: ${t.textMuted}; margin-bottom: 32px; }
    
    .ca-editor-layout { display: flex; flex: 1; overflow: hidden; }
    .ca-sidebar { width: 400px; border-right: 1px solid ${t.border}; background: ${t.surface}; display: flex; flex-direction: column; }
    .ca-main { flex: 1; display: flex; flex-direction: column; background: ${t.bg}; min-width: 0; }
    .ca-tabs { display: flex; border-bottom: 1px solid ${t.border}; padding: 8px 16px; gap: 8px; background: ${t.surfaceAlt}; }
    .ca-tab { padding: 8px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; border-radius: 8px; cursor: pointer; color: ${t.textMuted}; transition: all 0.2s; border: none; background: transparent; }
    .ca-tab.active { background: ${t.tabActiveBg}; color: ${t.accent}; }
    .ca-tab:hover:not(.active) { color: ${t.text}; background: ${t.border}; }
    .ca-console { height: 280px; border-top: 1px solid ${t.border}; background: ${isDarkMode ? '#0d1117' : '#f8f9fa'}; display: flex; flex-direction: column; }
    .ca-console-header { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid ${t.border}; background: ${t.surfaceAlt}; }
  `;

  // ── PHASE 1: SELECT ──
  if (phase === 'select') {
    return (
      <div className="ca-root">
        <style>{css}</style>
        <CodingNavbar />
        <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '40px 24px' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="ca-title">Assessment Setup</div>
            <div className="ca-subtitle">Select your preferred environment and challenge to begin your evaluation.</div>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div className="ca-card">
              <div style={{ fontSize: '13px', fontWeight: 800, color: t.textSub, textTransform: 'uppercase', marginBottom: '20px' }}>Choose Challenge</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {questions.map((q, index) => {
                  const isCompleted = recentSessions.some(s => s.question?._id === q._id && ['submitted', 'evaluated'].includes(s.status));
                  const isAssigned = assignedQuestions.has(q._id) && !isCompleted;
                  return (
                    <div 
                      key={q._id} 
                      onClick={() => setSelectedQ(q)}
                      className={`ca-card ca-card-hover ${selectedQ?._id === q._id ? 'ca-card-active' : ''}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}
                    >
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', 
                          background: selectedQ?._id === q._id ? t.accent : 
                            q.department === 'ECE' ? '#6366f120' : q.department === 'EEE' ? '#f59e0b20' : t.surfaceAlt, 
                          color: selectedQ?._id === q._id ? '#fff' : 
                            q.department === 'ECE' ? '#818cf8' : q.department === 'EEE' ? '#fbbf24' : t.text, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>
                         {q.department === 'ECE' ? '⚡' : q.department === 'EEE' ? '🔌' : q.title?.charAt(0) || 'C'}
                       </div>
                       <div style={{ flex: 1 }}>
                         <div style={{ fontWeight: 800, fontSize: '15px', color: t.text }}>{q.title}</div>
                         <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                           <span className="ca-badge ca-badge-ok" style={{ background: q.difficulty === 'Easy' ? 'rgba(16,185,129,0.1)' : q.difficulty === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: q.difficulty === 'Easy' ? '#10b981' : q.difficulty === 'Medium' ? '#f59e0b' : '#ef4444' }}>
                             {q.difficulty}
                           </span>
                           {q.department && q.department !== 'General' && (
                             <span className="ca-badge" style={{ background: q.department === 'ECE' ? '#6366f120' : '#f59e0b20', color: q.department === 'ECE' ? '#818cf8' : '#fbbf24', border: `1px solid ${q.department === 'ECE' ? '#6366f130' : '#f59e0b30'}` }}>
                               {q.department}
                             </span>
                           )}
                           {q.circuitDiagram && (
                             <span className="ca-badge" style={{ background: '#0ea5e920', color: '#38bdf8', border: '1px solid #0ea5e930' }}>
                               📐 Circuit
                             </span>
                           )}
                           {isCompleted && <span className="ca-badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Completed</span>}
                         </div>
                       </div>
                       {selectedQ?._id === q._id && <CheckCircle color={t.accent} />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="ca-card">
                <div style={{ fontSize: '13px', fontWeight: 800, color: t.textSub, textTransform: 'uppercase', marginBottom: '20px' }}>Runtime Environment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {LANGUAGES.map((l) => (
                    <button 
                      key={l.value} 
                      onClick={() => setLanguage(l.value)}
                      className={`ca-card ca-card-hover ${language === l.value ? 'ca-card-active' : ''}`}
                      style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: language === l.value ? t.accent : t.textMuted }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ca-card" style={{ background: t.tabActiveBg, borderColor: `${t.accent}44` }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Shield color={t.accent} size={24} />
                  <div style={{ fontSize: '13px', color: t.text, lineHeight: 1.6 }}>
                    This assessment utilizes <strong>AI Telemetry</strong>. Tab switches, prolonged idle time, and large paste events are logged and reported for authentication scoring.
                  </div>
                </div>
              </div>

              {recentSessions.some(s => s.question?._id === selectedQ?._id && ['submitted', 'evaluated'].includes(s.status)) ? (
                <div className="ca-card" style={{ textAlign: 'center', background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                  <CheckCircle color="#10b981" size={32} style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 800, color: '#10b981' }}>Challenge Completed</div>
                </div>
              ) : (
                <button onClick={startSession} disabled={!selectedQ} className="ca-btn ca-btn-primary" style={{ padding: '16px', fontSize: '16px' }}>
                  Begin Assessment <ArrowRight size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: CONCEPTUAL QUESTIONS ──
  if (phase === 'conceptual') {
    return (
      <div className="ca-root">
        <style>{css}</style>
        <CodingNavbar />
        <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', padding: '40px 24px' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div className="ca-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Brain color={t.accent} size={36} /> AI Code Verification
            </div>
            <div className="ca-subtitle">Please answer these dynamically generated questions about your code to complete the assessment.</div>
          </motion.div>

          <form onSubmit={handleConceptualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {conceptualQuestions.map((q, idx) => (
              <motion.div key={idx} className="ca-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.tabActiveBg, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{idx + 1}</div>
                  {q.contextCodeSnippet && (
                    <div className="ca-badge ca-badge-ok">Context: {q.contextCodeSnippet}</div>
                  )}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: t.text, marginBottom: '16px' }}>{q.questionText}</div>
                <textarea
                  required
                  rows={4}
                  value={conceptualAnswers[q.questionText] || ''}
                  onChange={(e) => setConceptualAnswers({ ...conceptualAnswers, [q.questionText]: e.target.value })}
                  placeholder="Type your explanation here..."
                  className="ca-input"
                />
              </motion.div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="submit" disabled={submitLoading} className="ca-btn ca-btn-primary">
                {submitLoading ? <Loader className="spin" size={20} /> : <Send size={20} />} Submit Answers
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── PHASE 2: RESULT ──
  if (phase === 'result' && result) {
    const score = result.prediction?.authenticityScore ?? 0;
    const label = result.prediction?.classification ?? 'N/A';
    return (
      <div className="ca-root">
        <style>{css}</style>
        <CodingNavbar />
        <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '40px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div className="ca-title">Assessment Summary</div>
            <div className="ca-subtitle">Your coding session has been successfully processed by the evaluation engine.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
            <div className="ca-card" style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '48px', fontWeight: 900, color: score >= 85 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444' }}>{score}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: t.textSub, textTransform: 'uppercase', marginTop: '8px' }}>Authenticity Score</div>
              <div className="ca-badge ca-badge-ok" style={{ marginTop: '12px', display: 'inline-block' }}>{label}</div>
            </div>
            <div className="ca-card" style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '48px', fontWeight: 900, color: t.accent }}>{result.session?.testCasesPassed ?? 0}/{result.session?.totalTestCases ?? 0}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: t.textSub, textTransform: 'uppercase', marginTop: '8px' }}>Test Cases Passed</div>
            </div>
            <div className="ca-card" style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '48px', fontWeight: 900, color: '#8b5cf6' }}>{result.prediction?.confidence ?? 0}%</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: t.textSub, textTransform: 'uppercase', marginTop: '8px' }}>Analysis Confidence</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => navigate('/student')} className="ca-btn ca-btn-secondary">Return to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 3: CODING ──
  const activeMonacoLang = LANGUAGES.find(l => l.value === language)?.monacoLang || 'python';

  return (
    <div className="ca-root" style={{ height: '100vh' }}>
      <style>{css}</style>
      <CodingNavbar />

      {/* Proctoring Header */}
      <div style={{ padding: '10px 24px', background: t.surfaceAlt, borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock color={t.accent} size={20} />
          <span style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'monospace' }}>{formatTimer(timer)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Live Face Alert Banners */}
          {faceAlert === 'no_face' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100,
              background: 'rgba(245, 158, 11, 0.15)', border: '1.5px solid #f59e0b',
              animation: 'pulse-warning 1.2s ease-in-out infinite',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 8px #f59e0b' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1 }}>⚠ Face Not Visible</span>
            </div>
          )}
          {faceAlert === 'multiple_faces' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100,
              background: 'rgba(239, 68, 68, 0.15)', border: '1.5px solid #ef4444',
              animation: 'pulse-warning 0.8s ease-in-out infinite',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 8px #ef4444' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1 }}>🚨 Multiple Faces Detected</span>
            </div>
          )}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ width: '54px', height: '38px', borderRadius: '8px', border: `2px solid ${faceAlert === 'multiple_faces' ? '#ef4444' : faceAlert === 'no_face' ? '#f59e0b' : '#10b981'}`, objectFit: 'cover', background: '#000', boxShadow: `0 0 10px ${faceAlert === 'multiple_faces' ? 'rgba(239,68,68,0.5)' : faceAlert === 'no_face' ? 'rgba(245,158,11,0.5)' : 'rgba(16, 185, 129, 0.4)'}` }} 
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: '100px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub }}>AI Proctoring Active</span>
          </div>
          <button onClick={runCode} disabled={runLoading} className="ca-btn ca-btn-secondary" style={{ padding: '8px 16px' }}>
            {runLoading ? <Loader size={16} className="spin" /> : <Play size={16} />} Run Code
          </button>
          <button onClick={handleInitialSubmit} disabled={submitLoading} className="ca-btn ca-btn-primary" style={{ padding: '8px 16px' }}>
            {submitLoading ? <Loader size={16} className="spin" /> : <Send size={16} />} Final Submit
          </button>
        </div>
      </div>

      <div className="ca-editor-layout">
        {/* Left Panel */}
        <div className="ca-sidebar">
          <div className="ca-tabs">
            <button onClick={() => setActiveTab('description')} className={`ca-tab ${activeTab === 'description' ? 'active' : ''}`}>Description</button>
            <button onClick={() => setActiveTab('examples')} className={`ca-tab ${activeTab === 'examples' ? 'active' : ''}`}>Examples</button>
          </div>
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            {activeTab === 'description' && selectedQ && (
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: t.text }}>{selectedQ.title}</h2>
                
                {/* Department & Domain badges */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {selectedQ.department && selectedQ.department !== 'General' && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                      background: selectedQ.department === 'ECE' ? '#6366f120' : '#f59e0b20',
                      color: selectedQ.department === 'ECE' ? '#818cf8' : '#fbbf24',
                      border: `1px solid ${selectedQ.department === 'ECE' ? '#6366f140' : '#f59e0b40'}` }}>
                      {selectedQ.department}
                    </span>
                  )}
                  {selectedQ.domain_type && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                      background: '#10b98120', color: '#10b981', border: '1px solid #10b98140' }}>
                      {selectedQ.domain_type.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                  {selectedQ.difficulty && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                      background: selectedQ.difficulty === 'Hard' ? '#ef444420' : selectedQ.difficulty === 'Medium' ? '#f59e0b20' : '#10b98120',
                      color: selectedQ.difficulty === 'Hard' ? '#ef4444' : selectedQ.difficulty === 'Medium' ? '#fbbf24' : '#10b981',
                      border: '1px solid #33415580' }}>
                      {selectedQ.difficulty}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '14px', lineHeight: 1.7, color: t.textMuted, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
                  {selectedQ.description}
                </div>

                {/* ── Circuit Diagram Panel ── */}
                {selectedQ.circuitDiagram ? (
                  <div style={{
                    marginTop: 8, marginBottom: 20,
                    background: '#0f172a', border: '2px solid #6366f140',
                    borderRadius: 14, overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '10px 16px', background: '#1e293b',
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid #334155'
                    }}>
                      <span style={{ fontSize: 16 }}>⚡</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Circuit / Hardware Reference Diagram
                      </span>
                    </div>
                    <div
                      style={{ padding: 8, width: '100%' }}
                      dangerouslySetInnerHTML={{ __html: selectedQ.circuitDiagram }}
                    />
                    {selectedQ.circuitDescription && (
                      <div style={{
                        padding: '10px 16px', background: '#1e293b',
                        borderTop: '1px solid #334155', fontSize: 12,
                        color: '#94a3b8', lineHeight: 1.6
                      }}>
                        <strong style={{ color: '#e2e8f0' }}>📐 Circuit Notes: </strong>
                        {selectedQ.circuitDescription}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {selectedQ.problemImage && (
                      <HardwareImageViewer imageUrl={selectedQ.problemImage} title={selectedQ.title} />
                    )}
                    {!selectedQ.problemImage && selectedQ.domain_type === 'verilog' && (
                      <HardwareWaveformViewer title={selectedQ.title} />
                    )}
                    {!selectedQ.problemImage && (selectedQ.domain_type === 'embedded_c' || selectedQ.department === 'EEE' || selectedQ.domain_type === 'control_systems') && (
                      <CircuitSchematicViewer title={selectedQ.title} />
                    )}
                  </>
                )}
              </div>
            )}
            {activeTab === 'examples' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedQ?.examples?.map((ex, i) => (
                  <div key={i} className="ca-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: t.textSub, marginBottom: '8px' }}>EXAMPLE {i+1}</div>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', background: t.inputBg, padding: '12px', borderRadius: '8px', marginBottom: '8px', whiteSpace: 'pre-wrap' }}><strong>Input:</strong><br/>{ex.input}</div>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}><strong>Output:</strong><br/>{ex.output}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel (Editor + Console) */}
        <div className="ca-main">
          <div style={{ flex: 1, position: 'relative' }}>
            <Editor 
              theme={isDarkMode ? 'vs-dark' : 'light'}
              language={activeMonacoLang}
              value={code}
              onChange={v => setCode(v || '')}
              onMount={handleEditorMount}
              options={{ fontSize: 14, fontFamily: '"JetBrains Mono", monospace', minimap: { enabled: false } }}
            />
          </div>
          <div className="ca-console">
            <div className="ca-console-header">
              <div style={{ fontSize: '11px', fontWeight: 800, color: t.textSub, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={14} /> Execution Console
              </div>
              <button onClick={() => setOutput('')} style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: 800, color: t.textMuted, cursor: 'pointer' }}>CLEAR</button>
            </div>
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap', color: output.includes('[System Error]') ? '#ef4444' : t.text }}>
              {output || '> Ready...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
