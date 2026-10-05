/**
 * CircuitExamPage.jsx
 * Full-page circuit design examination experience.
 * Layout: Question Panel | Circuit Board Canvas | Evaluation Panel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ComponentPalette from '../components/circuit/ComponentPalette';
import CircuitBoard from '../components/circuit/CircuitBoard';
import EvaluationPanel from '../components/circuit/EvaluationPanel';
import {
    getCircuitQuestion,
    saveCircuitDraft,
    submitCircuitForEval,
    getCircuitDraft
} from '../services/api';

export default function CircuitExamPage() {
    const { examId, questionId } = useParams();
    const navigate = useNavigate();

    const studentId = localStorage.getItem('studentId');
    const userRole = localStorage.getItem('role');
    const isAdmin = userRole === 'admin';

    const [question, setQuestion] = useState(null);
    const [submission, setSubmission] = useState(null);
    const [components, setComponents] = useState([]);
    const [connections, setConnections] = useState([]);
    const [evaluation, setEvaluation] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [highlightedComps, setHighlightedComps] = useState([]);
    const [hintOpen, setHintOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(document.fullscreenElement !== null);
    const [alertMsg, setAlertMsg] = useState('');

    // ── Fullscreen enforcement ──────────────────────────────────────────────
    const enterFullscreen = useCallback(() => {
        const docElm = document.documentElement;
        if (docElm.requestFullscreen) docElm.requestFullscreen();
        else if (docElm.mozRequestFullScreen) docElm.mozRequestFullScreen();
        else if (docElm.webkitRequestFullScreen) docElm.webkitRequestFullScreen();
        else if (docElm.msRequestFullscreen) docElm.msRequestFullscreen();
        setIsFullscreen(true);
        setAlertMsg('');
    }, []);

    useEffect(() => {
        const handleFsChange = () => {
            const inFs = !!document.fullscreenElement;
            setIsFullscreen(inFs);
            if (!inFs && !isAdmin) {
                setAlertMsg(' You exited fullscreen mode! Please return to fullscreen immediately.');
            }
        };

        document.addEventListener('fullscreenchange', handleFsChange);
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        document.addEventListener('mozfullscreenchange', handleFsChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.removeEventListener('webkitfullscreenchange', handleFsChange);
            document.removeEventListener('mozfullscreenchange', handleFsChange);
        };
    }, [isAdmin]);

    // Auto-enter fullscreen for student upon loading question
    useEffect(() => {
        if (!isAdmin && question && !isFullscreen) {
            enterFullscreen();
        }
    }, [isAdmin, question, isFullscreen, enterFullscreen]);

    // ── Load question + existing draft ───────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const qRes = await getCircuitQuestion(questionId);
                setQuestion(qRes.data);

                // Try to load existing draft
                try {
                    const dRes = await getCircuitDraft(studentId, questionId);
                    if (dRes.data) {
                        setSubmission(dRes.data);
                        setComponents(dRes.data.components || []);
                        setConnections(dRes.data.connections || []);
                        if (dRes.data.status === 'evaluated' && dRes.data.evaluation) {
                            setEvaluation(dRes.data.evaluation);
                        }
                    }
                } catch (_) { /* no draft yet */ }
            } catch (err) {
                setError('Failed to load question. ' + (err.response?.data?.message || err.message));
            } finally {
                setLoading(false);
            }
        })();
    }, [questionId, studentId]);

    // ── Save draft ───────────────────────────────────────────────────────────
    const handleSave = useCallback(async ({ components: comps, connections: conns }) => {
        try {
            setSaving(true);
            const res = await saveCircuitDraft({
                student_id: studentId,
                question_id: questionId,
                exam_id: examId,
                components: comps,
                connections: conns
            });
            setSubmission(res.data);
            setComponents(comps);
            setConnections(conns);
            setSaveMsg('Draft saved ');
            setTimeout(() => setSaveMsg(''), 2500);
        } catch (err) {
            setSaveMsg('Save failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    }, [studentId, questionId, examId]);

    // ── Submit for evaluation ─────────────────────────────────────────────────
    const handleSubmit = useCallback(async ({ components: comps, connections: conns }) => {
        if (!window.confirm('Submit this circuit for AI evaluation? You cannot edit it after submission.')) return;
        try {
            setSubmitting(true);
            // First save the current state
            let sub = submission;
            const saveRes = await saveCircuitDraft({
                student_id: studentId,
                question_id: questionId,
                exam_id: examId,
                components: comps,
                connections: conns
            });
            sub = saveRes.data;

            // Now submit for evaluation
            const evalRes = await submitCircuitForEval(sub._id);
            setSubmission(evalRes.data);
            setEvaluation(evalRes.data.evaluation);
            setComponents(comps);
            setConnections(conns);
        } catch (err) {
            alert('Submission failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSubmitting(false);
        }
    }, [studentId, questionId, examId, submission]);

    // ── Highlight flagged component ───────────────────────────────────────────
    const handleHighlightComp = useCallback((comp_id) => {
        setHighlightedComps([comp_id]);
        setTimeout(() => setHighlightedComps([]), 3000);
    }, []);

    // ── Difficulty badge ─────────────────────────────────────────────────────
    const diffColor = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };

    if (loading) return <FullPageCenter><Spinner /><p style={{ color: '#6b7280', marginTop: 16 }}>Loading question…</p></FullPageCenter>;
    if (error) return <FullPageCenter><p style={{ color: '#ef4444' }}>{error}</p></FullPageCenter>;
    if (!question) return null;

    const isSubmitted = submission?.status === 'submitted' || submission?.status === 'evaluated';
    const maxInstances = question.max_instances instanceof Object ? question.max_instances : {};
    const placedCounts = {};
    for (const c of components) placedCounts[c.type] = (placedCounts[c.type] || 0) + 1;

    return (
        <div style={styles.root}>
            {/* ── Fullscreen Overlay for Student Exam ────────────────── */}
            {!isAdmin && !isSubmitted && !isFullscreen && (
                <div style={styles.fullscreenOverlay}>
                    <div style={styles.fsCard}>
                        <div style={{ fontSize: 44, marginBottom: 16 }}></div>
                        <h2 style={styles.fsTitle}> Fullscreen Mode Required</h2>
                        <p style={styles.fsDesc}>
                            To ensure exam integrity, you must be in fullscreen mode to attempt the circuit simulation exam.
                        </p>
                        <button style={styles.fsBtn} onClick={enterFullscreen}>
                            Go Fullscreen
                        </button>
                    </div>
                </div>
            )}

            {/* ── Left: Question Info + Palette ───────────────────────── */}
            <div style={styles.leftPanel}>
                {/* Header */}
                <div style={styles.qHeader}>
                    <button style={styles.backBtn} onClick={() => navigate('/student')}>← Back</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isAdmin && !isSubmitted && (
                            <button
                                style={styles.fsHeaderBtn}
                                onClick={enterFullscreen}
                                title="Toggle Fullscreen Mode"
                            >
                                {isFullscreen ? ' Fullscreen' : ' Go Fullscreen'}
                            </button>
                        )}
                        <div style={{ ...styles.diffBadge, background: (diffColor[question.difficulty] || '#94a3b8') + '22', color: diffColor[question.difficulty] || '#94a3b8' }}>
                            {question.difficulty?.toUpperCase()}
                        </div>
                    </div>
                </div>

                {alertMsg && <div style={styles.alertBox}>{alertMsg}</div>}

                <div style={styles.qTitle}>{question.title}</div>
                <div style={styles.qTopic}> {question.topic}</div>

                <div style={styles.qDesc}>{question.description}</div>

                {/* Hint */}
                {question.hint_text && (
                    <div style={styles.hintBox}>
                        <button style={styles.hintToggle} onClick={() => setHintOpen(!hintOpen)}>
                             Hint {hintOpen ? '▲' : '▼'}
                        </button>
                        {hintOpen && <p style={styles.hintText}>{question.hint_text}</p>}
                    </div>
                )}

                {/* Expected behavior */}
                {question.expected_behavior && (
                    <div style={styles.expBox}>
                        <div style={styles.expTitle}> Objective</div>
                        <div style={styles.expText}>
                            {question.expected_behavior.formula && (
                                <div style={styles.formula}>{question.expected_behavior.formula}</div>
                            )}
                            {question.expected_behavior.expected_gain !== undefined && (
                                <p>Target gain: <strong style={{ color: '#6c63ff' }}>{question.expected_behavior.expected_gain}</strong></p>
                            )}
                            {question.expected_behavior.expected_voltage !== undefined && (
                                <p>Target output: <strong style={{ color: '#6c63ff' }}>{question.expected_behavior.expected_voltage} V</strong></p>
                            )}
                            {question.expected_behavior.expected_freq !== undefined && (
                                <p>Target frequency: <strong style={{ color: '#6c63ff' }}>{question.expected_behavior.expected_freq} Hz</strong></p>
                            )}
                            <p style={styles.tolerance}>Tolerance: ±{question.expected_behavior.tolerance_percent || 5}%</p>
                        </div>
                    </div>
                )}

                {/* Status */}
                {isSubmitted && (
                    <div style={styles.submittedBadge}>
                        {submission.status === 'evaluated'
                            ? (isAdmin ? ' Evaluated' : ' Submitted successfully')
                            : '⏳ Submitted'}
                    </div>
                )}

                {/* Save message */}
                {saveMsg && <div style={styles.saveMsg}>{saveMsg}</div>}

                {/* Divider */}
                <div style={styles.paletteDivider}>Components</div>

                {/* Palette */}
                <ComponentPalette
                    visiblePalette={question.visible_palette || []}
                    maxInstances={maxInstances}
                    placedCounts={placedCounts}
                />
            </div>

            {/* ── Center: Circuit Board ──────────────────────────────── */}
            <div style={styles.centerPanel}>
                <CircuitBoard
                    initialComponents={components}
                    initialConnections={connections}
                    visiblePalette={question.visible_palette || []}
                    onSave={handleSave}
                    onSubmit={handleSubmit}
                    readOnly={isSubmitted}
                    highlightedComps={highlightedComps}
                    submitting={submitting}
                />
            </div>

            {/* ── Right: Evaluation Panel (shown to admin only after submission) ──── */}
            {evaluation && isAdmin && (
                <EvaluationPanel
                    evaluation={evaluation}
                    question={question || {}}
                    submission={{ components, connections, submitted_at: submission?.submitted_at }}
                    onHighlightComp={handleHighlightComp}
                />
            )}
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FullPageCenter({ children }) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d0f1a' }}>
            {children}
        </div>
    );
}

function Spinner() {
    return (
        <div style={{
            width: 40, height: 40,
            border: '3px solid rgba(108,99,255,0.2)',
            borderTopColor: '#6c63ff',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite'
        }} />
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
    root: {
        display: 'flex',
        height: '100vh',
        background: '#0d0f1a',
        fontFamily: 'Outfit, sans-serif',
        color: '#f0f0ff',
        overflow: 'hidden',
    },
    leftPanel: {
        width: 280,
        background: 'rgba(22, 24, 39, 0.98)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
    },
    qHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 8px',
    },
    backBtn: {
        background: 'none',
        border: 'none',
        color: '#6b7280',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'Outfit, sans-serif',
        fontWeight: 600,
        padding: 0,
    },
    diffBadge: {
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.08em',
    },
    qTitle: {
        fontSize: 14,
        fontWeight: 800,
        color: '#f0f0ff',
        padding: '0 16px',
        lineHeight: 1.4,
    },
    qTopic: {
        fontSize: 11,
        color: '#6b7280',
        padding: '4px 16px 10px',
    },
    qDesc: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.7,
        padding: '0 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    hintBox: {
        margin: '12px 16px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 10,
        overflow: 'hidden',
    },
    hintToggle: {
        width: '100%',
        background: 'none',
        border: 'none',
        color: '#f59e0b',
        fontSize: 12,
        fontWeight: 700,
        padding: '10px 14px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'Outfit, sans-serif',
    },
    hintText: {
        color: '#fbbf24',
        fontSize: 12,
        lineHeight: 1.6,
        padding: '0 14px 12px',
    },
    expBox: {
        margin: '12px 16px',
        background: 'rgba(108,99,255,0.07)',
        border: '1px solid rgba(108,99,255,0.2)',
        borderRadius: 10,
        padding: '12px 14px',
    },
    expTitle: {
        fontSize: 11,
        fontWeight: 700,
        color: '#6c63ff',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
    },
    expText: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        fontSize: 12,
        color: '#94a3b8',
    },
    formula: {
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#c4b5fd',
        background: 'rgba(108,99,255,0.1)',
        padding: '4px 8px',
        borderRadius: 6,
    },
    tolerance: {
        color: '#6b7280',
        fontSize: 11,
    },
    submittedBadge: {
        margin: '10px 16px',
        padding: '8px 14px',
        background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 8,
        color: '#22c55e',
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'center',
    },
    saveMsg: {
        margin: '6px 16px',
        fontSize: 11,
        color: '#22c55e',
        textAlign: 'center',
    },
    paletteDivider: {
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#4b5563',
        padding: '14px 16px 6px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
    },
    centerPanel: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    fsHeaderBtn: {
        background: 'rgba(108,99,255,0.15)',
        border: '1px solid rgba(108,99,255,0.3)',
        color: '#a5b4fc',
        fontSize: 11,
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'Outfit, sans-serif',
        transition: 'all 0.2s',
    },
    alertBox: {
        margin: '10px 16px',
        padding: '10px 14px',
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8,
        color: '#ef4444',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        lineHeight: 1.4,
    },
    fullscreenOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(13, 15, 26, 0.92)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
    },
    fsCard: {
        background: 'rgba(22, 24, 39, 0.98)',
        padding: '36px 32px',
        borderRadius: '20px',
        textAlign: 'center',
        maxWidth: '420px',
        width: '90%',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(239, 68, 68, 0.15)',
        fontFamily: 'Outfit, sans-serif',
    },
    fsTitle: {
        fontSize: '20px',
        fontWeight: '800',
        color: '#ef4444',
        marginBottom: '12px',
    },
    fsDesc: {
        fontSize: '13px',
        color: '#94a3b8',
        lineHeight: '1.6',
        marginBottom: '24px',
    },
    fsBtn: {
        width: '100%',
        padding: '14px 24px',
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(135deg, #6c63ff 0%, #4834d4 100%)',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(108, 99, 255, 0.4)',
        transition: 'all 0.2s ease',
        fontFamily: 'Outfit, sans-serif',
    },
};
