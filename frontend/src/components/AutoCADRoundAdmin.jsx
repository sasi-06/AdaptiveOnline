import React, { useState, useEffect } from 'react';
import {
    getCadAssessments,
    createCadAssessment,
    updateCadAssessment,
    deleteCadAssessment,
    assignCadAssessment,
    getCadQuestions,
    createCadQuestion,
    updateCadQuestion,
    deleteCadQuestion
} from '../services/api';

export default function AutoCADRoundAdmin({ theme: t, students = [], flash, openTimeline }) {
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState('ALL');

    // Create Assessment Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        title: '',
        description: '',
        total_questions: 0,
        duration: 60,
        cad_level: 'Level 1 — Basic'
    });

    // Details / Management View state
    const [selectedAssessment, setSelectedAssessment] = useState(null);
    const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'questions' | 'students'

    // CAD Questions state
    const [cadQuestions, setCadQuestions] = useState([]);
    const [questionsLoading, setQuestionsLoading] = useState(false);
    const [showQModal, setShowQModal] = useState(false);
    const [editingQ, setEditingQ] = useState(null);
    const [qSubmitting, setQSubmitting] = useState(false);
    const [qForm, setQForm] = useState({
        question_text: '',
        instructions: '',
        marks: 10,
        difficulty: 'medium'
    });
    const [qImageFile, setQImageFile] = useState(null);
    const [qImagePreview, setQImagePreview] = useState('');
    const [previewImageModal, setPreviewImageModal] = useState(null);

    // Student Assignment states inside Details View or Assign Modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTarget, setAssignTarget] = useState(null);
    const [deptFilter, setDeptFilter] = useState('ALL');
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        loadAssessments();
    }, []);

    useEffect(() => {
        if (selectedAssessment?._id) {
            if (detailTab === 'questions') {
                loadCadQuestions(selectedAssessment._id);
            }
        }
    }, [selectedAssessment, detailTab]);

    const loadAssessments = async () => {
        setLoading(true);
        try {
            const res = await getCadAssessments();
            setAssessments(res.data || []);
            if (selectedAssessment) {
                const updated = (res.data || []).find(a => a._id === selectedAssessment._id);
                if (updated) setSelectedAssessment(updated);
            }
        } catch (err) {
            flash('Failed to load AutoCAD assessments', true);
        } finally {
            setLoading(false);
        }
    };

    const loadCadQuestions = async (assessmentId) => {
        setQuestionsLoading(true);
        try {
            const res = await getCadQuestions(assessmentId);
            setCadQuestions(res.data || []);
        } catch (err) {
            flash('Failed to load CAD questions', true);
        } finally {
            setQuestionsLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return flash('Assessment Name is required', true);

        setSubmitting(true);
        try {
            await createCadAssessment(form);
            flash('AutoCAD Assessment created successfully!');
            setShowCreateModal(false);
            setForm({
                title: '',
                description: '',
                total_questions: 0,
                duration: 60,
                cad_level: 'Level 1 — Basic'
            });
            await loadAssessments();
        } catch (err) {
            flash(err.response?.data?.message || 'Error creating CAD assessment', true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Delete AutoCAD Assessment "${title}"?`)) return;
        try {
            await deleteCadAssessment(id);
            flash('AutoCAD Assessment deleted.');
            if (selectedAssessment && selectedAssessment._id === id) {
                setSelectedAssessment(null);
            }
            await loadAssessments();
        } catch (err) {
            flash('Error deleting assessment', true);
        }
    };

    // ──────────────── CAD QUESTION HANDLERS ────────────────
    const openAddQuestion = () => {
        setEditingQ(null);
        setQForm({
            question_text: '',
            instructions: '',
            marks: 10,
            difficulty: 'medium'
        });
        setQImageFile(null);
        setQImagePreview('');
        setShowQModal(true);
    };

    const openEditQuestion = (q) => {
        setEditingQ(q);
        setQForm({
            question_text: q.question_text || '',
            instructions: q.instructions || '',
            marks: q.marks || 10,
            difficulty: q.difficulty || 'medium'
        });
        setQImageFile(null);
        setQImagePreview(q.image_url || '');
        setShowQModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setQImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setQImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSaveQuestion = async (e) => {
        e.preventDefault();
        if (!qForm.question_text.trim()) return flash('Question text is required', true);

        setQSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('question_text', qForm.question_text);
            formData.append('instructions', qForm.instructions);
            formData.append('marks', qForm.marks);
            formData.append('difficulty', qForm.difficulty);
            if (qImageFile) {
                formData.append('image', qImageFile);
            }

            if (editingQ) {
                await updateCadQuestion(editingQ._id, formData);
                flash('CAD question updated successfully!');
            } else {
                await createCadQuestion(selectedAssessment._id, formData);
                flash('CAD question added successfully!');
            }

            setShowQModal(false);
            setQForm({ question_text: '', instructions: '', marks: 10, difficulty: 'medium' });
            setQImageFile(null);
            setQImagePreview('');
            await loadCadQuestions(selectedAssessment._id);
            await loadAssessments();
        } catch (err) {
            flash(err.response?.data?.message || 'Error saving CAD question', true);
        } finally {
            setQSubmitting(false);
        }
    };

    const handleDeleteQuestion = async (qId) => {
        if (!window.confirm('Delete this CAD question?')) return;
        try {
            await deleteCadQuestion(qId);
            flash('CAD question deleted.');
            await loadCadQuestions(selectedAssessment._id);
            await loadAssessments();
        } catch (err) {
            flash('Error deleting question', true);
        }
    };

    // ──────────────── STUDENT ASSIGNMENT HANDLERS ────────────────
    const openAssign = (asm) => {
        setAssignTarget(asm);
        const currentIds = (asm.assigned_students || []).map(s => typeof s === 'object' ? s._id : s);
        setSelectedStudentIds(currentIds);
        setShowAssignModal(true);
    };

    const handleAssign = async (e) => {
        if (e) e.preventDefault();
        const targetId = assignTarget ? assignTarget._id : selectedAssessment?._id;
        if (!targetId) return;

        setAssigning(true);
        try {
            await assignCadAssessment({
                assessmentId: targetId,
                studentIds: selectedStudentIds
            });
            flash('Students assigned successfully to AutoCAD Assessment!');
            setShowAssignModal(false);
            await loadAssessments();
        } catch (err) {
            flash('Error assigning students', true);
        } finally {
            setAssigning(false);
        }
    };

    const filteredAssessments = assessments.filter(a => {
        const matchesSearch = !searchQuery ||
            a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (a.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLevel = levelFilter === 'ALL' || a.cad_level === levelFilter;
        return matchesSearch && matchesLevel;
    });

    const levelBadgeColor = (level) => {
        if (level?.includes('Advanced')) return '#ef4444';
        if (level?.includes('Intermediate')) return '#f59e0b';
        return '#22c55e';
    };

    // ────────────────────── DETAILS VIEW ──────────────────────
    if (selectedAssessment) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Header with Back Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <button
                            className="ad-btn ad-btn-ghost ad-btn-sm"
                            style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={() => setSelectedAssessment(null)}
                        >
                            ← Back to AutoCAD Assessments
                        </button>
                        <h2 className="ad-page-title" style={{ margin: 0 }}>
                             {selectedAssessment.title}
                        </h2>
                        <p style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>
                            {selectedAssessment.category || 'Civil Engineering Assessments'} • {selectedAssessment.assessment_type || 'AutoCAD / 2D Drawing Assessment'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            className="ad-btn ad-btn-secondary"
                            onClick={() => setDetailTab('questions')}
                        >
                             Configure Questions ({cadQuestions.length || selectedAssessment.questions?.length || 0})
                        </button>
                        <button className="ad-btn ad-btn-secondary" onClick={() => openAssign(selectedAssessment)}>
                             Assign Students ({selectedAssessment.assigned_students?.length || 0})
                        </button>
                        <button
                            className="ad-btn ad-btn-danger"
                            onClick={() => handleDelete(selectedAssessment._id, selectedAssessment.title)}
                        >
                             Delete Assessment
                        </button>
                    </div>
                </div>

                {/* Nav Tabs */}
                <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${t.border}`, paddingBottom: 8 }}>
                    {[
                        { key: 'overview', label: ' Overview' },
                        { key: 'questions', label: ` Questions (${cadQuestions.length || selectedAssessment.questions?.length || 0})` },
                        { key: 'students', label: ' Students' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            className={`ad-btn ${detailTab === tab.key ? 'ad-btn-primary' : 'ad-btn-ghost'} ad-btn-sm`}
                            onClick={() => setDetailTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW TAB */}
                {detailTab === 'overview' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                        <div className="ad-card">
                            <div className="ad-card-title">Assessment Metadata</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12, fontSize: 14 }}>
                                <div>
                                    <strong style={{ color: t.textSub }}>Description:</strong>
                                    <p style={{ color: t.text, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                        {selectedAssessment.description || 'No description provided.'}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
                                    <span style={{ color: t.textMuted }}>CAD Level:</span>
                                    <span className="ad-badge" style={{ background: levelBadgeColor(selectedAssessment.cad_level) + '22', color: levelBadgeColor(selectedAssessment.cad_level), border: `1px solid ${levelBadgeColor(selectedAssessment.cad_level)}44` }}>
                                        {selectedAssessment.cad_level}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
                                    <span style={{ color: t.textMuted }}>Duration:</span>
                                    <strong>{selectedAssessment.duration} minutes</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
                                    <span style={{ color: t.textMuted }}>Total Questions:</span>
                                    <strong>{selectedAssessment.total_questions || selectedAssessment.questions?.length || cadQuestions.length || 0}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
                                    <span style={{ color: t.textMuted }}>Created At:</span>
                                    <span>{new Date(selectedAssessment.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="ad-card">
                            <div className="ad-card-title">Assigned Students ({selectedAssessment.assigned_students?.length || 0})</div>
                            <div style={{ marginTop: 12 }}>
                                {(!selectedAssessment.assigned_students || selectedAssessment.assigned_students.length === 0) ? (
                                    <div style={{ color: t.textMuted, fontSize: 13, padding: '16px 0' }}>
                                        No students assigned to this AutoCAD assessment yet.
                                    </div>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 240, overflowY: 'auto' }}>
                                        {selectedAssessment.assigned_students.map(st => (
                                            <li key={typeof st === 'object' ? st._id : st} style={{ padding: '8px 0', borderBottom: `1px solid ${t.border}`, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                                                <strong>{typeof st === 'object' ? st.name : st}</strong>
                                                <span style={{ color: t.textMuted }}>{typeof st === 'object' ? st.email : ''}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* QUESTIONS TAB */}
                {detailTab === 'questions' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>AutoCAD Question Bank</h3>
                                <p style={{ fontSize: 13, color: t.textMuted, margin: '2px 0 0' }}>
                                    Configure drawing prompts, CAD specs, and upload reference drawing photos.
                                </p>
                            </div>
                            <button className="ad-btn ad-btn-primary" onClick={openAddQuestion}>
                                ＋ Add CAD Question
                            </button>
                        </div>

                        {questionsLoading ? (
                            <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading CAD questions...</div>
                        ) : cadQuestions.length === 0 ? (
                            <div className="ad-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}></div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>No CAD Questions Configured Yet</h3>
                                <p style={{ color: t.textMuted, fontSize: 14, maxWidth: 480, margin: '8px auto 16px' }}>
                                    Click below to add your first 2D drawing prompt, instruction constraints, and optional blueprint reference photo.
                                </p>
                                <button className="ad-btn ad-btn-primary" onClick={openAddQuestion}>
                                    ＋ Add First CAD Question
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {cadQuestions.map((q, idx) => (
                                    <div key={q._id} className="ad-card" style={{ padding: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                        {/* Image preview thumbnail if attached */}
                                        {q.image_url ? (
                                            <div
                                                style={{ width: 140, height: 110, borderRadius: 10, border: `1px solid ${t.border}`, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, position: 'relative', background: t.surfaceAlt }}
                                                onClick={() => setPreviewImageModal(q.image_url)}
                                                title="Click to view full size photo"
                                            >
                                                <img src={q.image_url} alt="Reference Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <span style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}> Enlarge</span>
                                            </div>
                                        ) : (
                                            <div style={{ width: 100, height: 90, borderRadius: 10, border: `1.5px dashed ${t.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: t.textMuted, fontSize: 11 }}>
                                                <span></span> No Photo
                                            </div>
                                        )}

                                        {/* Question content */}
                                        <div style={{ flex: 1, minWidth: 260 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                                <span style={{ fontWeight: 800, fontSize: 15, color: t.accent }}>Q{idx + 1}.</span>
                                                <span className="ad-badge" style={{ background: levelBadgeColor(q.difficulty) + '22', color: levelBadgeColor(q.difficulty) }}>
                                                    {q.difficulty?.toUpperCase()}
                                                </span>
                                                <span className="ad-badge" style={{ background: t.surfaceAlt }}>
                                                    {q.marks} Marks
                                                </span>
                                            </div>

                                            <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: '4px 0', whiteSpace: 'pre-wrap' }}>
                                                {q.question_text}
                                            </p>

                                            {q.instructions && (
                                                <div style={{ fontSize: 13, color: t.textMuted, marginTop: 8, background: t.surfaceAlt, padding: '8px 12px', borderRadius: 8, borderLeft: `3px solid ${t.accent}` }}>
                                                    <strong>Instructions:</strong> {q.instructions}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                            <button className="ad-btn ad-btn-secondary ad-btn-sm" onClick={() => openEditQuestion(q)}>
                                                 Edit
                                            </button>
                                            <button className="ad-btn ad-btn-danger ad-btn-sm" onClick={() => handleDeleteQuestion(q._id)}>
                                                 Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STUDENTS TAB */}
                {detailTab === 'students' && (
                    <div className="ad-card">
                        <div className="ad-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                            <span>Manage Student Assignments</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: t.textMuted }}>Department:</span>
                                <select className="ad-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: 140 }}>
                                    <option value="ALL">All Depts</option>
                                    <option value="CIVIL">CIVIL</option>
                                    <option value="ECE">ECE</option>
                                    <option value="EEE">EEE</option>
                                    <option value="CSE">CSE</option>
                                </select>
                            </div>
                        </div>

                        <form onSubmit={handleAssign} style={{ marginTop: 16 }}>
                            <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, background: t.inputBg }}>
                                {students
                                    .filter(s => deptFilter === 'ALL' || (s.department || '').toUpperCase().includes(deptFilter.toUpperCase()))
                                    .map(s => {
                                        const isChecked = selectedStudentIds.includes(s._id);
                                        return (
                                            <label key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedStudentIds(prev => [...prev, s._id]);
                                                            else setSelectedStudentIds(prev => prev.filter(id => id !== s._id));
                                                        }}
                                                    />
                                                    <div>
                                                        <strong style={{ fontSize: 13 }}>{s.name}</strong>
                                                        <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 8 }}>({s.email})</span>
                                                    </div>
                                                </div>
                                                <span className="ad-badge" style={{ fontSize: 11 }}>{s.department || 'General'}</span>
                                            </label>
                                        );
                                    })}
                            </div>
                            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="ad-btn ad-btn-primary" disabled={assigning}>
                                    {assigning ? 'Saving Assignments...' : ' Save Student Assignments'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}


                {/* ADD / EDIT CAD QUESTION MODAL */}
                {showQModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        <div className="ad-card" style={{ width: '100%', maxWidth: 580, background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${t.border}`, paddingBottom: 12 }}>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                                    {editingQ ? ' Edit CAD Question' : '＋ Add New CAD Question'}
                                </h3>
                                <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setShowQModal(false)}></button>
                            </div>

                            <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                        Question / 2D Drawing Prompt *
                                    </label>
                                    <textarea
                                        className="ad-input"
                                        rows={3}
                                        placeholder="e.g. Draw the 2D architectural floor plan with wall thickness 230mm, door width 900mm..."
                                        value={qForm.question_text}
                                        onChange={e => setQForm({ ...qForm, question_text: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                        Instructions / Drawing Constraints
                                    </label>
                                    <textarea
                                        className="ad-input"
                                        rows={2}
                                        placeholder="e.g. Use layer WALLS for outer boundaries, DIMENSIONS for linear dimensions. Units: mm."
                                        value={qForm.instructions}
                                        onChange={e => setQForm({ ...qForm, instructions: e.target.value })}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                            Marks
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            className="ad-input"
                                            value={qForm.marks}
                                            onChange={e => setQForm({ ...qForm, marks: +e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                            Difficulty
                                        </label>
                                        <select
                                            className="ad-select"
                                            value={qForm.difficulty}
                                            onChange={e => setQForm({ ...qForm, difficulty: e.target.value })}
                                        >
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                        Reference Image / Blueprint Photo (Optional)
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="ad-input"
                                        onChange={handleImageChange}
                                    />
                                    {qImagePreview && (
                                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <img
                                                src={qImagePreview}
                                                alt="Preview"
                                                style={{ width: 100, height: 75, objectFit: 'cover', borderRadius: 8, border: `1px solid ${t.border}` }}
                                            />
                                            <span style={{ fontSize: 12, color: t.textMuted }}>Photo attached cleanly</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setShowQModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="ad-btn ad-btn-primary" disabled={qSubmitting}>
                                        {qSubmitting ? 'Saving Question...' : (editingQ ? 'Update Question' : 'Save CAD Question')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* FULL IMAGE LIGHTBOX MODAL */}
                {previewImageModal && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                        onClick={() => setPreviewImageModal(null)}
                    >
                        <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                            <button
                                style={{ position: 'absolute', top: -14, right: -14, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                onClick={() => setPreviewImageModal(null)}
                            >
                                
                            </button>
                            <img src={previewImageModal} alt="Enlarged Reference Drawing" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12, border: `2px solid ${t.border}` }} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ────────────────────── DASHBOARD LIST VIEW ──────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h2 className="ad-page-title" style={{ margin: 0 }}>AutoCAD Assessments</h2>
                    <p style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>
                        Manage Civil Engineering 2D CAD drawing assessments & questions.
                    </p>
                </div>
                <button
                    className="ad-btn ad-btn-primary"
                    onClick={() => setShowCreateModal(true)}
                    style={{ padding: '10px 18px', fontSize: 14 }}
                >
                    ＋ Create Assessment
                </button>
            </div>

            {/* Controls Bar: Search & Filters */}
            <div className="ad-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 240px' }}>
                        <input
                            className="ad-input"
                            placeholder=" Search CAD assessments..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div>
                        <select
                            className="ad-select"
                            value={levelFilter}
                            onChange={e => setLevelFilter(e.target.value)}
                            style={{ width: 190 }}
                        >
                            <option value="ALL">All CAD Levels</option>
                            <option value="Level 1 — Basic">Level 1 — Basic</option>
                            <option value="Level 2 — Intermediate">Level 2 — Intermediate</option>
                            <option value="Level 3 — Advanced">Level 3 — Advanced</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Assessment Cards / Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading AutoCAD Assessments...</div>
            ) : filteredAssessments.length === 0 ? (
                <div className="ad-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}></div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>No AutoCAD Assessments Found</h3>
                    <p style={{ color: t.textMuted, fontSize: 14, margin: '8px 0 16px' }}>
                        {assessments.length === 0
                            ? 'Get started by creating your first Civil Engineering CAD drawing assessment.'
                            : 'No assessments match your search and filter criteria.'}
                    </p>
                    {assessments.length === 0 && (
                        <button className="ad-btn ad-btn-primary" onClick={() => setShowCreateModal(true)}>
                            ＋ Create AutoCAD Assessment
                        </button>
                    )}
                </div>
            ) : (
                <div className="ad-table-wrap">
                    <table className="ad-table">
                        <thead>
                            <tr>
                                <th>Assessment Name</th>
                                <th>CAD Level</th>
                                <th>Questions</th>
                                <th>Duration</th>
                                <th>Assigned Students</th>
                                <th>Created Date</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssessments.map(asm => (
                                <tr key={asm._id}>
                                    <td>
                                        <strong style={{ color: t.text, fontSize: 14 }}>{asm.title}</strong>
                                        {asm.description && (
                                            <div style={{ fontSize: 12, color: t.textMuted, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {asm.description}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className="ad-badge" style={{ background: levelBadgeColor(asm.cad_level) + '22', color: levelBadgeColor(asm.cad_level), border: `1px solid ${levelBadgeColor(asm.cad_level)}44` }}>
                                            {asm.cad_level}
                                        </span>
                                    </td>
                                    <td>{asm.total_questions || asm.questions?.length || 0}</td>
                                    <td>{asm.duration} mins</td>
                                    <td>
                                        <span className="ad-badge" style={{ background: t.surfaceAlt }}>
                                             {asm.assigned_students?.length || 0} Students
                                        </span>
                                    </td>
                                    <td className="ad-cell-muted">
                                        {new Date(asm.createdAt).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            <button
                                                className="ad-btn ad-btn-primary ad-btn-sm"
                                                onClick={() => {
                                                    setSelectedAssessment(asm);
                                                    setDetailTab('overview');
                                                }}
                                                title="View Assessment Details"
                                            >
                                                 Details
                                            </button>
                                            <button
                                                className="ad-btn ad-btn-secondary ad-btn-sm"
                                                onClick={() => {
                                                    setSelectedAssessment(asm);
                                                    setDetailTab('questions');
                                                }}
                                                title="Configure CAD Questions"
                                            >
                                                 Questions
                                            </button>
                                            <button
                                                className="ad-btn ad-btn-secondary ad-btn-sm"
                                                onClick={() => openAssign(asm)}
                                            >
                                                Assign
                                            </button>
                                            <button
                                                className="ad-btn ad-btn-danger ad-btn-sm"
                                                onClick={() => handleDelete(asm._id, asm.title)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* CREATE ASSESSMENT MODAL */}
            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: 20 }}>
                    <div className="ad-card" style={{ width: '100%', maxWidth: 540, margin: 'auto', background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: `1px solid ${t.border}`, paddingBottom: 12 }}>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}> Create AutoCAD Assessment</h3>
                            <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setShowCreateModal(false)}></button>
                        </div>

                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                    Assessment Name *
                                </label>
                                <input
                                    className="ad-input"
                                    placeholder="e.g. 2D Architectural Floor Plan Assessment"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                    Description / Instructions
                                </label>
                                <textarea
                                    className="ad-input"
                                    rows={3}
                                    placeholder="Instructions for students regarding drawing layer specs, units, and geometric constraints..."
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                        Number of Questions
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        className="ad-input"
                                        value={form.total_questions}
                                        onChange={e => setForm({ ...form, total_questions: +e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                        Total Duration (Minutes)
                                    </label>
                                    <input
                                        type="number"
                                        min={5}
                                        className="ad-input"
                                        value={form.duration}
                                        onChange={e => setForm({ ...form, duration: +e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: 13, fontWeight: 600, color: t.textSub, display: 'block', marginBottom: 6 }}>
                                    CAD Level *
                                </label>
                                <select
                                    className="ad-select"
                                    value={form.cad_level}
                                    onChange={e => setForm({ ...form, cad_level: e.target.value })}
                                >
                                    <option value="Level 1 — Basic">Level 1 — Basic</option>
                                    <option value="Level 2 — Intermediate">Level 2 — Intermediate</option>
                                    <option value="Level 3 — Advanced">Level 3 — Advanced</option>
                                </select>
                            </div>

                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setShowCreateModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="ad-btn ad-btn-primary" disabled={submitting}>
                                    {submitting ? 'Creating...' : '+ Create Assessment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ASSIGN STUDENTS MODAL */}
            {showAssignModal && assignTarget && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyCenter: 'center', padding: 20 }}>
                    <div className="ad-card" style={{ width: '100%', maxWidth: 520, margin: 'auto', background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${t.border}`, paddingBottom: 12 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}> Assign Students</h3>
                                <p style={{ fontSize: 13, color: t.textMuted, margin: '2px 0 0' }}>{assignTarget.title}</p>
                            </div>
                            <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setShowAssignModal(false)}></button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Filter Department:</span>
                            <select className="ad-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: 150 }}>
                                <option value="ALL">All Depts</option>
                                <option value="CIVIL">CIVIL</option>
                                <option value="ECE">ECE</option>
                                <option value="EEE">EEE</option>
                                <option value="CSE">CSE</option>
                            </select>
                        </div>

                        <form onSubmit={handleAssign}>
                            <div style={{ maxHeight: 240, overflowY: 'auto', border: `1px solid ${t.border}`, borderRadius: 8, padding: 10, background: t.inputBg }}>
                                {students
                                    .filter(s => deptFilter === 'ALL' || (s.department || '').toUpperCase().includes(deptFilter.toUpperCase()))
                                    .map(s => {
                                        const isChecked = selectedStudentIds.includes(s._id);
                                        return (
                                            <label key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', cursor: 'pointer' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedStudentIds(prev => [...prev, s._id]);
                                                            else setSelectedStudentIds(prev => prev.filter(id => id !== s._id));
                                                        }}
                                                    />
                                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                                                </div>
                                                <span style={{ fontSize: 12, color: t.textMuted }}>{s.department || 'General'}</span>
                                            </label>
                                        );
                                    })}
                            </div>

                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setShowAssignModal(false)}>Cancel</button>
                                <button type="submit" className="ad-btn ad-btn-primary" disabled={assigning}>
                                    {assigning ? 'Assigning...' : 'Assign Selected Students'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
