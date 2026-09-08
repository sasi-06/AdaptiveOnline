import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { User, PlayCircle, CheckCircle, Search, LayoutList, MessageSquare, FileDown } from 'lucide-react';
import BehaviorTimeline from '../components/BehaviorTimeline';
import { getInterviewBehaviorLogs } from '../services/api'; // or api.get(...) inline

export default function AdminInterviewResults({ flash }) {
    const { theme: t } = useTheme();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);

    const [showTimeline, setShowTimeline] = useState(false);
    const [timelineLogs, setTimelineLogs] = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineStudentName, setTimelineStudentName] = useState('');

    const [pdfLoadingId, setPdfLoadingId] = useState(null);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/interviews/session/all');
            setSessions(res.data || []);
        } catch (err) {
            if (flash) flash('Failed to load interview results', true);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score) => {
        if (!score) return t.textMuted;
        if (score >= 80) return '#10b981'; // Green
        if (score >= 60) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    };

    const openTimeline = async (sessionId, studentName) => {
        setTimelineStudentName(studentName);
        setShowTimeline(true);
        setTimelineLoading(true);
        try {
            const res = await getInterviewBehaviorLogs(sessionId);
            setTimelineLogs(res.data || []);
        } catch (err) {
            if (flash) flash('Failed to load behavior timeline', true);
        } finally {
            setTimelineLoading(false);
        }
    };

    // NEW: downloads a freshly generated PDF report for one interview session
    const downloadPdfReport = async (sessionId, studentName) => {
        setPdfLoadingId(sessionId);
        try {
            const res = await api.get(`/interviews/session/${sessionId}/report-pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Interview_Report_${(studentName || 'Candidate').replace(/\s+/g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            if (flash) flash('Failed to generate PDF report', true);
        } finally {
            setPdfLoadingId(null);
        }
    };

    return (
        <div>
            <div className="ad-page-title">Interview Reports</div>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: t.text }}>Completed Interviews</div>
                    <button onClick={loadSessions} className="ad-btn" style={{ background: t.surfaceAlt, color: t.text }}>Refresh</button>
                </div>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>Loading sessions...</div>
                ) : (
                    <div className="ad-table-wrap">
                        <table className="ad-table">
                            <thead>
                                <tr>
                                    <th>Candidate</th>
                                    <th>Interview Round</th>
                                    <th>Role</th>
                                    <th>Date</th>
                                    <th>Questions Asked</th>
                                    <th>Final Score</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(s => (
                                    <tr key={s._id}>
                                        <td>
                                            <div style={{ fontWeight: 600, color: t.text }}>{s.student?.name || 'Unknown'}</div>
                                            <div style={{ fontSize: '12px', color: t.textMuted }}>{s.student?.email}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{s.interview?.title || 'Unknown Round'}</div>
                                        </td>
                                        <td><span className="ad-badge ad-badge-medium">{s.selectedRole || 'General'}</span></td>
                                        <td><div style={{ fontSize: '13px', color: t.textMuted }}>{new Date(s.updatedAt).toLocaleDateString()}</div></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <MessageSquare size={16} color={t.textMuted} />
                                                <strong>{s.qa_pairs?.length || 0}</strong> / {s.totalQuestionsConfigured || '-'}
                                            </div>
                                        </td>
                                        <td>
                                            <strong style={{ fontSize: '16px', color: getScoreColor(s.finalScore) }}>
                                                {s.finalScore}/100
                                            </strong>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => setSelectedSession(s)}
                                                    className="ad-btn ad-btn-primary ad-btn-sm"
                                                >
                                                    View Report
                                                </button>
                                                <button
                                                    onClick={() => openTimeline(s._id, s.student?.name)}
                                                    className="ad-btn ad-btn-sm"
                                                    style={{ background: t.surfaceAlt, color: t.text }}
                                                >
                                                    Analyze Timeline
                                                </button>
                                                <button
                                                    onClick={() => downloadPdfReport(s._id, s.student?.name)}
                                                    disabled={pdfLoadingId === s._id}
                                                    className="ad-btn ad-btn-sm"
                                                    style={{ background: t.surfaceAlt, color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <FileDown size={14} />
                                                    {pdfLoadingId === s._id ? 'Generating...' : 'PDF Report'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sessions.length === 0 && (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: t.textMuted }}>
                                            No completed interviews found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Session Detail Modal */}
            {selectedSession && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px',
                        width: '90%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surfaceAlt }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: t.text }}>
                                {selectedSession.student?.name}'s Interview Report
                            </div>
                            <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: '24px', cursor: 'pointer' }}>×</button>
                        </div>

                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>

                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                <div style={{ background: t.surfaceAlt, padding: '16px', borderRadius: '12px', border: `1px solid ${t.border}` }}>
                                    <div style={{ fontSize: '12px', color: t.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Final Score</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(selectedSession.finalScore) }}>
                                        {selectedSession.finalScore}/100
                                    </div>
                                    <div style={{ fontSize: '13px', color: t.text, marginTop: '4px' }}>
                                        Recommendation: <strong>{selectedSession.report?.hiringRecommendation || 'N/A'}</strong>
                                    </div>
                                </div>
                                <div style={{ background: t.surfaceAlt, padding: '16px', borderRadius: '12px', border: `1px solid ${t.border}` }}>
                                    <div style={{ fontSize: '12px', color: t.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Strengths</div>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: t.text }}>
                                        {selectedSession.report?.strengths?.map((s,i) => <li key={i}>{s}</li>) || <li>None noted</li>}
                                    </ul>
                                </div>
                                <div style={{ background: t.surfaceAlt, padding: '16px', borderRadius: '12px', border: `1px solid ${t.border}` }}>
                                    <div style={{ fontSize: '12px', color: t.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Weaknesses</div>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: t.text }}>
                                        {selectedSession.report?.weaknesses?.map((w,i) => <li key={i}>{w}</li>) || <li>None noted</li>}
                                    </ul>
                                </div>
                                <div style={{ background: t.surfaceAlt, padding: '16px', borderRadius: '12px', border: `1px solid ${t.border}` }}>
                                    <div style={{ fontSize: '12px', color: '#ef4444', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>Malpractice / Anomalies</div>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: t.text }}>
                                        {selectedSession.cheatingClips && selectedSession.cheatingClips.length > 0
                                            ? selectedSession.cheatingClips.map((c,i) => (
                                                <li key={i}>
                                                    <span style={{ color: '#ef4444', fontWeight: 500 }}>{c.reason}</span>
                                                    <div style={{ fontSize: '11px', color: t.textMuted }}>{new Date(c.timestamp).toLocaleTimeString()}</div>
                                                </li>
                                            ))
                                            : <li>No anomalies detected</li>}
                                    </ul>
                                </div>
                            </div>

                            {/* Q&A Matrix */}
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: t.text, marginBottom: '16px' }}>Detailed Q&A Mapping</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {selectedSession.qa_pairs?.map((qa, idx) => (
                                        <div key={idx} style={{ background: t.surfaceAlt, borderRadius: '12px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                                            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontSize: '12px', color: t.accent, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Question {idx + 1}</span>
                                                    <div style={{ fontSize: '15px', color: t.text, fontWeight: '500', marginTop: '6px' }}>{qa.question}</div>
                                                </div>
                                                <div style={{ background: t.surface, padding: '6px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '10px', color: t.textMuted, textTransform: 'uppercase' }}>Relevance</span>
                                                    <strong style={{ color: getScoreColor(qa.score), fontSize: '16px' }}>{qa.score}/100</strong>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: t.border }}>
                                                <div style={{ padding: '16px', background: t.surfaceAlt }}>
                                                    <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <CheckCircle size={14} /> Expected Answer (AI)
                                                    </div>
                                                    <div style={{ fontSize: '14px', color: t.textMuted, lineHeight: '1.5' }}>
                                                        {qa.expectedAnswer || 'No expected answer generated.'}
                                                    </div>
                                                </div>
                                                <div style={{ padding: '16px', background: t.surfaceAlt }}>
                                                    <div style={{ fontSize: '12px', color: t.accent, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <User size={14} /> Student's Transcript
                                                    </div>
                                                    <div style={{ fontSize: '14px', color: t.text, lineHeight: '1.5' }}>
                                                        {qa.answer || <span style={{ fontStyle: 'italic', color: t.textMuted }}>No answer provided.</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            {qa.feedback && (
                                                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.01)', borderTop: `1px solid ${t.border}`, fontSize: '13px', color: t.textSub }}>
                                                    <strong>Feedback:</strong> {qa.feedback}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {(!selectedSession.qa_pairs || selectedSession.qa_pairs.length === 0) && (
                                        <div style={{ padding: '20px', textAlign: 'center', color: t.textMuted, background: t.surfaceAlt, borderRadius: '8px' }}>
                                            No Q&A data available for this session.
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Behavior Timeline Modal — sibling of the Session Detail Modal, so it works
                whether or not "View Report" was ever opened for this session */}
            {showTimeline && (
                <div
                    onClick={() => setShowTimeline(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 100000, padding: '24px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: t.surface, border: `1px solid ${t.border}`,
                            borderRadius: '20px', width: '100%', maxWidth: '760px',
                            maxHeight: '85vh', overflowY: 'auto', padding: '28px',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: t.text }}>
                                    🧠 Behavior Timeline: {timelineStudentName}
                                </div>
                                <div style={{ fontSize: '13px', color: t.textMuted }}>
                                    Chronological evidence from the AI interview session.
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTimeline(false)}
                                className="ad-btn ad-btn-ghost ad-btn-sm"
                            >
                                ✕
                            </button>
                        </div>

                        {timelineLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: t.textMuted }}>
                                Fetching evidence logs...
                            </div>
                        ) : (
                            <BehaviorTimeline logs={timelineLogs} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}