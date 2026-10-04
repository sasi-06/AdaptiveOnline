import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    initInterviewSession,
    uploadInterviewResume,
    generateInterviewQuestion,
    submitInterviewAnswer,
    uploadInterviewCheatClip,
    endInterviewSession,
} from '../services/api';
import CameraMonitor from '../components/CameraMonitor';
import BehaviorTracker from '../components/BehaviorTracker';
import { useTheme } from '../context/ThemeContext';
import AudioMonitor from '../components/AudioMonitor';
import { logInterviewBehavior } from '../services/api'; // add to your existing import line


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
    const [finalReport, setFinalReport] = useState(null);

    const cameraRef = useRef(null);
    const behaviorTrackerRef = useRef(null);
    const synthRef = useRef(null);
    const recognitionRef = useRef(null);
    const questionStartTime = useRef(Date.now());
const cameraMetricsRef = useRef({});
const audioMetricsRef = useRef({});
    useEffect(() => {
        // Init Speech Recognition if supported
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    }
                }
                if (finalTranscript) {
                    setTranscript((prev) => prev + finalTranscript);
                }
            };
        }

        // Init BehaviorTracker
        behaviorTrackerRef.current = new BehaviorTracker((violation) => {
            if (violation.type === 'tab') {
                setAlertMsg('⚠️ Tab switch detected! Please stay on the interview page. This violation has been logged.');
                setTimeout(() => setAlertMsg(''), 4000);
                handleBehaviorViolation(violation);
            } else if (violation.type === 'fullscreen') {
                setIsFullscreen(false);
                setAlertMsg('🚨 You exited fullscreen mode! Please return to fullscreen immediately.');
                setTimeout(() => setAlertMsg(''), 4000);
                handleBehaviorViolation(violation);
            }
        });
        behaviorTrackerRef.current.start();

        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);

        // Cleanup speech synthesis and tracker on unmount
        return () => {
            if (synthRef.current) {
                synthRef.current.cancel();
            }
            if (behaviorTrackerRef.current) {
                behaviorTrackerRef.current.stop();
            }
            document.removeEventListener('fullscreenchange', handleFsChange);
        };
    }, []);

    // Periodic behavior logging → powers the Admin "Analyze Timeline" view
useEffect(() => {
    if (step < 6 || finalReport) return; // only log during active Q&A

    const interval = setInterval(async () => {
        try {
            const cam = cameraMetricsRef.current;
            const aud = audioMetricsRef.current;

            const hasAnomaly =
                cam.multipleFacesDetected ||
                cam.phoneDetected ||
                cam.identityMismatch ||
                cam.faceNotDetected ||
                aud.multipleVoicesDetected;

            let snapshot;
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
                speech_level: aud.speechLevel || 0,
                snapshot,
            };

            await logInterviewBehavior(payload);
        } catch (err) {
            console.error('Interview behavior log failed:', err);
        }
    }, 5000); // every 5s — tune as needed

    return () => clearInterval(interval);
}, [step, finalReport, sessionId, questionNumber]);

    const speakQuestion = (text) => {
        if ('speechSynthesis' in window) {
            if (synthRef.current) {
                synthRef.current.cancel();
            }
            const utterance = new SpeechSynthesisUtterance(text);
            synthRef.current = window.speechSynthesis;
            synthRef.current.speak(utterance);
        }
    };

    const handleStartInterviewFlow = async () => {
        if (!agreed) {
            setAlertMsg('You must agree to the instructions.');
            setTimeout(() => setAlertMsg(''), 4000);
            return;
        }
        setStep(2);
    };

    const handleResumeUpload = async () => {
        if (!selectedRole) {
            setAlertMsg('Please select a role.');
            setTimeout(() => setAlertMsg(''), 4000);
            return;
        }
        if (!resumeFile) {
            setAlertMsg('Please upload your resume.');
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
            // Init Session
            const resInit = await initInterviewSession({ interviewId, selectedRole });
            setSessionId(resInit.data._id);
            setTotalQuestions(resInit.data.totalQuestionsConfigured || 5);
            
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
                recognitionRef.current.start();
                setIsRecordingAnswer(true);
            } catch (e) {
                console.warn('Recognition already started');
            }
        } else {
            setAlertMsg('Speech recognition is not supported in this browser. Please use Chrome.');
            setTimeout(() => setAlertMsg(''), 4000);
        }
    };

    const stopSpeechRecognition = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
                setIsRecordingAnswer(false);
            } catch (e) {}
        }
    };

    const submitAnswerAndContinue = async () => {
        try {
            if (isRecordingAnswer) stopSpeechRecognition();
            setLoading(true);
            const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);
            
            const res = await submitInterviewAnswer(sessionId, { transcript, timeTaken });
            
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
                const formData = new FormData();
                formData.append('reason', `Violation: ${violation.type}`);
                await uploadInterviewCheatClip(sessionId, formData);
            } catch (error) {
                console.error('Cheat Clip Upload Error:', error);
            }
        }
    };

const handleCameraMetrics = (metrics) => {
    cameraMetricsRef.current = metrics; // NEW: keep latest metrics for the logger

    if (step >= 6) {
        let anomaly = null;
        if (metrics.identityMismatch) anomaly = 'Identity Mismatch';
        else if (metrics.multipleFacesDetected) anomaly = 'Multiple Faces Detected';
        else if (metrics.phoneDetected) anomaly = 'Cell Phone Detected';
        else if (metrics.faceNotDetected) anomaly = 'Face Not Detected';
        else if (metrics.eyeDeviation > 30) anomaly = 'Suspicious Eye Movement';
        else if (metrics.headMovement > 15) anomaly = 'Suspicious Head Movement';

        if (anomaly) {
            handleBehaviorViolation({ type: anomaly });
            setAlertMsg(`🚨 ${anomaly} Detected!`);
            setTimeout(() => setAlertMsg(''), 4000);
        }
    }
};
// NEW: handler for AudioMonitor
const handleAudioMetrics = (metrics) => {
    audioMetricsRef.current = metrics;
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
                        <li><strong>Strict Environment:</strong> Camera checking and voice detection are enabled. The tab must remain in full screen mode at all times. All rules are followed in a strict manner.</li>
                        <li><strong>Identity Verification:</strong> Your voice and face must remain the same from the start of the interview to the very end.</li>
                        <li><strong>AI Proctoring:</strong> We monitor your eye movements, head position, and background audio to ensure integrity. Looking away or using a phone will flag your session and record video evidence.</li>
                        <li><strong>Resume Based:</strong> Questions are dynamically generated based on the role and your uploaded resume.</li>
                        <li><strong>Format:</strong> The AI will ask a question audibly. You will answer using your microphone.</li>
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
                    <p style={{ marginBottom: '16px' }}>Please specify the role you are applying for and upload your latest resume (PDF or DOCX).</p>
                    
                    {roles && roles.length > 0 ? (
                        <select style={styles.input} value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
                            <option value="" style={{ color: t.text, background: t.surface }}>Select a Role</option>
                            {roles.map(r => <option key={r} value={r} style={{ color: t.text, background: t.surface }}>{r}</option>)}
                        </select>
                    ) : (
                        <input style={styles.input} type="text" placeholder="e.g. React Developer" value={selectedRole} onChange={e => setSelectedRole(e.target.value)} />
                    )}
                    
                    <input style={styles.input} type="file" accept=".pdf" onChange={e => setResumeFile(e.target.files[0])} />

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button style={{...styles.btn, background: 'transparent', color: t.text, border: `1px solid ${t.border}`}} onClick={() => setStep(1)}>← Back</button>
                        <button style={styles.btn} onClick={handleResumeUpload}>Upload & Continue →</button>
                    </div>
                </div>
            )}

            {/* Step 3: Permissions & System Check */}
            {step === 3 && (
                <div style={styles.card}>
                    <h2 style={styles.title}>System & Identity Check</h2>
                    <p style={{ textAlign: 'center', marginBottom: '16px' }}>We need access to your camera and microphone to conduct the interview.</p>
                    
                    {!permissionsGranted ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button style={styles.btn} onClick={handlePermissions}>Grant Permissions</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <p style={{ marginBottom: '12px', fontSize: '14px', color: t.textSub }}>Please look directly at the camera to register your identity for the session.</p>
                            <div style={{ width: '100%', maxWidth: '400px', marginBottom: '20px' }}>
                                <CameraMonitor ref={idMonitorRef} onMetrics={() => {}} reference={null} />
                            </div>
                            <button style={styles.btn} onClick={() => {
                                const norm = idMonitorRef.current?.capture();
                                if (norm) {
                                    setIdReference(norm);
                                    setStep(4);
                                    initializeAndParse();
                                } else {
                                    setAlertMsg('Failed to capture face. Ensure you are well-lit and facing the camera.');
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
                        <h2 style={{ marginBottom: '12px', fontFamily: 'Outfit, sans-serif', color: '#ef4444' }}>🚨 Fullscreen Mode Required</h2>
                        <p style={{ marginBottom: '24px', color: t.textMuted, lineHeight: '1.6' }}>To ensure interview integrity, you must be in fullscreen mode to continue.</p>
                        <button style={{ ...styles.btn, background: t.accent }} onClick={() => {
                            const docElm = document.documentElement;
                            if (docElm.requestFullscreen) docElm.requestFullscreen();
                            else if (docElm.mozRequestFullScreen) docElm.mozRequestFullScreen();
                            else if (docElm.webkitRequestFullScreen) docElm.webkitRequestFullScreen();
                            else if (docElm.msRequestFullscreen) docElm.msRequestFullscreen();
                            setIsFullscreen(true);
                        }}>Go Fullscreen</button>
                    </div>
                </div>
            )}

            {/* Step 4 & 5: Processing */}
            {(step === 4 || step === 5) && (
                <div style={styles.card}>
                    <h2 style={styles.title}>Setting up your interview...</h2>
                    <p style={{ textAlign: 'center', color: t.textMuted }}>
                        {step === 4 ? 'Analyzing your resume and extracting skills...' : 'Generating your first personalized question...'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                        <div style={{ width: '40px', height: '40px', border: `4px solid ${t.border}`, borderTopColor: t.accent, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            {/* Step 6, 7, 8: Interview Loop */}
            {(step === 6 || step === 7 || step === 8) && (
                <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                    
                    {/* Main Interview Area */}
                    <div style={{ ...styles.card, flex: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: t.accent }}>Question {questionNumber} / {totalQuestions}</span>
                            <button style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer' }} onClick={() => finishInterview()}>End Interview</button>
                        </div>
                        
                        <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '30px', lineHeight: '1.5' }}>
                            {currentQuestion}
                        </h2>

                        <div style={{ background: t.surfaceAlt, padding: '20px', borderRadius: '12px', minHeight: '150px', border: `1px solid ${t.border}`, marginBottom: '24px' }}>
                            {transcript ? (
                                <p style={{ fontStyle: 'italic', color: t.text }}>{transcript}</p>
                            ) : (
                                <p style={{ color: t.textMuted }}>Your spoken answer will appear here...</p>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                            {!isRecordingAnswer ? (
                                <button style={{ ...styles.btn, background: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={startSpeechRecognition}>
                                    <span style={{ fontSize: '20px' }}>🎙️</span> Start Speaking
                                </button>
                            ) : (
                                <button style={{ ...styles.btn, background: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={stopSpeechRecognition}>
                                    <span style={{ fontSize: '20px' }}>⏹️</span> Stop Speaking
                                </button>
                            )}

                            <button 
                                style={{ ...styles.btn, background: t.accent, opacity: loading ? 0.5 : 1 }} 
                                disabled={loading}
                                onClick={submitAnswerAndContinue}
                            >
                                {loading ? 'Evaluating...' : 'Submit Answer →'}
                            </button>
                        </div>
                    </div>

                    {/* Proctoring Sidebar */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: t.surface, padding: '16px', borderRadius: '12px', border: `1px solid ${t.border}` }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: t.textSub, textTransform: 'uppercase' }}>Live Proctoring</h3>
                            <CameraMonitor ref={cameraRef} onMetrics={handleCameraMetrics} reference={idReference} />
                            <AudioMonitor onMetrics={handleAudioMetrics} />
                        </div>
                    </div>

                </div>
            )}

            {/* Step 10: End Report */}
            {step === 10 && (
                <div style={{ ...styles.card, maxWidth: '900px' }}>
                    <h2 style={styles.title}>Interview Completed 🎉</h2>
                    <p style={{ textAlign: 'center', marginBottom: '24px', fontSize: '16px' }}>Your responses have been successfully recorded and evaluated.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ background: t.surfaceAlt, padding: '24px', borderRadius: '12px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: `1px solid ${t.border}`, paddingBottom: '12px' }}>Evaluation Report</h3>
                            <div>
                                <strong>Final Score:</strong> 
                                <span style={{ fontSize: '24px', fontWeight: 'bold', color: finalReport?.report?.hiringRecommendation === 'Hire' ? '#10b981' : t.accent, marginLeft: '10px' }}>
                                    {finalReport?.finalScore || 'Pending'}
                                </span>
                            </div>
                            <div>
                                <strong>Strengths:</strong>
                                <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                                    {finalReport?.report?.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>Pending analysis...</li>}
                                </ul>
                            </div>
                            <div>
                                <strong>Weaknesses:</strong>
                                <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                                    {finalReport?.report?.weaknesses?.map((w, i) => <li key={i}>{w}</li>) || <li>Pending analysis...</li>}
                                </ul>
                            </div>
                        </div>

                        <div style={{ background: t.surfaceAlt, padding: '24px', borderRadius: '12px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', borderBottom: `1px solid ${t.border}`, paddingBottom: '12px' }}>
                                Behavior & Proctoring Log
                            </h3>
                            {finalReport?.cheatingClips && finalReport.cheatingClips.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '300px' }}>
                                    {finalReport.cheatingClips.map((clip, idx) => (
                                        <div key={idx} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: t.text, marginBottom: '4px' }}>🚨 {clip.reason}</div>
                                            <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '8px' }}>{new Date(clip.timestamp || Date.now()).toLocaleString()}</div>
                                            <a href={clip.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: t.accent, textDecoration: 'none', fontWeight: '500' }}>
                                                View Evidence →
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                                    <div style={{ fontWeight: 'bold' }}>No Anomalies Detected</div>
                                    <div style={{ fontSize: '13px', marginTop: '4px' }}>Your proctoring record is clean.</div>
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
