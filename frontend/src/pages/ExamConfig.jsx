import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExam, updateExam, getQuestions, updateExamQuestions } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ThemeSwitcher from '../components/ThemeSwitcher';

export default function ExamConfig() {
    const { examId } = useParams();
    const navigate = useNavigate();
    const { theme: t } = useTheme();

    const [exam, setExam] = useState(null);
    const [allQ, setAllQ] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [form, setForm] = useState({});
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getExam(examId), getQuestions(examId)])
            .then(([eRes, qRes]) => {
                const e = eRes.data;
                setExam(e);
                setForm({ 
                    title: e.title, 
                    duration: e.duration, 
                    total_questions: e.total_questions, 
                    difficulty_distribution: e.difficulty_distribution, 
                    per_question_time: e.per_question_time || {} 
                });
                setSelectedIds((e.questions || []).map(q => q._id || q));
                setAllQ(qRes.data);
            })
            .catch(() => setError('Failed to load exam config.'))
            .finally(() => setLoading(false));
    }, [examId]);

    // Auto-calculate Total Questions, Duration, and Distribution based on selected questions
    useEffect(() => {
        if (!form.per_question_time || !allQ.length) return;
        
        const counts = { easy: 0, medium: 0, hard: 0 };
        selectedIds.forEach(id => {
            const q = allQ.find(x => x._id === id);
            if (q && q.difficulty) {
                counts[q.difficulty] = (counts[q.difficulty] || 0) + 1;
            }
        });

        const totalQs = selectedIds.length;
        const pqt = form.per_question_time;
        const totalSecs = ( (counts.easy || 0) * (pqt.easy || 60) ) + 
                          ( (counts.medium || 0) * (pqt.medium || 120) ) + 
                          ( (counts.hard || 0) * (pqt.hard || 180) );
        const totalMins = Math.ceil(totalSecs / 60);

        if (form.total_questions !== totalQs || form.duration !== totalMins || 
            JSON.stringify(form.difficulty_distribution) !== JSON.stringify(counts)) {
            setForm(prev => ({ 
                ...prev, 
                total_questions: totalQs, 
                duration: totalMins,
                difficulty_distribution: counts 
            }));
        }
    }, [selectedIds, allQ, form.per_question_time]);

    const toggleQuestion = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        try {
            // Update basic exam settings
            await updateExam(examId, form);
            // Update selected questions using dedicated endpoint
            await updateExamQuestions(examId, { questionIds: selectedIds });
            setSuccess('Exam configuration saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Exam save error:', err);
            setError(err.response?.data?.message || 'Failed to save exam configuration. Please check console.');
        }
    };

    const diffDist = form.difficulty_distribution || {};

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ec-root { min-height: 100vh; background: ${t.bg}; color: ${t.text}; font-family: 'Outfit', sans-serif; transition: background 0.4s, color 0.4s; }

        .ec-nav {
            position: sticky; top: 0; z-index: 40;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 32px; height: 60px;
            background: ${t.surface}; border-bottom: 1px solid ${t.border};
            transition: background 0.4s, border-color 0.4s;
        }
        .ec-nav-logo { font-family: 'Outfit', sans-serif; font-size: 17px; font-weight: 800; color: ${t.text}; }
        .ec-nav-logo span { background: ${t.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .ec-back-btn {
            padding: 7px 16px; border-radius: 8px; border: 1px solid ${t.border};
            background: ${t.surfaceAlt}; color: ${t.textMuted};
            font-family: 'Outfit', sans-serif; font-size: 13.5px; font-weight: 500; cursor: pointer;
            transition: all 0.2s ease;
        }
        .ec-back-btn:hover { border-color: ${t.accent}; color: ${t.text}; }

        .ec-body { max-width: 900px; margin: 0 auto; padding: 32px 24px; }

        .ec-page-title { font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; color: ${t.text}; margin-bottom: 24px; letter-spacing: -0.5px; }

        .ec-flash {
            display: flex; align-items: center; gap: 10px;
            border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13.5px; font-weight: 500;
        }
        .ec-flash.success { background: ${t.tabActiveBg}; border: 1px solid ${t.accent}44; color: ${t.accent}; }
        .ec-flash.error { background: ${t.errorBg}; border: 1px solid ${t.errorBorder}55; color: ${t.errorText}; }

        .ec-form { display: flex; flex-direction: column; gap: 20px; }

        .ec-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 24px; transition: background 0.4s, border-color 0.4s; }
        .ec-card-title { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; color: ${t.text}; margin-bottom: 18px; }
        .ec-hint { font-size: 12.5px; color: ${t.textMuted}; margin-bottom: 14px; }

        .ec-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ec-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

        .ec-field { display: flex; flex-direction: column; gap: 7px; }
        .ec-label { font-size: 12px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; color: ${t.textMuted}; }
        .ec-input {
            background: ${t.inputBg}; border: 1.5px solid ${t.border}; border-radius: 9px;
            color: ${t.text}; font-family: 'Outfit', sans-serif; font-size: 14px;
            padding: 10px 13px; outline: none; transition: all 0.2s ease; width: 100%;
        }
        .ec-input::placeholder { color: ${t.textSub}; }
        .ec-input:focus { border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.accentGlow}; background: ${t.surfaceAlt}; }

        /* QUESTION LIST */
        .ec-q-list { max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
        .ec-q-list::-webkit-scrollbar { width: 5px; }
        .ec-q-list::-webkit-scrollbar-track { background: ${t.surfaceAlt}; border-radius: 99px; }
        .ec-q-list::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 99px; }
        .ec-q-item {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 14px 16px; border-radius: 10px; cursor: pointer;
            border: 1.5px solid ${t.border}; background: ${t.surfaceAlt};
            transition: all 0.18s ease;
        }
        .ec-q-item:hover { border-color: ${t.accent}; background: ${t.tabActiveBg}; }
        .ec-q-item.selected { border-color: ${t.accent}; background: ${t.tabActiveBg}; }
        .ec-q-checkbox {
            width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; margin-top: 2px;
            border: 2px solid ${t.border}; background: ${t.inputBg};
            display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;
        }
        .ec-q-item.selected .ec-q-checkbox { background: ${t.accent}; border-color: ${t.accent}; }
        .ec-q-text { font-size: 14px; font-weight: 500; color: ${t.text}; margin-bottom: 8px; line-height: 1.45; }
        .ec-q-meta { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }
        .ec-badge {
            display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 100px;
            font-size: 11.5px; font-weight: 600;
        }
        .ec-badge-easy { background: rgba(5,150,105,0.12); color: #059669; }
        .ec-badge-medium { background: rgba(234,179,8,0.12); color: #ca8a04; }
        .ec-badge-hard { background: ${t.errorBg}; color: ${t.errorText}; }
        .ec-badge-topic { background: ${t.tabActiveBg}; color: ${t.accent}; }
        .ec-badge-type { background: ${t.surfaceAlt}; color: ${t.textMuted}; border: 1px solid ${t.border}; }
        .ec-q-count { font-size: 13px; color: ${t.textMuted}; margin-bottom: 14px; }
        .ec-q-empty { font-size: 13.5px; color: ${t.textMuted}; padding: 20px 0; text-align: center; }

        .ec-save-btn {
            padding: 12px 28px; background: ${t.gradient}; border: none; border-radius: 10px;
            color: #fff; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;
            cursor: pointer; box-shadow: 0 4px 18px ${t.accentGlow};
            transition: all 0.2s ease; align-self: flex-start;
        }
        .ec-save-btn:hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 6px 24px ${t.accentGlow}; }

        .ec-loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: ${t.bg}; color: ${t.textMuted}; font-size: 15px; }
    `;

    if (loading) return <><style>{css}</style><div className="ec-loading">Loading…</div></>;

    return (
        <>
            <style>{css}</style>
            <ThemeSwitcher />
            <div className="ec-root">
                <nav className="ec-nav">
                    <div className="ec-nav-logo"> <span>Exam Config</span></div>
                    <button className="ec-back-btn" onClick={() => navigate('/admin')}>← Back to Dashboard</button>
                </nav>

                <div className="ec-body">
                    {success && <div className="ec-flash success"> {success}</div>}
                    {error && <div className="ec-flash error"> {error}</div>}

                    <div className="ec-page-title">Configure: {exam?.title}</div>

                    <form className="ec-form" onSubmit={handleSave}>
                        {/* Basic Settings */}
                        <div className="ec-card">
                            <div className="ec-card-title">Basic Settings</div>
                            <div className="ec-grid-2">
                                <div className="ec-field">
                                    <label className="ec-label">Exam Title</label>
                                    <input className="ec-input" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} required />
                                </div>
                                <div className="ec-field">
                                    <label className="ec-label">Auto-Calculated Duration (min)</label>
                                    <input className="ec-input" type="number" value={form.duration || 0} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                                </div>
                                <div className="ec-field">
                                    <label className="ec-label">Auto-Calculated Total Questions</label>
                                    <input className="ec-input" type="number" value={form.total_questions || 0} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                                </div>
                            </div>
                        </div>

                        <script>
                            {/* Logic handled by useEffect below */}
                        </script>

                        {/* Difficulty */}
                        <div className="ec-card">
                            <div className="ec-card-title">Difficulty & Timing Configuration</div>
                            <div className="ec-hint">Set question counts and time limits (in seconds) for each difficulty level.</div>
                            <div className="ec-grid-3">
                                <div className="ec-label">Difficulty</div>
                                <div className="ec-label">Question Count</div>
                                <div className="ec-label">Per-Question Time (s)</div>
                                
                                {['easy', 'medium', 'hard'].map(d => (
                                    <React.Fragment key={d}>
                                        <div style={{ alignSelf: 'center', fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{d}</div>
                                        <div style={{ alignSelf: 'center', fontSize: 15, fontWeight: 700, color: t.accent }}>{diffDist[d] || 0}</div>
                                        <input className="ec-input" type="number" min={1} 
                                            value={form.per_question_time?.[d] || ''}
                                            onChange={e => setForm({ 
                                                ...form, 
                                                per_question_time: { 
                                                    ...(form.per_question_time || {}), 
                                                    [d]: +e.target.value 
                                                } 
                                            })} />
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* Question Selector */}
                        <div className="ec-card">
                            <div className="ec-card-title">Select Questions</div>
                            <div className="ec-q-count">{selectedIds.length} of {allQ.length} selected</div>
                            <div className="ec-q-list">
                                {allQ.length === 0
                                    ? <div className="ec-q-empty">No questions in the bank yet. Upload questions first.</div>
                                    : allQ.map(q => (
                                        <div key={q._id}
                                            className={`ec-q-item ${selectedIds.includes(q._id) ? 'selected' : ''}`}
                                            onClick={() => toggleQuestion(q._id)}>
                                            <div className="ec-q-checkbox">
                                                {selectedIds.includes(q._id) && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}></span>}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div className="ec-q-text">{q.question_text}</div>
                                                <div className="ec-q-meta">
                                                    <span className={`ec-badge ec-badge-${q.difficulty}`}>{q.difficulty}</span>
                                                    <span className="ec-badge ec-badge-topic">{q.topic}</span>
                                                    <span className="ec-badge ec-badge-type">{q.structure_type}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        <button type="submit" className="ec-save-btn"> Save Configuration</button>
                    </form>
                </div>
            </div>
        </>
    );
}
