import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExam, logBehavior, submitResult, getNextAdaptiveQuestion, getCircuitQuestionsByExam } from '../services/api';
import CameraMonitor from '../components/CameraMonitor';
import AudioMonitor from '../components/AudioMonitor';
import QuestionCard from '../components/QuestionCard';
import Timer from '../components/Timer';
import BehaviorTracker from '../components/BehaviorTracker';
import { useTheme } from '../context/ThemeContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import ScientificCalculator from '../components/ScientificCalculator';
import { io } from 'socket.io-client';

export default function ExamPage() {
    const { examId } = useParams();
    const navigate = useNavigate();
    const { theme: t } = useTheme();
    const studentId = localStorage.getItem('studentId');

    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [qIndex, setQIndex] = useState(0);
    const [answers, setAnswers] = useState({}); // { qId: { selected_option, time_taken } }
    const [qSeconds, setQSeconds] = useState(0);
    const [replaced, setReplaced] = useState({});
    const [riskScore, setRiskScore] = useState(0);
    const [tabWarnings, setTabWarnings] = useState(0);
    const [alert, setAlert] = useState('');
    const [mlMessage, setMlMessage] = useState([]);
    const [isFullscreen, setIsFullscreen] = useState(document.fullscreenElement !== null);
    const [isAdaptiveMode, setIsAdaptiveMode] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isIdentityRegistered, setIsIdentityRegistered] = useState(false);
    const [isMismatching, setIsMismatching] = useState(false);
    const [idReference, setIdReference] = useState(null);
    const [showCalc, setShowCalc] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessScreen, setShowSuccessScreen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const trackerRef = useRef(null);
    const idMonitorRef = useRef(null);
    const monitorRef = useRef(null);
    const cameraMetrics = useRef({ eyeDeviation: 0, headMovement: 0 });
    const audioMetrics = useRef({ speechDetected: false, multipleVoicesDetected: false, speechLevel: 0 });
    const lastSwapTimeRef = useRef(0);
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const qStartRef = useRef(Date.now());
    const isTransitioningRef = useRef(false);

    // ── Pre-Calculation Logic ────────────────────────────────────────────────
    const currentQ = questions[qIndex];

    // ── Callbacks ────────────────────────────────────────────────────────────
    // Opens the confirmation modal (or directly submits if called from auto-submit paths)
    const handleSubmit = useCallback(async (force = false) => {
        if (submitted) return;
        if (!force) {
            // Show confirmation modal for voluntary submission
            setShowConfirmModal(true);
            return;
        }
        // Force-submit path (timer expiry, identity violation, risk threshold)
        setSubmitted(true);
        trackerRef.current?.stop();
        const timeSpent = Math.floor((Date.now() - qStartRef.current) / 1000);
        const finalAnswers = { ...answers };
        if (currentQ) {
            const curr = finalAnswers[currentQ._id] || { selected_option: '', time_taken: 0 };
            finalAnswers[currentQ._id] = { ...curr, time_taken: (curr.time_taken || 0) + timeSpent };
        }
        const payload = {
            student_id: studentId, exam_id: examId,
            answers: Object.entries(finalAnswers).map(([question_id, val]) => ({
                question_id,
                selected_option: val.selected_option || '',
                time_taken: val.time_taken || 0
            })),
        };
        try {
            await submitResult(payload);
            setShowSuccessScreen(true);
        } catch { setAlert('Failed to submit exam. Please try again.'); setSubmitted(false); }
    }, [answers, currentQ, examId, studentId, submitted]);

    // Called when student confirms submission in the modal
    const confirmAndSubmit = useCallback(async () => {
        if (submitted || isSubmitting) return;
        setIsSubmitting(true);
        setShowConfirmModal(false);
        setSubmitted(true);
        trackerRef.current?.stop();
        const timeSpent = Math.floor((Date.now() - qStartRef.current) / 1000);
        const finalAnswers = { ...answers };
        if (currentQ) {
            const curr = finalAnswers[currentQ._id] || { selected_option: '', time_taken: 0 };
            finalAnswers[currentQ._id] = { ...curr, time_taken: (curr.time_taken || 0) + timeSpent };
        }
        const payload = {
            student_id: studentId, exam_id: examId,
            answers: Object.entries(finalAnswers).map(([question_id, val]) => ({
                question_id,
                selected_option: val.selected_option || '',
                time_taken: val.time_taken || 0
            })),
        };
        try {
            await submitResult(payload);
            setShowSuccessScreen(true);
        } catch {
            setAlert('Failed to submit exam. Please try again.');
            setSubmitted(false);
        } finally {
            setIsSubmitting(false);
        }
    }, [answers, currentQ, examId, studentId, submitted, isSubmitting]);

    const handleNext = useCallback(() => { 
        if (qIndex < questions.length - 1) { 
            trackerRef.current?.resetQuestion(); 
            setQIndex(i => i + 1); 
        } 
    }, [qIndex, questions.length]);

    const handlePrev = useCallback(() => { 
        if (qIndex > 0) { 
            trackerRef.current?.resetQuestion(); 
            setQIndex(i => i - 1); 
        } 
    }, [qIndex]);

    const handleIdentityViolation = useCallback(() => {
        if (submitted) return;
        setAlert('🚨 Warning: Unauthorised person detected! User changed.');
        trackerRef.current?.stop();
        setTimeout(() => {
            handleSubmit();
        }, 3000);
    }, [handleSubmit, submitted]);

    const handleCameraMetrics = useCallback(({ 
        eyeDeviation, headMovement, faceScale, 
        faceNotDetected, multipleFacesDetected, 
        phoneDetected, identityMismatch 
    }) => {
        cameraMetrics.current = { 
            eyeDeviation, headMovement, faceScale, 
            faceNotDetected, multipleFacesDetected, 
            phoneDetected, identityMismatch 
        };
        if (isIdentityRegistered && !submitted) {
            if (identityMismatch) {
                setIsMismatching(true);
                setAlert('🚨 Warning: Unauthorised person detected! User changed.');
                handleIdentityViolation();
            } else if (multipleFacesDetected) {
                setAlert(prev => prev === '🚨 Warning: Another face is detected! Please ensure only you are visible.' ? prev : '🚨 Warning: Another face is detected! Please ensure only you are visible.');
            } else if (phoneDetected) {
                setAlert(prev => prev === '🚨 Warning: Cell phone detected! Use of mobile phones is strictly prohibited.' ? prev : '🚨 Warning: Cell phone detected! Use of mobile phones is strictly prohibited.');
            } else if (faceNotDetected) {
                setAlert(prev => prev === '🚨 Warning: Face not detected! Please face the camera.' ? prev : '🚨 Warning: Face not detected! Please face the camera.');
            } else {
                setAlert(prev => {
                    if (prev.includes('Another face is detected') || prev.includes('Cell phone detected') || prev.includes('Face not detected') || prev.includes('Unauthorised person detected')) {
                        return '';
                    }
                    return prev;
                });
            }
        }
    }, [handleIdentityViolation, isIdentityRegistered, submitted]);

    const handleAudioMetrics = useCallback(({ speechDetected, multipleVoicesDetected, speechLevel }) => {
        audioMetrics.current = { speechDetected, multipleVoicesDetected, speechLevel };
        if (speechDetected && !submitted) {
            setAlert(prev => {
                if (prev.includes('Talking')) return prev;
                return '📢 Talking detected! Please maintain silence during the exam.';
            });
            setTimeout(() => setAlert(prev => prev.includes('Talking') ? '' : prev), 4000);
        }
    }, [submitted]);

    // ── Stability Refs to break recursive update loops ───────────────────────
    const handleSubmitRef = useRef(handleSubmit);
    const handleNextRef = useRef(handleNext);
    const currentQRef = useRef(currentQ);
    const answersRef = useRef(answers);
    const questionsRef = useRef(questions);

    useEffect(() => {
        handleSubmitRef.current = handleSubmit;
        handleNextRef.current = handleNext;
        currentQRef.current = currentQ;
        answersRef.current = answers;
        questionsRef.current = questions;
    }, [handleSubmit, handleNext, currentQ, answers, questions]);

    // ── Effects ──────────────────────────────────────────────────────────────
    useEffect(() => {
        getExam(examId)
            .then(async res => {
                const exData = res.data;
                setExam(exData);

                // Auto-detect Circuit Design Exam and redirect to Circuit Workspace
                if ((!exData.questions || exData.questions.length === 0) || exData.rounds?.simulation || exData.title?.startsWith('Circuit Test')) {
                    try {
                        const cRes = await getCircuitQuestionsByExam(examId);
                        const circuitQs = cRes.data || [];
                        if (circuitQs.length > 0) {
                            navigate(`/circuit/${examId}/${circuitQs[0]._id}`, { replace: true });
                            return;
                        }
                    } catch (cErr) {
                        console.warn('Circuit questions fetch error:', cErr);
                    }
                }

                setQuestions(exData.questions || []);
            })
            .catch(() => setAlert('Failed to load exam.'))
            .finally(() => setLoading(false));
    }, [examId, navigate]);


    useEffect(() => {
        const tracker = new BehaviorTracker((violation) => {
            if (violation.type === 'tab') {
                setTabWarnings(violation.count);
                if (violation.count >= 3) setAlert('⚠️ Multiple tab switches detected! This will be flagged in your behavior report.');
                else setAlert(`⚠️ Tab switch detected (${violation.count}/3). Please stay on the exam page.`);
            } else if (violation.type === 'fullscreen') {
                setIsFullscreen(false);
                setAlert('🚨 You exited fullscreen mode! Please return to fullscreen immediately.');
            } else if (violation.type === 'resize') {
                setAlert('⚠️ Window resize detected. Please keep the window maximized.');
            }
        });

        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);

        tracker.start();
        trackerRef.current = tracker;
        return () => {
            tracker.stop();
            document.removeEventListener('fullscreenchange', handleFsChange);
        };
    }, []);

    const enterFullscreen = () => {
        const docElm = document.documentElement;
        if (docElm.requestFullscreen) docElm.requestFullscreen();
        else if (docElm.mozRequestFullScreen) docElm.mozRequestFullScreen();
        else if (docElm.webkitRequestFullScreen) docElm.webkitRequestFullScreen();
        else if (docElm.msRequestFullscreen) docElm.msRequestFullscreen();
        setIsFullscreen(true);
        setAlert('');
    };

    useEffect(() => {
        if (!examId || !studentId || !exam) return;
        const socket = io('http://localhost:5000');
        socketRef.current = socket;

        socket.emit('join-exam', { 
            studentId, examId, role: 'student', 
            name: localStorage.getItem('studentName') || 'Student' 
        });

        socket.on('signal', async ({ from, signal }) => {
            if (signal.type === 'offer') {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                peerRef.current = pc;

                const stream = monitorRef.current?.getStream();
                if (stream) {
                    stream.getTracks().forEach(track => pc.addTrack(track, stream));
                }

                pc.onicecandidate = (e) => {
                    if (e.candidate) {
                        socket.emit('signal', { to: from, from: socket.id, signal: e.candidate });
                    }
                };

                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('signal', { to: from, from: socket.id, signal: answer });
            } else if (signal.candidate) {
                try {
                    await peerRef.current?.addIceCandidate(new RTCIceCandidate(signal));
                } catch (e) { console.error("Error adding candidate:", e); }
            }
        });

        return () => {
            socket.disconnect();
            peerRef.current?.close();
        };
    }, [examId, studentId, exam]);

    // Behavior logging interval (stable via refs)
    useEffect(() => {
        if (!currentQ || submitted) return;
        const interval = setInterval(async () => {
            try {
                let snapshot = undefined;
                const hasAnomaly = cameraMetrics.current.multipleFacesDetected || 
                                   cameraMetrics.current.phoneDetected || 
                                   cameraMetrics.current.identityMismatch || 
                                   cameraMetrics.current.faceNotDetected ||
                                   audioMetrics.current.speechDetected;
                
                if (hasAnomaly && monitorRef.current) {
                    const snap = monitorRef.current.takeSnapshot();
                    if (snap) {
                        snapshot = snap;
                    }
                }

                const browserMetrics = trackerRef.current?.getMetrics() || {};

                const payload = {
                    student_id: studentId, exam_id: examId, question_id: currentQ._id,
                    answers: Object.fromEntries(
                        Object.entries(answersRef.current).map(([id, val]) => [id, val?.selected_option || ''])
                    ), 
                    eyeDeviation: cameraMetrics.current.eyeDeviation,
                    headMovement: cameraMetrics.current.headMovement,
                    faceScale: cameraMetrics.current.faceScale || 0,
                    mouseIdleTime: browserMetrics.mouseIdleTime || 0,
                    responseTime: browserMetrics.responseTime || 0,
                    tabSwitches: browserMetrics.tabSwitches || 0,
                    fullscreenExits: browserMetrics.fullscreenExits || 0,
                    difficulty: currentQ.difficulty || 'medium',
                    faceNotDetected: cameraMetrics.current.faceNotDetected || false,
                    multipleFacesDetected: cameraMetrics.current.multipleFacesDetected || false,
                    phoneDetected: cameraMetrics.current.phoneDetected || false,
                    identity_mismatch: cameraMetrics.current.identityMismatch || false,
                    speech_detected: audioMetrics.current.speechDetected || false,
                    multiple_voices: audioMetrics.current.multipleVoicesDetected || false,
                    speech_level: audioMetrics.current.speechLevel || 0,
                    snapshot: snapshot
                };
                const res = await logBehavior(payload);
                const { riskScore: rs, messages } = res.data;
                setRiskScore(rs || 0);

                socketRef.current?.emit('risk-update', { studentId, examId, riskScore: rs, messages });

                if (messages && messages.length > 0 && messages[0] !== "Behavior appears normal.") {
                    setMlMessage(messages);
                } else {
                    setMlMessage([]);
                }

                if (rs >= 95 && !submitted) {
                    setAlert('🚨 Critical anomalies detected. Exam forcefully submitted.');
                    setTimeout(() => handleSubmitRef.current(true), 2000);
                    return;
                }

                // -- Adaptive Question Delivery System --
                if (rs >= 50 && !isAdaptiveMode && !isSwapping && !submitted) {
                    setIsSwapping(true);
                    const timeSpent = Math.floor((Date.now() - qStartRef.current) / 1000);
                    
                    try {
                        const nextRes = await getNextAdaptiveQuestion({
                            student_id: studentId,
                            exam_id: examId,
                            current_question_id: currentQ._id,
                            risk_score: rs,
                            current_exam_question_ids: questionsRef.current.map(q => q._id)
                        });
                        
                        const newQ = nextRes.data?.newQuestion;
                        if (newQ) {
                            setQuestions(prev => {
                                const updated = [...prev];
                                updated[qIndex] = newQ;
                                return updated;
                            });
                            // Target: validation time = half the previous answering time
                            // Using a 10s minimum for usability
                            const validationTime = Math.max(10, Math.floor(timeSpent / 2));
                            setQSeconds(validationTime);
                            setIsAdaptiveMode(true);
                            setReplaced(prev => ({ ...prev, [qIndex]: true }));
                            setAlert('🛡️ Verification Mode: High behavior anomalies detected. Please answer this validation question.');
                            qStartRef.current = Date.now();
                        }
                    } catch (e) {
                        console.error("Adaptive switch failed:", e);
                    } finally {
                        setIsSwapping(false);
                    }
                }

                // If risk drops below 30, we could potentially exit adaptive mode for next questions
                if (rs < 30 && isAdaptiveMode) {
                    setIsAdaptiveMode(false);
                }
            } catch (_) {}
        }, 2000);
        return () => clearInterval(interval);
    }, [currentQ, qIndex, submitted, examId, studentId]);

    // Per-question timer logic
    useEffect(() => {
        if (!exam || questions.length === 0 || submitted) return;
        const q = questions[qIndex];
        if (!q) return;

        const difficulty = q.difficulty || 'medium';
        const limit = (exam.per_question_time && exam.per_question_time[difficulty]) || 60;
        
        console.log(`[Timer] Starting timer for Q${qIndex + 1} (${difficulty}): ${limit}s`);
        setQSeconds(limit);
        qStartRef.current = Date.now();
        isTransitioningRef.current = false;

        const interval = setInterval(() => {
            setQSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    // Trigger transition only once
                    if (!isTransitioningRef.current) {
                        isTransitioningRef.current = true;
                        
                        if (qIndex < questions.length - 1) {
                            console.log(`[Timer] Q${qIndex + 1} expired. Moving to next question.`);
                            // Explicit transition to next question
                            setQIndex(prevIdx => prevIdx + 1);
                            trackerRef.current?.resetQuestion();
                        } else {
                            console.log(`[Timer] Final question Q${qIndex + 1} expired. Submitting total result.`);
                            handleSubmitRef.current();
                        }
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(interval);
            const timeSpent = Math.floor((Date.now() - qStartRef.current) / 1000);
            if (timeSpent > 0) {
                setAnswers(prev => {
                    const qId = q._id;
                    const curr = prev[qId] || { selected_option: '', time_taken: 0 };
                    return {
                        ...prev,
                        [qId]: { ...curr, time_taken: (curr.time_taken || 0) + timeSpent }
                    };
                });
            }
        };
    }, [qIndex, questions.length, exam, submitted]);

    const riskPct = Math.round(riskScore || 0);
    const riskColor = riskScore >= 51 ? '#ef4444' : riskScore >= 21 ? '#f59e0b' : '#10b981';
    const answeredCount = Object.values(answers).filter(a => a.selected_option).length;

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .ep-root { min-height: 100vh; background: ${t.bg}; color: ${t.text}; font-family: 'Outfit', sans-serif; transition: background 0.4s, color 0.4s; }
        .ep-nav { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: ${t.surface}; border-bottom: 1px solid ${t.border}; box-shadow: 0 1px 16px ${t.cardShadow}; transition: background 0.4s, border-color 0.4s; }
        .ep-nav-logo { font-family: 'Outfit', sans-serif; font-size: 17px; font-weight: 800; color: ${t.text}; }
        .ep-nav-logo span { background: ${t.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .ep-nav-right { display: flex; align-items: center; gap: 12px; }
        .ep-warn-chip { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 100px; background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; font-size: 12.5px; font-weight: 600; }
        .ep-alert { margin: 14px 32px; padding: 12px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 500; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; }
        .ep-cam-warn { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; margin-bottom: 12px; animation: epfadeIn 0.3s ease; text-align: center; }
        @keyframes epfadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .ep-body { display: grid; grid-template-columns: 1fr 300px; gap: 24px; padding: 28px 32px; max-width: 1280px; margin: 0 auto; }
        .ep-left { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .ep-qmap { display: flex; flex-wrap: wrap; gap: 8px; }
        .ep-qmap-btn { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid ${t.border}; background: ${t.surfaceAlt}; color: ${t.textMuted}; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.18s ease; font-family: 'Outfit', sans-serif; display: flex; align-items: center; justify-content: center; }
        .ep-qmap-btn.answered { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
        .ep-qmap-btn.replaced { background: rgba(245,158,11,0.25); border-color: #f59e0b; color: #f59e0b; }
        .ep-qmap-btn.current { outline: 2.5px solid ${t.accent}; outline-offset: 2px; }
        .ep-qmap-btn:hover { border-color: ${t.accent}; color: ${t.text}; }
        .ep-nav-btns { display: flex; justify-content: space-between; align-items: center; }
        .ep-btn { padding: 10px 22px; border-radius: 9px; border: none; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
        .ep-btn-prev { background: ${t.surfaceAlt}; color: ${t.textMuted}; border: 1px solid ${t.border}; }
        .ep-btn-prev:hover:not(:disabled) { color: ${t.text}; border-color: ${t.accent}; }
        .ep-btn-prev:disabled { opacity: 0.4; cursor: not-allowed; }
        .ep-btn-next { background: ${t.gradient}; color: #fff; box-shadow: 0 4px 14px ${t.accentGlow}; }
        .ep-btn-next:hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 6px 20px ${t.accentGlow}; }
        .ep-btn-submit { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: 0 4px 14px rgba(16,185,129,0.3); }
        .ep-btn-submit:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
        .ep-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .ep-sidebar { display: flex; flex-direction: column; gap: 14px; }
        .ep-widget { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 18px; transition: background 0.4s, border-color 0.4s; }
        .ep-widget-label { font-size: 11px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: ${t.textSub}; margin-bottom: 12px; }
        .ep-timer-display { font-family: 'Outfit', sans-serif; font-size: 36px; font-weight: 800; text-align: center; letter-spacing: 1px; line-height: 1; color: ${t.text}; transition: color 0.3s; }
        .ep-timer-display.warning { color: #f59e0b; }
        .ep-timer-display.danger { color: #ef4444; animation: epblink 1s infinite; }
        @keyframes epblink { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .ep-progress-bar-bg { height: 6px; background: ${t.surfaceAlt}; border-radius: 99px; overflow: hidden; margin-top: 10px; }
        .ep-progress-bar-fill { height: 100%; border-radius: 99px; transition: width 1s linear, background 0.5s; }
        .ep-risk-bar-bg { height: 8px; background: ${t.surfaceAlt}; border-radius: 99px; overflow: hidden; margin: 8px 0 6px; }
        .ep-risk-bar-fill { height: 100%; border-radius: 99px; transition: width 0.5s ease, background 0.5s; }
        .ep-risk-labels { display: flex; justify-content: space-between; }
        .ep-risk-val { font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; text-align: center; }
        .ep-prog-big { font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 800; text-align: center; background: ${t.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .ep-prog-sub { font-size: 12px; color: ${t.textSub}; text-align: center; margin-top: 4px; }
        .ep-center { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: ${t.bg}; }
        .ep-center p { font-size: 15px; color: ${t.textMuted}; }
        .ep-fullscreen-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
        .ep-fs-card { background: ${t.surface}; padding: 40px; border-radius: 20px; text-align: center; max-width: 400px; border: 1px solid ${t.border}; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
        .ep-fs-card h2 { margin-bottom: 12px; font-family: 'Outfit', sans-serif; color: #ef4444; }
        .ep-fs-card p { margin-bottom: 24px; color: ${t.textMuted}; line-height: 1.6; }
        .ep-identity-overlay, .ep-unconfigured-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: ${t.bg}; z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; }
        .ep-id-card { background: ${t.surface}; padding: 48px; border-radius: 24px; max-width: 500px; width: 100%; border: 1px solid ${t.border}; box-shadow: 0 30px 60px ${t.cardShadow}; }
        .ep-id-icon { font-size: 48px; margin-bottom: 20px; }
        .ep-id-title { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; margin-bottom: 12px; }
        .ep-id-desc { color: ${t.textMuted}; font-size: 15px; margin-bottom: 32px; line-height: 1.6; }
        .ep-id-cam-box { width: 100%; aspect-ratio: 4/3; background: #000; border-radius: 12px; margin-bottom: 24px; overflow: hidden; border: 2px solid ${t.accent}; }
        @media (max-width: 768px) { .ep-body { grid-template-columns: 1fr; } .ep-sidebar { order: -1; display: grid; grid-template-columns: 1fr 1fr; } .ep-nav { padding: 0 16px; } .ep-body { padding: 16px; } }

        /* ── Confirm Submit Modal ── */
        .ep-modal-overlay { position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.65); backdrop-filter: blur(10px); animation: epfadeIn 0.25s ease; }
        .ep-modal-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 24px; padding: 44px 40px 36px; max-width: 480px; width: 92%; text-align: center; box-shadow: 0 32px 80px rgba(0,0,0,0.45); animation: epModalSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes epModalSlideUp { from { opacity: 0; transform: translateY(32px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .ep-modal-icon { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.25)); border: 2px solid rgba(16,185,129,0.35); display: flex; align-items: center; justify-content: center; font-size: 34px; margin: 0 auto 22px; }
        .ep-modal-title { font-size: 22px; font-weight: 800; color: ${t.text}; margin-bottom: 10px; }
        .ep-modal-desc { font-size: 14.5px; color: ${t.textMuted}; line-height: 1.65; margin-bottom: 28px; }
        .ep-modal-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 28px; }
        .ep-modal-stat { background: ${t.surfaceAlt}; border: 1px solid ${t.border}; border-radius: 12px; padding: 12px 14px; }
        .ep-modal-stat-val { font-size: 22px; font-weight: 800; color: ${t.text}; }
        .ep-modal-stat-lbl { font-size: 11px; color: ${t.textSub}; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
        .ep-modal-btns { display: flex; gap: 12px; }
        .ep-modal-cancel { flex: 1; padding: 13px; border-radius: 11px; border: 1.5px solid ${t.border}; background: transparent; color: ${t.textMuted}; font-family: 'Outfit',sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .ep-modal-cancel:hover { border-color: ${t.accent}; color: ${t.text}; }
        .ep-modal-confirm { flex: 2; padding: 13px; border-radius: 11px; border: none; background: linear-gradient(135deg,#10b981,#059669); color: #fff; font-family: 'Outfit',sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 16px rgba(16,185,129,0.35); display: flex; align-items: center; justify-content: center; gap: 8px; }
        .ep-modal-confirm:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 8px 24px rgba(16,185,129,0.45); }
        .ep-modal-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Success Screen ── */
        .ep-success-overlay { position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 60%, rgba(16,185,129,0.12) 0%, ${t.bg} 70%); animation: epfadeIn 0.4s ease; }
        .ep-success-card { background: ${t.surface}; border: 1px solid rgba(16,185,129,0.3); border-radius: 28px; padding: 56px 48px; max-width: 520px; width: 92%; text-align: center; box-shadow: 0 40px 100px rgba(0,0,0,0.4), 0 0 60px rgba(16,185,129,0.12); animation: epModalSlideUp 0.5s cubic-bezier(0.34,1.3,0.64,1); }
        .ep-success-ring { width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg,rgba(16,185,129,0.2),rgba(5,150,105,0.3)); border: 3px solid rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center; margin: 0 auto 28px; box-shadow: 0 0 40px rgba(16,185,129,0.25); animation: epSuccessPulse 2s ease-in-out infinite; }
        @keyframes epSuccessPulse { 0%,100% { box-shadow: 0 0 30px rgba(16,185,129,0.2); } 50% { box-shadow: 0 0 55px rgba(16,185,129,0.45); } }
        .ep-success-check { font-size: 48px; animation: epBounceIn 0.6s 0.2s cubic-bezier(0.34,1.56,0.64,1) both; }
        @keyframes epBounceIn { from { transform: scale(0); opacity:0; } to { transform: scale(1); opacity:1; } }
        .ep-success-title { font-size: 30px; font-weight: 800; color: ${t.text}; margin-bottom: 10px; }
        .ep-success-subtitle { font-size: 18px; font-weight: 700; background: linear-gradient(135deg,#10b981,#34d399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom: 16px; }
        .ep-success-msg { font-size: 14.5px; color: ${t.textMuted}; line-height: 1.7; margin-bottom: 12px; max-width: 380px; margin-left: auto; margin-right: auto; }
        .ep-success-note { font-size: 13px; color: ${t.textSub}; background: ${t.surfaceAlt}; border: 1px solid ${t.border}; border-radius: 10px; padding: 10px 16px; margin: 0 auto 32px; max-width: 360px; }
        .ep-success-divider { height: 1px; background: ${t.border}; margin: 28px 0; }
        .ep-success-btns { display: flex; flex-direction: column; gap: 12px; }
        .ep-success-go { padding: 15px 28px; border-radius: 12px; border: none; background: linear-gradient(135deg,#10b981,#059669); color: #fff; font-family: 'Outfit',sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 6px 20px rgba(16,185,129,0.35); display: flex; align-items: center; justify-content: center; gap: 10px; }
        .ep-success-go:hover { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 10px 28px rgba(16,185,129,0.45); }
        .ep-success-stay { padding: 12px 28px; border-radius: 12px; border: 1.5px solid ${t.border}; background: transparent; color: ${t.textMuted}; font-family: 'Outfit',sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .ep-success-stay:hover { border-color: ${t.accent}; color: ${t.text}; }
    `;

    if (loading) return <>
        <style>{css}</style>
        <div className="ep-center"><div className="ep-spinner" /><p>Loading exam data...</p></div>
    </>;

    if (!exam || questions.length === 0 || exam.duration <= 0) {
        return (
            <>
                <style>{css}</style>
                <div className="ep-unconfigured-overlay">
                    <div className="sd-logo" style={{ marginBottom: 40, fontSize: 24 }}><span>Adapt</span>Exam</div>
                    <div className="ep-id-card" style={{ borderColor: '#ef4444' }}>
                        <div className="ep-id-icon">⚠️</div>
                        <h2 className="ep-id-title">Exam Not Ready</h2>
                        <p className="ep-id-desc">
                            This exam has not been fully configured by the administrator yet. 
                            It might be missing questions or a valid duration. 
                            Please contact your instructor before taking the exam.
                        </p>
                        <button className="ep-btn ep-btn-prev" onClick={() => navigate('/student')} style={{ width: '100%', padding: '14px' }}>
                            Back to Student Dashboard
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Success screen shown after submission
    if (showSuccessScreen) {
        return (
            <>
                <style>{css}</style>
                <div className="ep-success-overlay">
                    <div className="ep-success-card">
                        <div className="ep-success-ring">
                            <span className="ep-success-check">✅</span>
                        </div>
                        <div className="ep-success-title">Exam Submitted!</div>
                        <div className="ep-success-subtitle">Thank you for completing the exam</div>
                        <p className="ep-success-msg">
                            Your answers have been recorded successfully. Our system is now processing your responses and evaluating your performance.
                        </p>
                        <div className="ep-success-note">
                            📬 We will notify you with your results soon. Please check your Student Dashboard for updates.
                        </div>
                        <div className="ep-success-divider" />
                        <div className="ep-success-btns">
                            <button
                                className="ep-success-go"
                                onClick={() => navigate('/student')}
                            >
                                🏠 Go to Student Dashboard
                            </button>
                            <button
                                className="ep-success-stay"
                                onClick={() => setShowSuccessScreen(false)}
                            >
                                Stay on this page
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <style>{css}</style>
            <ThemeSwitcher />
            <div className="ep-root">
                <nav className="ep-nav">
                    <div className="ep-nav-logo"><span>{exam.title}</span></div>
                    <div className="ep-nav-right">
                        {tabWarnings > 0 && (
                            <div className="ep-warn-chip">⚠️ {tabWarnings} tab switch{tabWarnings > 1 ? 'es' : ''}</div>
                        )}
                        <button
                            onClick={() => setShowCalc(v => !v)}
                            title="Open Scientific Calculator"
                            style={{
                                background: showCalc
                                    ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                                    : t.surfaceAlt,
                                border: `1px solid ${showCalc ? '#6366f1' : t.border}`,
                                color: showCalc ? '#fff' : t.textMuted,
                                borderRadius: '10px',
                                padding: '7px 14px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: showCalc ? '0 4px 15px rgba(99,102,241,0.4)' : 'none',
                                transition: 'all 0.2s',
                                fontFamily: "'Outfit', sans-serif",
                            }}
                        >
                            🧮 Calculator
                        </button>
                    </div>
                </nav>
                {showCalc && <ScientificCalculator onClose={() => setShowCalc(false)} t={t} />}

                {alert && <div className="ep-alert">{alert}</div>}

                {!isIdentityRegistered && !submitted && (
                    <div className="ep-identity-overlay">
                        <div className="ep-id-card">
                            <div className="ep-id-icon">👤</div>
                            <h2 className="ep-id-title">Identity Verification</h2>
                            <p className="ep-id-desc">
                                Before starting, the system must capture your face identity to ensure exam integrity. 
                                Please look directly at the camera.
                            </p>
                            <div className="ep-id-cam-box">
                                <CameraMonitor ref={idMonitorRef} onMetrics={handleCameraMetrics} reference={null} />
                            </div>
                            <button 
                                className="ep-btn ep-btn-next" 
                                style={{ width: '100%', padding: '16px' }}
                                onClick={() => {
                                    const norm = idMonitorRef.current?.capture();
                                    if (norm) {
                                        setIdReference(norm);
                                        setIsIdentityRegistered(true);
                                        setAlert('✅ Identity registered successfully!');
                                        setTimeout(() => setAlert(''), 3000);
                                    } else {
                                        setAlert('❌ Failed to capture face. Ensure you are well-lit and facing the camera.');
                                    }
                                }}
                            >
                                Register Identity & Proceed
                            </button>
                        </div>
                    </div>
                )}
                
                {isIdentityRegistered && !isFullscreen && !submitted && (
                    <div className="ep-fullscreen-overlay">
                        <div className="ep-fs-card">
                            <h2>🚨 Fullscreen Mode Required</h2>
                            <p>To ensure exam integrity, you must be in fullscreen mode to continue.</p>
                            <button className="ep-btn ep-btn-next" onClick={enterFullscreen}>Go Fullscreen</button>
                        </div>
                    </div>
                )}

                <div className="ep-body">
                    <div className="ep-left">
                        <QuestionCard
                            question={currentQ}
                            index={qIndex}
                            total={questions.length}
                            selected={answers[currentQ?._id]?.selected_option || ''}
                            onSelect={(opt) => setAnswers(prev => ({ 
                                ...prev, 
                                [currentQ._id]: { 
                                    ...(prev[currentQ._id] || {}), 
                                    selected_option: opt 
                                } 
                            }))}
                            isReplaced={!!replaced[qIndex]}
                        />
                        <div className="ep-nav-btns">
                            <button className="ep-btn ep-btn-prev" onClick={handlePrev} disabled={qIndex === 0}>← Previous</button>
                            {qIndex < questions.length - 1
                                ? <button className="ep-btn ep-btn-next" onClick={handleNext}>Next →</button>
                                : <button
                                    className="ep-btn ep-btn-submit"
                                    onClick={() => setShowConfirmModal(true)}
                                    disabled={submitted || isSubmitting}
                                  >✔ Submit Exam</button>
                            }
                        </div>

                        {/* ── Confirm Submit Modal ── */}
                        {showConfirmModal && (
                            <div className="ep-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowConfirmModal(false)}>
                                <div className="ep-modal-card">
                                    <div className="ep-modal-icon">📋</div>
                                    <div className="ep-modal-title">Ready to Submit?</div>
                                    <p className="ep-modal-desc">
                                        You are about to submit your exam. Once submitted, you will not be able to change your answers.
                                        Please review your progress before confirming.
                                    </p>
                                    <div className="ep-modal-stats">
                                        <div className="ep-modal-stat">
                                            <div className="ep-modal-stat-val" style={{ color: '#10b981' }}>{answeredCount}</div>
                                            <div className="ep-modal-stat-lbl">Answered</div>
                                        </div>
                                        <div className="ep-modal-stat">
                                            <div className="ep-modal-stat-val" style={{ color: '#f59e0b' }}>{questions.length - answeredCount}</div>
                                            <div className="ep-modal-stat-lbl">Unanswered</div>
                                        </div>
                                    </div>
                                    <div className="ep-modal-btns">
                                        <button
                                            className="ep-modal-cancel"
                                            onClick={() => setShowConfirmModal(false)}
                                        >
                                            ✖ Cancel
                                        </button>
                                        <button
                                            className="ep-modal-confirm"
                                            onClick={confirmAndSubmit}
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? '⏳ Submitting...' : '✔ Yes, Submit Exam'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="ep-qmap">
                            {questions.map((q, i) => (
                                <button key={i}
                                    className={`ep-qmap-btn ${answers[q._id]?.selected_option ? 'answered' : ''} ${replaced[i] ? 'replaced' : ''} ${i === qIndex ? 'current' : ''}`}
                                    onClick={() => { trackerRef.current?.resetQuestion(); setQIndex(i); }}>
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ep-sidebar">
                        <TimerWidget duration={exam.duration} onExpire={handleSubmit} t={t} />
                        <QuestionTimerWidget 
                            seconds={qSeconds} 
                            difficulty={currentQ?.difficulty || 'medium'} 
                            maxSeconds={exam.per_question_time?.[currentQ?.difficulty || 'medium'] || 60}
                            t={t} 
                        />
                        <div className="ep-widget">
                            <div className="ep-widget-label">📸 Camera Monitor</div>
                            {Array.isArray(mlMessage) && mlMessage.length > 0 && (
                                <div className="ep-cam-warn">
                                    {mlMessage.map((m, i) => (
                                        <div key={i} style={{ marginBottom: 4 }}>⚠️ {m}</div>
                                    ))}
                                </div>
                            )}
                            <CameraMonitor ref={monitorRef} onMetrics={handleCameraMetrics} reference={idReference} />
                            <AudioMonitor onMetrics={handleAudioMetrics} />
                        </div>
                        <div className="ep-widget">
                            <div className="ep-widget-label">🧠 Behavior Risk</div>
                            <div className="ep-risk-val" style={{ color: riskColor }}>{riskPct}%</div>
                            <div className="ep-risk-bar-bg">
                                <div className="ep-risk-bar-fill" style={{ width: `${riskPct}%`, background: riskColor }} />
                            </div>
                            <div className="ep-risk-labels">
                                <span style={{ fontSize: 11, color: t.textSub }}>Low</span>
                                <span style={{ fontSize: 11, color: t.textSub }}>High</span>
                            </div>
                        </div>
                        <div className="ep-widget" style={{ textAlign: 'center' }}>
                            <div className="ep-widget-label">📊 Progress</div>
                            <div className="ep-prog-big">{answeredCount} / {questions.length}</div>
                            <div className="ep-prog-sub">questions answered</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function QuestionTimerWidget({ seconds, difficulty, maxSeconds, t }) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = n => String(n).padStart(2, '0');
    const pct = maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0;
    const danger = seconds <= 10;
    const color = danger ? '#ef4444' : difficulty === 'hard' ? '#ef4444' : difficulty === 'medium' ? '#f59e0b' : '#10b981';
    return (
        <div className="ep-widget" style={{ textAlign: 'center', borderLeft: `4px solid ${color}` }}>
            <div className="ep-widget-label">⌛ Question Timer ({difficulty})</div>
            <div className={`ep-timer-display ${danger ? 'danger' : ''}`} style={{ color, fontSize: '28px' }}>
                {pad(mins)}:{pad(secs)}
            </div>
            <div className="ep-progress-bar-bg" style={{ height: '4px' }}>
                <div className="ep-progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

function TimerWidget({ duration, onExpire, t }) {
    const total = duration * 60;
    const [seconds, setSeconds] = useState(total);
    const onExpireRef = useRef(onExpire);
    useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

    useEffect(() => {
        if (seconds <= 0) { 
            console.log("[TimerWidget] Exam duration expired. Triggering final submission.");
            onExpireRef.current?.(); 
            return; 
        }
        const id = setInterval(() => setSeconds(s => s - 1), 1000);
        return () => clearInterval(id);
    }, [seconds]);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = n => String(n).padStart(2, '0');
    const pct = (seconds / total) * 100;
    const warning = seconds <= 300;
    const danger = seconds <= 60;
    const color = danger ? '#ef4444' : warning ? '#f59e0b' : t.accent;
    return (
        <div className="ep-widget" style={{ textAlign: 'center' }}>
            <div className="ep-widget-label">⏱ Time Remaining</div>
            <div className={`ep-timer-display ${danger ? 'danger' : warning ? 'warning' : ''}`} style={{ color }}>
                {pad(mins)}:{pad(secs)}
            </div>
            <div className="ep-progress-bar-bg">
                <div className="ep-progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}
