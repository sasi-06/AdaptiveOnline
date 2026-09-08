import React, { useState, useEffect } from 'react';
import api, { getCodingAssessments, createCodingAssessment, assignCodingAssessment } from '../services/api';

export default function CodingRoundManager({ theme: t, students, flash }) {
    const [assessments, setAssessments] = useState([]);
    const [codingQuestions, setCodingQuestions] = useState([]);
    const [assignDeptFilter, setAssignDeptFilter] = useState('ALL');
    
    // Forms
    const [examForm, setExamForm] = useState({ title: '', instructions: '' });
    const [assignForm, setAssignForm] = useState({ assessmentId: '', studentIds: [] });
    
    // Challenge Architect Form
    const [qForm, setQForm] = useState({
        assessmentId: '',
        title: '',
        description: '',
        difficulty: 'Medium',
        tags: '',
        department: 'ECE',
        domain_type: 'embedded_c',
        timeLimit: 15,
        memoryLimit: 256,
        languagesSupported: ['python', 'javascript', 'java', 'cpp', 'verilog', 'c_embedded'],
        starterCode: {
            python: '# Write your solution here\n',
            javascript: '// Write your solution here\n',
            java: 'public class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n',
            cpp: '#include <iostream>\nusing namespace std;\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
            verilog: '// Verilog HDL Module\nmodule hardware_module(\n    input wire clk,\n    input wire reset,\n    output reg [3:0] out\n);\nendmodule\n',
            c_embedded: '// Embedded C Source\n#include <stdint.h>\nint main(void) {\n    return 0;\n}\n'
        },
        examples: [{ input: '', output: '', explanation: '' }],
        testCases: [{ input: '', expectedOutput: '', isHidden: false }]
    });

    const [activeCodeTab, setActiveCodeTab] = useState('python');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [assmRes, qRes] = await Promise.all([
                getCodingAssessments(),
                api.get('/coding/questions')
            ]);
            setAssessments(assmRes.data);
            setCodingQuestions(Array.isArray(qRes.data?.questions) ? qRes.data.questions : (Array.isArray(qRes.data) ? qRes.data : []));
        } catch (err) {
            flash('Failed to load coding round data', true);
        }
    };

    // ── Create Assessment ──
    const handleCreateExam = async (e) => {
        e.preventDefault();
        try {
            await createCodingAssessment(examForm);
            setExamForm({ title: '', instructions: '' });
            flash('Coding Assessment created!');
            loadData();
        } catch (err) {
            flash(err.response?.data?.message || 'Error creating assessment', true);
        }
    };

    // ── Assign Students ──
    const handleAssignExam = async (e) => {
        e.preventDefault();
        try {
            await assignCodingAssessment({ assessmentId: assignForm.assessmentId, studentIds: assignForm.studentIds });
            flash('Students assigned to Coding Assessment!');
            loadData();
        } catch (err) {
            flash('Error assigning students', true);
        }
    };

    // ── Challenge Architect (Create Question) ──
    const handleCreateQuestion = async (e) => {
        e.preventDefault();
        if (!qForm.title || !qForm.description) return flash('Title and Description are required', true);
        try {
            const payload = { ...qForm, tags: qForm.tags.split(',').map(tag => tag.trim()).filter(Boolean) };
            await api.post('/coding/questions', payload);
            flash('Coding Challenge created successfully!');
            setQForm({
                assessmentId: '', title: '', description: '', difficulty: 'Medium', tags: '', timeLimit: 15, memoryLimit: 256,
                languagesSupported: ['python', 'javascript', 'java', 'cpp'],
                starterCode: {
                    python: '# Write your solution here\n', javascript: '// Write your solution here\n',
                    java: 'public class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n',
                    cpp: '#include <iostream>\nusing namespace std;\nint main() {\n    // Write your solution here\n    return 0;\n}\n'
                },
                examples: [{ input: '', output: '', explanation: '' }],
                testCases: [{ input: '', expectedOutput: '', isHidden: false }]
            });
            loadData();
        } catch (err) {
            flash(err.response?.data?.message || 'Error creating challenge', true);
        }
    };

    const addTestCase = () => setQForm({ ...qForm, testCases: [...qForm.testCases, { input: '', expectedOutput: '', isHidden: false }] });
    const addExample = () => setQForm({ ...qForm, examples: [...qForm.examples, { input: '', output: '', explanation: '' }] });

    return (
        <div>
            <div className="ad-page-title">Coding Round Management</div>
            
            {/* ① Create Assessment */}
            <div className="ad-card">
                <div className="ad-card-title">① Create Coding Assessment</div>
                <form onSubmit={handleCreateExam} style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input className="ad-input" placeholder="Assessment Title" value={examForm.title} onChange={e=>setExamForm({...examForm,title:e.target.value})} required style={{flex:'1 1 200px'}} />
                        <input className="ad-input" placeholder="Instructions for Students" value={examForm.instructions} onChange={e=>setExamForm({...examForm,instructions:e.target.value})} style={{flex:'2 1 300px'}} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="ad-btn ad-btn-primary">+ Create</button>
                    </div>
                </form>
            </div>

            {/* ② Assign Students */}
            <div className="ad-card">
                <div className="ad-card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <span>② Assign Students to Coding Assessment</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: t.textSub }}>Department Filter:</span>
                        <select 
                            className="ad-select" 
                            value={assignDeptFilter} 
                            onChange={e => setAssignDeptFilter(e.target.value)}
                            style={{ width: '160px', padding: '6px 10px', fontSize: '13px' }}
                        >
                            <option value="ALL">All Departments</option>
                            <option value="ECE">ECE Department</option>
                            <option value="EEE">EEE Department</option>
                            <option value="CSE">CSE Department</option>
                            <option value="IT">IT Department</option>
                        </select>
                    </div>
                </div>
                <div className="ad-card-hint">Filter by Department to assign coding/hardware assessments directly to ECE, EEE, or CSE candidates.</div>
                <form onSubmit={handleAssignExam} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <select className="ad-select" value={assignForm.assessmentId} onChange={e=>setAssignForm({...assignForm,assessmentId:e.target.value})} required style={{flex:'1 1 200px'}}>
                        <option value="">Select Assessment</option>
                        {assessments.map(ex=><option key={ex._id} value={ex._id}>{ex.title}</option>)}
                    </select>
                    <div style={{ flex: '1 1 300px', maxHeight: '180px', overflowY: 'auto', border: `1.5px solid ${t.border}`, borderRadius: '9px', padding: '12px', background: t.inputBg }}>
                        {students.filter(s => assignDeptFilter === 'ALL' || (s.department || '').toUpperCase().includes(assignDeptFilter.toUpperCase())).length === 0 ? (
                            <div style={{ fontSize: '13px', color: t.textMuted }}>No students found for department: {assignDeptFilter}.</div>
                        ) : (
                            students
                                .filter(s => assignDeptFilter === 'ALL' || (s.department || '').toUpperCase().includes(assignDeptFilter.toUpperCase()))
                                .map(s => (
                                    <label key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px', fontSize: '14px', color: t.text, cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                            <span>{s.name}</span>
                                            <span style={{ color: t.textMuted, fontSize: '12px' }}>({s.email})</span>
                                        </div>
                                        <span className="ad-badge ad-badge-ok" style={{ marginLeft: 'auto', fontSize: '10px' }}>{s.department || 'General'}</span>
                                    </label>
                                ))
                        )}
                    </div>
                    <button type="submit" className="ad-btn ad-btn-primary">Assign</button>
                </form>
            </div>

            {/* Existing Assessments Table */}
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:t.text,marginBottom:12}}>Active Coding Assessments</div>
            <div className="ad-table-wrap" style={{marginBottom: '24px'}}>
                <table className="ad-table">
                    <thead><tr><th>Title</th><th>Candidates</th><th>Actions</th></tr></thead>
                    <tbody>
                        {assessments.map(ex => (
                            <tr key={ex._id}>
                                <td><strong>{ex.title}</strong></td>
                                <td>{ex.candidates?.length||0} students</td>
                                <td>
                                    <button className="ad-btn ad-btn-danger ad-btn-sm" onClick={async () => {
                                        if(window.confirm('Delete this assessment?')) {
                                            await api.delete(`/coding/assessments/${ex._id}`);
                                            flash('Assessment deleted');
                                            loadData();
                                        }
                                    }}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        {assessments.length===0&&<tr><td colSpan={3} style={{textAlign:'center',color:t.textMuted,padding:28}}>No assessments yet.</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* ③ Challenge Architect (Question Builder) */}
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:t.text,marginBottom:12}}>③ Challenge Architect (Question Builder)</div>
            <div className="ad-card" style={{ background: t.surface, padding: '32px' }}>
                <form onSubmit={handleCreateQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Assign to Assessment (Optional)</div>
                            <select className="ad-select" value={qForm.assessmentId} onChange={e=>setQForm({...qForm, assessmentId: e.target.value})} style={{ padding: '12px 16px', fontSize: '14px', width: '100%' }}>
                                <option value="">Do not assign (Standalone Question)</option>
                                {assessments.map(ex => <option key={ex._id} value={ex._id}>{ex.title}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: '2 1 300px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Test Title</div>
                            <input className="ad-input" value={qForm.title} onChange={e=>setQForm({...qForm, title: e.target.value})} placeholder="e.g. Asynchronous Sequence Processing" required style={{ padding: '12px 16px', fontSize: '15px' }} />
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Rank Level</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {['Easy', 'Medium', 'Hard'].map(d => (
                                    <button key={d} type="button" onClick={() => setQForm({...qForm, difficulty: d})} 
                                        className="ad-btn"
                                        style={{ 
                                            flex: 1, padding: '10px 0', fontSize: '12px',
                                            background: qForm.difficulty === d ? t.accent : t.surfaceAlt, 
                                            color: qForm.difficulty === d ? '#fff' : t.textMuted,
                                            border: `1px solid ${qForm.difficulty === d ? t.accent : t.border}`
                                        }}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Department & Domain Type Selectors */}
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>🎯 Target Department Domain</div>
                            <select className="ad-select" value={qForm.department || 'ECE'} onChange={e=>setQForm({...qForm, department: e.target.value})} style={{ padding: '12px 16px', fontSize: '14px', width: '100%', fontWeight: 700 }}>
                                <option value="ECE">⚡ ECE — Electronics & Communication</option>
                                <option value="EEE">🔌 EEE — Electrical & Electronics</option>
                                <option value="CSE">💻 CSE — Computer Science</option>
                                <option value="IT">🌐 IT — Information Technology</option>
                                <option value="General">📘 General — All Departments</option>
                            </select>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>🧠 Question Domain Type</div>
                            <select className="ad-select" value={qForm.domain_type || 'embedded_c'} onChange={e=>setQForm({...qForm, domain_type: e.target.value})} style={{ padding: '12px 16px', fontSize: '14px', width: '100%', fontWeight: 700 }}>
                                <option value="embedded_c">🔌 Embedded C Microcontroller (ECE/EEE)</option>
                                <option value="verilog">⚡ Verilog HDL Digital Logic (ECE)</option>
                                <option value="dsp">📡 Digital Signal Processing (ECE)</option>
                                <option value="control_systems">⚙️ Control Systems & Power (EEE)</option>
                                <option value="hardware_image_analysis">📷 Hardware Image Analysis (ECE)</option>
                                <option value="software">💻 General Software Algorithm (CSE/IT)</option>
                            </select>
                        </div>
                    </div>

                    {/* Hardware Schematic / Image Input */}
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>
                            📷 Hardware Schematic / PCB Image URL (ECE & EEE)
                        </div>
                        <input 
                            className="ad-input" 
                            value={qForm.problemImage || ''} 
                            onChange={e => setQForm({...qForm, problemImage: e.target.value})} 
                            placeholder="e.g. https://example.com/schematic_diagram.png (Leave blank to use interactive vector schematic)" 
                            style={{ padding: '12px 16px', fontSize: '14px', fontFamily: 'monospace' }} 
                        />
                    </div>

                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Instruction Set</div>
                        <textarea className="ad-input" rows="5" value={qForm.description} onChange={e=>setQForm({...qForm, description: e.target.value})} placeholder="Document the challenge requirements..." required style={{ padding: '16px', resize: 'vertical' }}></textarea>
                    </div>

                    {/* Limits & Tags */}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '20px', background: t.surfaceAlt, borderRadius: '12px', border: `1px solid ${t.border}` }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Time Budget (min)</div>
                            <input type="number" className="ad-input" value={qForm.timeLimit} onChange={e=>setQForm({...qForm, timeLimit: e.target.value})} style={{ fontFamily: 'monospace' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Memory Peak (MB)</div>
                            <input type="number" className="ad-input" value={qForm.memoryLimit} onChange={e=>setQForm({...qForm, memoryLimit: e.target.value})} style={{ fontFamily: 'monospace' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textSub, marginBottom: '6px' }}>Tags (CSV)</div>
                            <input type="text" className="ad-input" value={qForm.tags} onChange={e=>setQForm({...qForm, tags: e.target.value})} placeholder="dp, recursion" style={{ fontFamily: 'monospace' }} />
                        </div>
                    </div>

                    {/* Public Examples */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: t.text }}>Public Examples</div>
                            <button type="button" onClick={addExample} style={{ background: 'none', border: 'none', color: t.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+ Add Example</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {qForm.examples.map((ex, i) => (
                                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <input className="ad-input" placeholder="Input" value={ex.input} onChange={e => {
                                        const newEx = [...qForm.examples]; newEx[i].input = e.target.value; setQForm({ ...qForm, examples: newEx });
                                    }} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                                    <input className="ad-input" placeholder="Output" value={ex.output} onChange={e => {
                                        const newEx = [...qForm.examples]; newEx[i].output = e.target.value; setQForm({ ...qForm, examples: newEx });
                                    }} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                                    <button type="button" className="ad-btn ad-btn-danger" onClick={() => {
                                        const newEx = [...qForm.examples]; newEx.splice(i, 1); setQForm({ ...qForm, examples: newEx });
                                    }}>🗑</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hidden Test Cases */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: t.text }}>Test Grid</div>
                            <button type="button" onClick={addTestCase} style={{ background: 'none', border: 'none', color: t.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+ Add Case</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                            {qForm.testCases.map((tc, i) => (
                                <div key={i} style={{ border: `1px solid ${t.border}`, background: t.surfaceAlt, padding: '16px', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span className="ad-badge ad-badge-medium">Case #{i + 1}</span>
                                        <button type="button" onClick={() => {
                                            const newTC = [...qForm.testCases]; newTC[i].isHidden = !newTC[i].isHidden; setQForm({ ...qForm, testCases: newTC });
                                        }} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: 'none', background: tc.isHidden ? t.errorBg : t.tabActiveBg, color: tc.isHidden ? t.errorText : t.accent, cursor: 'pointer' }}>
                                            {tc.isHidden ? 'Hidden' : 'Public'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input className="ad-input" placeholder="Raw Input" value={tc.input} onChange={e => {
                                            const newTC = [...qForm.testCases]; newTC[i].input = e.target.value; setQForm({ ...qForm, testCases: newTC });
                                        }} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                                        <input className="ad-input" placeholder="Expected Output" value={tc.expectedOutput} onChange={e => {
                                            const newTC = [...qForm.testCases]; newTC[i].expectedOutput = e.target.value; setQForm({ ...qForm, testCases: newTC });
                                        }} style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Starter Code */}
                    <div>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                            {['python', 'javascript', 'java', 'cpp'].map(lang => (
                                <button key={lang} type="button" onClick={() => setActiveCodeTab(lang)} 
                                    className="ad-btn"
                                    style={{ 
                                        padding: '6px 14px', fontSize: '12px', textTransform: 'uppercase',
                                        background: activeCodeTab === lang ? t.text : 'transparent', 
                                        color: activeCodeTab === lang ? t.bg : t.textMuted,
                                        border: `1px solid ${activeCodeTab === lang ? t.text : t.border}`
                                    }}>
                                    {lang}
                                </button>
                            ))}
                        </div>
                        <textarea className="ad-input" rows="8" value={qForm.starterCode[activeCodeTab]} onChange={e => {
                            const newSC = { ...qForm.starterCode, [activeCodeTab]: e.target.value };
                            setQForm({ ...qForm, starterCode: newSC });
                        }} style={{ fontFamily: 'monospace', background: '#0d1117', color: '#58a6ff', padding: '20px', border: 'none', borderRadius: '12px' }}></textarea>
                    </div>

                    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="ad-btn ad-btn-primary" style={{ padding: '14px 28px', fontSize: '15px' }}>Commit Challenge</button>
                    </div>
                </form>
            </div>

            {/* Existing Global Questions Bank */}
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:t.text,marginBottom:12, marginTop: '32px'}}>Challenge Bank</div>
            <div className="ad-table-wrap">
                <table className="ad-table">
                    <thead><tr><th>Title</th><th>Rank</th><th>Tags</th><th>Actions</th></tr></thead>
                    <tbody>
                        {codingQuestions.map(q => (
                            <tr key={q._id}>
                                <td><strong>{q.title}</strong></td>
                                <td><span className="ad-badge ad-badge-medium">{q.difficulty}</span></td>
                                <td style={{ fontFamily: 'monospace', fontSize: '12px', color: t.textMuted }}>{q.tags?.join(', ')}</td>
                                <td>
                                    <button className="ad-btn ad-btn-danger ad-btn-sm" onClick={async () => {
                                        if(window.confirm('Delete this challenge?')) {
                                            await api.delete(`/coding/questions/${q._id}`);
                                            flash('Challenge deleted');
                                            loadData();
                                        }
                                    }}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        {codingQuestions.length===0&&<tr><td colSpan={4} style={{textAlign:'center',color:t.textMuted,padding:28}}>No challenges engineered yet.</td></tr>}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
