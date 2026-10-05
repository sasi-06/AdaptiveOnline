import React, { useState, useEffect } from 'react';
import { getCadAssessments, getCadSubmissionsForAdmin, getBehaviorLogs } from '../services/api';
import BehaviorTimeline from './BehaviorTimeline';
import AdminCadActivityReview from './cad/AdminCadActivityReview';

export default function AdminCadResults({ theme: t, students = [], flash, openTimeline, initialAssessmentId = 'ALL' }) {
    const [assessments, setAssessments] = useState([]);
    const [selectedAssessmentId, setSelectedAssessmentId] = useState(initialAssessmentId);
    const [cadResults, setCadResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modal & Activity History State
    const [viewingStudentResult, setViewingStudentResult] = useState(null);
    const [activityReviewItem, setActivityReviewItem] = useState(null);
    const [modalTab, setModalTab] = useState('drawings'); // 'drawings' | 'proctoring'
    const [studentLogs, setStudentLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [lightboxPhoto, setLightboxPhoto] = useState(null);

    const isFirstRender = React.useRef(true);

    useEffect(() => {
        loadAssessmentsAndResults();
    }, [initialAssessmentId]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (selectedAssessmentId) {
            loadResults(selectedAssessmentId);
        }
    }, [selectedAssessmentId]);

    // Fetch behavior logs whenever a student result is opened in modal
    useEffect(() => {
        if (viewingStudentResult) {
            const stId = viewingStudentResult.student?._id || viewingStudentResult.student;
            const asmId = viewingStudentResult.assessment?._id || viewingStudentResult.assessment;
            if (stId && asmId) {
                setLogsLoading(true);
                getBehaviorLogs(stId, asmId)
                    .then(res => setStudentLogs(res.data || []))
                    .catch(err => {
                        console.error('Failed to load behavior logs for student:', err);
                        setStudentLogs([]);
                    })
                    .finally(() => setLogsLoading(false));
            } else {
                setStudentLogs([]);
            }
        } else {
            setStudentLogs([]);
        }
    }, [viewingStudentResult]);

    const loadAssessmentsAndResults = async () => {
        setLoading(true);
        try {
            const res = await getCadAssessments();
            const asmList = res.data || [];
            setAssessments(asmList);
            const targetId = initialAssessmentId || selectedAssessmentId || 'ALL';
            await loadResults(targetId, asmList);
        } catch (err) {
            flash?.('Failed to load AutoCAD assessments', true);
        } finally {
            setLoading(false);
        }
    };

    const loadResults = async (asmId, asmList = assessments) => {
        setLoading(true);
        try {
            const res = await getCadSubmissionsForAdmin(asmId);
            const data = res.data || [];
            const mapped = data.map(item => {
                const asmObj = (item.assessment && typeof item.assessment === 'object' && item.assessment.title)
                    ? item.assessment
                    : (asmList.find(a => String(a._id) === String(asmId) || String(a._id) === String(item.assessment?._id || item.assessment)) || { title: 'AutoCAD Assessment' });
                return { ...item, assessment: asmObj };
            });
            setCadResults(mapped);
        } catch (err) {
            flash?.('Failed to load CAD assessment results', true);
        } finally {
            setLoading(false);
        }
    };

    const filteredResults = cadResults.filter(item => {
        const st = item.student || {};
        const asm = item.assessment || {};
        const qStr = searchQuery.toLowerCase();

        const matchesSearch = !searchQuery ||
            (st.name || '').toLowerCase().includes(qStr) ||
            (st.email || '').toLowerCase().includes(qStr) ||
            (st.rollno || '').toLowerCase().includes(qStr) ||
            (asm.title || '').toLowerCase().includes(qStr);

        const matchesDept = deptFilter === 'ALL' || (st.department || '').toUpperCase().includes(deptFilter.toUpperCase());
        const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

        return matchesSearch && matchesDept && matchesStatus;
    });

    const totalSubmissions = cadResults.length;
    const completedSubmissions = cadResults.filter(r => r.status === 'submitted').length;
    const draftSubmissions = cadResults.filter(r => r.status !== 'submitted').length;

    // Proctoring Evidence computations for open student modal
    const snapshotLogs = studentLogs.filter(l => l.snapshot);
    const anomalyLogs = studentLogs.filter(l => (l.events && l.events.length > 0) || l.riskScore > 30 || l.snapshot);
    const maxRiskScore = studentLogs.reduce((max, l) => Math.max(max, l.riskScore || 0), 0);
    const totalTabSwitches = studentLogs.reduce((max, l) => Math.max(max, l.tabSwitches || 0, l.fullscreenExits || 0), 0);

    const formatEventLabel = (evt) => {
        switch (evt) {
            case 'head_turn': return '👤 Head Movement / Rotation';
            case 'gaze_away': return '👁️ Eye Deviation / Gazed Away';
            case 'face_missing': return '🚫 Face Connection Lost';
            case 'multiple_faces': return '👥 Proxy / Multiple Faces';
            case 'phone_detected': return '📱 Prohibited Device Detected';
            case 'speech_detected': return '🎙️ Human Speech Activity';
            case 'fullscreen_exit': return '🖥️ Exited Fullscreen / Tab Switch';
            default: return evt || 'Behavior Anomaly';
        }
    };

    const getHumanMetricsText = (log) => {
        const details = [];
        if (log.headMovement > 15) details.push(`Head turned by ${Math.round(log.headMovement)}°`);
        if (log.eyeDeviation > 25) details.push(`Gazed away at ${Math.round(log.eyeDeviation)}°`);
        if (log.tabSwitches > 0) details.push(`Tab switches: ${log.tabSwitches}`);
        if (log.fullscreenExits > 0) details.push(`Fullscreen exits: ${log.fullscreenExits}`);
        return details.join(' • ');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'Outfit, sans-serif' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h2 className="ad-page-title" style={{ margin: 0 }}>
                        📈 AutoCAD Assessment Results
                    </h2>
                    <p style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>
                        Student 2D CAD vector drawings, geometric telemetry, and webcam photo proof proctoring logs.
                    </p>
                </div>

                <button className="ad-btn ad-btn-primary" onClick={() => loadResults(selectedAssessmentId)}>
                    🔄 Refresh Results
                </button>
            </div>

            {/* Metric Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div className="ad-card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>Total Submissions</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: t.text, marginTop: 6 }}>{totalSubmissions}</div>
                </div>
                <div className="ad-card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>Completed Submissions</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', marginTop: 6 }}>{completedSubmissions}</div>
                </div>
                <div className="ad-card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>Draft / In-Progress</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', marginTop: 6 }}>{draftSubmissions}</div>
                </div>
                <div className="ad-card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>Active CAD Modules</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: t.accent, marginTop: 6 }}>{assessments.length}</div>
                </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="ad-card" style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    type="text"
                    className="ad-input"
                    placeholder="Search student name, email, roll no, assessment..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>Assessment:</span>
                    <select className="ad-select" value={selectedAssessmentId} onChange={e => setSelectedAssessmentId(e.target.value)} style={{ minWidth: 160 }}>
                        <option value="ALL">All Assessments</option>
                        {assessments.map(asm => (
                            <option key={asm._id} value={asm._id}>{asm.title}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>Dept:</span>
                    <select className="ad-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: 110 }}>
                        <option value="ALL">All Depts</option>
                        <option value="CIVIL">CIVIL</option>
                        <option value="ECE">ECE</option>
                        <option value="EEE">EEE</option>
                        <option value="CSE">CSE</option>
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>Status:</span>
                    <select className="ad-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 120 }}>
                        <option value="ALL">All Status</option>
                        <option value="submitted">Submitted</option>
                        <option value="draft">Draft</option>
                    </select>
                </div>
            </div>

            {/* Results Data Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading AutoCAD assessment results...</div>
            ) : filteredResults.length === 0 ? (
                <div className="ad-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>No AutoCAD Results Found</h3>
                    <p style={{ color: t.textMuted, fontSize: 14, maxWidth: 480, margin: '8px auto 0' }}>
                        No student CAD submissions match the selected filters.
                    </p>
                </div>
            ) : (
                <div className="ad-card" style={{ overflowX: 'auto', padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: t.surfaceAlt, borderBottom: `1px solid ${t.border}`, color: t.textSub }}>
                                <th style={{ padding: '12px 16px' }}>Student Name</th>
                                <th style={{ padding: '12px 16px' }}>Email / Roll No</th>
                                <th style={{ padding: '12px 16px' }}>Department</th>
                                <th style={{ padding: '12px 16px' }}>Assessment Title</th>
                                <th style={{ padding: '12px 16px' }}>Status</th>
                                <th style={{ padding: '12px 16px' }}>Submitted Date</th>
                                <th style={{ padding: '12px 16px' }}>Drawings</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResults.map(res => {
                                const st = res.student || {};
                                const asm = res.assessment || {};
                                const isSubmitted = res.status === 'submitted';
                                const totalObjs = res.drawings?.reduce((sum, d) => sum + (d.drawing_data?.objects?.length || 0), 0) || 0;

                                return (
                                    <tr key={res._id || Math.random()} style={{ borderBottom: `1px solid ${t.border}` }}>
                                        <td style={{ padding: '14px 16px', fontWeight: 700, color: t.text }}>
                                            {st.name || 'Unknown Student'}
                                        </td>
                                        <td style={{ padding: '14px 16px', color: t.textMuted }}>
                                            <div>{st.email || '-'}</div>
                                            {st.rollno && <div style={{ fontSize: 11, color: t.accent }}>ID: {st.rollno}</div>}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span className="ad-badge" style={{ fontSize: 11 }}>{st.department || 'General'}</span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                                            <div>📐 {asm.title || 'AutoCAD Assessment'}</div>
                                            <div style={{ fontSize: 11, color: t.textMuted }}>{asm.cad_level || 'Level 1'}</div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span className="ad-badge" style={{
                                                background: isSubmitted ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                                color: isSubmitted ? '#10b981' : '#f59e0b',
                                                border: `1px solid ${isSubmitted ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                                            }}>
                                                {isSubmitted ? '✓ Submitted' : 'Draft / In-Progress'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', color: t.textMuted }}>
                                            {res.submitted_at ? new Date(res.submitted_at).toLocaleString() : new Date(res.updatedAt).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span className="ad-badge" style={{ background: t.surfaceAlt }}>
                                                {res.drawings?.length || 0} Questions ({totalObjs} shapes)
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                <button
                                                    className="ad-btn ad-btn-primary ad-btn-sm"
                                                    onClick={() => setActivityReviewItem(res)}
                                                    style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', color: '#000', fontWeight: 800 }}
                                                    title="View chronological CAD activity events, timestamps, and final drawing review"
                                                >
                                                    📜 Activity History & CAD Review
                                                </button>

                                                <button
                                                    className="ad-btn ad-btn-secondary ad-btn-sm"
                                                    onClick={() => {
                                                        setViewingStudentResult(res);
                                                        setModalTab('drawings');
                                                    }}
                                                >
                                                    📐 View Drawings
                                                </button>

                                                <button
                                                    className="ad-btn ad-btn-secondary ad-btn-sm"
                                                    onClick={() => {
                                                        setViewingStudentResult(res);
                                                        setModalTab('proctoring');
                                                    }}
                                                    title="View Webcam Anomaly Photos & Evidence"
                                                >
                                                    📸 Photo Evidence
                                                </button>

                                                {openTimeline && st._id && asm._id && (
                                                    <button
                                                        className="ad-btn ad-btn-ghost ad-btn-sm"
                                                        onClick={() => openTimeline(st._id, asm._id, st.name)}
                                                    >
                                                        🧠 Timeline
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* VIEW STUDENT CAD DRAWING & PROCTORING EVIDENCE MODAL */}
            {viewingStudentResult && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div className="ad-card" style={{ width: '100%', maxWidth: 960, background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${t.border}`, paddingBottom: 14, marginBottom: 16 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>
                                    Student Submission: {viewingStudentResult.student?.name || 'Student'}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textMuted }}>
                                    Assessment: {viewingStudentResult.assessment?.title} • Email: {viewingStudentResult.student?.email} • Dept: {viewingStudentResult.student?.department || 'General'}
                                </p>
                            </div>
                            <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setViewingStudentResult(null)}>✕ Close</button>
                        </div>

                        {/* Modal Navigation Tabs */}
                        <div style={{ display: 'flex', gap: 10, borderBottom: `1px solid ${t.border}`, paddingBottom: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    className={`ad-btn ${modalTab === 'drawings' ? 'ad-btn-primary' : 'ad-btn-ghost'} ad-btn-sm`}
                                    onClick={() => setModalTab('drawings')}
                                >
                                    📐 2D CAD Drawings ({viewingStudentResult.drawings?.length || 0})
                                </button>

                                <button
                                    className={`ad-btn ${modalTab === 'proctoring' ? 'ad-btn-primary' : 'ad-btn-ghost'} ad-btn-sm`}
                                    onClick={() => setModalTab('proctoring')}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    📸 Visual Proctoring & Photo Evidence
                                    {snapshotLogs.length > 0 && (
                                        <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 10 }}>
                                            {snapshotLogs.length} Photos
                                        </span>
                                    )}
                                </button>
                            </div>

                            <button
                                className="ad-btn ad-btn-primary ad-btn-sm"
                                onClick={() => setActivityReviewItem(viewingStudentResult)}
                                style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', color: '#000', fontWeight: 800 }}
                            >
                                📜 Open Interactive Activity Review Screen
                            </button>
                        </div>

                        {/* ── TAB 1: 2D CAD VECTOR DRAWINGS ────────────────────── */}
                        {modalTab === 'drawings' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {viewingStudentResult.drawings?.map((dr, idx) => {
                                    const q = dr.question || {};
                                    const objs = dr.drawing_data?.objects || [];
                                    const lineCount = objs.filter(o => (o.type || '').toUpperCase() === 'LINE').length;
                                    const circleCount = objs.filter(o => (o.type || '').toUpperCase() === 'CIRCLE').length;
                                    const rectCount = objs.filter(o => (o.type || '').toUpperCase() === 'RECTANGLE').length;
                                    const polyCount = objs.filter(o => (o.type || '').toUpperCase() === 'POLYLINE').length;
                                    const arcCount = objs.filter(o => (o.type || '').toUpperCase() === 'ARC').length;

                                    // Compute Bounding Box for Auto-Centering SVG ViewBox
                                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                                    const includePt = (x, y) => {
                                        if (typeof x === 'number' && !isNaN(x)) {
                                            if (x < minX) minX = x;
                                            if (x > maxX) maxX = x;
                                        }
                                        if (typeof y === 'number' && !isNaN(y)) {
                                            if (y < minY) minY = y;
                                            if (y > maxY) maxY = y;
                                        }
                                    };

                                    objs.forEach(obj => {
                                        const type = (obj.type || '').toUpperCase();
                                        if (type === 'LINE') {
                                            includePt(obj.start?.x ?? obj.x1 ?? 0, obj.start?.y ?? obj.y1 ?? 0);
                                            includePt(obj.end?.x ?? obj.x2 ?? 0, obj.end?.y ?? obj.y2 ?? 0);
                                        } else if (type === 'CIRCLE') {
                                            const cx = obj.center?.x ?? obj.cx ?? 0;
                                            const cy = obj.center?.y ?? obj.cy ?? 0;
                                            const r = obj.radius ?? obj.r ?? 0;
                                            includePt(cx - r, cy - r);
                                            includePt(cx + r, cy + r);
                                        } else if (type === 'RECTANGLE') {
                                            const x = obj.x ?? 0;
                                            const y = obj.y ?? 0;
                                            const w = obj.width ?? 0;
                                            const h = obj.height ?? 0;
                                            includePt(x, y);
                                            includePt(x + w, y + h);
                                        } else if (type === 'POLYLINE') {
                                            (obj.points || []).forEach(p => includePt(p.x, p.y));
                                        } else if (type === 'ARC') {
                                            const cx = obj.center?.x ?? obj.cx ?? 0;
                                            const cy = obj.center?.y ?? obj.cy ?? 0;
                                            const r = obj.radius ?? obj.r ?? 0;
                                            includePt(cx - r, cy - r);
                                            includePt(cx + r, cy + r);
                                        }
                                    });

                                    if (minX === Infinity || maxX === -Infinity) {
                                        minX = -100; maxX = 100; minY = -100; maxY = 100;
                                    }

                                    const rawW = Math.max(maxX - minX, 30);
                                    const rawH = Math.max(maxY - minY, 30);
                                    const margin = Math.max(rawW, rawH) * 0.2;

                                    const vbX = minX - margin;
                                    const vbY = minY - margin;
                                    const vbW = rawW + (margin * 2);
                                    const vbH = rawH + (margin * 2);
                                    const strokeWidth = Math.max((vbW / 450) * 2, 1.5);

                                    return (
                                        <div key={dr._id || idx} style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 16, background: t.surfaceAlt }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <div style={{ fontWeight: 800, fontSize: 14, color: t.accent }}>
                                                    Question {idx + 1}: {q.question_text || 'CAD Drawing Prompt'}
                                                </div>
                                                <span className="ad-badge" style={{ background: t.surface }}>
                                                    {q.marks || 10} Marks
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12, color: t.textMuted, flexWrap: 'wrap' }}>
                                                <span>📐 Total Primitives: <strong>{objs.length}</strong></span>
                                                <span>| Lines: <strong>{lineCount}</strong></span>
                                                <span>| Circles: <strong>{circleCount}</strong></span>
                                                <span>| Rectangles: <strong>{rectCount}</strong></span>
                                                <span>| Polylines: <strong>{polyCount}</strong></span>
                                                <span>| Arcs: <strong>{arcCount}</strong></span>
                                            </div>

                                            {/* Vector Canvas Render */}
                                            {objs.length === 0 ? (
                                                <div style={{ color: t.textMuted, padding: 24, textAlign: 'center', background: t.surface, borderRadius: 8 }}>
                                                    No 2D vector elements drawn for this question.
                                                </div>
                                            ) : (
                                                <div style={{ position: 'relative', width: '100%', borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.border}`, background: '#09090d' }}>
                                                    <div style={{ position: 'absolute', top: 6, right: 10, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 4, color: '#38bdf8', fontSize: 10, fontWeight: 700, zIndex: 10 }}>
                                                        Auto-Centered Vector View ({objs.length} shapes)
                                                    </div>

                                                    <svg
                                                        style={{ width: '100%', height: 320, display: 'block' }}
                                                        viewBox={`${vbX} ${- (vbY + vbH)} ${vbW} ${vbH}`}
                                                    >
                                                        <defs>
                                                            <pattern id={`adminCadGrid_${idx}`} width={vbW / 20} height={vbH / 20} patternUnits="userSpaceOnUse">
                                                                <path d={`M ${vbW / 20} 0 L 0 0 0 ${vbH / 20}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth * 0.3} />
                                                            </pattern>
                                                        </defs>
                                                        <rect x={vbX} y={- (vbY + vbH)} width={vbW} height={vbH} fill={`url(#adminCadGrid_${idx})`} />

                                                        {/* X and Y Axes */}
                                                        <line x1={vbX} y1={0} x2={vbX + vbW} y2={0} stroke="rgba(239, 68, 68, 0.4)" strokeWidth={strokeWidth} strokeDasharray={`${strokeWidth*2} ${strokeWidth}`} />
                                                        <line x1={0} y1={- (vbY + vbH)} x2={0} y2={- vbY} stroke="rgba(34, 197, 94, 0.4)" strokeWidth={strokeWidth} strokeDasharray={`${strokeWidth*2} ${strokeWidth}`} />

                                                        {/* Render Primitives with inverted Y for SVG coordinate system */}
                                                        <g transform="scale(1, -1)">
                                                            {objs.map((obj, i) => {
                                                                const type = (obj.type || '').toUpperCase();
                                                                const color = obj.color || '#38bdf8';
                                                                const w = strokeWidth * (obj.lineWidth || 1.5);

                                                                if (type === 'LINE') {
                                                                    const x1 = obj.start?.x ?? obj.x1 ?? 0;
                                                                    const y1 = obj.start?.y ?? obj.y1 ?? 0;
                                                                    const x2 = obj.end?.x ?? obj.x2 ?? 0;
                                                                    const y2 = obj.end?.y ?? obj.y2 ?? 0;
                                                                    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />;
                                                                }
                                                                if (type === 'CIRCLE') {
                                                                    const cx = obj.center?.x ?? obj.cx ?? 0;
                                                                    const cy = obj.center?.y ?? obj.cy ?? 0;
                                                                    const r = obj.radius ?? obj.r ?? 0;
                                                                    return <circle key={i} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={w} fill="none" />;
                                                                }
                                                                if (type === 'RECTANGLE') {
                                                                    const x = obj.x ?? 0;
                                                                    const y = obj.y ?? 0;
                                                                    const rw = obj.width ?? 0;
                                                                    const rh = obj.height ?? 0;
                                                                    return <rect key={i} x={x} y={y} width={rw} height={rh} stroke={color} strokeWidth={w} fill="none" />;
                                                                }
                                                                if (type === 'POLYLINE' && obj.points?.length > 1) {
                                                                    const pts = obj.points.map(p => `${p.x},${p.y}`).join(' ');
                                                                    return <polyline key={i} points={pts} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                                                                }
                                                                if (type === 'ARC') {
                                                                    const cx = obj.center?.x ?? obj.cx ?? 0;
                                                                    const cy = obj.center?.y ?? obj.cy ?? 0;
                                                                    const r = obj.radius ?? obj.r ?? 0;
                                                                    return <circle key={i} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={w} fill="none" strokeDasharray={`${w*2} ${w}`} />;
                                                                }
                                                                return null;
                                                            })}
                                                        </g>
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── TAB 2: VISUAL PROCTORING & PHOTO EVIDENCE GALLERY ── */}
                        {modalTab === 'proctoring' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* Proctoring Metric Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                                    <div style={{ background: t.surfaceAlt, padding: '14px 16px', borderRadius: 10, border: `1px solid ${t.border}` }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>Anomalies Flagged</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: anomalyLogs.length > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>
                                            {anomalyLogs.length} Events
                                        </div>
                                    </div>

                                    <div style={{ background: t.surfaceAlt, padding: '14px 16px', borderRadius: 10, border: `1px solid ${t.border}` }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>Maximum Risk Score</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: maxRiskScore > 70 ? '#ef4444' : maxRiskScore > 30 ? '#f59e0b' : '#10b981', marginTop: 4 }}>
                                            {Math.round(maxRiskScore)}%
                                        </div>
                                    </div>

                                    <div style={{ background: t.surfaceAlt, padding: '14px 16px', borderRadius: 10, border: `1px solid ${t.border}` }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>Photo Evidence Captured</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: t.accent, marginTop: 4 }}>
                                            📸 {snapshotLogs.length} Photos
                                        </div>
                                    </div>

                                    <div style={{ background: t.surfaceAlt, padding: '14px 16px', borderRadius: 10, border: `1px solid ${t.border}` }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase' }}>Tab Switches / Exits</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: totalTabSwitches > 0 ? '#ef4444' : t.text, marginTop: 4 }}>
                                            {totalTabSwitches} Times
                                        </div>
                                    </div>
                                </div>

                                {/* Visual Photo Proof Evidence Gallery */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text }}>
                                            📸 Visual Photo Proof & Webcam Evidence
                                        </h4>
                                        <span style={{ fontSize: 12, color: t.textMuted }}>
                                            Click any photo to enlarge high-resolution snapshot
                                        </span>
                                    </div>

                                    {logsLoading ? (
                                        <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading proctoring photos & telemetry evidence...</div>
                                    ) : snapshotLogs.length === 0 ? (
                                        <div style={{ padding: 32, textAlign: 'center', background: t.surfaceAlt, borderRadius: 12, border: `1.5px dashed ${t.border}` }}>
                                            <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
                                            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>No Photo Evidence Snapshots Captured</div>
                                            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
                                                No behavioral anomaly photo triggers were captured during this student's CAD exam session.
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                                            {snapshotLogs.map((log, i) => {
                                                const primaryEvent = log.events?.[0];
                                                const eventLabel = formatEventLabel(primaryEvent);
                                                const metricsText = getHumanMetricsText(log);
                                                const riskColor = log.riskScore > 70 ? '#ef4444' : log.riskScore > 30 ? '#f59e0b' : '#10b981';

                                                return (
                                                    <div
                                                        key={log._id || i}
                                                        style={{
                                                            background: t.surfaceAlt,
                                                            border: `1px solid ${t.border}`,
                                                            borderRadius: 12,
                                                            padding: 12,
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 10,
                                                            transition: 'transform 0.2s, boxShadow 0.2s',
                                                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                                                        }}
                                                    >
                                                        {/* Photo Thumbnail */}
                                                        <div
                                                            style={{
                                                                position: 'relative',
                                                                width: '100%',
                                                                height: 175,
                                                                borderRadius: 8,
                                                                overflow: 'hidden',
                                                                cursor: 'pointer',
                                                                border: `1px solid ${t.border}`,
                                                                background: '#000'
                                                            }}
                                                            onClick={() => setLightboxPhoto(log.snapshot)}
                                                            title="Click to open full high-resolution snapshot"
                                                        >
                                                            <img
                                                                src={log.snapshot}
                                                                alt="Webcam Anomaly Photo Evidence"
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                            <span style={{ position: 'absolute', bottom: 6, right: 8, background: 'rgba(0,0,0,0.75)', color: '#38bdf8', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>
                                                                🔍 Enlarge
                                                            </span>
                                                            <span style={{ position: 'absolute', top: 6, left: 8, background: `${riskColor}dd`, color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase' }}>
                                                                Risk: {Math.round(log.riskScore || 0)}%
                                                            </span>
                                                        </div>

                                                        {/* Event details */}
                                                        <div>
                                                            <div style={{ fontWeight: 800, fontSize: 13.5, color: t.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <span>{eventLabel}</span>
                                                            </div>

                                                            {metricsText && (
                                                                <div style={{ fontSize: 12, color: t.accent, marginTop: 4, fontWeight: 600 }}>
                                                                    {metricsText}
                                                                </div>
                                                            )}

                                                            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                                                                <span>⏱ {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                                <span>📅 {new Date(log.timestamp).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Full Interactive Timeline */}
                                <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 20, marginTop: 10 }}>
                                    <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: t.text }}>
                                        🧠 Complete Chronological Proctoring Timeline
                                    </h4>
                                    <BehaviorTimeline logs={studentLogs} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* FULL PHOTO LIGHTBOX MODAL */}
            {lightboxPhoto && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                    onClick={() => setLightboxPhoto(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <button
                            style={{ position: 'absolute', top: -14, right: -14, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}
                            onClick={() => setLightboxPhoto(null)}
                        >
                            ✕
                        </button>
                        <img
                            src={lightboxPhoto}
                            alt="High Resolution Webcam Anomaly Evidence Photo"
                            style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12, border: `2px solid ${t.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}
                        />
                    </div>
                </div>
            )}

            {/* INTERACTIVE CAD ACTIVITY HISTORY & REVIEW SCREEN */}
            {activityReviewItem && (
                <AdminCadActivityReview
                    studentData={activityReviewItem.student || {}}
                    assessmentData={activityReviewItem.assessment || {}}
                    drawings={activityReviewItem.drawings || []}
                    onClose={() => setActivityReviewItem(null)}
                    theme={t}
                />
            )}
        </div>
    );
}
