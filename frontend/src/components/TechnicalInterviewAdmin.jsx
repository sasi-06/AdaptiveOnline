import React, { useState, useEffect } from 'react';
import api, { getInterviews, createInterview, assignInterview, deleteInterview } from '../services/api';

export default function TechnicalInterviewAdmin({ theme: t, students, flash }) {
    const [interviews, setInterviews] = useState([]);
    
    // Forms
    const [examForm, setExamForm] = useState({ 
        title: '', 
        roles: '', 
        difficulty: 'Medium', 
        type: 'Auto',
        date: '',
        time: '',
        meetLink: '',
        numQuestions: 5 
    });
    
    const [assignForm, setAssignForm] = useState({ 
        interviewId: '', 
        studentIds: [] 
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await getInterviews();
            setInterviews(res.data);
        } catch (err) {
            if (flash) flash('Failed to load interview data', true);
        }
    };

    // ── Create Interview ──
    const handleCreateExam = async (e) => {
        e.preventDefault();
        try {
            const payload = { 
                ...examForm, 
                roles: examForm.roles.split(',').map(r => r.trim()).filter(Boolean) 
            };
            await createInterview(payload);
            setExamForm({ title: '', roles: '', difficulty: 'Medium', type: 'Auto', date: '', time: '', meetLink: '', numQuestions: 5 });
            if (flash) flash('Interview Round created!');
            loadData();
        } catch (err) {
            if (flash) flash(err.response?.data?.message || 'Error creating interview', true);
        }
    };

    // ── Assign Students ──
    const handleAssignExam = async (e) => {
        e.preventDefault();
        try {
            await assignInterview({ interviewId: assignForm.interviewId, studentIds: assignForm.studentIds });
            if (flash) flash('Students assigned to Interview!');
            setAssignForm({ interviewId: '', studentIds: [] });
            loadData();
        } catch (err) {
            if (flash) flash('Error assigning students', true);
        }
    };

    return (
        <div>
            <div className="ad-page-title">Technical Interview Management</div>
            
            {/* ① Create Assessment */}
            <div className="ad-card">
                <div className="ad-card-title">① Create Interview Round</div>
                <form onSubmit={handleCreateExam} style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'stretch' }}>
                    
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Interview Title</div>
                            <input className="ad-input" placeholder="e.g. Frontend Developer Final" value={examForm.title} onChange={e=>setExamForm({...examForm,title:e.target.value})} required style={{width: '100%'}} />
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Roles (comma separated)</div>
                            <input className="ad-input" placeholder="e.g. React Developer, Node Developer" value={examForm.roles} onChange={e=>setExamForm({...examForm,roles:e.target.value})} required style={{width: '100%'}} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '16px', background: t.surfaceAlt, borderRadius: '12px', border: `1px solid ${t.border}` }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Interview Type</div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                {['Auto', 'Manual'].map(type => (
                                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: t.text, fontSize: '13px' }}>
                                        <input type="radio" name="interviewType" value={type} checked={examForm.type === type} onChange={e => setExamForm({...examForm, type: e.target.value})} style={{ accentColor: t.accent, width: '16px', height: '16px', cursor: 'pointer' }} />
                                        {type}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ flex: '1 1 150px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Date</div>
                            <input type="date" className="ad-input" value={examForm.date} onChange={e=>setExamForm({...examForm, date: e.target.value})} required style={{ width: '100%' }} />
                        </div>

                        <div style={{ flex: '1 1 150px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Time</div>
                            <input type="time" className="ad-input" value={examForm.time} onChange={e=>setExamForm({...examForm, time: e.target.value})} required style={{ width: '100%' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '16px', background: t.surfaceAlt, borderRadius: '12px', border: `1px solid ${t.border}` }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Difficulty Level</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {['Easy', 'Medium', 'Hard'].map(d => (
                                    <button key={d} type="button" onClick={() => setExamForm({...examForm, difficulty: d})} 
                                        className="ad-btn"
                                        style={{ 
                                            flex: 1, padding: '10px 0', fontSize: '12px',
                                            background: examForm.difficulty === d ? t.accent : t.surfaceAlt, 
                                            color: examForm.difficulty === d ? '#fff' : t.textMuted,
                                            border: `1px solid ${examForm.difficulty === d ? t.accent : t.border}`
                                        }}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {examForm.type === 'Auto' && (
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Num Questions</div>
                                <input type="number" min="1" className="ad-input" value={examForm.numQuestions} onChange={e=>setExamForm({...examForm, numQuestions: e.target.value})} required style={{ fontFamily: 'monospace', width: '100%' }} />
                            </div>
                        )}
                        {examForm.type === 'Manual' && (
                            <div style={{ flex: '1 1 200px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>GMeet Link</div>
                                <input type="url" className="ad-input" placeholder="https://meet.google.com/..." value={examForm.meetLink} onChange={e=>setExamForm({...examForm, meetLink: e.target.value})} required style={{ width: '100%' }} />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button type="submit" className="ad-btn ad-btn-primary">+ Create Interview</button>
                    </div>
                </form>
            </div>

            {/* ② Assign Students */}
            <div className="ad-card">
                <div className="ad-card-title">② Assign Students to Interview</div>
                <div className="ad-card-hint">Select the interview round and assign candidates. Hold Ctrl/Cmd for multi-select.</div>
                <form onSubmit={handleAssignExam} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <select className="ad-select" value={assignForm.interviewId} 
                            onChange={e => {
                                const selectedId = e.target.value;
                                const selectedInterview = interviews.find(i => i._id === selectedId);
                                const currentCandidates = selectedInterview?.candidates?.map(c => c._id || c) || [];
                                setAssignForm({ interviewId: selectedId, studentIds: currentCandidates });
                            }} 
                            required style={{width: '100%'}}>
                            <option value="">Select Interview Round</option>
                            {interviews.map(ex=><option key={ex._id} value={ex._id}>{ex.title} ({ex.roles?.join(', ') || 'No Role'})</option>)}
                        </select>
                    </div>
                    
                    <div style={{ flex: '1 1 300px', maxHeight: '180px', overflowY: 'auto', border: `1.5px solid ${t.border}`, borderRadius: '9px', padding: '12px', background: t.inputBg }}>
                        {(!students || students.length === 0) ? (
                            <div style={{ fontSize: '13px', color: t.textMuted }}>No students available.</div>
                        ) : (
                            students.map(s => (
                                <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '14px', color: t.text, cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={assignForm.studentIds.includes(s._id)}
                                        onChange={(e) => {
                                            const newIds = e.target.checked 
                                                ? [...assignForm.studentIds, s._id] 
                                                : assignForm.studentIds.filter(id => id !== s._id);
                                            setAssignForm({...assignForm, studentIds: newIds});
                                        }}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: t.accent }}
                                    />
                                    {s.name} <span style={{ color: t.textMuted, fontSize: '12px' }}>({s.email})</span>
                                </label>
                            ))
                        )}
                    </div>
                    
                    <button type="submit" className="ad-btn ad-btn-primary" style={{marginTop: 'auto', marginBottom: 'auto'}}>Assign Candidates</button>
                </form>
            </div>

            {/* Existing Assessments Table */}
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:t.text,marginBottom:12}}>Active Interview Rounds</div>
            <div className="ad-table-wrap" style={{marginBottom: '24px'}}>
                <table className="ad-table">
                    <thead><tr><th>Title</th><th>Roles</th><th>Type</th><th>Schedule</th><th>Questions</th><th>Candidates</th><th>Actions</th></tr></thead>
                    <tbody>
                        {interviews.map(ex => (
                            <tr key={ex._id}>
                                <td><strong>{ex.title}</strong></td>
                                <td><span className="ad-badge ad-badge-medium">{ex.roles?.join(', ')}</span></td>
                                <td>{ex.type || 'Auto'}</td>
                                <td>{ex.date ? `${ex.date} ${ex.time}` : 'Not Set'}</td>
                                <td>{ex.type === 'Manual' ? '-' : ex.numQuestions}</td>
                                <td>{ex.candidates?.length||0} students</td>
                                <td>
                                    <button className="ad-btn ad-btn-danger ad-btn-sm" onClick={async () => {
                                        if(window.confirm('Delete this interview round?')) {
                                            try {
                                                await deleteInterview(ex._id);
                                                if (flash) flash('Interview round deleted');
                                                loadData();
                                            } catch (err) {
                                                if (flash) flash('Error deleting interview', true);
                                            }
                                        }
                                    }}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        {interviews.length===0&&<tr><td colSpan={6} style={{textAlign:'center',color:t.textMuted,padding:28}}>No interview rounds created yet.</td></tr>}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
