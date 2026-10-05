import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getCadAssessmentById,
    getCadQuestions,
    getCadDraft,
    saveCadDraft,
    getStudentCadSubmissions,
    submitCadAssessment,
    logBehavior
} from '../services/api';
import CadCanvas, { DEFAULT_LAYERS } from '../components/cad/CadCanvas';
import CadToolbar from '../components/cad/CadToolbar';
import CadStatusBar from '../components/cad/CadStatusBar';
import CameraMonitor from '../components/CameraMonitor';
import AudioMonitor from '../components/AudioMonitor';
import BehaviorTracker from '../components/BehaviorTracker';
import { useTheme } from '../context/ThemeContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { createCadActivityEvent } from '../components/cad/utils/cadActivityLogger';

export default function CadExamPage() {
    const { assessmentId } = useParams();
    const navigate = useNavigate();
    const { theme: t } = useTheme();

    const studentId = localStorage.getItem('studentId') || localStorage.getItem('userId') || '';
    const studentName = localStorage.getItem('name') || 'Student';

    // Assessment & Questions state
    const [assessment, setAssessment] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [qIndex, setQIndex] = useState(0);
    const currentQ = questions[qIndex] || null;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Drawings & Layers state per question ID: { [qId]: { objects: [...], layers: [...], currentLayerId: '...' } }
    const [questionDrawings, setQuestionDrawings] = useState({});
    const [questionEvents, setQuestionEvents] = useState({}); // { [qId]: [...] }
    const [activeObjects, setActiveObjects] = useState([]);
    const [activeLayers, setActiveLayers] = useState(DEFAULT_LAYERS);
    const [activeCurrentLayerId, setActiveCurrentLayerId] = useState('layer_walls');
    const [showLayersPanel, setShowLayersPanel] = useState(false);
    const [selectedCount, setSelectedCount] = useState(0);
    const reassignRef = useRef(null);

    // Tools & Canvas State
    const [activeTool, setActiveTool] = useState('select');
    const [gridEnabled, setGridEnabled] = useState(true);
    const [gridSpacing, setGridSpacing] = useState(10);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [orthoEnabled, setOrthoEnabled] = useState(false);
    const [osnapEnabled, setOsnapEnabled] = useState(true);
    const [angleEnabled, setAngleEnabled] = useState(false);
    const [angleIncrement, setAngleIncrement] = useState(45);
    const [coords, setCoords] = useState({ x: 0, y: 0, activeSnap: null, isSnapped: false });
    const [viewportInfo, setViewportInfo] = useState({ zoom: 1 });
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

    const handleCoordsChange = useCallback((c) => setCoords(c), []);
    const handleViewportChange = useCallback((v) => setViewportInfo(v), []);
    const handleHistoryChange = useCallback((h) => setHistoryState(h), []);

    // Autosave & Submission State
    const [saveStatus, setSaveStatus] = useState('Saved '); // 'Saving...', 'Saved ', 'Save failed '
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [showSuccessScreen, setShowSuccessScreen] = useState(false);
    const [previewImageModal, setPreviewImageModal] = useState(null);

    // Timer State
    const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600);

    // Fullscreen enforcement
    const [isFullscreen, setIsFullscreen] = useState(document.fullscreenElement !== null);
    const [fsAlert, setFsAlert] = useState('');

    // Proctoring & Behavior State
    const trackerRef = useRef(null);
    const cameraRef = useRef(null);
    const cameraMetrics = useRef({ eyeDeviation: 0, headMovement: 0, faceNotDetected: false, multipleFacesDetected: false, phoneDetected: false, identityMismatch: false });
    const audioMetrics = useRef({ speechDetected: false, speechLevel: 0, multipleVoicesDetected: false });
    const [proctorWarning, setProctorWarning] = useState('');
    const [warningCount, setWarningCount] = useState(0);
    const [riskScore, setRiskScore] = useState(0);
    const lastLoggedTimeRef = useRef(0);

    const triggerImmediateAnomalyLog = useCallback(async (overrides = {}) => {
        if (!studentId || !assessmentId || submitted) return;
        const now = Date.now();
        if (now - lastLoggedTimeRef.current < 4000) return; // 4s throttle to prevent log spamming
        lastLoggedTimeRef.current = now;

        const isSevereAnomaly = overrides.phoneDetected || 
                                overrides.multipleFacesDetected || 
                                overrides.identityMismatch || 
                                overrides.faceNotDetected ||
                                cameraMetrics.current.phoneDetected ||
                                cameraMetrics.current.multipleFacesDetected ||
                                cameraMetrics.current.identityMismatch ||
                                cameraMetrics.current.faceNotDetected ||
                                riskScore >= 60;

        let photoSnapshot = undefined;
        if (isSevereAnomaly && cameraRef.current && cameraRef.current.takeSnapshot) {
            photoSnapshot = cameraRef.current.takeSnapshot(true);
        }

        const browserMetrics = trackerRef.current?.getMetrics() || {};

        const payload = {
            student_id: studentId,
            exam_id: assessmentId,
            question_id: currentQ?._id,
            eyeDeviation: overrides.eyeDeviation ?? cameraMetrics.current.eyeDeviation ?? 0,
            headMovement: overrides.headMovement ?? cameraMetrics.current.headMovement ?? 0,
            faceNotDetected: overrides.faceNotDetected ?? cameraMetrics.current.faceNotDetected ?? false,
            multipleFacesDetected: overrides.multipleFacesDetected ?? cameraMetrics.current.multipleFacesDetected ?? false,
            phoneDetected: overrides.phoneDetected ?? cameraMetrics.current.phoneDetected ?? false,
            identity_mismatch: overrides.identityMismatch ?? cameraMetrics.current.identityMismatch ?? false,
            speech_detected: audioMetrics.current.speechDetected || false,
            tabSwitches: overrides.tabSwitches ?? browserMetrics.tabSwitches ?? 0,
            fullscreenExits: overrides.fullscreenExits ?? browserMetrics.fullscreenExits ?? 0,
            snapshot: photoSnapshot
        };

        try {
            const res = await logBehavior(payload);
            if (res.data?.riskScore !== undefined) {
                setRiskScore(res.data.riskScore);
            }
            setWarningCount(w => w + 1);
        } catch (err) {
            console.warn('Immediate behavior log error:', err);
        }
    }, [studentId, assessmentId, currentQ, submitted, riskScore]);

    const handleCameraMetrics = useCallback((m) => {
        cameraMetrics.current = { ...cameraMetrics.current, ...m };

        let warningText = '';
        if (m.multipleFacesDetected) {
            warningText = ' Warning: Multiple faces detected in camera feed!';
        } else if (m.faceNotDetected) {
            warningText = ' Warning: No face detected in camera frame!';
        } else if (m.phoneDetected) {
            warningText = ' Warning: Mobile phone/unauthorized device detected!';
        } else if (m.identityMismatch) {
            warningText = ' Warning: Identity mismatch / face unrecognized!';
        } else if (m.headMovement > 15 || m.eyeDeviation > 20) {
            warningText = ' Warning: Excessive head movement / looking away!';
        }

        if (warningText) {
            setProctorWarning(warningText);
            triggerImmediateAnomalyLog(m);
        }
    }, [triggerImmediateAnomalyLog]);

    const handleAudioMetrics = useCallback((m) => {
        audioMetrics.current = { ...audioMetrics.current, ...m };
        if (m.speechDetected || m.multipleVoicesDetected) {
            setProctorWarning(' Warning: Background voice activity detected!');
            triggerImmediateAnomalyLog({ speech_detected: true });
        }
    }, [triggerImmediateAnomalyLog]);

    // Periodic Behavior Logging & ML Risk Assessment
    useEffect(() => {
        if (loading || submitted || !studentId || !assessmentId) return;
        const interval = setInterval(async () => {
            const browserMetrics = trackerRef.current?.getMetrics() || {};
            const isSevereAnomaly = cameraMetrics.current.phoneDetected || 
                                    cameraMetrics.current.multipleFacesDetected || 
                                    cameraMetrics.current.identityMismatch || 
                                    cameraMetrics.current.faceNotDetected ||
                                    audioMetrics.current.multipleVoicesDetected ||
                                    riskScore >= 60;

            let photoSnapshot = undefined;
            if (isSevereAnomaly && cameraRef.current && cameraRef.current.takeSnapshot) {
                photoSnapshot = cameraRef.current.takeSnapshot(false);
            }

            const payload = {
                student_id: studentId,
                exam_id: assessmentId,
                question_id: currentQ?._id,
                eyeDeviation: cameraMetrics.current.eyeDeviation || 0,
                headMovement: cameraMetrics.current.headMovement || 0,
                faceNotDetected: cameraMetrics.current.faceNotDetected || false,
                multipleFacesDetected: cameraMetrics.current.multipleFacesDetected || false,
                phoneDetected: cameraMetrics.current.phoneDetected || false,
                identity_mismatch: cameraMetrics.current.identityMismatch || false,
                speech_detected: audioMetrics.current.speechDetected || false,
                tabSwitches: browserMetrics.tabSwitches || 0,
                fullscreenExits: browserMetrics.fullscreenExits || 0,
                snapshot: photoSnapshot
            };

            try {
                const res = await logBehavior(payload);
                if (res.data?.riskScore !== undefined) {
                    setRiskScore(res.data.riskScore);
                }
                if (res.data?.messages?.length > 0 && res.data.messages[0] !== 'Behavior appears normal.') {
                    setProctorWarning(` ${res.data.messages[0]}`);
                    setWarningCount(w => w + 1);
                }
            } catch (err) {
                console.warn('Behavior log error:', err);
            }
        }, 8000);
        return () => clearInterval(interval);
    }, [loading, submitted, currentQ, studentId, assessmentId, riskScore]);

    // Initialize BehaviorTracker class
    useEffect(() => {
        if (!studentId || !assessmentId) return;
        const tracker = new BehaviorTracker((violation) => {
            setProctorWarning(` Alert: ${violation.message || violation.type || 'Behavior Event'}`);
            triggerImmediateAnomalyLog({
                tabSwitches: trackerRef.current?.getMetrics()?.tabSwitches || 0,
                fullscreenExits: trackerRef.current?.getMetrics()?.fullscreenExits || 0
            });
        });
        trackerRef.current = tracker;
        tracker.start();

        return () => {
            if (trackerRef.current) {
                trackerRef.current.stop();
            }
        };
    }, [studentId, assessmentId, triggerImmediateAnomalyLog]);

    // ── Fullscreen Enforcer ──────────────────────────────────────────────
    const enterFullscreen = useCallback(() => {
        const docElm = document.documentElement;
        if (docElm.requestFullscreen) docElm.requestFullscreen();
        else if (docElm.webkitRequestFullscreen) docElm.webkitRequestFullscreen();
        setIsFullscreen(true);
        setFsAlert('');
    }, []);

    useEffect(() => {
        const handleFsChange = () => {
            const inFs = !!document.fullscreenElement;
            setIsFullscreen(inFs);
            if (!inFs) {
                setFsAlert(' Warning: You exited fullscreen mode! Return immediately for assessment integrity.');
            }
        };

        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    // ── Load Assessment & Existing Drafts ────────────────────────────────
    useEffect(() => {
        if (!studentId || !assessmentId) {
            setError('Missing student or assessment information');
            setLoading(false);
            return;
        }

        (async () => {
            setLoading(true);
            try {
                const [asmRes, qRes, draftRes] = await Promise.all([
                    getCadAssessmentById(assessmentId),
                    getCadQuestions(assessmentId),
                    getStudentCadSubmissions(studentId, assessmentId)
                ]);

                const asmData = asmRes.data;
                const qList = qRes.data || [];
                const subsList = draftRes.data || [];
                setAssessment(asmData);
                setQuestions(qList);
                setTimeLeftSeconds((asmData.duration || 60) * 60);

                const isAlreadySubmitted = asmData.isSubmitted ||
                    subsList.some(s => s.status === 'submitted') ||
                    localStorage.getItem(`exam_submitted_${studentId}_${assessmentId}`) === 'true';

                if (isAlreadySubmitted) {
                    setSubmitted(true);
                    setShowSuccessScreen(true);
                }

                // Load existing drawings map & activity events
                const initialDrawings = {};
                const initialEvents = {};
                subsList.forEach(sub => {
                    const qId = sub.question_id?._id || sub.question_id;
                    if (qId && sub.drawing_data) {
                        const d = sub.drawing_data;
                        if (Array.isArray(d)) {
                            initialDrawings[qId] = { objects: d, layers: DEFAULT_LAYERS, currentLayerId: 'layer_walls' };
                        } else {
                            initialDrawings[qId] = {
                                objects: d.objects || [],
                                layers: d.layers && d.layers.length > 0 ? d.layers : DEFAULT_LAYERS,
                                currentLayerId: d.currentLayerId || 'layer_walls'
                            };
                        }
                    }
                    if (qId && Array.isArray(sub.activity_events)) {
                        initialEvents[qId] = sub.activity_events;
                    }
                });
                setQuestionDrawings(initialDrawings);
                setQuestionEvents(initialEvents);

                // Set initial active objects for question 0
                if (qList.length > 0) {
                    const firstQId = qList[0]._id;
                    const firstData = initialDrawings[firstQId] || { objects: [], layers: DEFAULT_LAYERS, currentLayerId: 'layer_walls' };
                    setActiveObjects(firstData.objects);
                    setActiveLayers(firstData.layers);
                    setActiveCurrentLayerId(firstData.currentLayerId);
                }
            } catch (err) {
                setError('Failed to load AutoCAD assessment: ' + (err.response?.data?.message || err.message));
            } finally {
                setLoading(false);
            }
        })();
    }, [assessmentId, studentId]);

    // ── Activity Event Logger Callback ──────────────────────────────────
    const handleLogActivityEvent = useCallback((eventData) => {
        if (!currentQ || !studentId || !assessmentId) return;

        const qId = currentQ._id;
        setQuestionEvents(prev => {
            const existing = prev[qId] || [];
            const newEvent = createCadActivityEvent(
                eventData.actionType,
                eventData.geometryIds,
                eventData.parameters,
                eventData.customSummary,
                {
                    studentId,
                    assessmentId,
                    questionId: qId,
                    sequenceNumber: existing.length + 1
                }
            );
            const updated = [...existing, newEvent];

            // Background sync with backend draft persistence
            saveCadDraft({
                student_id: studentId,
                assessment_id: assessmentId,
                question_id: qId,
                drawing_data: { objects: activeObjects, layers: activeLayers, currentLayerId: activeCurrentLayerId, viewport: {} },
                activity_events: updated
            }).catch(err => console.warn('Activity event persistence sync warning:', err));

            return { ...prev, [qId]: updated };
        });
    }, [currentQ, studentId, assessmentId, activeObjects, activeLayers, activeCurrentLayerId]);

    // ── Timer Countdown ─────────────────────────────────────────────────
    useEffect(() => {
        if (loading || submitted || timeLeftSeconds <= 0) return;
        const timerId = setInterval(() => {
            setTimeLeftSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timerId);
                    handleFinalSubmit(true); // Force submit on timer expiry
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerId);
    }, [loading, submitted, timeLeftSeconds]);

    const formatTimer = (totalSec) => {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // ── Autosave Function ────────────────────────────────────────────────
    const saveCurrentDraft = useCallback(async (qIdToSave, drawingDataToSave) => {
        if (!studentId || !assessmentId || !qIdToSave) return;
        setSaveStatus('Saving...');
        try {
            const objs = drawingDataToSave?.objects !== undefined ? drawingDataToSave.objects : (Array.isArray(drawingDataToSave) ? drawingDataToSave : activeObjects);
            const lyrs = drawingDataToSave?.layers || activeLayers;
            const curL = drawingDataToSave?.currentLayerId || activeCurrentLayerId;
            const eventsToSave = questionEvents[qIdToSave] || [];

            await saveCadDraft({
                student_id: studentId,
                assessment_id: assessmentId,
                question_id: qIdToSave,
                drawing_data: { objects: objs, layers: lyrs, currentLayerId: curL, viewport: {} },
                activity_events: eventsToSave
            });
            setSaveStatus('Saved ');
        } catch (err) {
            console.error('Autosave error:', err);
            setSaveStatus('Save failed ');
        }
    }, [studentId, assessmentId, activeObjects, activeLayers, activeCurrentLayerId, questionEvents]);

    // Periodic Autosave every 15 seconds
    useEffect(() => {
        if (loading || submitted || !currentQ) return;
        const autoSaveInterval = setInterval(() => {
            saveCurrentDraft(currentQ._id, { objects: activeObjects, layers: activeLayers, currentLayerId: activeCurrentLayerId });
        }, 15000);
        return () => clearInterval(autoSaveInterval);
    }, [loading, submitted, currentQ, activeObjects, activeLayers, activeCurrentLayerId, saveCurrentDraft]);

    // ── Change Active Question & Retain Drawings ──────────────────────
    const handleQuestionChange = (newIdx) => {
        if (newIdx < 0 || newIdx >= questions.length || newIdx === qIndex) return;

        // 1. Save current question drawing state
        if (currentQ) {
            const currentData = { objects: activeObjects, layers: activeLayers, currentLayerId: activeCurrentLayerId };
            setQuestionDrawings(prev => ({
                ...prev,
                [currentQ._id]: currentData
            }));
            saveCurrentDraft(currentQ._id, currentData);
        }

        // 2. Load target question drawing state
        const nextQ = questions[newIdx];
        setQIndex(newIdx);
        const nextData = questionDrawings[nextQ._id] || { objects: [], layers: DEFAULT_LAYERS, currentLayerId: 'layer_walls' };
        const objs = Array.isArray(nextData) ? nextData : (nextData.objects || []);
        const lyrs = Array.isArray(nextData) ? DEFAULT_LAYERS : (nextData.layers || DEFAULT_LAYERS);
        const curL = Array.isArray(nextData) ? 'layer_walls' : (nextData.currentLayerId || 'layer_walls');

        setActiveObjects(objs);
        setActiveLayers(lyrs);
        setActiveCurrentLayerId(curL);
        setActiveTool('select');
    };

    // ── Final Assessment Submission ─────────────────────────────────────
    const handleFinalSubmit = async (force = false) => {
        if (submitted || isSubmitting) return;

        if (!force && !showConfirmSubmit) {
            setShowConfirmSubmit(true);
            return;
        }

        setIsSubmitting(true);
        setSaveStatus('Saving...');

        try {
            // Save current active question draft first
            if (currentQ) {
                await saveCurrentDraft(currentQ._id, activeObjects);
            }

            // Submit whole assessment
            await submitCadAssessment({
                student_id: studentId,
                assessment_id: assessmentId
            });

            try {
                if (studentId && assessmentId) {
                    localStorage.setItem(`exam_submitted_${studentId}_${assessmentId}`, 'true');
                }
            } catch (e) {
                console.warn('Failed to write submission flag to localStorage:', e);
            }

            setSubmitted(true);
            setShowConfirmSubmit(false);
            setShowSuccessScreen(true);
        } catch (err) {
            alert('Failed to submit CAD Assessment: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReturnToDashboard = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        window.location.href = '/student';
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#121216', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 24, height: 24, border: '3px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    <span style={{ fontSize: 16, fontWeight: 600 }}>Loading AutoCAD Assessment Workspace…</span>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error || !assessment) {
        return (
            <div style={{ minHeight: '100vh', background: '#121216', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Outfit, sans-serif' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Unable to Load CAD Assessment</h2>
                <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>{error || 'Assessment not found.'}</p>
                <button onClick={handleReturnToDashboard} style={{ padding: '10px 24px', background: '#38bdf8', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: '#121216', color: '#e2e8f0', fontFamily: 'Outfit, sans-serif', userSelect: 'none' }}>
            {/* Alert Banner for Proctoring / Fullscreen Warning */}
            {proctorWarning && (
                <div style={{ background: 'linear-gradient(90deg, #ef4444, #dc2626)', color: '#fff', padding: '8px 16px', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10000, boxShadow: '0 4px 15px rgba(239,68,68,0.4)' }}>
                    <span>{proctorWarning}</span>
                    <button onClick={() => setProctorWarning('')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>
                        Dismiss 
                    </button>
                </div>
            )}
            {fsAlert && !proctorWarning && (
                <div style={{ background: '#ef4444', color: '#fff', padding: '8px 16px', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10000 }}>
                    <span>{fsAlert}</span>
                    <button onClick={enterFullscreen} style={{ background: '#fff', color: '#ef4444', border: 'none', padding: '4px 12px', borderRadius: 6, fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>
                        Re-enter Fullscreen
                    </button>
                </div>
            )}

            {/* ── TOP BAR ────────────────────────────────────────────────────── */}
            <div style={{ height: 54, background: '#18181c', borderBottom: '1px solid #2e2e38', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, zIndex: 30 }}>
                {/* Left: Title & Level */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}></span>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>{assessment.title}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Civil Engineering 2D CAD Assessment</div>
                    </div>
                    <span style={{ padding: '3px 10px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {assessment.cad_level}
                    </span>
                </div>

                {/* Center: Timer & Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#22222a', border: '1px solid #333340', padding: '6px 14px', borderRadius: 8 }}>
                        <span style={{ fontSize: 14 }}>⏱</span>
                        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: timeLeftSeconds < 300 ? '#ef4444' : '#38bdf8' }}>
                            {formatTimer(timeLeftSeconds)}
                        </span>
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 600, color: saveStatus.includes('Saved') ? '#10b981' : saveStatus.includes('Saving') ? '#f59e0b' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: saveStatus.includes('Saved') ? '#10b981' : '#f59e0b' }} />
                        {saveStatus}
                    </div>

                    {riskScore > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: riskScore > 50 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: riskScore > 50 ? '#ef4444' : '#10b981', border: `1px solid ${riskScore > 50 ? '#ef444444' : '#10b98144'}` }}>
                            Risk: {riskScore}%
                        </div>
                    )}
                </div>

                {/* Right: Exit / Submit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={() => handleFinalSubmit(false)}
                        style={{
                            padding: '8px 20px',
                            background: 'linear-gradient(135deg, #059669, #10b981)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        Submit Assessment 
                    </button>
                </div>
            </div>

            {/* ── MAIN WORKSPACE AREA ───────────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>

                {/* LEFT QUESTION PANEL */}
                <div style={{ width: 340, flexShrink: 0, background: '#18181c', borderRight: '1px solid #2e2e38', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    {/* Header */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #2e2e38', background: '#1f1f26' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Question {qIndex + 1} of {questions.length}
                            </span>
                            <span style={{ padding: '2px 8px', background: '#333340', color: '#cbd5e1', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                Marks: {currentQ?.marks || 10}
                            </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            Difficulty: <span style={{ textTransform: 'capitalize', color: '#e2e8f0', fontWeight: 600 }}>{currentQ?.difficulty || 'Medium'}</span>
                        </div>
                    </div>

                    {/* Question Content */}
                    <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
                        {currentQ ? (
                            <>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.6, marginBottom: 16 }}>
                                    {currentQ.question_text}
                                </div>

                                {currentQ.instructions && (
                                    <div style={{ background: '#22222a', border: '1px solid #333340', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>
                                        <strong style={{ color: '#38bdf8' }}>Instructions:</strong>
                                        <p style={{ marginTop: 4, whiteSpace: 'pre-line' }}>{currentQ.instructions}</p>
                                    </div>
                                )}

                                {currentQ.image_url && (
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>Reference Drawing:</div>
                                        <div
                                            onClick={() => setPreviewImageModal(currentQ.image_url)}
                                            style={{
                                                border: '1px solid #333340',
                                                borderRadius: 8,
                                                overflow: 'hidden',
                                                background: '#0f0f13',
                                                cursor: 'pointer',
                                                position: 'relative'
                                            }}
                                        >
                                            <img
                                                src={currentQ.image_url}
                                                alt="Reference CAD Drawing"
                                                style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }}
                                            />
                                            <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
                                                 Click to Enlarge
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ color: '#94a3b8', fontSize: 13 }}>No question details available.</div>
                        )}
                    </div>

                    {/* AI Proctoring Widget Docked in Left Sidebar */}
                    <div style={{ padding: 12, borderTop: '1px solid #2e2e38', background: '#131317' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#777788', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                 AI Proctoring & Voice Monitor
                            </div>
                            {warningCount > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 4 }}>
                                     {warningCount} Alerts
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div style={{ width: 140, borderRadius: 8, overflow: 'hidden', border: '1px solid #2e2e38', flexShrink: 0 }}>
                                <CameraMonitor ref={cameraRef} onMetrics={handleCameraMetrics} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <AudioMonitor darkTheme compact onMetrics={handleAudioMetrics} />
                            </div>
                        </div>
                    </div>

                    {/* Question Quick Jump Grid */}
                    <div style={{ padding: 16, borderTop: '1px solid #2e2e38', background: '#18181c' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#777788', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 }}>
                            Questions Overview
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                            {questions.map((q, idx) => {
                                const hasDraft = (questionDrawings[q._id] || []).length > 0;
                                const isActive = idx === qIndex;
                                return (
                                    <button
                                        key={q._id}
                                        onClick={() => handleQuestionChange(idx)}
                                        style={{
                                            height: 34,
                                            borderRadius: 6,
                                            border: '1px solid',
                                            borderColor: isActive ? '#38bdf8' : hasDraft ? '#10b981' : '#333340',
                                            background: isActive ? 'rgba(56, 189, 248, 0.2)' : hasDraft ? 'rgba(16, 185, 129, 0.15)' : '#22222a',
                                            color: isActive ? '#38bdf8' : hasDraft ? '#10b981' : '#94a3b8',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Q{idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>


                {/* RIGHT CAD WORKSPACE PANEL */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    {/* CAD Toolbar */}
                    <CadToolbar
                        activeTool={activeTool}
                        onSelectTool={setActiveTool}
                        onUndo={() => setActiveTool('undo')}
                        onRedo={() => setActiveTool('redo')}
                        canUndo={historyState.canUndo}
                        canRedo={historyState.canRedo}
                        cadLevel={assessment.cad_level}
                        layers={activeLayers}
                        currentLayerId={activeCurrentLayerId}
                        onSelectCurrentLayer={(lId) => setActiveCurrentLayerId(lId)}
                        showLayersPanel={showLayersPanel}
                        onToggleLayersPanel={() => setShowLayersPanel(p => !p)}
                        selectedCount={selectedCount}
                        onReassignSelectedLayer={(lId) => reassignRef.current && reassignRef.current(lId)}
                    />

                    {/* 2D Interactive CAD Canvas */}
                    <CadCanvas
                        objects={activeObjects}
                        onChangeObjects={(newObjs) => {
                            setActiveObjects(newObjs);
                            if (currentQ) {
                                setQuestionDrawings(prev => ({ ...prev, [currentQ._id]: { objects: newObjs, layers: activeLayers, currentLayerId: activeCurrentLayerId } }));
                            }
                        }}
                        initialLayers={activeLayers}
                        initialCurrentLayerId={activeCurrentLayerId}
                        showLayersPanelProp={showLayersPanel}
                        onDrawingStateChange={({ objects, layers, currentLayerId, selectedCount: selCnt, reassignLayer }) => {
                            if (objects !== undefined) setActiveObjects(objects);
                            if (layers !== undefined) setActiveLayers(layers);
                            if (currentLayerId !== undefined) setActiveCurrentLayerId(currentLayerId);
                            if (selCnt !== undefined) setSelectedCount(selCnt);
                            if (reassignLayer) reassignRef.current = reassignLayer;

                            if (currentQ) {
                                setQuestionDrawings(prev => ({
                                    ...prev,
                                    [currentQ._id]: { objects: objects || activeObjects, layers: layers || activeLayers, currentLayerId: currentLayerId || activeCurrentLayerId }
                                }));
                            }
                        }}
                        activeTool={activeTool}
                        onSelectTool={setActiveTool}
                        gridEnabled={gridEnabled}
                        gridSpacing={gridSpacing}
                        snapEnabled={snapEnabled}
                        orthoEnabled={orthoEnabled}
                        osnapEnabled={osnapEnabled}
                        angleEnabled={angleEnabled}
                        angleIncrement={angleIncrement}
                        onCoordsChange={handleCoordsChange}
                        onViewportChange={handleViewportChange}
                        onHistoryChange={handleHistoryChange}
                        onLogActivityEvent={handleLogActivityEvent}
                    />

                    {/* CAD Status Bar */}
                    <CadStatusBar
                        coords={{ x: coords.x, y: coords.y }}
                        activeSnap={coords.activeSnap}
                        isSnapped={coords.isSnapped}
                        activeTool={activeTool}
                        gridEnabled={gridEnabled}
                        gridSpacing={gridSpacing}
                        snapEnabled={snapEnabled}
                        orthoEnabled={orthoEnabled}
                        osnapEnabled={osnapEnabled}
                        angleEnabled={angleEnabled}
                        angleIncrement={angleIncrement}
                        zoom={viewportInfo.viewport?.zoom || 1}
                        onToggleGrid={() => setGridEnabled(g => !g)}
                        onChangeGridSpacing={(sp) => setGridSpacing(sp)}
                        onToggleSnap={() => setSnapEnabled(s => !s)}
                        onToggleOrtho={() => setOrthoEnabled(o => !o)}
                        onToggleOsnap={() => setOsnapEnabled(o => !o)}
                        onToggleAngle={() => setAngleEnabled(a => !a)}
                        onChangeAngleIncrement={(inc) => setAngleIncrement(inc)}
                        onResetView={() => viewportInfo.fitExtents && viewportInfo.fitExtents()}
                    />
                </div>
            </div>

            {/* ── BOTTOM NAVIGATION BAR ─────────────────────────────────────── */}
            <div style={{ height: 50, background: '#18181c', borderTop: '1px solid #2e2e38', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
                <button
                    onClick={() => handleQuestionChange(qIndex - 1)}
                    disabled={qIndex === 0}
                    style={{
                        padding: '7px 16px',
                        borderRadius: 6,
                        border: '1px solid #333340',
                        background: '#22222a',
                        color: qIndex === 0 ? '#555566' : '#e2e8f0',
                        cursor: qIndex === 0 ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                    }}
                >
                    ← Previous Question
                </button>

                <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                    Drawing Question <span style={{ color: '#f8fafc', fontWeight: 800 }}>{qIndex + 1}</span> of <span style={{ color: '#f8fafc', fontWeight: 800 }}>{questions.length}</span>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    {qIndex < questions.length - 1 ? (
                        <button
                            onClick={() => handleQuestionChange(qIndex + 1)}
                            style={{
                                padding: '7px 20px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#38bdf8',
                                color: '#000',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 700
                            }}
                        >
                            Next Question →
                        </button>
                    ) : (
                        <button
                            onClick={() => handleFinalSubmit(false)}
                            style={{
                                padding: '7px 20px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#10b981',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 700
                            }}
                        >
                            Submit Assessment 
                        </button>
                    )}
                </div>
            </div>

            {/* ── REFERENCE IMAGE EXPANDED MODAL ────────────────────────────── */}
            {previewImageModal && (
                <div onClick={() => setPreviewImageModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#18181c', border: '1px solid #333340', borderRadius: 12, overflow: 'hidden', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '12px 20px', background: '#22222a', borderBottom: '1px solid #333340', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Reference CAD Specification Drawing</span>
                            <button onClick={() => setPreviewImageModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}></button>
                        </div>
                        <div style={{ padding: 20, overflow: 'auto' }}>
                            <img src={previewImageModal} alt="Expanded Reference" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── CONFIRM SUBMIT MODAL ─────────────────────────────────────── */}
            {showConfirmSubmit && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: '#18181c', border: '1px solid #333340', borderRadius: 14, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', margin: '0 0 10px' }}>Confirm Submission</h3>
                        <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 20px' }}>
                            Are you sure you want to submit your CAD Assessment? All saved 2D drawing geometry across all questions will be recorded as your final submission.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={() => setShowConfirmSubmit(false)} disabled={isSubmitting} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #333340', background: '#22222a', color: '#cbd5e1', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={() => handleFinalSubmit(true)} disabled={isSubmitting} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                {isSubmitting ? 'Submitting…' : 'Yes, Submit Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SUCCESS SCREEN ────────────────────────────────────────────── */}
            {showSuccessScreen && (
                <div style={{ position: 'fixed', inset: 0, background: '#121216', zIndex: 30000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: '#10b981', marginBottom: 20 }}>
                        
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>AutoCAD Assessment Submitted!</h2>
                    <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 460, lineHeight: 1.6, marginBottom: 28 }}>
                        Your 2D CAD drawings and geometric vector data have been saved successfully. Your responses are ready for evaluation.
                    </p>
                    <button
                        onClick={handleReturnToDashboard}
                        style={{ padding: '12px 32px', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', color: '#000', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(56, 189, 248, 0.3)' }}
                    >
                        Return to Student Dashboard
                    </button>
                </div>
            )}
        </div>
    );
}
