import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getStudentExams,
    getStudentResults,      // GET /api/results/student/:studentId
    getStudentBehaviorLogs, // GET /api/behavior/student/:studentId
    getStudentProfile,      // GET /api/students/:studentId
    getResult,              // GET /api/results/:studentId/:examId
    getStudentInterviews,   // GET /api/interviews/student/:studentId
    getCircuitQuestionsByExam,
    getStudentCadAssessments
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import StudentCodingResults from '../components/StudentCodingResults';

const SECTIONS = ['Overview', 'My Exams', 'Coding Round', 'Coding Results', 'AutoCAD Assessments', 'Technical Interview', 'My Results', 'Profile'];
const SECTION_ICONS = {
    Overview:       '',
    'My Exams':     '',
    'Coding Round': '',
    'Coding Results': '',
    'Technical Interview': '',
    'My Results':   '',
    Profile:        '',
};

// Sub-component for Answer Review Modal
const ReviewModal = ({ data, onClose, t }) => {
    if (!data) return null;

    const riskBadge = (rawScore) => {
        const pct = (rawScore ?? 0) <= 1 ? (rawScore ?? 0) * 100 : (rawScore ?? 0);
        if (pct >= 60) return <span className="sd-badge sd-badge-high">{pct.toFixed(0)}%</span>;
        if (pct >= 30) return <span className="sd-badge sd-badge-med">{pct.toFixed(0)}%</span>;
        return <span className="sd-badge sd-badge-low">{pct.toFixed(0)}%</span>;
    };

    return (
        <div className="sd-modal-overlay" onClick={onClose}>
            <div className="sd-modal-content" onClick={e => e.stopPropagation()}>
                <div className="sd-modal-header">
                    <div className="sd-modal-title">Review Answers: {data.exam_id?.title}</div>
                    <button className="sd-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="sd-modal-body">
                    <div className="sd-review-summary">
                        <div className="sd-review-stat">
                            <span>Score:</span> <strong>{data.score}/{data.total_marks}</strong>
                        </div>
                    </div>
                    <div className="sd-review-questions">
                        {data.answers && data.answers.map((ans, i) => {
                            const q = ans.question_id || {};
                            const isCorrect = ans.is_correct;
                            const optionsList = q.options || [];

                            return (
                                <div key={i} className={`sd-review-qcard ${isCorrect ? 'correct' : 'incorrect'}`}>
                                    <div className="sd-review-qtext">
                                        <strong>Q{i + 1}:</strong> {q.question_text || 'Question text not available'}
                                        <span className={`sd-review-mark ${isCorrect ? 'correct-text' : 'incorrect-text'}`}>
                                            [{ans.marks_awarded} / {q.marks || 0} Marks]
                                        </span>
                                    </div>
                                    
                                    <div className="sd-review-options">
                                        {optionsList.map((opt, optIdx) => {
                                            const isSelected = String(ans.selected_option).trim().toLowerCase() === String(opt).trim().toLowerCase();
                                            const isOptionCorrect = String(q.correct_answer).trim().toLowerCase() === String(opt).trim().toLowerCase() ||
                                                String(q.correct_answer).trim().toLowerCase() === ['a','b','c','d','e','f'][optIdx] || 
                                                String(q.correct_answer).trim() === String(optIdx + 1);
                                            
                                            let optClass = "sd-review-opt ";
                                            if (isSelected && isOptionCorrect) optClass += "opt-correct";
                                            else if (isSelected && !isOptionCorrect) optClass += "opt-wrong";
                                            else if (!isSelected && isOptionCorrect) optClass += "opt-correct-missed";

                                            return (
                                                <div key={optIdx} className={optClass}>
                                                    <span className="sd-opt-letter">{['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || optIdx + 1}</span>
                                                    <span className="sd-opt-text">{opt}</span>
                                                    {isSelected && <span className="sd-opt-tag">Your Answer</span>}
                                                    {isOptionCorrect && <span className="sd-opt-tag correct">Correct</span>}
                                                </div>
                                            );
                                        })}

                                        {!optionsList.length && (
                                            <div style={{ marginTop: 8, fontSize: 13, color: t.textSub }}>
                                                <p><strong>Your Answer:</strong> {ans.selected_option || 'None'}</p>
                                                <p><strong>Correct Answer:</strong> {q.correct_answer}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function StudentDashboard() {
    const navigate     = useNavigate();
    const { theme: t } = useTheme();

    const studentId    = localStorage.getItem('studentId') || localStorage.getItem('userId') || '';
    const studentName  = localStorage.getItem('name')  || 'Student';
    const studentEmail = localStorage.getItem('email') || '';

    const [section, setSection] = useState('Overview');
    const [exams,   setExams]   = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [cadAssessments, setCadAssessments] = useState([]);
    const [activeCadModal, setActiveCadModal] = useState(null);
    const [results, setResults] = useState([]);
    const [logs,    setLogs]    = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    const [reviewData, setReviewData] = useState(null);
    const [reviewLoading, setReviewLoading] = useState(false);

    // ─── Check if exam already submitted (results + localStorage fallback) ───
    const isExamDone = (exam) => {
        if (results.some(r =>
            r.exam_id?._id === exam._id || r.exam_id === exam._id
        )) return true;
        if (exam.submitted === true) return true;
        if (localStorage.getItem(`exam_submitted_${studentId}_${exam._id}`) === 'true') return true;
        return false;
    };

    const isCadDone = (asm) => {
        if (!asm) return false;
        if (asm.isSubmitted) return true;
        if (localStorage.getItem(`exam_submitted_${studentId}_${asm._id}`) === 'true') return true;
        return false;
    };

    const isInterviewCompleted = (interview) => {
        if (interview.completed) return true;
        if (interview.type === 'Manual' && interview.date && interview.time) {
            const interviewDateTime = new Date(`${interview.date}T${interview.time}`);
            const expirationTime = new Date(interviewDateTime.getTime() + 30 * 60000); // +30 minutes
            if (new Date() > expirationTime) {
                return true;
            }
        }
        return false;
    };

    useEffect(() => {
        if (!studentId) { setLoading(false); setError('Student ID not found. Please log in again.'); return; }
        loadAll();
    }, [studentId]);

    const loadAll = async () => {
        setLoading(true);
        setError('');
        try {
            // All calls are student-scoped — no admin access needed
            const [examRes, resultRes, profileRes, interviewRes, cadRes] = await Promise.allSettled([
                getStudentExams(studentId),
                getStudentResults(studentId),
                getStudentProfile(studentId),
                getStudentInterviews(studentId),
                getStudentCadAssessments(studentId)
            ]);

            // Exams — required, so surface the error
            if (examRes.status === 'fulfilled') {
                setExams(examRes.value.data || []);
            } else {
                setError('Failed to load your exams. Please try again.');
            }

            // Results — non-critical, default to []
            if (resultRes.status === 'fulfilled') {
                setResults(resultRes.value.data || []);
            }

            // Profile — non-critical, fallback to localStorage values
            if (profileRes.status === 'fulfilled') {
                setProfile(profileRes.value.data || null);
            }

            if (interviewRes.status === 'fulfilled') {
                setInterviews(interviewRes.value.data || []);
            }

            if (cadRes.status === 'fulfilled') {
                setCadAssessments(cadRes.value.data || []);
            }

        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => { localStorage.clear(); navigate('/'); };

    const handleStartExam = async (exam) => {
        if (isExamDone(exam)) {
            alert('You have already submitted this exam. Each exam can only be taken once.');
            return;
        }

        // Check if this is a Circuit Design exam
        if (exam.rounds?.simulation || exam.title?.startsWith('Circuit Test')) {
            try {
                const cRes = await getCircuitQuestionsByExam(exam._id);
                const circuitQs = cRes.data || [];
                if (circuitQs.length > 0) {
                    navigate(`/circuit/${exam._id}/${circuitQs[0]._id}`);
                    return;
                }
            } catch (err) {
                console.warn('Error checking circuit questions:', err);
            }
        }

        navigate(`/exam/${exam._id}`);
    };

    const handleRoundClick = (rp) => {
        const isMCQ = rp.round_name.toLowerCase().includes('mcq');
        if (isMCQ) {
            if (rp.status === 'Completed' || rp.status === 'Cleared' || rp.status === 'Failed') {
                alert('You have already completed the MCQ Test.');
                return;
            }
            if (exams.length > 0) {
                const pendingExam = exams.find(e => !isExamDone(e));
                if (pendingExam) {
                    handleStartExam(pendingExam);
                } else {
                    alert('No MCQ exam is currently assigned or active.');
                }
            } else {
                alert('No MCQ exam is currently assigned.');
            }
        } else {
            alert(`The ${rp.round_name} round is monitored manually. Please complete your MCQ Test. Further updates will be reflected here by the coordinator.`);
        }
    };

    const handleReview = async (examId) => {
        setReviewLoading(true);
        try {
            const res = await getResult(studentId, examId);
            setReviewData(res.data);
        } catch (err) {
            console.error('Review fetch error:', err);
            alert('Failed to load review data. Please try again.');
        } finally {
            setReviewLoading(false);
        }
    };

    // ─── Derived stats ───
    const completedExams = exams.filter(ex => isExamDone(ex));
    const pendingExams   = exams.filter(ex => !isExamDone(ex));

    const totalScore = results.reduce((a, r) => a + (r.score      || 0), 0);
    const totalMarks = results.reduce((a, r) => a + (r.total_marks || 0), 0);
    const avgPct     = totalMarks ? ((totalScore / totalMarks) * 100).toFixed(1) : '—';


    // ─── Sub-components ───
    const riskBadge = (rawScore) => {
        const pct = (rawScore ?? 0) <= 1 ? (rawScore ?? 0) * 100 : (rawScore ?? 0);
        if (pct >= 60) return <span className="sd-badge sd-badge-high">{pct.toFixed(0)}%</span>;
        if (pct >= 30) return <span className="sd-badge sd-badge-med">{pct.toFixed(0)}%</span>;
        return <span className="sd-badge sd-badge-low">{pct.toFixed(0)}%</span>;
    };

    const ScoreBar = ({ score, total }) => {
        const pct   = total ? Math.round((score / total) * 100) : 0;
        const color = pct >= 70 ? '#059669' : pct >= 40 ? '#ca8a04' : '#ef4444';
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <strong>{score}/{total}</strong>
                <span className="sd-bar-wrap">
                    <span className="sd-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </span>
                <span style={{ fontSize: 12, color: t.textMuted }}>{pct}%</span>
            </span>
        );
    };

    const ProfileRow = ({ label, value }) => (
        <div className="sd-profile-row">
            <span className="sd-profile-label">{label}</span>
            <span className="sd-profile-value">{value || '—'}</span>
        </div>
    );

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .sd-root { display: flex; min-height: 100vh; background: ${t.bg}; color: ${t.text}; font-family: 'Outfit', sans-serif; transition: background 0.4s ease, color 0.4s ease; }
        .sd-sidebar { width: 220px; flex-shrink: 0; background: ${t.surface}; border-right: 1px solid ${t.border}; display: flex; flex-direction: column; padding: 24px 12px; position: sticky; top: 0; height: 100vh; }
        .sd-logo { font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: ${t.text}; padding: 0 12px; margin-bottom: 28px; }
        .sd-logo span { background: ${t.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .sd-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: none; background: transparent; color: ${t.textMuted}; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.18s ease; text-align: left; width: 100%; margin-bottom: 2px; }
        .sd-nav-item:hover  { background: ${t.surfaceAlt}; color: ${t.text}; }
        .sd-nav-item.active { background: ${t.tabActiveBg}; color: ${t.accent}; font-weight: 600; }
        .sd-nav-spacer { flex: 1; }
        .sd-logout { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: none; background: transparent; color: ${t.textMuted}; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.18s ease; width: 100%; }
        .sd-logout:hover { background: ${t.errorBg}; color: ${t.errorText}; }
        .sd-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .sd-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: ${t.surface}; border-bottom: 1px solid ${t.border}; position: sticky; top: 0; z-index: 30; }
        .sd-topbar-title { font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 700; color: ${t.text}; }
        .sd-topbar-user { display: flex; align-items: center; gap: 8px; padding: 5px 14px; background: ${t.surfaceAlt}; border: 1px solid ${t.border}; border-radius: 100px; font-size: 13px; color: ${t.textMuted}; }
        .sd-user-dot { width: 7px; height: 7px; border-radius: 50%; background: ${t.accent}; box-shadow: 0 0 6px ${t.accentGlow}; }
        .sd-content { padding: 32px; flex: 1; }
        .sd-flash { display: flex; align-items: center; gap: 10px; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13.5px; font-weight: 500; }
        .sd-flash.error { background: ${t.errorBg}; border: 1px solid ${t.errorBorder}55; color: ${t.errorText}; }
        .sd-page-title { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: ${t.text}; margin-bottom: 28px; }
        .sd-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px,1fr)); gap: 16px; margin-bottom: 32px; }
        .sd-stat { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 20px 22px; transition: all 0.22s ease; }
        .sd-stat:hover { border-color: ${t.accent}; box-shadow: 0 4px 20px ${t.accentGlow}; transform: translateY(-2px); }
        .sd-stat-val { font-family: 'Outfit', sans-serif; font-size: 30px; font-weight: 800; background: ${t.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.1; }
        .sd-stat-lbl { font-size: 12px; color: ${t.textSub}; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 6px; }
        .sd-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 24px; margin-bottom: 20px; }
        .sd-card-title { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; color: ${t.text}; margin-bottom: 16px; }
        .sd-exam-list { display: flex; flex-direction: column; gap: 14px; }
        .sd-exam-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; transition: all 0.25s ease; }
        .sd-exam-card:hover { border-color: ${t.accent}; box-shadow: 0 4px 24px ${t.accentGlow}; transform: translateY(-2px); }
        .sd-exam-card.done { opacity: 0.65; border-style: dashed; }
        .sd-exam-title { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; color: ${t.text}; margin-bottom: 10px; }
        .sd-exam-meta { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .sd-meta-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; background: ${t.surfaceAlt}; border: 1px solid ${t.border}; border-radius: 100px; font-size: 12px; color: ${t.textMuted}; }
        .sd-table-wrap { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; overflow: hidden; overflow-x: auto; }
        .sd-table { width: 100%; border-collapse: collapse; }
        .sd-table thead tr { background: ${t.surfaceAlt}; border-bottom: 1px solid ${t.border}; }
        .sd-table th { padding: 12px 16px; text-align: left; font-size: 11.5px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: ${t.textSub}; white-space: nowrap; }
        .sd-table td { padding: 13px 16px; font-size: 13.5px; color: ${t.text}; border-bottom: 1px solid ${t.border}66; }
        .sd-table tbody tr:last-child td { border-bottom: none; }
        .sd-table tbody tr:hover { background: ${t.surfaceAlt}; }
        .sd-cell-muted { color: ${t.textMuted}; font-size: 12.5px; }
        .sd-bar-wrap { display: inline-block; width: 80px; height: 6px; background: ${t.border}; border-radius: 100px; overflow: hidden; vertical-align: middle; }
        .sd-bar-fill { display: block; height: 100%; border-radius: 100px; transition: width 0.6s ease; }
        .sd-badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 100px; font-size: 11.5px; font-weight: 600; }
        .sd-badge-low  { background: rgba(5,150,105,0.12); color: #059669; }
        .sd-badge-med  { background: rgba(234,179,8,0.12);  color: #ca8a04; }
        .sd-badge-high { background: ${t.errorBg}; color: ${t.errorText}; }
        .sd-badge-ok   { background: ${t.tabActiveBg}; color: ${t.accent}; }
        .sd-btn-start { padding: 10px 22px; border-radius: 9px; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; background: ${t.gradient}; color: #fff; box-shadow: 0 4px 16px ${t.accentGlow}; white-space: nowrap; transition: all 0.2s ease; flex-shrink: 0; }
        .sd-btn-start:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .sd-done-btn { padding: 10px 22px; background: transparent; border: 1px solid ${t.border}; border-radius: 9px; color: ${t.textSub}; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; cursor: not-allowed; white-space: nowrap; flex-shrink: 0; opacity: 0.7; }
        .sd-profile-avatar { width: 64px; height: 64px; border-radius: 50%; background: ${t.gradient}; display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 24px; box-shadow: 0 4px 20px ${t.accentGlow}; }
        .sd-round-card { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .sd-round-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px ${t.accentGlow}; }
        .sd-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .sd-profile-row { display: flex; flex-direction: column; gap: 4px; padding: 14px 0; border-bottom: 1px solid ${t.border}55; }
        .sd-profile-row:nth-child(odd)  { padding-right: 24px; }
        .sd-profile-row:nth-child(even) { padding-left: 24px; border-left: 1px solid ${t.border}55; }
        .sd-profile-label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: ${t.textSub}; }
        .sd-profile-value { font-size: 14px; color: ${t.text}; font-weight: 500; }
        .sd-empty { background: ${t.surface}; border: 1px dashed ${t.border}; border-radius: 16px; padding: 56px 24px; text-align: center; }
        .sd-empty-icon { font-size: 40px; margin-bottom: 14px; }
        .sd-empty p { font-size: 14px; color: ${t.textMuted}; }
        .sd-loading { display: flex; align-items: center; gap: 10px; color: ${t.textMuted}; font-size: 14px; padding: 16px 0; }
        .sd-spinner { width: 18px; height: 18px; border: 2px solid ${t.border}; border-top-color: ${t.accent}; border-radius: 50%; animation: sdspin 0.7s linear infinite; }
        @keyframes sdspin { to { transform: rotate(360deg); } }
        
        /* Modal Styles */
        .sd-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s; }
        .sd-modal-content { background: ${t.surface}; width: 90%; max-width: 800px; max-height: 90vh; border-radius: 16px; border: 1px solid ${t.border}; box-shadow: 0 10px 40px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s; }
        .sd-modal-header { padding: 20px 24px; border-bottom: 1px solid ${t.border}; display: flex; justify-content: space-between; align-items: center; background: ${t.surfaceAlt}; }
        .sd-modal-title { font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; color: ${t.text}; }
        .sd-modal-close { background: none; border: none; color: ${t.textMuted}; font-size: 20px; cursor: pointer; transition: color 0.2s; }
        .sd-modal-close:hover { color: ${t.errorText}; }
        .sd-modal-body { padding: 24px; overflow-y: auto; flex: 1; }
        .sd-review-summary { display: flex; gap: 24px; margin-bottom: 24px; padding: 16px; background: ${t.surfaceAlt}; border-radius: 12px; border: 1px solid ${t.border}55; }
        .sd-review-stat { font-size: 14px; color: ${t.text}; display: flex; align-items: center; gap: 8px; }
        .sd-review-questions { display: flex; flex-direction: column; gap: 16px; }
        .sd-review-qcard { padding: 16px; border-radius: 12px; border: 1px solid ${t.border}; background: ${t.surface}; }
        .sd-review-qcard.correct { border-left: 4px solid #10b981; }
        .sd-review-qcard.incorrect { border-left: 4px solid #ef4444; }
        .sd-review-qtext { font-size: 15px; font-weight: 500; color: ${t.text}; margin-bottom: 16px; display: flex; justify-content: space-between; gap: 16px; line-height: 1.5; }
        .sd-review-mark { font-size: 12px; font-weight: 700; white-space: nowrap; }
        .sd-review-mark.correct-text { color: #10b981; }
        .sd-review-mark.incorrect-text { color: #ef4444; }
        .sd-review-options { display: flex; flex-direction: column; gap: 8px; }
        .sd-review-opt { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; border: 1px solid ${t.border}; background: ${t.surface}; font-size: 14px; transition: all 0.2s; position: relative; }
        .sd-review-opt.opt-correct { background: rgba(16,185,129,0.1); border-color: #10b981; }
        .sd-review-opt.opt-wrong { background: rgba(239,68,68,0.1); border-color: #ef4444; }
        .sd-review-opt.opt-correct-missed { border-color: #10b981; border-style: dashed; }
        .sd-opt-letter { width: 24px; height: 24px; border-radius: 6px; background: ${t.surfaceAlt}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${t.textSub}; }
        .sd-opt-text { flex: 1; color: ${t.text}; }
        .sd-opt-tag { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; background: ${t.surfaceAlt}; color: ${t.textMuted}; }
        .sd-opt-tag.correct { background: #10b981; color: white; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
            .sd-sidebar { display: none; }
            .sd-content { padding: 20px 16px; }
            .sd-exam-card { flex-direction: column; align-items: flex-start; }
            .sd-btn-start, .sd-done-btn { width: 100%; text-align: center; }
            .sd-profile-grid { grid-template-columns: 1fr; }
            .sd-profile-row:nth-child(even) { padding-left: 0; border-left: none; }
        }
    `;

    return (
        <>
            <style>{css}</style>
            <ThemeSwitcher />
            <div className="sd-root">

                <aside className="sd-sidebar">
                    <div className="sd-logo"><span>Adapt</span>Exam</div>
                    {SECTIONS.map(s => (
                        <button key={s}
                            className={`sd-nav-item ${section === s ? 'active' : ''}`}
                            onClick={() => setSection(s)}>
                            {s}
                        </button>
                    ))}
                    <div className="sd-nav-spacer" />
                    <button className="sd-logout" onClick={handleLogout}>🚪 Logout</button>
                </aside>

                <div className="sd-main">
                    <div className="sd-topbar">
                        <div className="sd-topbar-title">{section}</div>
                        <div className="sd-topbar-user">
                            <span className="sd-user-dot" />
                            {studentName}
                        </div>
                    </div>

                    <div className="sd-content">
                        {error   && <div className="sd-flash error">⚠ {error}</div>}
                        {loading && <div className="sd-loading"><span className="sd-spinner" /> Loading…</div>}

                        {/* ── OVERVIEW ── */}
                        {section === 'Overview' && !loading && (
                            <>
                                <div className="sd-page-title">Welcome back, {studentName} 👋</div>

                                {profile && profile.department && profile.round_progress && profile.round_progress.length > 0 && (
                                    <div className="sd-card" style={{ marginBottom: '24px' }}>
                                        <div className="sd-card-title">💼 Recruitment Workflow: {profile.department}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '10px 0' }}>
                                            {profile.round_progress.map((rp, idx) => {
                                                const isMCQ = rp.round_name.toLowerCase().includes('mcq');
                                                const status = rp.status;
                                                
                                                let color = t.textMuted;
                                                let bg = t.surfaceAlt;
                                                let border = `1px solid ${t.border}`;
                                                
                                                if (status === 'Completed' || status === 'Cleared') {
                                                    color = '#059669';
                                                    bg = 'rgba(5, 150, 105, 0.12)';
                                                    border = '1.5px solid #059669';
                                                } else if (status === 'Failed') {
                                                    color = '#ef4444';
                                                    bg = 'rgba(239, 68, 68, 0.12)';
                                                    border = '1.5px solid #ef4444';
                                                } else if (status === 'In Progress') {
                                                    color = t.accent;
                                                    bg = t.tabActiveBg;
                                                    border = `1.5px solid ${t.accent}`;
                                                }

                                                return (
                                                    <React.Fragment key={idx}>
                                                        <div onClick={() => handleRoundClick(rp)} style={{ 
                                                            display: 'inline-flex', 
                                                            flexDirection: 'column', 
                                                            padding: '12px 20px', 
                                                            background: bg, 
                                                            border: border, 
                                                            borderRadius: '12px', 
                                                            cursor: 'pointer',
                                                            minWidth: '150px'
                                                        }} className="sd-round-card">
                                                            <span style={{ fontSize: '13px', fontWeight: '700', color: color }}>{rp.round_name}</span>
                                                            <span style={{ fontSize: '11px', color: t.textSub, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{status}</span>
                                                            {isMCQ && rp.score && (
                                                                <span style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>Score: {rp.score}</span>
                                                            )}
                                                        </div>
                                                        {idx < profile.round_progress.length - 1 && (
                                                            <span style={{ fontSize: '20px', color: t.textSub }}>➔</span>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                <div className="sd-stats">
                                    {[
                                        { val: exams.length + cadAssessments.length, lbl: 'Assigned Exams' },
                                        { val: completedExams.length + cadAssessments.filter(a => isCadDone(a)).length, lbl: 'Completed' },
                                        { val: pendingExams.length + cadAssessments.filter(a => !isCadDone(a)).length, lbl: 'Pending' },
                                        { val: `${avgPct}%`,                         lbl: 'Avg Score'       },
                                    ].map(({ val, lbl }) => (
                                        <div key={lbl} className="sd-stat">
                                            <div className="sd-stat-val">{val}</div>
                                            <div className="sd-stat-lbl">{lbl}</div>
                                        </div>
                                    ))}
                                </div>

                                {pendingExams.length > 0 && (
                                    <div className="sd-card">
                                        <div className="sd-card-title">⏳ Pending Exams</div>
                                        <div className="sd-exam-list">
                                            {pendingExams.map(exam => (
                                                <div key={exam._id} className="sd-exam-card">
                                                    <div style={{ flex: 1 }}>
                                                        <div className="sd-exam-title">{exam.title}</div>
                                                        <div className="sd-exam-meta">
                                                            <span className="sd-meta-chip">{exam.duration} min</span>
                                                            <span className="sd-meta-chip">{exam.total_questions} questions</span>
                                                        </div>
                                                    </div>
                                                    <button className="sd-btn-start" onClick={() => handleStartExam(exam)}>
                                                        Start Exam →
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {cadAssessments.length > 0 && (
                                    <div className="sd-card">
                                        <div className="sd-card-title">📐 AutoCAD Assessments</div>
                                        <div className="sd-exam-list">
                                            {cadAssessments.map(asm => {
                                                const done = isCadDone(asm);
                                                return (
                                                    <div key={asm._id} className={`sd-exam-card ${done ? 'done' : ''}`}>
                                                        <div style={{ flex: 1 }}>
                                                            <div className="sd-exam-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span>{asm.title}</span>
                                                                {done && (
                                                                    <span className="sd-badge" style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' }}>
                                                                        ✓ Submitted
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="sd-exam-meta">
                                                                <span className="sd-meta-chip">⏱ {asm.duration} min</span>
                                                                <span className="sd-meta-chip">🏷️ {asm.cad_level}</span>
                                                                {done && asm.submittedAt && (
                                                                    <span className="sd-meta-chip">📅 {new Date(asm.submittedAt).toLocaleDateString()}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {done ? (
                                                            <button className="sd-btn-start" disabled style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'default' }}>
                                                                Submitted ✓
                                                            </button>
                                                        ) : (
                                                            <button className="sd-btn-start" onClick={() => setActiveCadModal(asm)}>
                                                                Start CAD Assessment →
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {interviews.filter(i => !isInterviewCompleted(i)).length > 0 && (
                                    <div className="sd-card">
                                        <div className="sd-card-title">🎙️ Pending Technical Interviews</div>
                                        <div className="sd-exam-list">
                                            {interviews.filter(i => !isInterviewCompleted(i)).map(interview => (
                                                <div key={interview._id} className="sd-exam-card">
                                                    <div style={{ flex: 1 }}>
                                                        <div className="sd-exam-title">{interview.title}</div>
                                                        <div className="sd-exam-meta">
                                                            <span className="sd-meta-chip">Type: {interview.type || 'Auto'}</span>
                                                            {interview.date && <span className="sd-meta-chip">📅 {interview.date} {interview.time}</span>}
                                                            {interview.type !== 'Manual' && <span className="sd-meta-chip">{interview.numQuestions} questions</span>}
                                                            <span className="sd-meta-chip">Roles: {Array.isArray(interview.roles) ? interview.roles.join(', ') : interview.roles}</span>
                                                        </div>
                                                    </div>
                                                    {interview.type === 'Manual' ? (
                                                        <a href={interview.meetLink} target="_blank" rel="noreferrer" className="sd-btn-start" style={{ textDecoration: 'none', display: 'inline-block' }}>
                                                            Join GMeet 📹
                                                        </a>
                                                    ) : (
                                                        <button className="sd-btn-start" onClick={() => navigate(`/student/interview/${interview._id}`, { state: { roles: interview.roles } })}>
                                                            Start Interview →
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {results.length > 0 && (
                                    <div className="sd-card">
                                        <div className="sd-card-title">Recent Results</div>
                                        <div className="sd-table-wrap">
                                            <table className="sd-table">
                                                <thead><tr>
                                                    <th>Exam</th><th>Score</th><th>Date</th>
                                                </tr></thead>
                                                <tbody>
                                                    {results.slice(0, 5).map(r => {
                                                        return (
                                                            <tr key={r._id}>
                                                                <td>{r.exam_id?.title || '—'}</td>
                                                                <td><ScoreBar score={r.score} total={r.total_marks} /></td>
                                                                <td className="sd-cell-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── MY EXAMS ── */}
                        {section === 'My Exams' && !loading && (
                            <>
                                <div className="sd-page-title">My Exams</div>
                                {exams.length === 0 ? (
                                    <div className="sd-empty">
                                        <div className="sd-empty-icon">📋</div>
                                        <p>No exams assigned yet. Check back later.</p>
                                    </div>
                                ) : (
                                    <div className="sd-exam-list">
                                        {exams.map(exam => {
                                            const done = isExamDone(exam);
                                            return (
                                                <div key={exam._id} className={`sd-exam-card ${done ? 'done' : ''}`}>
                                                    <div style={{ flex: 1 }}>
                                                        <div className="sd-exam-title">{exam.title}</div>
                                                        <div className="sd-exam-meta">
                                                            <span className="sd-meta-chip">{exam.duration} min</span>
                                                            <span className="sd-meta-chip">{exam.total_questions} questions</span>
                                                            <span className="sd-meta-chip">
                                                                E:{exam.difficulty_distribution?.easy || 0} M:{exam.difficulty_distribution?.medium || 0} H:{exam.difficulty_distribution?.hard || 0}
                                                            </span>
                                                            {done && <span className="sd-badge sd-badge-ok">✓ Completed</span>}
                                                        </div>
                                                    </div>
                                                    {done
                                                        ? <button className="sd-done-btn" disabled>Submitted ✓</button>
                                                        : <button className="sd-btn-start" onClick={() => handleStartExam(exam)}>Start Exam →</button>
                                                    }
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── CODING ROUND ── */}
                        {section === 'Coding Round' && !loading && (
                            <>
                                <div className="sd-page-title">💻 Coding Round</div>
                                <div className="sd-card" style={{ marginBottom: 20, borderLeft: `4px solid ${t.accent}` }}>
                                    <div className="sd-card-title">Coding Assessment</div>
                                    <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                                        The Coding Round is a timed programming assessment where you solve algorithmic problems.
                                        It features real-time code execution, AI-powered proctoring, and behavioral telemetry.
                                    </p>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                                        {['Python 3 🐍', 'JavaScript JS', 'Java ☕', 'C++ C++'].map(lang => (
                                            <span key={lang} className="sd-meta-chip">{lang.split(' ')[0]}</span>
                                        ))}
                                    </div>
                                    <button className="sd-btn-start" onClick={() => navigate('/student/coding')}>
                                        Launch Coding Assessment →
                                    </button>
                                </div>
                                <div className="sd-card">
                                    <div className="sd-card-title">ℹ️ About the Coding Round</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            ['🕒', 'Timed Problems', 'Each problem has a configurable time limit.'],
                                            ['🧪', 'Test Cases', 'Your code is evaluated against hidden test cases.'],
                                            ['🔒', 'Proctored', 'AI monitors your session for academic integrity.'],
                                            ['📊', 'Instant Feedback', 'See test case results immediately after running.'],
                                        ].map(([icon, title, desc]) => (
                                            <div key={title} style={{ display: 'flex', gap: 12, padding: '12px', background: t.surfaceAlt, borderRadius: 10 }}>
                                                <span style={{ fontSize: 22 }}>{icon}</span>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: t.text, fontSize: 13 }}>{title}</div>
                                                    <div style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── CODING RESULTS ── */}
                        {section === 'Coding Results' && !loading && (
                            <StudentCodingResults />
                        )}

                        {/* ── AUTOCAD ASSESSMENTS (CIVIL ENGINEERING) ── */}
                        {section === 'AutoCAD Assessments' && !loading && (
                            <>
                                <div className="sd-page-title">📐 AutoCAD / 2D Drawing Assessments</div>
                                <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 24 }}>
                                    Civil Engineering 2D CAD drawing assessments assigned to your account.
                                </p>

                                {cadAssessments.length === 0 ? (
                                    <div className="sd-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                                        <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
                                        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>No AutoCAD Assessments Assigned</h3>
                                        <p style={{ color: t.textMuted, fontSize: 14, marginTop: 8 }}>
                                            You currently have no published AutoCAD drawing assessments assigned to your profile.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="sd-exam-list">
                                        {cadAssessments.map(asm => {
                                            const done = isCadDone(asm);
                                            return (
                                                <div key={asm._id} className={`sd-exam-card ${done ? 'done' : ''}`}>
                                                    <div style={{ flex: 1 }}>
                                                        <div className="sd-exam-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <span>📐 {asm.title}</span>
                                                            <span className="sd-badge" style={{ background: t.accent + '22', color: t.accent, border: `1px solid ${t.accent}44` }}>
                                                                {asm.cad_level}
                                                            </span>
                                                            {done && (
                                                                <span className="sd-badge" style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' }}>
                                                                    ✓ Submitted
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p style={{ fontSize: 13, color: t.textMuted, margin: '6px 0 10px' }}>
                                                            {asm.description || 'Civil Engineering 2D CAD drawing assessment.'}
                                                        </p>
                                                        <div className="sd-exam-meta">
                                                            <span className="sd-meta-chip">⏱ {asm.duration} minutes</span>
                                                            <span className="sd-meta-chip">📝 {asm.total_questions || 0} questions</span>
                                                            <span className="sd-meta-chip">🏷️ {asm.category || 'Civil Assessments'}</span>
                                                            {done && asm.submittedAt && (
                                                                <span className="sd-meta-chip">📅 Submitted {new Date(asm.submittedAt).toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {done ? (
                                                        <button className="sd-btn-start" disabled style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'default' }}>
                                                            Submitted ✓
                                                        </button>
                                                    ) : (
                                                        <button className="sd-btn-start" onClick={() => setActiveCadModal(asm)}>
                                                            Start CAD Assessment →
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── TECHNICAL INTERVIEW ── */}
                        {section === 'Technical Interview' && !loading && (
                            <>
                                <div className="sd-page-title">🎙️ Technical Interview</div>
                                {interviews.length === 0 ? (
                                    <div className="sd-empty">
                                        <div className="sd-empty-icon">🗣️</div>
                                        <p>No technical interviews assigned yet.</p>
                                    </div>
                                ) : (
                                    <div className="sd-exam-list">
                                        {interviews.map(interview => {
                                            const done = isInterviewCompleted(interview);
                                            return (
                                                <div key={interview._id} className={`sd-exam-card ${done ? 'done' : ''}`}>
                                                    <div style={{ flex: 1 }}>
                                                        <div className="sd-exam-title">{interview.title}</div>
                                                        <div className="sd-exam-meta">
                                                            <span className="sd-meta-chip">Type: {interview.type || 'Auto'}</span>
                                                            {interview.date && <span className="sd-meta-chip">📅 {interview.date} {interview.time}</span>}
                                                            {interview.type !== 'Manual' && <span className="sd-meta-chip">{interview.numQuestions} questions</span>}
                                                            <span className="sd-meta-chip">Roles: {Array.isArray(interview.roles) ? interview.roles.join(', ') : interview.roles}</span>
                                                            {done && <span className="sd-badge sd-badge-ok">✓ Completed</span>}
                                                        </div>
                                                    </div>
                                                    {interview.type === 'Manual' ? (
                                                        done
                                                            ? <button className="sd-done-btn" disabled>Completed ✓</button>
                                                            : <a href={interview.meetLink} target="_blank" rel="noreferrer" className="sd-btn-start" style={{ textDecoration: 'none', display: 'inline-block' }}>Join GMeet 📹</a>
                                                    ) : (
                                                        done 
                                                            ? <button className="sd-done-btn" disabled>Completed ✓</button>
                                                            : <button className="sd-btn-start" onClick={() => navigate(`/student/interview/${interview._id}`, { state: { roles: interview.roles } })}>Start Interview →</button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── MY RESULTS ── */}
                        {section === 'My Results' && !loading && (
                            <>
                                <div className="sd-page-title">My Results</div>
                                {results.length === 0 ? (
                                    <div className="sd-empty">
                                        <div className="sd-empty-icon">📊</div>
                                        <p>No results yet. Complete an exam to see your scores here.</p>
                                    </div>
                                ) : (
                                    <div className="sd-table-wrap">
                                        <table className="sd-table">
                                            <thead><tr>
                                                <th>Exam</th><th>Score</th><th>Date</th><th>Action</th>
                                            </tr></thead>
                                            <tbody>
                                                {results.map(r => {
                                                    return (
                                                        <tr key={r._id}>
                                                            <td>{r.exam_id?.title || '—'}</td>
                                                            <td><ScoreBar score={r.score} total={r.total_marks} /></td>
                                                            <td className="sd-cell-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                            <td>
                                                                <button 
                                                                    style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '6px', cursor: 'pointer', color: t.text, fontSize: '12px' }}
                                                                    disabled={reviewLoading}
                                                                    onClick={() => handleReview(r.exam_id?._id)}
                                                                >
                                                                    Review
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}


                        {/* ── PROFILE ── */}
                        {section === 'Profile' && !loading && (
                            <>
                                <div className="sd-page-title">My Profile</div>
                                <div className="sd-card">
                                    <div className="sd-profile-avatar">
                                        {studentName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="sd-profile-grid">
                                        <ProfileRow label="Full Name"       value={profile?.name          || studentName}  />
                                        <ProfileRow label="Email"           value={profile?.email         || studentEmail} />
                                        <ProfileRow label="Roll No"         value={profile?.rollno}           />
                                        <ProfileRow label="Gender"          value={profile?.gender}           />
                                        <ProfileRow label="Age"             value={profile?.age}              />
                                        <ProfileRow label="Phone"           value={profile?.phone_number}     />
                                        <ProfileRow label="Department"      value={profile?.department}       />
                                        <ProfileRow label="Year of Study"   value={profile?.year_of_study}    />
                                        <ProfileRow label="College"         value={profile?.college}          />
                                    </div>
                                </div>
                            </>
                        )}

                        {activeCadModal && (
                            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                                <div className="sd-card" style={{ width: '100%', maxWidth: 560, background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', padding: 28 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <div>
                                            <span className="sd-badge sd-badge-ok" style={{ marginBottom: 6 }}>
                                                {activeCadModal.cad_level}
                                            </span>
                                            <h3 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>
                                                📐 {activeCadModal.title}
                                            </h3>
                                            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
                                                {activeCadModal.category || 'Civil Engineering Assessments'} • Duration: {activeCadModal.duration} Mins
                                            </p>
                                        </div>
                                        <button className="sd-modal-close" onClick={() => setActiveCadModal(null)}>✕</button>
                                    </div>

                                    <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13.5, color: t.text }}>
                                        <strong>Instructions:</strong>
                                        <p style={{ margin: '6px 0 0', color: t.textMuted }}>
                                            {activeCadModal.description || 'Draft 2D architectural plan & orthographic projection specs according to given geometric constraints.'}
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 8, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                                        <span>🔒 AI Proctoring & Monitoring System Initialized</span>
                                    </div>

                                    <div style={{ border: `1px solid ${t.border}`, borderRadius: 14, padding: '24px 20px', textAlign: 'center', background: t.bg }}>
                                        <div style={{ fontSize: 36, marginBottom: 10 }}>📐</div>
                                        <h4 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                                            2D CAD Drafting Environment
                                        </h4>
                                        <p style={{ fontSize: 13, color: t.textMuted, marginTop: 6 }}>
                                            Interactive CAD canvas with geometric drawing tools, grid snapping, ortho mode, object snap, autosave, and proctoring.
                                        </p>
                                    </div>

                                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button className="sd-done-btn" onClick={() => setActiveCadModal(null)}>
                                            Cancel
                                        </button>
                                        <button className="sd-btn-start" onClick={() => {
                                            if (isCadDone(activeCadModal)) {
                                                alert('You have already submitted this AutoCAD assessment.');
                                                setActiveCadModal(null);
                                                return;
                                            }
                                            const id = activeCadModal._id;
                                            setActiveCadModal(null);
                                            navigate(`/student/cad/${id}`);
                                        }}>
                                            Take Assessment →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {reviewData && <ReviewModal data={reviewData} onClose={() => setReviewData(null)} t={t} />}
                    </div>
                </div>
            </div>
        </>
    );
}
