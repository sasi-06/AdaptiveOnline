import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    initInterviewSession,
    uploadInterviewResume,
    generateInterviewQuestion,
    submitInterviewAnswer,
    uploadInterviewCheatClip,
    endInterviewSession,
    logInterviewBehavior,
} from '../services/api';
import CameraMonitor from '../components/CameraMonitor';
import BehaviorTracker from '../components/BehaviorTracker';
import { useTheme } from '../context/ThemeContext';
import AudioMonitor from '../components/AudioMonitor';

export default function InterviewPage() {
    const { id: interviewId } = useParams();
    const navigate = useNavigate();
    const { state } = useLocation();
    const rawRoles = state?.roles || [];
    const roles = Array.isArray(rawRoles) ? rawRoles : typeof rawRoles === 'string' ? rawRoles.split(',').map(r => r.trim()).filter(Boolean) : [];
    const { theme: t } = useTheme();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(document.fullscreenElement !== null);
    const [idReference, setIdReference] = useState(null);
    const [alertMsg, setAlertMsg] = useState('');
    const idMonitorRef = useRef(null);
    const lastViolationTime = useRef(0);

    // Forms & Settings
    const [selectedRole, setSelectedRole] = useState(roles.length > 0 ? roles[0] : '');
    const [resumeFile, setResumeFile] = useState(null);
    const [permissionsGranted, setPermissionsGranted] = useState(false);
    const [agreed, setAgreed] = useState(false);

    const [questionNumber, setQuestionNumber] = useState(1);
    const [totalQuestions, setTotalQuestions] = useState(1);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [transcript, setTranscript] = useState('');
    const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
    const [lastScoreFeedback, setLastScoreFeedback] = useState(null);
    const [finalReport, setFinalReport] = useState(null);

    const cameraRef = useRef(null);
    const behaviorTrackerRef = useRef(null);
    const synthRef = useRef(null);
    const recognitionRef = useRef(null);
    const isRecordingRef = useRef(false);
    const questionStartTime = useRef(Date.now());
    const cameraMetricsRef = useRef({});
    const audioMetricsRef = useRef({});

    useEffect(() => {
        // Init Speech Recognition if supported
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recog = new SpeechRecognition();
            recog.continuous = true;
            recog.interimResults = true;
            recog.lang = 'en-US';

            recog.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    }
                }
                if (finalTranscript) {
                    setTranscript((prev) => (prev ? prev.trim() + ' ' : '') + finalTranscript.trim());
                }
            };

            recog.onend = () => {
                // If user hasn't explicitly stopped recording, automatically restart to prevent cutoff
                if (isRecordingRef.current) {
                    try {
                        recog.start();
                    } catch (e) { }
                }
            };

            recog.onerror = (e) => {
                if (e.error !== 'no-speech') {
                    console.warn('Speech recognition status:', e.error);
                }
            };

            recognitionRef.current = recog;
        }

        // Init BehaviorTracker
        behaviorTrackerRef.current = new BehaviorTracker((violation) => {
            if (violation.type === 'tab') {
                setAlertMsg(' Tab switch detected! Please stay on the interview page. This violation has been logged.');
                setTimeout(() => setAlertMsg(''), 4000);
                handleBehaviorViolation(violation);
            } else if (violation.type === 'fullscreen') {
                setIsFullscreen(false);
                setAlertMsg(' You exited fullscreen mode! Please return to fullscreen immediately.');
                setTimeout(() => setAlertMsg(''), 4000);
                handleBehaviorViolation(violation);
            }
        });
        behaviorTrackerRef.current.start();

        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);

        // Cleanup speech synthesis and tracker on unmount
        return () => {
            isRecordingRef.current = false;
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
            if (synthRef.current) {
                synthRef.current.cancel();
            }
            if (behaviorTrackerRef.current) {
                behaviorTrackerRef.current.stop();
            }
            document.removeEventListener('fullscreenchange', handleFsChange);
        };
    }, []);

    // Periodic behavior logging for timeline analysis
    useEffect(() => {
        if (step < 6 || finalReport || !sessionId) return; // only log during active Q&A

        const interval = setInterval(async () => {
            try {
                const cam = cameraMetricsRef.current;
                const aud = audioMetricsRef.current;

                const hasAnomaly =
                    cam.multipleFacesDetected ||
                    cam.phoneDetected ||
                    cam.identityMismatch ||
                    cam.faceNotDetected ||
                    aud.multipleVoicesDetected ||
                    (cam.eyeDeviation > 35) ||
                    (cam.headMovement > 25);

                let snapshot = null;

                if (hasAnomaly && cameraRef.current) {
                    snapshot = cameraRef.current.takeSnapshot(false);
                }

                const browserMetrics = behaviorTrackerRef.current?.getMetrics() || {};

                const payload = {
                    session_id: sessionId,
                    question_number: questionNumber,
                    eyeDeviation: cam.eyeDeviation || 0,
                    headMovement: cam.headMovement || 0,
                    faceScale: cam.faceScale || 0,
                    mouseIdleTime: browserMetrics.mouseIdleTime || 0,
                    responseTime: browserMetrics.responseTime || 0,
                    tabSwitches: browserMetrics.tabSwitches || 0,
                    fullscreenExits: browserMetrics.fullscreenExits || 0,
                    faceNotDetected: cam.faceNotDetected || false,
                    multipleFacesDetected: cam.multipleFacesDetected || false,
                    phoneDetected: cam.phoneDetected || false,
                    identity_mismatch: cam.identityMismatch || false,
                    speech_detected: aud.speechDetected || false,
                    multiple_voices: aud.multipleVoicesDetected || false,
                    unexpected_speech: !isRecordingAnswer && aud.speechDetected,
                    speech_level: aud.speechLevel || 0,
                    snapshot,
                };

                await logInterviewBehavior(payload);
            } catch (err) {
                console.error('Interview behavior log failed:', err);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [step, finalReport, sessionId, questionNumber, isRecordingAnswer]);

    const speakQuestion = (text) => {
        if ('speechSynthesis' in window) {
            if (synthRef.current) {
                synthRef.current.cancel();
            }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            synthRef.current = window.speechSynthesis;
            synthRef.current.speak(utterance);
        }
    };

    const handleStartInterviewFlow = () => {
        if (!agreed) {
            setAlertMsg('You must agree to the instructions.');
            setTimeout(() => setAlertMsg(''), 4000);
            return;
        }
        setStep(2);
    };

    const handleResumeUpload = () => {
        if (!selectedRole) {
            setAlertMsg('Please select a role.');
            setTimeout(() => setAlertMsg(''), 4000);
            return;
        }
        if (!resumeFile) {
            setAlertMsg('Please upload your resume (PDF).');
            setTimeout(() => setAlertMsg(''), 4000);
            return;
        }
        setStep(3);
    };

    const handlePermissions = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setPermissionsGranted(true);
        } catch (err) {
            setAlertMsg('Camera and microphone permissions are required.');
            setTimeout(() => setAlertMsg(''), 4000);
        }
    };

    const initializeAndParse = async () => {
        try {
            setLoading(true);
            // Init Session with reset=true to ensure a fresh, randomized question sequence
            const resInit = await initInterviewSession({ interviewId, selectedRole, reset: true });
            setSessionId(resInit.data._id);
            setTotalQuestions(resInit.data.totalQuestionsConfigured || 5);
            setQuestionNumber(1);

            // Upload Resume
            const formData = new FormData();
            formData.append('resume', resumeFile);
            await uploadInterviewResume(resInit.data._id, formData);

            setStep(5);
            fetchNextQuestion(resInit.data._id);
        } catch (error) {
            console.error('Init Error:', error);
            setAlertMsg('Failed to initialize interview.');
            setTimeout(() => setAlertMsg(''), 4000);
        } finally {
            setLoading(false);
        }
    };

    const fetchNextQuestion = async (sId = sessionId) => {
        try {
            setLoading(true);
            const res = await generateInterviewQuestion(sId);
            setCurrentQuestion(res.data.questionText);
            setTranscript('');
            setStep(6);
            speakQuestion(res.data.questionText);
            questionStartTime.current = Date.now();
        } catch (error) {
            console.error('Fetch Question Error:', error);
            setAlertMsg('Failed to fetch question.');
            setTimeout(() => setAlertMsg(''), 4000);
        } finally {
            setLoading(false);
        }
    };

    const startSpeechRecognition = () => {
        if (recognitionRef.current) {
            try {
                isRecordingRef.current = true;
                recognitionRef.current.start();
                setIsRecordingAnswer(true);
            } catch (e) {
                console.warn('Recognition already running');
                setIsRecordingAnswer(true);
            }
        } else {
            setAlertMsg('Speech recognition is not supported in this browser. Please use Chrome or type your answer.');
            setTimeout(() => setAlertMsg(''), 4000);
        }
    };

    const stopSpeechRecognition = () => {
        isRecordingRef.current = false;
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) { }
        }
        setIsRecordingAnswer(false);
    };

    const submitAnswerAndContinue = async () => {
        try {
            if (isRecordingAnswer) {
                stopSpeechRecognition();
            }

            const cleanTranscript = (transcript || '').trim();
            const wordCount = cleanTranscript ? cleanTranscript.split(/\s+/).filter(Boolean).length : 0;

            // CORRECT USER VALIDATION: Require minimum meaningful answer
            if (wordCount < 3) {
                setAlertMsg(' Please speak your answer or type an explanation before submitting.');
                setTimeout(() => setAlertMsg(''), 4000);
                return;
            }

            setLoading(true);
            const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);

            const res = await submitInterviewAnswer(sessionId, { transcript: cleanTranscript, timeTaken });

            setLastScoreFeedback({
                score: res.data.score,
                feedback: res.data.feedback
            });

            if (res.data.isComplete) {
                finishInterview();
            } else {
                setQuestionNumber(prev => prev + 1);
                fetchNextQuestion();
            }
        } catch (error) {
            console.error('Submit Answer Error:', error);
            setAlertMsg('Failed to submit answer.');
            setTimeout(() => setAlertMsg(''), 4000);
        } finally {
            setLoading(false);
        }
    };

    const finishInterview = async () => {
        try {
            setStep(9);
            const res = await endInterviewSession(sessionId);
            setFinalReport(res.data);
            setStep(10);
        } catch (error) {
            console.error('End Session Error:', error);
            setAlertMsg('Failed to end interview.');
            setTimeout(() => setAlertMsg(''), 4000);
        }
    };

    const handleBehaviorViolation = async (violation) => {
        console.warn('Behavior violation:', violation);
        const now = Date.now();
        if (now - lastViolationTime.current < 4000) return;
        lastViolationTime.current = now;

        if (sessionId) {
            try {
                // Capture actual visual snapshot evidence
                const snapshot = cameraRef.current?.takeSnapshot?.();
                const formData = new FormData();
                formData.append('reason', `Violation: ${violation.type}`);
                if (snapshot) {
                    formData.append('snapshot', snapshot);
                }
                await uploadInterviewCheatClip(sessionId, formData);
            } catch (error) {
                console.error('Cheat Clip Upload Error:', error);
            }
        }
    };

    const handleCameraMetrics = (metrics) => {
        cameraMetricsRef.current = metrics;

        if (step >= 6 && step < 10) {
            let anomaly = null;
            if (metrics.identityMismatch) anomaly = 'Identity Mismatch';
            else if (metrics.multipleFacesDetected) anomaly = 'Multiple Faces Detected';
            else if (metrics.phoneDetected) anomaly = 'Cell Phone Detected';
            else if (metrics.faceNotDetected) anomaly = 'Face Not Detected';
            else if (metrics.eyeDeviation > 35) anomaly = 'Suspicious Eye Movement';
            else if (metrics.headMovement > 25) anomaly = 'Suspicious Head Movement';

            if (anomaly) {
                handleBehaviorViolation({ type: anomaly });
                setAlertMsg(` ${anomaly} Detected!`);
                setTimeout(() => setAlertMsg(''), 4000);
            }
        }
    };

    const handleAudioMetrics = (metrics) => {
        audioMetricsRef.current = metrics;

        if (step >= 6 && step < 10 && metrics.multipleVoicesDetected) {
            handleBehaviorViolation({ type: 'Multiple Voices Detected' });
            setAlertMsg(' Multiple voices detected! Please ensure you are alone.');
            setTimeout(() => setAlertMsg(''), 4000);
        }
    };

    // ─── STYLES ───
    const styles = {
        container: { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: 'Outfit, sans-serif', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
        card: { background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '40px', maxWidth: '800px', width: '100%', boxShadow: `0 10px 40px rgba(0,0,0,0.1)` },
        title: { fontSize: '28px', fontWeight: 800, marginBottom: '20px', textAlign: 'center' },
        btn: { padding: '12px 24px', background: t.accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px' },
        input: { width: '100%', padding: '12px', border: `1px solid ${t.border}`, borderRadius: '8px', background: t.surfaceAlt, color: t.text, marginBottom: '16px' }
    };

    return (
        <div style={styles.container}>
            {alertMsg && (
                <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#ef4444', color: '#fff', padding: '12px 24px', borderRadius: '8px', zIndex: 10000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontWeight: 'bold' }}>
                    {alertMsg}
                </div>
            )}

            {/* Step 1: Instructions */}
            {step === 1 && (
                <div style={styles.card}>
                    <h1 style={styles.title}>AI Technical Interview - Terms and Conditions</h1>
                    <ul style={{ lineHeight: '1.8', marginBottom: '24px', fontSize: '15px' }}>
                        <li><strong>Strict Environment:</strong> Fullscreen mode is mandatory. Leaving fullscreen or switching tabs will be recorded as a proctoring violation.</li>
                        <li><strong>Identity Verification:</strong> Your face is verified against your registered identity throughout the entire session.</li>
                        <li><strong>Audio & Video Proctoring:</strong> Head turns, prolonged gaze away, multiple voices, and phones in frame are automatically detected and captured as visual proof.</li>
                        <li><strong>Adaptive Questions:</strong> Questions dynamically adapt to your specified role, your resume skills, and follow up directly on your spoken answers.</li>
                        <li><strong>Answering Format:</strong> The AI speaks the question audibly. You can speak your answer using your microphone and review or edit the live transcript before submitting.</li>
                    </ul>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                        I agree to start the interview and abide by the terms and conditions.
                    </label>
                    <button style={styles.btn} onClick={handleStartInterviewFlow}>Proceed →</button>
                </div>
            )}

            {/* Step 2: Role & Resume */}
            {step === 2 && (
                <div style={styles.card}>
                    <h2 style={styles.title}>Role & Resume</h2>
                    <p style={{ marginBottom: '16px' }}>Select the technical role you are interviewing for and upload your latest resume (PDF).</p>

                    {roles && roles.length > 0 ? (
                        <select style={styles.input} value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
                            <option value="" style={{ color: t.text, background: t.surface }}>Select a Role</option>
                            {roles.map(r => <option key={r} value={r} style={{ color: t.text, background: t.surface }}>{r}</option>)}
                        </select>
                    ) : (
                        <input style={styles.input} type="text" placeholder="e.g. React Developer, Backend Engineer, Python Developer" value={selectedRole} onChange={e => setSelectedRole(e.target.value)} />
                    )}

                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: t.textSub, marginBottom: '6px', display: 'block' }}>Upload Resume (PDF format)</label>
                    <input style={styles.input} type="file" accept=".pdf" onChange={e => setResumeFile(e.target.files[0])} />

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button style={{ ...styles.btn, background: 'transparent', color: t.text, border: `1px solid ${t.border}` }} onClick={() => setStep(1)}>← Back</button>
                        <button style={styles.btn} onClick={handleResumeUpload}>Upload & Continue →</button>
                    </div>
                </div>
            )}

            {/* Step 3: Permissions & System Check */}
            {step === 3 && (
                <div style={styles.card}>
                    <h2 style={styles.title}>System & Identity Check</h2>
                    <p style={{ textAlign: 'center', marginBottom: '16px' }}>We need camera and microphone access to conduct and proctor the interview.</p>

                    {!permissionsGranted ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button style={styles.btn} onClick={handlePermissions}>Grant Permissions</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <p style={{ marginBottom: '12px', fontSize: '14px', color: t.textSub }}>Please look directly at the camera to register your facial identity for the session.</p>
                            <div style={{ width: '100%', maxWidth: '400px', marginBottom: '20px' }}>
                                <CameraMonitor ref={idMonitorRef} onMetrics={() => { }} reference={null} />
                            </div>
                            <button style={styles.btn} onClick={() => {
                                const norm = idMonitorRef.current?.capture();
                                if (norm) {
                                    setIdReference(norm);
                                    setStep(4);
                                    initializeAndParse();
                                } else {
                                    setAlertMsg('Failed to capture face. Ensure you are well-lit and facing the camera directly.');
                                    setTimeout(() => setAlertMsg(''), 4000);
                                }
                            }}>Register Identity & Start</button>
                        </div>
                    )}
                </div>
            )}

            {/* Fullscreen Enforcer Overlay */}
            {step >= 4 && !isFullscreen && step < 10 && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: t.surface, padding: '40px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', border: `1px solid ${t.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                        <h2 style={{ marginBottom: '12px', fontFamily: 'Outfit, sans-serif', color: '#ef4444' }}> Fullscreen Mode Required</h2>
                        <p style={{ marginBottom: '24px', color: t.textMuted, lineHeight: '1.6' }}>To maintain interview integrity, you must remain in fullscreen mode. Returning to windowed mode flags a proctoring anomaly.</p>
                        <button style={{ ...styles.btn, background: t.accent }} onClick={() => {
                            const docElm = document.documentElement;
                            if (docElm.requestFullscreen) docElm.requestFullscreen();
                            else if (docElm.mozRequestFullScreen) docElm.mozRequestFullScreen();
                            else if (docElm.webkitRequestFullScreen) docElm.webkitRequestFullScreen();
                            else if (docElm.msRequestFullscreen) docElm.msRequestFullscreen();
                            setIsFullscreen(true);
                        }}>Return to Fullscreen</button>
                    </div>
                </div>
            )}

            {/* Step 4 & 5: Processing */}
            {(step === 4 || step === 5) && (
                <div style={styles.card}>
                    <h2 style={styles.title}>Setting up your interview...</h2>
                    <p style={{ textAlign: 'center', color: t.textMuted }}>
                        {step === 4 ? 'Analyzing your resume and extracting skills...' : 'Generating your personalized interview questions...'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                        <div style={{ width: '40px', height: '40px', border: `4px solid ${t.border}`, borderTopColor: t.accent, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            {/* Step 6, 7, 8: Interview Loop */}
            {(step === 6 || step === 7 || step === 8) && (
                <div style={{ width: '100%', maxWidth: '1050px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                    {/* Main Interview Area */}
                    <div style={{ ...styles.card, flex: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: t.accent, background: 'rgba(99, 102, 241, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                                    Question {questionNumber} of {totalQuestions}
                                </span>
                                <span style={{ fontSize: '12px', color: t.textMuted }}>• {selectedRole}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, color: t.text, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => speakQuestion(currentQuestion)}
                                    title="Replay audio of current question"
                                >
                                     Replay Question
                                </button>
                                <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => finishInterview()}>
                                    End Early
                                </button>
                            </div>
                        </div>

                        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', lineHeight: '1.5', color: t.text }}>
                            {currentQuestion}
                        </h2>

                        {/* Interactive Answer Input with Live Edit Support */}
                        <div style={{ background: t.surfaceAlt, padding: '16px', borderRadius: '12px', border: `1px solid ${isRecordingAnswer ? '#ef4444' : t.border}`, marginBottom: '16px', position: 'relative', transition: 'border-color 0.3s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: `1px solid ${t.border}`, paddingBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isRecordingAnswer ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                                            Listening to your microphone...
                                        </span>
                                    ) : (
                                        <span style={{ color: t.textMuted, fontSize: '12px' }}>
                                             Spoken Transcript (Editable)
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: t.textMuted }}>
                                    <span>{transcript ? transcript.split(/\s+/).filter(Boolean).length : 0} words</span>
                                    {transcript && (
                                        <button
                                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}
                                            onClick={() => setTranscript('')}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            <textarea
                                value={transcript}
                                onChange={e => setTranscript(e.target.value)}
                                placeholder="Click 'Start Speaking' to speak your answer, or type directly into this box. You can freely edit or expand your answer before submitting..."
                                style={{
                                    width: '100%',
                                    minHeight: '140px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: t.text,
                                    resize: 'vertical',
                                    outline: 'none',
                                    fontSize: '15px',
                                    lineHeight: '1.6',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        {/* Controls */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {!isRecordingAnswer ? (
                                    <button
                                        style={{ ...styles.btn, marginTop: 0, background: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        onClick={startSpeechRecognition}
                                    >
                                        <span style={{ fontSize: '18px' }}></span> Start Speaking
                                    </button>
                                ) : (
                                    <button
                                        style={{ ...styles.btn, marginTop: 0, background: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        onClick={stopSpeechRecognition}
                                    >
                                        <span style={{ fontSize: '18px' }}>⏹</span> Stop Speaking
                                    </button>
                                )}
                            </div>

                            <button
                                style={{
                                    ...styles.btn,
                                    marginTop: 0,
                                    background: t.accent,
                                    opacity: loading ? 0.6 : 1,
                                    cursor: loading ? 'not-allowed' : 'pointer'
                                }}
                                disabled={loading}
                                onClick={submitAnswerAndContinue}
                            >
                                {loading ? 'Evaluating Response...' : 'Submit Answer →'}
                            </button>
                        </div>
                    </div>

                    {/* Proctoring Sidebar */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: t.surface, padding: '16px', borderRadius: '12px', border: `1px solid ${t.border}` }}>
                            <h3 style={{ fontSize: '13px', marginBottom: '12px', color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>
                                Live Proctoring Feed
                            </h3>
                            <CameraMonitor ref={cameraRef} onMetrics={handleCameraMetrics} reference={idReference} />
                            <AudioMonitor onMetrics={handleAudioMetrics} />
                        </div>
                    </div>

                </div>
            )}

            {/* Step 10: End Report */}
            {step === 10 && (
                <div style={{ ...styles.card, maxWidth: '900px' }}>
                    <h2 style={styles.title}>Interview Completed </h2>
                    <p style={{ textAlign: 'center', marginBottom: '24px', fontSize: '16px' }}>Your technical responses and integrity metrics have been evaluated.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ background: t.surfaceAlt, padding: '24px', borderRadius: '12px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: `1px solid ${t.border}`, paddingBottom: '12px' }}>Evaluation Report</h3>
                            <div>
                                <strong>Final Technical Score:</strong>
                                <span style={{ fontSize: '24px', fontWeight: 'bold', color: (finalReport?.finalScore || 0) >= 80 ? '#10b981' : (finalReport?.finalScore || 0) >= 60 ? '#f59e0b' : '#ef4444', marginLeft: '10px' }}>
                                    {finalReport?.finalScore !== undefined ? `${finalReport.finalScore}/100` : 'Evaluating...'}
                                </span>
                            </div>
                            <div>
                                <strong>Recommendation:</strong>
                                <span style={{ marginLeft: '8px', fontWeight: '600', color: finalReport?.report?.hiringRecommendation?.includes('Hire') ? '#10b981' : '#f59e0b' }}>
                                    {finalReport?.report?.hiringRecommendation || 'Under Review'}
                                </span>
                            </div>
                            <div>
                                <strong>Strengths:</strong>
                                <ul style={{ marginLeft: '20px', marginTop: '8px', fontSize: '14px', lineHeight: '1.6' }}>
                                    {finalReport?.report?.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>Evaluating strengths...</li>}
                                </ul>
                            </div>
                            <div>
                                <strong>Areas to Improve:</strong>
                                <ul style={{ marginLeft: '20px', marginTop: '8px', fontSize: '14px', lineHeight: '1.6' }}>
                                    {finalReport?.report?.weaknesses?.map((w, i) => <li key={i}>{w}</li>) || <li>Evaluating areas...</li>}
                                </ul>
                            </div>
                        </div>

                        <div style={{ background: t.surfaceAlt, padding: '24px', borderRadius: '12px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', borderBottom: `1px solid ${t.border}`, paddingBottom: '12px' }}>
                                Proctoring & Integrity Log
                            </h3>
                            {finalReport?.cheatingClips && finalReport.cheatingClips.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '300px' }}>
                                    {finalReport.cheatingClips.map((clip, idx) => (
                                        <div key={idx} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ef4444', marginBottom: '4px' }}> {clip.reason}</div>
                                            <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '8px' }}>{new Date(clip.timestamp || Date.now()).toLocaleTimeString()}</div>
                                            {clip.videoUrl && clip.videoUrl.startsWith('data:image') ? (
                                                <img src={clip.videoUrl} alt="Violation Evidence" style={{ maxWidth: '160px', borderRadius: '6px', border: `1px solid ${t.border}` }} />
                                            ) : clip.videoUrl ? (
                                                <a href={clip.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: t.accent, textDecoration: 'none', fontWeight: '500' }}>
                                                    View Violation Evidence →
                                                </a>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}></div>
                                    <div style={{ fontWeight: 'bold' }}>Clean Proctoring Session</div>
                                    <div style={{ fontSize: '13px', marginTop: '4px' }}>No severe integrity anomalies were detected.</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                        <button style={styles.btn} onClick={() => navigate('/student/dashboard')}>Return to Dashboard</button>
                    </div>
                </div>
            )}

        </div>
    );
}
