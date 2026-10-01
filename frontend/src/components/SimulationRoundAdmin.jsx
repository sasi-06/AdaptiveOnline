/**
 * SimulationRoundAdmin.jsx
 * Standalone Admin Hub for Circuit Exam Management & Assignment.
 * 
 * Features:
 *   1. Assign Circuit Exam: Select circuit questions + target students (with dept filter).
 *   2. Circuit Question Bank: Create, edit, and configure circuit questions.
 *   3. Submissions & ML Results: View all student submissions, ML neural net scores, verdicts & feedback.
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import EvaluationPanel from './circuit/EvaluationPanel';
import CircuitBoard    from './circuit/CircuitBoard';
import { COMP_DEFS }   from './circuit/constants';
import {
    getCircuitQuestions,
    createCircuitQuestion,
    updateCircuitQuestion,
    deleteCircuitQuestion,
    getAllCircuitSubmissions,
    getCircuitSubmissionsByExam,
    assignCircuitExam,
} from '../services/api';
import { exportCircuitReportPDF, exportSchematicPNG } from '../utils/exportCircuitReport';

const PALETTE_OPTIONS = [
    'resistor','capacitor','inductor','diode','bjt_npn',
    'op_amp','voltage_source','ground','voltmeter','ammeter','logic_gate_and'
];

const BEHAVIOR_TYPES = ['gain_check','voltage_divider','rlc_analysis','led_circuit'];

const DIFFICULTY_COLORS = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
const VERDICT_COLORS    = { correct: '#22c55e', partially_correct: '#f59e0b', incorrect: '#ef4444' };

export default function SimulationRoundAdmin({ examId, students = [], flash }) {
    const { theme: t } = useTheme();
    const [tab,          setTab]          = useState('assign');  // 'assign' | 'questions' | 'submissions'
    const [selectedSub,  setSelectedSub]  = useState(null);
    const [modalTab,     setModalTab]     = useState('eval');     // 'eval' | 'netlist' | 'spec'
    const [questions,    setQuestions]    = useState([]);
    const [submissions,  setSubmissions]  = useState([]);
    const [loading,      setLoading]      = useState(false);
    const [showForm,     setShowForm]     = useState(false);
    const [editQ,        setEditQ]        = useState(null);
    const [msg,          setMsg]          = useState('');

    // ── Circuit Assignment States ──
    const [selectedQuestionId, setSelectedQuestionId] = useState('');
    const [deptFilter,         setDeptFilter]         = useState('ALL');
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [assigning,          setAssigning]          = useState(false);
    const [retrainStatus,      setRetrainStatus]      = useState(null); // null | 'training' | 'done' | 'error'
    const [modelStats,         setModelStats]         = useState(null);

    // Load model stats on mount
    useEffect(() => {
        fetch((import.meta.env.VITE_ML_URL || 'http://127.0.0.1:8001') + '/circuit-model-stats')
            .then(r => r.json())
            .then(d => setModelStats(d))
            .catch(() => {});
    }, []);

    // Question Form state
    const emptyForm = {
        title: '', description: '', topic: 'Op-Amp Circuits',
        difficulty: 'medium', hint_text: '',
        visible_palette: ['resistor','op_amp','voltage_source','ground'],
        max_instances: {},
        expected_behavior: { type: 'gain_check', expected_gain: -10, tolerance_percent: 5 }
    };
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        loadQuestions();
        loadAllSubmissions();
    }, []);

    useEffect(() => {
        if (questions.length > 0 && !selectedQuestionId) {
            setSelectedQuestionId(questions[0]._id);
        }
    }, [questions]);

    const loadQuestions = async () => {
        try {
            setLoading(true);
            const res = await getCircuitQuestions();
            setQuestions(res.data || []);
        } catch (err) {
            showMsg('Failed to load circuit questions: ' + (err.response?.data?.message || err.message), true);
        } finally { setLoading(false); }
    };

    const loadAllSubmissions = async () => {
        try {
            setLoading(true);
            const res = examId ? await getCircuitSubmissionsByExam(examId) : await getAllCircuitSubmissions();
            setSubmissions(res.data || []);
        } catch (_) {} finally { setLoading(false); }
    };

    const showMsg = (text, isErr = false) => {
        if (flash) flash(text, isErr);
        else setMsg(text);
    };

    // ── Handle Assign Circuit Exam to Students ──
    const handleAssignCircuitExam = async (e) => {
        e.preventDefault();
        if (!selectedQuestionId) {
            showMsg('Please select a circuit question to assign.', true);
            return;
        }
        if (selectedStudentIds.length === 0) {
            showMsg('Please select at least one student to assign.', true);
            return;
        }

        setAssigning(true);
        try {
            const selectedQ = questions.find(q => q._id === selectedQuestionId);
            const res = await assignCircuitExam({
                questionId: selectedQuestionId,
                studentIds: selectedStudentIds,
            });

            showMsg(res.data?.message || `Successfully assigned "${selectedQ?.title}" to ${selectedStudentIds.length} student(s)!`);
            setSelectedStudentIds([]);
        } catch (err) {
            showMsg('Error assigning circuit exam: ' + (err.response?.data?.message || err.message), true);
        } finally {
            setAssigning(false);
        }
    };

    const filteredStudents = students.filter(s =>
        deptFilter === 'ALL' || (s.department || '').toUpperCase().includes(deptFilter.toUpperCase())
    );

    const toggleStudentSelection = (sid) => {
        setSelectedStudentIds(prev =>
            prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]
        );
    };

    const toggleSelectAll = () => {
        const visibleIds = filteredStudents.map(s => s._id);
        const allSelected = visibleIds.every(id => selectedStudentIds.includes(id));
        if (allSelected) {
            setSelectedStudentIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedStudentIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    // ── Question CRUD ──
    const openCreate = () => { setEditQ(null); setForm(emptyForm); setShowForm(true); };
    const openEdit   = (q) => {
        setEditQ(q);
        setForm({
            title: q.title, description: q.description, topic: q.topic,
            difficulty: q.difficulty, hint_text: q.hint_text || '',
            visible_palette: q.visible_palette || [],
            max_instances: q.max_instances || {},
            expected_behavior: q.expected_behavior || emptyForm.expected_behavior
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            if (editQ) {
                await updateCircuitQuestion(editQ._id, form);
                showMsg('Circuit Question updated ✓');
            } else {
                await createCircuitQuestion(form);
                showMsg('Circuit Question created ✓');
            }
            setShowForm(false);
            loadQuestions();
        } catch (err) {
            showMsg('Error saving question: ' + (err.response?.data?.message || err.message), true);
        } finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this circuit question?')) return;
        try {
            await deleteCircuitQuestion(id);
            showMsg('Circuit Question deleted ✓');
            loadQuestions();
        } catch (err) {
            showMsg('Delete failed: ' + err.message, true);
        }
    };

    const togglePalette = (type) => {
        setForm(f => ({
            ...f,
            visible_palette: f.visible_palette.includes(type)
                ? f.visible_palette.filter(x => x !== type)
                : [...f.visible_palette, type]
        }));
    };

    const s = styles(t);

    return (
        <div>
            {/* Header with Navigation Tabs */}
            <div className="ad-page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <span>⚡ Circuit Design Exam Manager</span>
                <div style={{ display: 'flex', gap: 10 }}>
                    <TabBtn active={tab === 'assign'} onClick={() => setTab('assign')}>
                        📋 Assign Circuit Exam
                    </TabBtn>
                    <TabBtn active={tab === 'questions'} onClick={() => setTab('questions')}>
                        ⚡ Question Bank ({questions.length})
                    </TabBtn>
                    <TabBtn active={tab === 'submissions'} onClick={() => { setTab('submissions'); loadAllSubmissions(); }}>
                        📊 Submissions & Results ({submissions.length})
                    </TabBtn>
                </div>
            </div>

            {msg && <div style={s.msg} onClick={() => setMsg('')}>{msg} ✕</div>}

            {/* ── TAB 1: ASSIGN CIRCUIT EXAM TO STUDENTS ──────────────── */}
            {tab === 'assign' && (
                <div className="ad-card" style={{ padding: '24px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                        🎯 Assign Circuit Exam to Students
                    </div>
                    <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>
                        Select a circuit design problem from the Question Bank, filter students by department, and assign the test.
                    </div>

                    <form onSubmit={handleAssignCircuitExam} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Step 1: Select Question */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#6c63ff', letterSpacing: '0.05em' }}>
                                Step 1 — Select Circuit Question
                            </label>
                            <select
                                className="ad-select"
                                value={selectedQuestionId}
                                onChange={e => setSelectedQuestionId(e.target.value)}
                                required
                                style={{ width: '100%', padding: '10px 14px', fontSize: 14, background: t.inputBg, border: `1.5px solid ${t.border}`, color: t.text }}
                            >
                                <option value="">-- Select Circuit Question --</option>
                                {questions.map(q => (
                                    <option key={q._id} value={q._id}>
                                        {q.title} ({q.difficulty?.toUpperCase()}) — [{q.expected_behavior?.type?.replace(/_/g,' ')}]
                                    </option>
                                ))}
                            </select>
                            {questions.length === 0 && (
                                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                                    ⚠️ No circuit questions found. Please create one in the Question Bank tab first.
                                </div>
                            )}
                        </div>

                        {/* Step 2: Filter Students by Department */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#6c63ff', letterSpacing: '0.05em' }}>
                                Step 2 — Select Students to Assign ({selectedStudentIds.length} Selected)
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Filter Dept:</span>
                                <select
                                    className="ad-select"
                                    value={deptFilter}
                                    onChange={e => setDeptFilter(e.target.value)}
                                    style={{ width: 140, padding: '5px 10px', fontSize: 13, background: t.inputBg, border: `1px solid ${t.border}` }}
                                >
                                    <option value="ALL">All Depts</option>
                                    <option value="ECE">ECE</option>
                                    <option value="EEE">EEE</option>
                                    <option value="CSE">CSE</option>
                                    <option value="IT">IT</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    style={{
                                        padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                                        background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.3)',
                                        color: '#a78bfa', cursor: 'pointer'
                                    }}
                                >
                                    {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s._id)) ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                        </div>

                        {/* Student Checkboxes List */}
                        <div style={{
                            maxHeight: 240, overflowY: 'auto', border: `1.5px solid ${t.border}`,
                            borderRadius: 10, padding: '14px', background: t.inputBg || 'rgba(0,0,0,0.1)'
                        }}>
                            {filteredStudents.length === 0 ? (
                                <div style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: 20 }}>
                                    No students found for department filter: <strong>{deptFilter}</strong>.
                                </div>
                            ) : (
                                filteredStudents.map(st => {
                                    const isChecked = selectedStudentIds.includes(st._id);
                                    return (
                                        <label
                                            key={st._id}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '8px 12px', borderRadius: 6, marginBottom: 4,
                                                background: isChecked ? 'rgba(108,99,255,0.12)' : 'transparent',
                                                border: `1px solid ${isChecked ? 'rgba(108,99,255,0.3)' : 'transparent'}`,
                                                cursor: 'pointer', transition: 'all 0.15s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleStudentSelection(st._id)}
                                                    style={{ width: 16, height: 16, accentColor: '#6c63ff' }}
                                                />
                                                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                                                    {st.name}
                                                </span>
                                                <span style={{ fontSize: 12, color: t.textMuted }}>
                                                    ({st.email})
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: t.textMuted }}>
                                                    {st.department || 'General'}
                                                </span>
                                                {st.rollno && (
                                                    <span style={{ fontSize: 11, color: t.textMuted, fontFamily: 'monospace' }}>
                                                        {st.rollno}
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>

                        {/* Submit Button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                            <button
                                type="submit"
                                disabled={assigning || !selectedQuestionId || selectedStudentIds.length === 0}
                                style={{
                                    padding: '12px 28px', fontSize: 14, fontWeight: 700,
                                    borderRadius: 10, border: 'none',
                                    background: (!selectedQuestionId || selectedStudentIds.length === 0)
                                        ? 'rgba(255,255,255,0.1)'
                                        : 'linear-gradient(135deg, #6c63ff, #4b44cc)',
                                    color: (!selectedQuestionId || selectedStudentIds.length === 0) ? '#6b7280' : '#ffffff',
                                    cursor: (!selectedQuestionId || selectedStudentIds.length === 0) ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 16px rgba(108,99,255,0.3)',
                                    display: 'flex', alignItems: 'center', gap: 8
                                }}
                            >
                                {assigning ? 'Assigning Circuit Exam…' : `⚡ Assign Circuit Exam to ${selectedStudentIds.length} Student(s)`}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── TAB 2: QUESTIONS BANK ───────────────────────────────── */}
            {tab === 'questions' && (
                <>
                    <div style={{ marginBottom: 16 }}>
                        <button style={s.primaryBtn} onClick={openCreate}>＋ New Circuit Question</button>
                    </div>

                    {loading && <div style={s.loader}>Loading…</div>}

                    <div style={s.qGrid}>
                        {questions.map(q => (
                            <div key={q._id} className="ad-card" style={s.qCard}>
                                <div style={s.qCardHeader}>
                                    <div style={{ flex: 1 }}>
                                        <div style={s.qTitle}>{q.title}</div>
                                        <div style={s.qMeta}>
                                            <span style={{ ...s.diffBadge, color: DIFFICULTY_COLORS[q.difficulty] }}>
                                                {q.difficulty}
                                            </span>
                                            <span style={s.topicTag}>📐 {q.topic}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <IconBtn icon="✏️" title="Edit"   onClick={() => openEdit(q)} />
                                        <IconBtn icon="🗑"  title="Delete" danger onClick={() => handleDelete(q._id)} />
                                    </div>
                                </div>
                                <p style={s.qDesc}>{q.description?.slice(0, 120)}…</p>
                                <div style={s.qFooter}>
                                    <span style={s.palLabel}>
                                        {(q.visible_palette || []).slice(0, 4).join(', ')}
                                        {q.visible_palette?.length > 4 ? ` +${q.visible_palette.length - 4}` : ''}
                                    </span>
                                    <span style={s.evalType}>{q.expected_behavior?.type?.replace(/_/g,' ')}</span>
                                </div>
                            </div>
                        ))}
                        {questions.length === 0 && !loading && (
                            <div style={s.empty}>
                                No circuit questions created yet. Click "+ New Circuit Question" to add one.
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ── TAB 3: SUBMISSIONS & ML RESULTS ─────────────────────── */}
            {tab === 'submissions' && (
                <div className="ad-card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                            🧠 Student Submissions & ML Evaluation Analytics
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {/* Model Stats Badge */}
                            {modelStats?.loaded && (
                                <div style={{ fontSize: 11, color: t.textMuted, padding: '4px 10px', background: t.surfaceAlt || '#f1f5f9', borderRadius: 6, border: `1px solid ${t.border}` }}>
                                    🤖 Model: R²={modelStats.r2} · MAE={modelStats.mae} · {modelStats.n_features || 25} features
                                </div>
                            )}
                            {/* Retrain Button */}
                            <button
                                disabled={retrainStatus === 'training'}
                                onClick={async () => {
                                    setRetrainStatus('training');
                                    try {
                                        const res = await fetch(
                                            (import.meta.env.VITE_ML_URL || 'http://127.0.0.1:8001') + '/train-circuit-model',
                                            { method: 'POST' }
                                        );
                                        const data = await res.json();
                                        if (res.ok) {
                                            setRetrainStatus('done');
                                            showMsg('✅ Model retrained successfully! Refresh to see updated stats.');
                                            // Reload model stats
                                            fetch((import.meta.env.VITE_ML_URL || 'http://127.0.0.1:8001') + '/circuit-model-stats')
                                                .then(r => r.json()).then(d => setModelStats(d)).catch(() => {});
                                        } else {
                                            setRetrainStatus('error');
                                            showMsg('❌ Retrain failed: ' + (data.detail || 'Unknown error'), true);
                                        }
                                    } catch (e) {
                                        setRetrainStatus('error');
                                        showMsg('❌ ML service unreachable: ' + e.message, true);
                                    }
                                    setTimeout(() => setRetrainStatus(null), 5000);
                                }}
                                style={{
                                    padding: '5px 12px', fontSize: 12,
                                    background: retrainStatus === 'training'
                                        ? 'rgba(245,158,11,0.15)'
                                        : retrainStatus === 'done'
                                        ? 'rgba(34,197,94,0.15)'
                                        : 'rgba(108,99,255,0.12)',
                                    border: `1px solid ${retrainStatus === 'done' ? '#22c55e' : retrainStatus === 'error' ? '#ef4444' : '#6c63ff'}`,
                                    color: retrainStatus === 'done' ? '#22c55e' : retrainStatus === 'error' ? '#ef4444' : '#6c63ff',
                                    borderRadius: 6, cursor: retrainStatus === 'training' ? 'not-allowed' : 'pointer',
                                    fontWeight: 700
                                }}
                            >
                                {retrainStatus === 'training' ? '⏳ Training…' : retrainStatus === 'done' ? '✅ Retrained!' : '🔄 Retrain AI Model'}
                            </button>
                            <button
                                onClick={loadAllSubmissions}
                                style={{ padding: '5px 12px', fontSize: 12, background: t.surfaceAlt || 'rgba(255,255,255,0.05)', border: `1px solid ${t.border}`, color: t.text, borderRadius: 6, cursor: 'pointer' }}
                            >
                                🔃 Refresh
                            </button>
                        </div>
                    </div>

                    <table style={s.table}>
                        <thead>
                            <tr>
                                {['Student','Department','Question','Status','ML Score','Verdict','Evaluation Engine','Submitted','Actions'].map(h => (
                                    <th key={h} style={s.th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.map(sub => (
                                <tr key={sub._id} style={s.tr}>
                                    <td style={s.td}>
                                        <strong>{sub.student_id?.name || 'Student'}</strong>
                                        <div style={{ fontSize: 11, color: t.textMuted }}>{sub.student_id?.email}</div>
                                    </td>
                                    <td style={s.td}>{sub.student_id?.department || '—'}</td>
                                    <td style={s.td}><strong>{sub.question_id?.title || 'Circuit Test'}</strong></td>
                                    <td style={s.td}>
                                        <span style={{
                                            ...s.statusBadge,
                                            background: sub.status === 'evaluated' ? 'rgba(34,197,94,0.12)'
                                                      : sub.status === 'submitted' ? 'rgba(245,158,11,0.12)'
                                                      : 'rgba(255,255,255,0.05)',
                                            color: sub.status === 'evaluated' ? '#22c55e'
                                                 : sub.status === 'submitted' ? '#f59e0b'
                                                 : '#6b7280'
                                        }}>{sub.status}</span>
                                    </td>
                                    <td style={{ ...s.td, fontWeight: 800, color: '#6c63ff', fontSize: 14 }}>
                                        {sub.evaluation?.score !== undefined ? `${sub.evaluation.score} / 100` : '—'}
                                    </td>
                                    <td style={s.td}>
                                        {sub.evaluation?.verdict ? (
                                            <span style={{ color: VERDICT_COLORS[sub.evaluation.verdict] || '#94a3b8', fontWeight: 700, textTransform: 'capitalize' }}>
                                                {sub.evaluation.verdict.replace(/_/g,' ')}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td style={s.td}>
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(108,99,255,0.1)', color: '#a78bfa' }}>
                                            {sub.evaluation?.engine || 'ML Neural Net'}
                                        </span>
                                    </td>
                                    <td style={{ ...s.td, fontSize: 11, color: t.textMuted }}>
                                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'Draft'}
                                    </td>
                                    <td style={s.td}>
                                        {sub.evaluation ? (
                                            <button
                                                onClick={() => setSelectedSub(sub)}
                                                style={{
                                                    padding: '5px 12px',
                                                    fontSize: 12,
                                                    background: '#6c63ff',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: 6,
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}
                                            >
                                                👁️ View Evaluation
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: 11, color: t.textMuted }}>No eval yet</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {submissions.length === 0 && (
                                <tr><td colSpan={9} style={{ ...s.td, textAlign: 'center', color: '#4b5563', padding: 28 }}>
                                    No student circuit submissions recorded yet.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── QUESTION EDIT / CREATE FORM MODAL ───────────────────── */}
            {showForm && (
                <>
                    <div style={s.backdrop} onClick={() => setShowForm(false)} />
                    <div style={s.modal}>
                        <div style={s.modalHeader}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {editQ ? '✏️ Edit Circuit Question' : '＋ New Circuit Question'}
                                </h3>
                                <div style={{ fontSize: 12, color: t.isDark ? '#94a3b8' : '#64748b', marginTop: 3 }}>
                                    Configure simulation constraints, component palette & evaluation targets
                                </div>
                            </div>
                            <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
                        </div>

                        <div style={s.modalBody}>
                            <Field label="Question Title">
                                <input style={s.input} value={form.title}
                                       onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                       placeholder="e.g. Design an Inverting Amplifier with Gain = −10" />
                            </Field>

                            <Field label="Question Description">
                                <textarea style={{ ...s.input, minHeight: 76, resize: 'vertical' }}
                                          value={form.description}
                                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                          placeholder="Full question description & specifications shown to students" />
                            </Field>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <Field label="Topic">
                                    <input style={s.input} value={form.topic}
                                           placeholder="e.g. Analog Electronics"
                                           onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
                                </Field>
                                <Field label="Difficulty">
                                    <select style={s.select} value={form.difficulty}
                                            onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                                        {['easy','medium','hard'].map(d => (
                                            <option key={d} value={d} style={{ background: t.isDark ? '#1a1c2e' : '#fff', color: t.isDark ? '#fff' : '#000' }}>
                                                {d.toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>

                            <Field label="Hint Text (Optional)">
                                <input style={s.input} value={form.hint_text}
                                       placeholder="e.g. Use an op-amp with negative feedback resistor Rf"
                                       onChange={e => setForm(f => ({ ...f, hint_text: e.target.value }))} />
                            </Field>

                            <Field label="Allowed Components Palette (Click to toggle)">
                                <div style={s.checkGrid}>
                                    {PALETTE_OPTIONS.map(type => {
                                        const isChecked = form.visible_palette.includes(type);
                                        const label = type.replace(/_/g, ' ');
                                        return (
                                            <div
                                                key={type}
                                                onClick={() => togglePalette(type)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    padding: '9px 12px',
                                                    borderRadius: 10,
                                                    cursor: 'pointer',
                                                    userSelect: 'none',
                                                    fontSize: 12,
                                                    fontWeight: isChecked ? 700 : 500,
                                                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    background: isChecked
                                                        ? (t.isDark ? 'rgba(108, 99, 255, 0.22)' : 'rgba(108, 99, 255, 0.1)')
                                                        : (t.isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc'),
                                                    border: isChecked
                                                        ? '1.5px solid #6c63ff'
                                                        : `1px solid ${t.isDark ? 'rgba(255, 255, 255, 0.09)' : '#e2e8f0'}`,
                                                    color: isChecked
                                                        ? (t.isDark ? '#c4b5fd' : '#4f46e5')
                                                        : (t.isDark ? '#94a3b8' : '#64748b'),
                                                    boxShadow: isChecked ? '0 2px 10px rgba(108, 99, 255, 0.2)' : 'none',
                                                }}
                                            >
                                                <div style={{
                                                    width: 16, height: 16, borderRadius: 4,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: isChecked ? '#6c63ff' : 'transparent',
                                                    border: isChecked ? 'none' : `1.5px solid ${t.isDark ? 'rgba(255,255,255,0.25)' : '#cbd5e1'}`,
                                                    color: '#fff', fontSize: 10, fontWeight: 900, flexShrink: 0
                                                }}>
                                                    {isChecked && '✓'}
                                                </div>
                                                <span style={{ textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Field>

                            {/* Evaluation Specification Box */}
                            <div style={{
                                background: t.isDark ? 'rgba(108, 99, 255, 0.06)' : '#f5f3ff',
                                border: `1px solid ${t.isDark ? 'rgba(108, 99, 255, 0.2)' : '#ddd6fe'}`,
                                borderRadius: 12,
                                padding: 14,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12
                            }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: t.isDark ? '#c4b5fd' : '#6d28d9', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    🎯 EVALUATION TARGET SPECIFICATIONS
                                </div>

                                <Field label="Evaluation Type">
                                    <select style={s.select}
                                            value={form.expected_behavior.type}
                                            onChange={e => setForm(f => ({
                                                ...f,
                                                expected_behavior: { ...f.expected_behavior, type: e.target.value }
                                            }))}>
                                        {BEHAVIOR_TYPES.map(bt => (
                                            <option key={bt} value={bt} style={{ background: t.isDark ? '#1a1c2e' : '#fff', color: t.isDark ? '#fff' : '#000' }}>
                                                {bt.replace(/_/g,' ').toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    {form.expected_behavior.type === 'gain_check' && (
                                        <Field label="Expected Gain">
                                            <input style={s.input} type="number" step="any"
                                                   value={form.expected_behavior.expected_gain}
                                                   onChange={e => setForm(f => ({
                                                       ...f,
                                                       expected_behavior: { ...f.expected_behavior, expected_gain: parseFloat(e.target.value) }
                                                   }))} />
                                        </Field>
                                    )}
                                    {form.expected_behavior.type === 'voltage_divider' && (
                                        <Field label="Expected Output Voltage (V)">
                                            <input style={s.input} type="number" step="any"
                                                   value={form.expected_behavior.expected_voltage}
                                                   onChange={e => setForm(f => ({
                                                       ...f,
                                                       expected_behavior: { ...f.expected_behavior, expected_voltage: parseFloat(e.target.value) }
                                                   }))} />
                                        </Field>
                                    )}
                                    {form.expected_behavior.type === 'rlc_analysis' && (
                                        <Field label="Expected Resonant Frequency (Hz)">
                                            <input style={s.input} type="number" step="any"
                                                   value={form.expected_behavior.expected_freq}
                                                   onChange={e => setForm(f => ({
                                                       ...f,
                                                       expected_behavior: { ...f.expected_behavior, expected_freq: parseFloat(e.target.value) }
                                                   }))} />
                                        </Field>
                                    )}

                                    <Field label="Tolerance (%)">
                                        <input style={s.input} type="number" min="0" max="50"
                                               value={form.expected_behavior.tolerance_percent}
                                               onChange={e => setForm(f => ({
                                                   ...f,
                                                   expected_behavior: { ...f.expected_behavior, tolerance_percent: parseFloat(e.target.value) }
                                               }))} />
                                    </Field>
                                </div>
                            </div>
                        </div>

                        <div style={s.modalFooter}>
                            <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
                            <button style={s.primaryBtn} onClick={handleSave} disabled={loading}>
                                {loading ? 'Saving…' : editQ ? 'Update Question' : 'Create Question'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── AI EVALUATION & CIRCUIT INSPECTION MODAL FOR ADMIN ───── */}
            {selectedSub && (
                <>
                    <div style={s.backdrop} onClick={() => setSelectedSub(null)} />
                    <div style={{
                        ...s.modal,
                        background: t.surface || '#ffffff',
                        border: `1px solid ${t.border || '#e2e8f0'}`,
                        boxShadow: t.isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 20px 50px rgba(0,0,0,0.12)',
                        width: '92vw',
                        maxWidth: '1150px',
                        maxHeight: '90vh',
                        height: '85vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            ...s.modalHeader,
                            background: t.surfaceAlt || '#f8fafc',
                            borderBottom: `1px solid ${t.border || '#e2e8f0'}`
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, color: t.text || '#0f172a', fontWeight: 700 }}>
                                    🧠 AI Evaluation Report & Circuit Inspection — <span style={{ color: t.accent || '#6c63ff' }}>{selectedSub.student_id?.name || 'Student'}</span>
                                </h3>
                                <div style={{ fontSize: 12, color: t.textMuted || '#64748b', marginTop: 4 }}>
                                    Question: <strong style={{ color: t.text || '#0f172a' }}>{selectedSub.question_id?.title || 'Circuit Test'}</strong> | Submitted: {selectedSub.submitted_at ? new Date(selectedSub.submitted_at).toLocaleString() : 'N/A'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                    onClick={() => {
                                        const svgEl = document.querySelector('svg');
                                        exportCircuitReportPDF({
                                            question: selectedSub.question_id || {},
                                            submission: selectedSub,
                                            evaluation: selectedSub.evaluation || {},
                                            studentName: selectedSub.student_id?.name || 'Student',
                                            studentId: selectedSub.student_id?.rollno || selectedSub.student_id?._id || 'N/A',
                                            studentDepartment: selectedSub.student_id?.department || 'ECE',
                                            examTitle: selectedSub.question_id?.title || 'Circuit Exam',
                                            schematicSvgRef: svgEl
                                        });
                                    }}
                                    style={{
                                        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #6c63ff 0%, #4b44cc 100%)', color: '#fff',
                                        fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
                                        boxShadow: '0 3px 10px rgba(108,99,255,0.35)', display: 'flex', alignItems: 'center', gap: 6
                                    }}
                                >
                                    📄 Export PDF Report
                                </button>
                                <button
                                    onClick={() => {
                                        const svgEl = document.querySelector('svg');
                                        exportSchematicPNG(svgEl, selectedSub.question_id?.title || 'Circuit_Schematic');
                                    }}
                                    style={{
                                        padding: '7px 12px', borderRadius: 8,
                                        border: `1px solid ${t.border || '#cbd5e1'}`, cursor: 'pointer',
                                        background: t.isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                                        color: t.text || '#0f172a', fontSize: 12, fontWeight: 600, fontFamily: 'Outfit, sans-serif'
                                    }}
                                >
                                    🖼️ Download PNG
                                </button>
                                <button style={{
                                    ...s.closeBtn,
                                    background: t.surfaceAlt || '#f1f5f9',
                                    border: `1px solid ${t.border || '#e2e8f0'}`,
                                    color: t.textMuted || '#64748b'
                                }} onClick={() => setSelectedSub(null)}>✕</button>
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden', padding: 16 }}>
                            {/* Left: Student's Drawn Circuit Canvas */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0d0f1a', borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border || '#e2e8f0'}` }}>
                                <div style={{ padding: '10px 14px', background: t.surfaceAlt || '#f8fafc', fontSize: 12, fontWeight: 700, color: t.text || '#0f172a', borderBottom: `1px solid ${t.border || '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                    <span>📐 Submitted Circuit Design</span>
                                    <span style={{ fontSize: 11, color: t.textMuted || '#64748b', fontWeight: 400 }}>Read-Only Mode</span>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
                                    <CircuitBoard
                                        key={selectedSub._id}
                                        initialComponents={selectedSub.components || []}
                                        initialConnections={selectedSub.connections || []}
                                        readOnly={true}
                                    />
                                </div>
                            </div>

                            {/* Right: Interactive Inspection Tabs & Details */}
                            <div style={{ width: '460px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                {/* Tab Bar */}
                                <div style={{ display: 'flex', gap: 4, background: t.surfaceAlt || '#f1f5f9', padding: 4, borderRadius: 8, marginBottom: 12, border: `1px solid ${t.border || '#e2e8f0'}` }}>
                                    <button
                                        onClick={() => setModalTab('eval')}
                                        style={{
                                            flex: 1, padding: '7px 6px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                                            background: modalTab === 'eval' ? (t.accent || '#6c63ff') : 'transparent',
                                            color: modalTab === 'eval' ? '#ffffff' : (t.textMuted || '#64748b')
                                        }}
                                    >
                                        📊 AI Evaluation
                                    </button>
                                    <button
                                        onClick={() => setModalTab('netlist')}
                                        style={{
                                            flex: 1, padding: '7px 6px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                                            background: modalTab === 'netlist' ? (t.accent || '#6c63ff') : 'transparent',
                                            color: modalTab === 'netlist' ? '#ffffff' : (t.textMuted || '#64748b')
                                        }}
                                    >
                                        📋 Netlist & BOM
                                    </button>
                                    <button
                                        onClick={() => setModalTab('spec')}
                                        style={{
                                            flex: 1, padding: '7px 6px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                                            background: modalTab === 'spec' ? (t.accent || '#6c63ff') : 'transparent',
                                            color: modalTab === 'spec' ? '#ffffff' : (t.textMuted || '#64748b')
                                        }}
                                    >
                                        🎯 Spec Verification
                                    </button>
                                </div>

                                {/* Scrollable Tab Body */}
                                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                                    {modalTab === 'eval' && (
                                        selectedSub.evaluation ? (
                                            <EvaluationPanel
                                                evaluation={selectedSub.evaluation}
                                                question={selectedSub.question_id || {}}
                                                submission={selectedSub}
                                            />
                                        ) : (
                                            <div style={{ padding: 24, textAlign: 'center', color: t.textMuted }}>
                                                No evaluation details available.
                                            </div>
                                        )
                                    )}

                                    {modalTab === 'netlist' && (
                                        <NetlistAuditTab submission={selectedSub} t={t} />
                                    )}

                                    {modalTab === 'spec' && (
                                        <SpecVerificationTab submission={selectedSub} t={t} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }) {
    return (
        <button onClick={onClick} style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid',
            borderColor: active ? '#6c63ff' : 'rgba(255,255,255,0.1)',
            background:  active ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.03)',
            color:       active ? '#a78bfa' : '#6b7280',
            fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            transition: 'all 0.15s'
        }}>{children}</button>
    );
}

function IconBtn({ icon, title, onClick, danger }) {
    return (
        <button title={title} onClick={onClick} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, cursor: 'pointer',
            color: danger ? '#ef4444' : '#94a3b8',
            padding: '4px 8px', fontSize: 13,
        }}>{icon}</button>
    );
}

function Field({ label, children, style: fieldStyle }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...fieldStyle }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
            </label>
            {children}
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = (t) => ({
    msg: {
        background: 'rgba(108,99,255,0.12)',
        border: '1px solid rgba(108,99,255,0.25)',
        borderRadius: 8,
        color: '#a78bfa',
        padding: '10px 16px',
        fontSize: 13,
        marginBottom: 16,
        cursor: 'pointer',
    },
    qGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 },
    qCard: { padding: 16 },
    qCardHeader: { display: 'flex', gap: 12, marginBottom: 8 },
    qTitle: { fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.3 },
    qMeta: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 },
    diffBadge: { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' },
    topicTag: { fontSize: 11, color: t.textMuted },
    qDesc: { fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginBottom: 10 },
    qFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    palLabel: { fontSize: 10, color: '#4b5563', fontFamily: 'monospace' },
    evalType: { fontSize: 11, color: '#6c63ff', fontWeight: 600, textTransform: 'capitalize' },
    empty: { gridColumn: '1/-1', textAlign: 'center', color: t.textMuted, padding: '40px 20px', fontSize: 13 },
    loader: { textAlign: 'center', color: t.textMuted, padding: '20px', fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '12px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: t.textMuted, borderBottom: `1px solid ${t.border}`, textAlign: 'left' },
    tr: { borderBottom: `1px solid ${t.border}` },
    td: { padding: '12px 14px', fontSize: 13, color: t.text },
    statusBadge: { padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' },
    backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, backdropFilter: 'blur(6px)' },
    modal: {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 501, background: t.isDark ? '#141628' : '#ffffff',
        borderRadius: 20,
        border: `1px solid ${t.isDark ? 'rgba(108,99,255,0.3)' : '#cbd5e1'}`,
        boxShadow: t.isDark ? '0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(108,99,255,0.15)' : '0 24px 60px rgba(0,0,0,0.15)',
        width: 620, maxHeight: '88vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
    },
    modalHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 24px',
        borderBottom: `1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
        background: t.isDark ? 'linear-gradient(135deg, rgba(108,99,255,0.14), rgba(20,22,40,0.95))' : 'linear-gradient(135deg, #f8fafc, #edf2f7)',
    },
    modalBody: {
        overflowY: 'auto', padding: '22px 24px',
        display: 'flex', flexDirection: 'column', gap: 16,
    },
    modalFooter: {
        display: 'flex', justifyContent: 'flex-end', gap: 12,
        padding: '16px 24px',
        borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
        background: t.isDark ? '#101221' : '#f8fafc',
    },
    input: {
        width: '100%',
        background: t.isDark ? '#1a1c30' : '#ffffff',
        border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}`,
        borderRadius: 10,
        color: t.isDark ? '#f8fafc' : '#0f172a',
        fontSize: 13,
        padding: '10px 14px',
        outline: 'none',
        fontFamily: 'Outfit, sans-serif',
        boxSizing: 'border-box',
        transition: 'all 0.15s ease',
    },
    select: {
        width: '100%',
        background: t.isDark ? '#1a1c30' : '#ffffff',
        border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}`,
        borderRadius: 10,
        color: t.isDark ? '#f8fafc' : '#0f172a',
        fontSize: 13,
        padding: '10px 14px',
        outline: 'none',
        fontFamily: 'Outfit, sans-serif',
        cursor: 'pointer',
        boxSizing: 'border-box',
    },
    checkGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
    },
    checkLabel: { fontSize: 12, color: t.isDark ? '#94a3b8' : '#475569', display: 'flex', alignItems: 'center', cursor: 'pointer' },
    primaryBtn: {
        padding: '10px 24px',
        background: 'linear-gradient(135deg, #6c63ff 0%, #4b44cc 100%)',
        border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
        boxShadow: '0 4px 14px rgba(108, 99, 255, 0.4)',
        transition: 'all 0.15s ease',
    },
    cancelBtn: {
        padding: '10px 20px',
        background: t.isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
        border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}`,
        borderRadius: 10,
        color: t.isDark ? '#cbd5e1' : '#475569',
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
        transition: 'all 0.15s ease',
    },
    closeBtn: {
        background: t.isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
        border: `1px solid ${t.isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}`,
        borderRadius: '50%',
        color: t.isDark ? '#cbd5e1' : '#64748b',
        cursor: 'pointer',
        width: 32, height: 32, fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease',
    },
});

// ── Netlist & Component Audit Tab ────────────────────────────────────────────
function NetlistAuditTab({ submission, t }) {
    const components = submission?.components || [];
    const connections = submission?.connections || [];

    const formatProps = (comp) => {
        const props = comp.properties || {};
        const entries = props instanceof Map ? Array.from(props.entries()) : Object.entries(props);
        if (entries.length === 0) return 'Standard';
        return entries.map(([k, v]) => {
            if (k === 'resistance_ohm') return `${v >= 1000 ? (v/1000)+' k' : v} Ω`;
            if (k === 'capacitance_farad') return `${v} F`;
            if (k === 'inductance_henry') return `${v} H`;
            if (k === 'voltage') return `${v} V (${props.waveform || 'DC'})`;
            return `${k}: ${v}`;
        }).join(', ');
    };

    const nets = connections.map((conn, idx) => {
        const fromStr = `${conn.from?.comp_id}:${conn.from?.pin}`;
        const toStr   = `${conn.to?.comp_id}:${conn.to?.pin}`;
        return { id: conn.id || `net-${idx+1}`, label: `Net #${idx+1}`, from: fromStr, to: toStr };
    });

    const isDark = t?.isDark ?? false;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Bill of Materials */}
            <div style={{ background: t?.surfaceAlt || '#f8fafc', borderRadius: 10, padding: 14, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t?.text || '#0f172a', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span>📦 Bill of Materials (Component Inventory)</span>
                    <span style={{ fontSize: 11, color: t?.accent || '#6c63ff', fontWeight: 600 }}>{components.length} Placed</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${t?.border || '#e2e8f0'}`, color: t?.textMuted || '#64748b', textAlign: 'left' }}>
                            <th style={{ padding: '6px 8px' }}>Component ID</th>
                            <th style={{ padding: '6px 8px' }}>Type</th>
                            <th style={{ padding: '6px 8px' }}>Configured Values</th>
                            <th style={{ padding: '6px 8px' }}>Rotation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {components.map(comp => {
                            const def = COMP_DEFS[comp.type] || {};
                            return (
                                <tr key={comp.comp_id} style={{ borderBottom: `1px solid ${t?.border || '#f1f5f9'}` }}>
                                    <td style={{ padding: '8px', fontWeight: 700, color: def.color || t?.accent || '#6c63ff' }}>{comp.comp_id}</td>
                                    <td style={{ padding: '8px', color: t?.text || '#0f172a' }}>{def.label || comp.type}</td>
                                    <td style={{ padding: '8px', color: t?.textMuted || '#64748b' }}>{formatProps(comp)}</td>
                                    <td style={{ padding: '8px', color: t?.textMuted || '#64748b' }}>{comp.rotation || 0}°</td>
                                </tr>
                            );
                        })}
                        {components.length === 0 && (
                            <tr><td colSpan={4} style={{ padding: 12, textAlign: 'center', color: t?.textMuted || '#64748b' }}>No components placed</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Electrical Netlist */}
            <div style={{ background: t?.surfaceAlt || '#f8fafc', borderRadius: 10, padding: 14, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t?.text || '#0f172a', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span>⚡ Wiring Netlist ({nets.length} Wires)</span>
                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Active Nets</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${t?.border || '#e2e8f0'}`, color: t?.textMuted || '#64748b', textAlign: 'left' }}>
                            <th style={{ padding: '6px 8px' }}>Net ID</th>
                            <th style={{ padding: '6px 8px' }}>From Terminal</th>
                            <th style={{ padding: '6px 8px' }}></th>
                            <th style={{ padding: '6px 8px' }}>To Terminal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {nets.map(net => (
                            <tr key={net.id} style={{ borderBottom: `1px solid ${t?.border || '#f1f5f9'}` }}>
                                <td style={{ padding: '8px', fontWeight: 700, color: t?.accent || '#6c63ff' }}>{net.label}</td>
                                <td style={{ padding: '8px', color: t?.text || '#0f172a' }}><code style={{ color: isDark ? '#a78bfa' : '#6d28d9' }}>{net.from}</code></td>
                                <td style={{ padding: '8px', color: t?.accent || '#6c63ff' }}>➔</td>
                                <td style={{ padding: '8px', color: t?.text || '#0f172a' }}><code style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>{net.to}</code></td>
                            </tr>
                        ))}
                        {nets.length === 0 && (
                            <tr><td colSpan={4} style={{ padding: 12, textAlign: 'center', color: t?.textMuted || '#64748b' }}>No wire connections created</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Spec Verification Tab ───────────────────────────────────────────────────
function SpecVerificationTab({ submission, t }) {
    const q = submission?.question_id || {};
    const eb = q.expected_behavior || {};
    const evalData = submission?.evaluation || {};
    const sim = evalData.sim_result || {};

    const targetVal = eb.expected_gain ?? eb.expected_voltage ?? eb.expected_freq ?? 'N/A';
    const measuredVal = sim.measured_gain ?? sim.output_voltage ?? sim.resonant_frequency ?? 'N/A';
    const tolPercent = eb.tolerance_percent || 5;

    let errorFrac = null;
    if (typeof targetVal === 'number' && typeof measuredVal === 'number' && targetVal !== 0) {
        errorFrac = Math.abs((measuredVal - targetVal) / targetVal) * 100;
    }

    const isPass = errorFrac !== null ? errorFrac <= tolPercent : evalData.verdict === 'correct';
    const components = submission?.components || [];
    const hasGnd = components.some(c => c.type === 'ground');
    const issues = (evalData.issues_found || []).filter(Boolean);
    const isDark = t?.isDark ?? false;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Target vs Measured Spec Grid */}
            <div style={{ background: t?.surfaceAlt || '#f8fafc', borderRadius: 10, padding: 14, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t?.text || '#0f172a', marginBottom: 12 }}>
                    🎯 Specification Comparison
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div style={{ background: isDark ? 'rgba(108,99,255,0.12)' : '#f3e8ff', padding: 10, borderRadius: 8, textAlign: 'center', border: `1px solid ${isDark ? 'rgba(108,99,255,0.25)' : '#e9d5ff'}` }}>
                        <div style={{ fontSize: 11, color: t?.textMuted || '#64748b', fontWeight: 600 }}>Required Target</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? '#c084fc' : '#7e22ce', marginTop: 4 }}>
                            {targetVal} {eb.type === 'voltage_divider' ? 'V' : eb.type === 'rlc_analysis' ? 'Hz' : ''}
                        </div>
                    </div>
                    <div style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', padding: 10, borderRadius: 8, textAlign: 'center', border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                        <div style={{ fontSize: 11, color: t?.textMuted || '#64748b', fontWeight: 600 }}>Simulated Measured</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: measuredVal !== 'N/A' ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#f87171' : '#b91c1c'), marginTop: 4 }}>
                            {typeof measuredVal === 'number' ? measuredVal.toFixed(4) : measuredVal} {eb.type === 'voltage_divider' ? 'V' : eb.type === 'rlc_analysis' ? 'Hz' : ''}
                        </div>
                    </div>
                    <div style={{ background: isPass ? (isDark ? 'rgba(34,197,94,0.12)' : '#dcfce7') : (isDark ? 'rgba(239,68,68,0.12)' : '#fee2e2'), padding: 10, borderRadius: 8, textAlign: 'center', border: `1px solid ${isPass ? (isDark ? 'rgba(34,197,94,0.3)' : '#86efac') : (isDark ? 'rgba(239,68,68,0.3)' : '#fca5a5')}` }}>
                        <div style={{ fontSize: 11, color: t?.textMuted || '#64748b', fontWeight: 600 }}>Tolerance Outcome</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isPass ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#f87171' : '#b91c1c'), marginTop: 4 }}>
                            {isPass ? '🟢 PASS' : '🔴 FAIL'} ({errorFrac !== null ? `${errorFrac.toFixed(2)}% err` : 'Out of tol'})
                        </div>
                    </div>
                </div>
            </div>

            {/* DRC Checklist */}
            <div style={{ background: t?.surfaceAlt || '#f8fafc', borderRadius: 10, padding: 14, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t?.text || '#0f172a', marginBottom: 10 }}>
                    🛡️ Design Rule Checks (DRC Checklist) & SPICE Compliance
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: t?.surface || '#ffffff', borderRadius: 6, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                        <span style={{ color: t?.text || '#1e293b', fontWeight: 500 }}>⚡ 0V Ground Reference Symbol</span>
                        <span style={{ fontWeight: 700, color: hasGnd ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#f87171' : '#dc2626') }}>
                            {hasGnd ? '🟢 Present' : '🔴 Missing'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: t?.surface || '#ffffff', borderRadius: 6, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                        <span style={{ color: t?.text || '#1e293b', fontWeight: 500 }}>💥 Short Circuit Prevention</span>
                        <span style={{ fontWeight: 700, color: issues.some(i => i?.type === 'short_circuit') ? (isDark ? '#f87171' : '#dc2626') : (isDark ? '#4ade80' : '#15803d') }}>
                            {issues.some(i => i?.type === 'short_circuit') ? '🔴 Short Circuit Detected' : '🟢 0 Shorts'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: t?.surface || '#ffffff', borderRadius: 6, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                        <span style={{ color: t?.text || '#1e293b', fontWeight: 500 }}>📍 Floating Pin Audit</span>
                        <span style={{ fontWeight: 700, color: issues.some(i => i?.type === 'floating_pin') ? (isDark ? '#fbbf24' : '#d97706') : (isDark ? '#4ade80' : '#15803d') }}>
                            {issues.some(i => i?.type === 'floating_pin') ? '⚠️ Floating Pins Found' : '🟢 Fully Wired'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: t?.surface || '#ffffff', borderRadius: 6, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                        <span style={{ color: t?.text || '#1e293b', fontWeight: 500 }}>🔥 Thermal Safety Margin (&lt;250mW Limit)</span>
                        <span style={{ fontWeight: 700, color: sim.thermal_warnings?.length > 0 ? (isDark ? '#f87171' : '#dc2626') : (isDark ? '#4ade80' : '#15803d') }}>
                            {sim.thermal_warnings?.length > 0 ? `⚠️ ${sim.thermal_warnings.length} Overload` : '🟢 Thermal Safe'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: t?.surface || '#ffffff', borderRadius: 6, border: `1px solid ${t?.border || '#e2e8f0'}` }}>
                        <span style={{ color: t?.text || '#1e293b', fontWeight: 500 }}>📊 EE Overall Grade</span>
                        <span style={{ fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: '#6c63ff', color: '#fff' }}>
                            Grade {sim.ee_grade || (isPass ? 'A+' : 'C')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
