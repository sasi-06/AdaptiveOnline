import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx'; // npm install xlsx
import {
    getStudents, createStudent, deleteStudent, bulkUploadStudents,
    getExams, createExam, deleteExam, assignExam,
    getQuestions, bulkUploadQ,
    getAllResults, getAllBehaviorLogs,
    updateExamQuestions, // see api.js
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SimulationRoundAdmin from '../components/SimulationRoundAdmin';
import TechnicalInterviewAdmin from '../components/TechnicalInterviewAdmin';
import ThemeSwitcher from '../components/ThemeSwitcher';
import AdminLiveProctor from '../components/AdminLiveProctor';
import AdminCodingResults from '../components/AdminCodingResults';
import AdminAlerts from '../components/AdminAlerts';
import BehaviorTimeline from '../components/BehaviorTimeline';
import CodingRoundManager from '../components/CodingRoundManager';
import AdminInterviewResults from '../components/AdminInterviewResults';
import AdminPlagiarismDetector from '../components/AdminPlagiarismDetector';
import AutoCADRoundAdmin from '../components/AutoCADRoundAdmin';
import AdminCadResults from '../components/AdminCadResults';
import { getBehaviorLogs } from '../services/api';

const SECTIONS = ['Overview', 'Students', 'Exams (MCQ Module)', 'Coding Round', 'Plagiarism Detector', 'Simulation Round', 'Technical Interview', 'AutoCAD Assessments', 'AutoCAD Results', 'MCQ Results', 'Coding Results', 'Interview Reports', 'Security Alerts', 'Behavior', 'Live Monitor'];
const SECTION_ICONS = { Overview: '', Students: '', 'Exams (MCQ Module)': '', 'Coding Round': '', 'Simulation Round': '', 'Technical Interview': '', 'MCQ Results': '', 'Coding Results': '', 'Interview Reports': '', 'Security Alerts': '', Behavior: '', 'Live Monitor': '' };
const EMPTY_STUDENT = {
    name: '',
    email: '',
    password: '',
    rollno: '',
    age: '',
    phone_number: '',
    department: '',
    year_of_study: '',
    college: '',
    gender: ''
};

function rowToQuestion(row) {
    const get = (keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k]; return ''; };
    const raw = get(['options', 'Options']);
    const options = typeof raw === 'string' ? raw.split(',').map(s => s.trim()).filter(Boolean) : Array.isArray(raw) ? raw : [];
    return {
        question_text: String(get(['question_text','question','Question']) || '').trim(),
        options,
        correct_answer: String(get(['correct_answer','answer','Answer']) || '').trim(),
        topic: String(get(['topic','Topic']) || '').trim(),
        concept: String(get(['concept','Concept']) || '').trim(),
        difficulty: String(get(['difficulty','Difficulty']) || 'medium').toLowerCase().trim(),
        structure_type: String(get(['structure_type','type','Type']) || 'mcq').toLowerCase().trim(),
        marks: Number(get(['marks','Marks'])) || 1,
    };
}

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { theme: t } = useTheme();
    const adminName = localStorage.getItem('name') || 'Admin';

    const [section, setSection] = useState('Overview');
    const [civilExpanded, setCivilExpanded] = useState(true);
    const fileInputRef = useRef(null);
    const studentFormRef = useRef(null);

    const [students, setStudents] = useState([]);
    const [exams, setExams] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [results, setResults] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [studentForm, setStudentForm] = useState({ ...EMPTY_STUDENT });
    const [examForm, setExamForm] = useState({ 
        title: '', 
        description: '', 
        per_question_time: { easy: 60, medium: 120, hard: 180 } 
    });
    const [assignForm, setAssignForm] = useState({ examId: '', studentIds: [] });

    // ── Department-wise Workflow States ──
    // Removed Departments States

    // ── Two-column configurator state ──
    const [configExam, setConfigExam] = useState(null);
    const [available, setAvailable] = useState([]); // left column
    const [selected, setSelected] = useState([]); // right column
    const [configSaving, setConfigSaving] = useState(false);
    const [avSearch, setAvSearch] = useState('');
    const [avFilter, setAvFilter] = useState('all');
    const [selSearch, setSelSearch] = useState('');
    const [dragItem, setDragItem] = useState(null); // { q, from }

    // ── Upload inside configurator ──
    const qUploadRef = useRef(null);
    const [qPreview, setQPreview] = useState([]);
    const [qUploading, setQUploading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
    const [cfgDeptFilter, setCfgDeptFilter] = useState('ALL');

    // ── Questions section: grouped by exam ──
    const [expandedExam, setExpandedExam] = useState(null);

    // ── Timeline Modal State ──
    const [showTimeline, setShowTimeline] = useState(false);
    const [timelineLogs, setTimelineLogs] = useState([]);
    const [timelineStudent, setTimelineStudent] = useState(null);
    const [tlLoading, setTlLoading] = useState(false);

    useEffect(() => { loadAll(); }, []);

    const openTimeline = async (studentId, examId, studentName) => {
        setTlLoading(true);
        setTimelineStudent(studentName);
        setShowTimeline(true);
        try {
            const res = await getBehaviorLogs(studentId, examId);
            setTimelineLogs(res.data);
        } catch {
            setError('Failed to fetch behavior logs.');
        } finally {
            setTlLoading(false);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [s, e, q, r, l] = await Promise.all([
                getStudents(), getExams(), getQuestions(), getAllResults(), getAllBehaviorLogs()
            ]);
            setStudents(s.data); setExams(e.data); setQuestions(q.data);
            setResults(r.data); setLogs(l.data);
        } catch { setError('Failed to load data.'); }
        finally { setLoading(false); }
    };

    // ── (Department handlers removed) ──

    const flash = (msg, isErr = false) => {
        isErr ? setError(msg) : setSuccess(msg);
        setTimeout(() => { setError(''); setSuccess(''); }, 3500);
    };
    const handleLogout = () => { localStorage.clear(); navigate('/'); };

    // ── Students ──
    const handleCreateStudent = async (e) => {
        e.preventDefault();
        try {
            await createStudent({ ...studentForm });
            setStudentForm({ ...EMPTY_STUDENT });
            if (studentFormRef.current) studentFormRef.current.reset();
            flash('Student created!'); await loadAll();
        } catch (err) { flash(err.response?.data?.message || 'Error creating student', true); }
    };
    const handleBulkUploadStudents = async (e) => {
        e.preventDefault();
        const file = fileInputRef.current?.files?.[0];
        if (!file) { flash('Please select an Excel file', true); return; }
        const formData = new FormData(); formData.append('file', file);
        try {
            const res = await bulkUploadStudents(formData);
            flash(res.data.message, res.data.errors?.length > 0);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadAll();
        } catch (err) { flash(err.response?.data?.message || 'Upload error', true); }
    };
    const handleDeleteStudent = async (id) => {
        if (!window.confirm('Delete this student?')) return;
        await deleteStudent(id); flash('Student deleted.'); loadAll();
    };

    // ── Exams ──
    const handleCreateExam = async (e) => {
        e.preventDefault();
        try {
            await createExam(examForm);
            setExamForm({ 
                title: '', 
                description: '', 
                per_question_time: { easy: 60, medium: 120, hard: 180 } 
            });
            flash('Exam created!'); loadAll();
        } catch (err) { flash(err.response?.data?.message || 'Error creating exam', true); }
    };
    const handleDeleteExam = async (id) => {
        if (!window.confirm('Delete this exam?')) return;
        await deleteExam(id); flash('Exam deleted.'); loadAll();
    };
    const handleAssignExam = async (e) => {
        e.preventDefault();
        try {
            await assignExam({ examId: assignForm.examId, studentIds: assignForm.studentIds });
            flash('Exam assigned!'); loadAll();
        } catch { flash('Error assigning exam', true); }
    };

    // ── Open configurator ──
    // Available = global bank questions NOT in this exam
    // Selected = questions already tagged/linked to this exam
    const openConfigurator = (exam) => {
        const attachedIds = new Set(
            (exam.questions || []).map(q => (typeof q === 'object' ? q._id : q))
        );
        const qsForThisExam = questions.filter(q => (q.examId === exam._id || q.exam_id === exam._id) && q.difficulty !== 'validation');
        setSelected(qsForThisExam.filter(q => attachedIds.has(q._id)));
        setAvailable(qsForThisExam.filter(q => !attachedIds.has(q._id)));
        setConfigExam(exam);
        setAvSearch(''); setSelSearch(''); setAvFilter('all');
        setQPreview([]); setShowUpload(false);
    };
    const closeConfigurator = () => { setConfigExam(null); setQPreview([]); };

    // ── Move between columns ──
    const moveToSelected = (q) => { setAvailable(p => p.filter(x => x._id !== q._id)); setSelected(p => [...p, q]); };
    const moveToAvailable = (q) => { setSelected(p => p.filter(x => x._id !== q._id)); setAvailable(p => [...p, q]); };

    const matchesAvFilter = useCallback((q) => {
        const ms = !avSearch || q.question_text?.toLowerCase().includes(avSearch.toLowerCase()) || q.topic?.toLowerCase().includes(avSearch.toLowerCase());
        const md = avFilter === 'all' || q.difficulty === avFilter;
        const mdept = cfgDeptFilter === 'ALL' || (q.department || 'GENERAL').toUpperCase().includes(cfgDeptFilter.toUpperCase());
        return ms && md && mdept;
    }, [avSearch, avFilter, cfgDeptFilter]);

    const matchesSelFilter = useCallback((q) =>
        !selSearch || q.question_text?.toLowerCase().includes(selSearch.toLowerCase()) || q.topic?.toLowerCase().includes(selSearch.toLowerCase()),
    [selSearch]);

    const moveAllToSelected = () => {
        const f = available.filter(matchesAvFilter);
        setSelected(p => [...p, ...f]);
        setAvailable(p => p.filter(q => !f.find(x => x._id === q._id)));
    };
    const moveAllToAvailable = () => {
        const f = selected.filter(matchesSelFilter);
        setAvailable(p => [...p, ...f]);
        setSelected(p => p.filter(q => !f.find(x => x._id === q._id)));
    };

    // ── Drag & drop ──
    const handleDragStart = (q, from) => setDragItem({ q, from });
    const handleDragEnd = () => setDragItem(null);
    const handleDropOnSelected = (e) => { e.preventDefault(); if (dragItem?.from === 'available') moveToSelected(dragItem.q); setDragItem(null); };
    const handleDropOnAvailable = (e) => { e.preventDefault(); if (dragItem?.from === 'selected') moveToAvailable(dragItem.q); setDragItem(null); };

    // ── Save ──
    const handleSaveConfig = async () => {
        if (!configExam) return;
        setConfigSaving(true);
        try {
            await updateExamQuestions(configExam._id, { questionIds: selected.map(q => q._id) });
            flash(`"${configExam.title}" saved with ${selected.length} question(s)!`);
            await loadAll();
            closeConfigurator();
        } catch (err) { flash(err.response?.data?.message || 'Error saving', true); }
        finally { setConfigSaving(false); }
    };

    // ── Excel parse ──
    const handleQFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) { setQPreview([]); return; }
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                setQPreview(XLSX.utils.sheet_to_json(ws, { defval: '' }).map(rowToQuestion).filter(q => q.question_text));
            } catch { flash('Cannot parse file. Use .xlsx or .csv', true); setQPreview([]); }
        };
        reader.readAsArrayBuffer(file);
    };

    // ── Upload to global bank → immediately move to Selected column ──
    const handleUploadToExam = async () => {
        if (!qPreview.length) { flash('No questions to upload', true); return; }
        setQUploading(true);
        try {
            const res = await bulkUploadQ({ examId: configExam._id, questions: qPreview });
            const newQs = res.data?.questions || res.data || [];
            // Place them straight into the Selected (right) column
            setSelected(prev => [...prev, ...(Array.isArray(newQs) ? newQs : [])]);
            flash(`${qPreview.length} question(s) uploaded & added to Selected!`);
            setQPreview([]); setShowUpload(false);
            if (qUploadRef.current) qUploadRef.current.value = '';
            await loadAll();
        } catch (err) { flash(err.response?.data?.message || 'Upload failed', true); }
        finally { setQUploading(false); }
    };

    const downloadQTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['question_text','options','correct_answer','topic','concept','difficulty','structure_type','marks'],
            ['What is 2+2?','1,2,3,4','4','Math','Addition','easy','mcq',1],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        XLSX.writeFile(wb, 'questions_template.xlsx');
    };

    const filteredAvailable = available.filter(matchesAvFilter);
    const filteredSelected = selected.filter(matchesSelFilter);

    // ── Questions section: group by exam ──
    const questionsByExam = exams.map(ex => ({
        exam: ex,
        qs: questions.filter(q => {
            if (q.difficulty === 'validation') return false;
            const extId = q.examId || q.exam_id;
            const eId = typeof extId === 'object' ? extId?._id : extId;
            return eId === ex._id;
        }),
    }));
    const untaggedQs = questions.filter(q => !(q.examId || q.exam_id));

    // ─────────────────────── CSS ───────────────────────
    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ad-root { display: flex; min-height: 100vh; background: ${t.bg}; color: ${t.text}; font-family: 'Outfit', sans-serif; transition: background 0.4s, color 0.4s; }

        .ad-sidebar { width: 220px; flex-shrink: 0; background: ${t.surface}; border-right: 1px solid ${t.border}; display: flex; flex-direction: column; padding: 24px 12px; position: sticky; top: 0; height: 100vh; }
        .ad-sidebar-logo { font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; color: ${t.text}; padding: 0 12px; margin-bottom: 28px; }
        .ad-sidebar-logo span { background: ${t.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .ad-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: none; background: transparent; color: ${t.textMuted}; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.18s; text-align: left; width: 100%; margin-bottom: 2px; }
        .ad-nav-item:hover { background: ${t.surfaceAlt}; color: ${t.text}; }
        .ad-nav-item.active { background: ${t.tabActiveBg}; color: ${t.accent}; font-weight: 600; }
        .ad-nav-subitem { display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 26px; border-radius: 8px; border: none; background: transparent; color: ${t.textMuted}; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.18s; text-align: left; width: 100%; margin-bottom: 2px; }
        .ad-nav-subitem:hover { background: ${t.surfaceAlt}; color: ${t.text}; }
        .ad-nav-subitem.active { background: ${t.tabActiveBg}; color: ${t.accent}; font-weight: 600; }
        .ad-nav-spacer { flex: 1; }
        .ad-logout { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: none; background: transparent; color: ${t.textMuted}; font-family: 'Outfit', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.18s; width: 100%; }
        .ad-logout:hover { background: ${t.errorBg}; color: ${t.errorText}; }

        .ad-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .ad-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: ${t.surface}; border-bottom: 1px solid ${t.border}; position: sticky; top: 0; z-index: 30; }
        .ad-topbar-title { font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 700; color: ${t.text}; }
        .ad-topbar-user { display: flex; align-items: center; gap: 8px; padding: 5px 14px; background: ${t.surfaceAlt}; border: 1px solid ${t.border}; border-radius: 100px; font-size: 13px; color: ${t.textMuted}; }
        .ad-user-dot { width: 7px; height: 7px; border-radius: 50%; background: ${t.accent}; box-shadow: 0 0 6px ${t.accentGlow}; }
        .ad-content { padding: 32px; flex: 1; }

        .ad-flash { display: flex; align-items: center; gap: 10px; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13.5px; font-weight: 500; }
        .ad-flash.success { background: ${t.tabActiveBg}; border: 1px solid ${t.accent}44; color: ${t.accent}; }
        .ad-flash.error { background: ${t.errorBg}; border: 1px solid ${t.errorBorder}55; color: ${t.errorText}; }

        .ad-page-title { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: ${t.text}; margin-bottom: 28px; }

        .ad-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap: 16px; margin-bottom: 32px; }
        .ad-stat { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 20px 22px; transition: all 0.22s; }
        .ad-stat:hover { border-color: ${t.accent}; box-shadow: 0 4px 20px ${t.accentGlow}; transform: translateY(-2px); }
        .ad-stat-val { font-family: 'Outfit', sans-serif; font-size: 30px; font-weight: 800; background: ${t.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.1; }
        .ad-stat-lbl { font-size: 12px; color: ${t.textSub}; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 6px; }

        .ad-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 24px; margin-bottom: 20px; }
        .ad-card-title { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; color: ${t.text}; margin-bottom: 16px; }
        .ad-card-hint { font-size: 12.5px; color: ${t.textMuted}; margin-bottom: 14px; line-height: 1.5; }

        .ad-input, .ad-select { background: ${t.inputBg}; border: 1.5px solid ${t.border}; border-radius: 9px; color: ${t.text}; font-family: 'Outfit', sans-serif; font-size: 14px; padding: 10px 13px; outline: none; width: 100%; transition: all 0.2s; }
        .ad-input:-webkit-autofill, .ad-input:-webkit-autofill:hover, .ad-input:-webkit-autofill:focus, .ad-input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px ${t.inputBg} inset !important;
            -webkit-text-fill-color: ${t.text} !important;
            transition: background-color 5000s ease-in-out 0s;
        }
        .ad-input::placeholder { color: ${t.textSub}; }
        .ad-input:focus, .ad-select:focus { border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.accentGlow}; background: ${t.surfaceAlt}; }
        .ad-select option { background: ${t.surface}; color: ${t.text}; }
        .ad-form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px,1fr)); gap: 10px; margin-bottom: 16px; }
        .ad-form-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }

        .ad-btn { padding: 10px 20px; border-radius: 9px; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; transition: all 0.2s; white-space: nowrap; }
        .ad-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .ad-btn-primary { background: ${t.gradient}; color: #fff; box-shadow: 0 4px 14px ${t.accentGlow}; }
        .ad-btn-primary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
        .ad-btn-secondary { background: ${t.surfaceAlt}; color: ${t.textMuted}; border: 1px solid ${t.border}; }
        .ad-btn-secondary:hover { color: ${t.text}; border-color: ${t.accent}; background: ${t.tabActiveBg}; }
        .ad-btn-danger { background: ${t.errorBg}; color: ${t.errorText}; border: 1px solid ${t.errorBorder}44; padding: 7px 14px; font-size: 12.5px; }
        .ad-btn-danger:hover { border-color: ${t.errorBorder}; }
        .ad-btn-ghost { background: transparent; color: ${t.textMuted}; border: 1px solid ${t.border}; }
        .ad-btn-ghost:hover { background: ${t.surfaceAlt}; color: ${t.text}; }
        .ad-btn-sm { padding: 6px 13px; font-size: 12.5px; }

        .ad-table-wrap { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; overflow: hidden; overflow-x: auto; margin-bottom: 20px; }
        .ad-table { width: 100%; border-collapse: collapse; }
        .ad-table thead tr { background: ${t.surfaceAlt}; border-bottom: 1px solid ${t.border}; }
        .ad-table th { padding: 12px 16px; text-align: left; font-size: 11.5px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: ${t.textSub}; white-space: nowrap; }
        .ad-table td { padding: 13px 16px; font-size: 13.5px; color: ${t.text}; border-bottom: 1px solid ${t.border}66; }
        .ad-table tbody tr:last-child td { border-bottom: none; }
        .ad-table tbody tr:hover { background: ${t.surfaceAlt}; }
        .ad-cell-muted { color: ${t.textMuted}; font-size: 12.5px; }
        .ad-td-actions { display: flex; gap: 8px; align-items: center; }

        .ad-badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 100px; font-size: 11.5px; font-weight: 600; }
        .ad-badge-easy { background: rgba(5,150,105,0.12); color: #059669; }
        .ad-badge-medium { background: rgba(234,179,8,0.12); color: #ca8a04; }
        .ad-badge-hard { background: ${t.errorBg}; color: ${t.errorText}; }
        .ad-badge-ok { background: ${t.tabActiveBg}; color: ${t.accent}; }

        .ad-loading { display: flex; align-items: center; gap: 10px; color: ${t.textMuted}; font-size: 14px; padding: 16px 0; }
        .ad-spinner { width: 18px; height: 18px; border: 2px solid ${t.border}; border-top-color: ${t.accent}; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Questions grouped accordion ── */
        .exam-group { border: 1px solid ${t.border}; border-radius: 14px; margin-bottom: 12px; overflow: hidden; }
        .exam-group-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: ${t.surface}; cursor: pointer; transition: background 0.15s; gap: 12px; flex-wrap: wrap; }
        .exam-group-header:hover { background: ${t.surfaceAlt}; }
        .exam-group-header.open { background: ${t.tabActiveBg}; border-bottom: 1px solid ${t.border}; }
        .exam-group-title { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; color: ${t.text}; display: flex; align-items: center; gap: 10px; }
        .exam-group-meta { display: flex; gap: 10px; align-items: center; font-size: 12.5px; color: ${t.textMuted}; flex-wrap: wrap; }
        .eg-chevron { font-size: 11px; color: ${t.textMuted}; transition: transform 0.2s; display: inline-block; }
        .eg-chevron.open { transform: rotate(90deg); }

        /* ════════════════════════════════════
           TWO-COLUMN CONFIGURATOR OVERLAY
        ════════════════════════════════════ */
        .cfg-overlay {
            position: fixed; inset: 0; z-index: 200;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
            display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .cfg-panel {
            background: ${t.surface}; border: 1px solid ${t.border};
            border-radius: 20px; width: 100%; max-width: 1120px;
            max-height: 92vh; display: flex; flex-direction: column;
            box-shadow: 0 32px 100px rgba(0,0,0,0.45);
        }

        /* Header */
        .cfg-header {
            display: flex; align-items: flex-start; justify-content: space-between;
            padding: 22px 28px; border-bottom: 1px solid ${t.border}; flex-shrink: 0; gap: 16px;
        }
        .cfg-title { font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; color: ${t.text}; }
        .cfg-subtitle { font-size: 12.5px; color: ${t.textMuted}; margin-top: 4px; line-height: 1.6; }
        .cfg-header-btns { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

        /* Upload strip */
        .cfg-upload-strip {
            display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
            padding: 12px 28px; background: ${t.surfaceAlt}; border-bottom: 1px solid ${t.border}; flex-shrink: 0;
        }
        .cfg-upload-strip .ad-input { max-width: 240px; padding: 8px 11px; font-size: 13px; }
        .cfg-hint { font-size: 11.5px; color: ${t.textMuted}; flex: 1; min-width: 180px; }
        .cfg-pill { font-size: 12px; font-weight: 600; color: ${t.accent}; background: ${t.tabActiveBg}; padding: 3px 10px; border-radius: 100px; white-space: nowrap; }
        .cfg-preview-wrap { padding: 0 28px 14px; border-bottom: 1px solid ${t.border}; flex-shrink: 0; max-height: 180px; overflow-y: auto; }

        /* Two-column body */
        .cfg-body { flex: 1; display: grid; grid-template-columns: 1fr 52px 1fr; min-height: 0; overflow: hidden; }

        /* Each column */
        .cfg-col { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .cfg-col-head {
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            padding: 12px 16px; border-bottom: 1px solid ${t.border}; flex-shrink: 0;
        }
        .cfg-col-label { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 700; color: ${t.text}; white-space: nowrap; }
        .cfg-col-pill { font-size: 11.5px; font-weight: 600; padding: 2px 9px; border-radius: 100px; white-space: nowrap; }
        .cfg-col-pill-blue { background: ${t.tabActiveBg}; color: ${t.accent}; }
        .cfg-col-pill-green { background: rgba(5,150,105,0.12); color: #059669; }
        .cfg-col-head .ad-input { flex: 1; min-width: 80px; padding: 7px 10px; font-size: 12.5px; }
        .cfg-col-head .ad-select { width: auto; min-width: 80px; padding: 7px 10px; font-size: 12.5px; }

        /* Scrollable list */
        .cfg-list { flex: 1; overflow-y: auto; padding: 10px; transition: background 0.15s, outline 0.15s; }
        .cfg-list.drag-target {
            background: ${t.tabActiveBg};
            outline: 2px dashed ${t.accent};
            outline-offset: -5px; border-radius: 12px;
        }

        /* Question card */
        .cfg-q-card {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 11px 12px; border-radius: 10px;
            border: 1px solid ${t.border}55; background: ${t.bg};
            margin-bottom: 6px; cursor: grab; user-select: none;
            transition: border-color 0.15s, background 0.15s, opacity 0.15s;
        }
        .cfg-q-card:hover { border-color: ${t.accent}; background: ${t.surfaceAlt}; }
        .cfg-q-card.is-dragging { opacity: 0.35; cursor: grabbing; }
        .cfg-q-body { flex: 1; min-width: 0; }
        .cfg-q-text { font-size: 13px; color: ${t.text}; line-height: 1.45; word-break: break-word; }
        .cfg-q-meta { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
        .cfg-q-tag { font-size: 10.5px; color: ${t.textMuted}; background: ${t.surfaceAlt}; padding: 1px 7px; border-radius: 5px; }
        .cfg-q-btn { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; transition: all 0.15s; }
        .cfg-q-btn-add { background: ${t.tabActiveBg}; color: ${t.accent}; }
        .cfg-q-btn-add:hover { background: ${t.accent}; color: #fff; }
        .cfg-q-btn-remove { background: ${t.errorBg}; color: ${t.errorText}; }
        .cfg-q-btn-remove:hover { background: ${t.errorText}; color: #fff; }

        /* Empty state */
        .cfg-empty { text-align: center; padding: 48px 20px; color: ${t.textMuted}; font-size: 13px; line-height: 1.8; }
        .cfg-empty-icon { font-size: 30px; margin-bottom: 10px; }

        /* Middle arrows */
        .cfg-mid {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 8px; border-left: 1px solid ${t.border}; border-right: 1px solid ${t.border};
            flex-shrink: 0; padding: 8px 0;
        }
        .cfg-arrow {
            width: 34px; height: 34px; border-radius: 50%;
            border: 1.5px solid ${t.border}; background: ${t.surfaceAlt}; color: ${t.textMuted};
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 13px; transition: all 0.15s; flex-shrink: 0;
        }
        .cfg-arrow:hover { border-color: ${t.accent}; color: ${t.accent}; background: ${t.tabActiveBg}; }
        .cfg-arrow-divider { width: 20px; height: 1px; background: ${t.border}; }

        /* Footer */
        .cfg-footer {
            display: flex; align-items: center; gap: 10px; justify-content: flex-end;
            padding: 16px 28px; border-top: 1px solid ${t.border}; flex-shrink: 0;
        }
        .cfg-footer-stats { margin-right: auto; font-size: 13px; color: ${t.textMuted}; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .cfg-footer-stats strong { color: ${t.accent}; }
        .diff-pill { font-size: 11.5px; padding: 2px 8px; border-radius: 100px; }

        @media (max-width: 820px) {
            .ad-sidebar { display: none; }
            .ad-content { padding: 20px 16px; }
            .cfg-body { grid-template-columns: 1fr; grid-template-rows: 1fr auto 1fr; }
            .cfg-mid { flex-direction: row; border-left: none; border-right: none; border-top: 1px solid ${t.border}; border-bottom: 1px solid ${t.border}; padding: 10px; height: auto; }
        }
    `;

    return (
        <>
            <style>{css}</style>
            <ThemeSwitcher />
            <div className="ad-root">

                {/* Sidebar */}
                <aside className="ad-sidebar">
                    <div className="ad-sidebar-logo"><span>Adapt</span>Exam</div>
                    {SECTIONS.map(s => (
                        <button key={s} className={`ad-nav-item ${section === s ? 'active' : ''}`} onClick={() => setSection(s)}>
                            {s}
                        </button>
                    ))}
                    <div className="ad-nav-spacer" />
                    <button className="ad-logout" onClick={handleLogout}> Logout</button>
                </aside>

                <div className="ad-main">
                    <div className="ad-topbar">
                        <div className="ad-topbar-title">{section}</div>
                        <div className="ad-topbar-user"><span className="ad-user-dot" />{adminName}</div>
                    </div>

                    <div className="ad-content">
                        {success && <div className="ad-flash success"> {success}</div>}
                        {error && <div className="ad-flash error"> {error}</div>}
                        {loading && <div className="ad-loading"><span className="ad-spinner" /> Loading…</div>}

                        {/* ══ AUTOCAD ASSESSMENTS (CIVIL ENGINEERING) ══ */}
                        {section === 'AutoCAD Assessments' && (
                            <AutoCADRoundAdmin theme={t} students={students} flash={flash} openTimeline={openTimeline} />
                        )}

                        {/* ══ AUTOCAD RESULTS ══ */}
                        {section === 'AutoCAD Results' && (
                            <AdminCadResults theme={t} students={students} flash={flash} openTimeline={openTimeline} />
                        )}

                        {/* ══ LIVE MONITOR ══ */}
                        {section === 'Live Monitor' && <AdminLiveProctor />}

                        {/* ══ SIMULATION ROUND (CIRCUIT EXAM) ══ */}
                        {section === 'Simulation Round' && <SimulationRoundAdmin students={students} flash={flash} />}

                        {/* ══ TECHNICAL INTERVIEW ══ */}
                        {section === 'Technical Interview' && <TechnicalInterviewAdmin theme={t} students={students} flash={flash} />}

                        {/* ══ OVERVIEW ══ */}
                        {section === 'Overview' && (
                            <>
                                <div className="ad-page-title">Welcome back, {adminName} </div>
                                <div className="ad-stats">
                                    {[
                                        { val: students.length, lbl: 'Students' },
                                        { val: exams.length, lbl: 'Exams' },
                                        { val: questions.length, lbl: 'Questions' },
                                        { val: results.length, lbl: 'Results' },
                                        { val: logs.length, lbl: 'Behavior Logs' },
                                        { val: `${logs.length?(logs.reduce((a,l)=>a+l.riskScore,0)/logs.length).toFixed(0):0}%`, lbl: 'Avg Risk' },
                                    ].map(({ val, lbl }) => (
                                        <div key={lbl} className="ad-stat">
                                            <div className="ad-stat-val">{val}</div>
                                            <div className="ad-stat-lbl">{lbl}</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ══ STUDENTS ══ */}
                        {section === 'Students' && (
                            <>
                                <div className="ad-page-title">Students</div>
                                <div className="ad-card">
                                    <div className="ad-card-title">Add New Student</div>
                                    <form ref={studentFormRef} onSubmit={handleCreateStudent}>
                                        <div className="ad-form-grid">
                                            {[
                                                {ph:'Full Name *', key:'name', type:'text', req:true},
                                                {ph:'Email *', key:'email', type:'email', req:true},
                                                {ph:'Password *', key:'password', type:'password', req:true},
                                                {ph:'Roll No', key:'rollno', type:'text'},
                                                {ph:'Age', key:'age', type:'number'},
                                                {ph:'Phone Number', key:'phone_number', type:'text'},
                                                {ph:'Department', key:'department', type:'text'},
                                                {ph:'Year of Study', key:'year_of_study', type:'text'},
                                                {ph:'College', key:'college', type:'text'},
                                            ].map(({ph,key,type,req}) => (
                                                <input key={key} className="ad-input" placeholder={ph} type={type}
                                                    value={studentForm[key]} required={req} autoComplete="new-password"
                                                    onChange={e => setStudentForm(prev => ({...prev,[key]:e.target.value}))} />
                                            ))}
                                            <select className="ad-select" value={studentForm.gender}
                                                onChange={e => setStudentForm(prev => ({...prev,gender:e.target.value}))}>
                                                <option value="">Select Gender</option>
                                                <option>Male</option><option>Female</option><option>Other</option>
                                            </select>
                                        </div>
                                        <button type="submit" className="ad-btn ad-btn-primary">+ Add Student</button>
                                    </form>
                                </div>
                                <div className="ad-card">
                                    <div className="ad-card-title">Bulk Upload (Excel)</div>
                                    <div className="ad-card-hint">Columns: name, email, password, rollno, gender, age, phone_number, department, year_of_study, college</div>
                                    <form onSubmit={handleBulkUploadStudents} className="ad-form-row">
                                        <input type="file" ref={fileInputRef} accept=".xlsx,.xls" className="ad-input" style={{flex:'1 1 240px'}} />
                                        <button type="submit" className="ad-btn ad-btn-secondary">Upload Excel</button>
                                    </form>
                                </div>

                                <div className="ad-table-wrap">
                                    <table className="ad-table">
                                        <thead><tr>{['Name','Email','Roll No','Dept','College','Exams Assigned','Action'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                                        <tbody>
                                            {students.map(s => (
                                                <tr key={s._id}>
                                                    <td><strong>{s.name}</strong></td>
                                                    <td className="ad-cell-muted">{s.email}</td>
                                                    <td>{s.rollno||'—'}</td>
                                                    <td>{s.department||'—'}</td>
                                                    <td>{s.college||'—'}</td>
                                                    <td>{s.assigned_exams?.length
                                                        ? s.assigned_exams.map((ex,i)=><span key={i} className="ad-badge ad-badge-ok" style={{marginRight:4}}>{typeof ex==='object'?ex.title:`Exam ${i+1}`}</span>)
                                                        : <span className="ad-cell-muted">None</span>}
                                                    </td>
                                                    <td>
                                                        <div className="ad-td-actions">
                                                            <button className="ad-btn ad-btn-danger ad-btn-sm" onClick={()=>handleDeleteStudent(s._id)}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {students.length === 0 && <tr><td colSpan={7} style={{textAlign:'center',color:t.textMuted,padding:28}}>No students found.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* ══ CODING ROUND ══ */}
                        {section === 'Coding Round' && (
                            <CodingRoundManager theme={t} students={students} flash={flash} />
                        )}

                        {/* ══ CODING RESULTS ══ */}
                        {section === 'Coding Results' && (
                            <AdminCodingResults />
                        )}

                        {/* ══ PLAGIARISM DETECTOR ══ */}
                        {section === 'Plagiarism Detector' && (
                            <AdminPlagiarismDetector />
                        )}

                        {/* ══ INTERVIEW REPORTS ══ */}
                        {section === 'Interview Reports' && (
                            <AdminInterviewResults flash={flash} />
                        )}

                        {/* ══ SECURITY ALERTS ══ */}
                        {section === 'Security Alerts' && (
                            <AdminAlerts />
                        )}

                        {/* ══ MCQ EXAMS ══ */}
                        {section === 'Exams (MCQ Module)' && (
                            <>
                                <div className="ad-page-title">Exams</div>
                                <div className="ad-card">
                                    <div className="ad-card-title">① Create Exam</div>
                                    <form onSubmit={handleCreateExam} style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'stretch' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input className="ad-input" placeholder="Exam Title" value={examForm.title} onChange={e=>setExamForm({...examForm,title:e.target.value})} required style={{flex:'1 1 200px'}} />
                                            <input className="ad-input" placeholder="Exam Description" value={examForm.description} onChange={e=>setExamForm({...examForm,description:e.target.value})} style={{flex:'2 1 300px'}} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: t.textSub }}>Per-Question Time (s):</div>
                                            {['easy', 'medium', 'hard'].map(d => (
                                                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '12px', textTransform: 'capitalize', color: t.textMuted }}>{d}:</span>
                                                    <input className="ad-input" type="number" min={1} value={examForm.per_question_time[d]}
                                                        style={{ width: '80px', padding: '6px 10px' }}
                                                        onChange={e => setExamForm({
                                                            ...examForm,
                                                            per_question_time: { ...examForm.per_question_time, [d]: +e.target.value }
                                                        })} />
                                                </div>
                                            ))}
                                            <div style={{ flex: 1 }} />
                                            <button type="submit" className="ad-btn ad-btn-primary">+ Create</button>
                                        </div>
                                    </form>
                                </div>
                                <div className="ad-card">
                                    <div className="ad-card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                        <span>② Assign Students to Exam</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: '600', color: t.textSub }}>Department Filter:</span>
                                            <select 
                                                className="ad-select" 
                                                value={selectedDeptFilter} 
                                                onChange={e => setSelectedDeptFilter(e.target.value)}
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
                                    <div className="ad-card-hint">Filter by Department to assign tests directly to ECE, EEE, or CSE students.</div>
                                    <form onSubmit={handleAssignExam} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                        <select className="ad-select" value={assignForm.examId} onChange={e=>setAssignForm({...assignForm,examId:e.target.value})} required style={{flex:'1 1 200px'}}>
                                            <option value="">Select Exam</option>
                                            {exams.map(ex=><option key={ex._id} value={ex._id}>{ex.title}</option>)}
                                        </select>
                                        <div style={{ flex: '1 1 300px', maxHeight: '200px', overflowY: 'auto', border: `1.5px solid ${t.border}`, borderRadius: '9px', padding: '12px', background: t.inputBg }}>
                                            {students.filter(s => selectedDeptFilter === 'ALL' || (s.department || '').toUpperCase().includes(selectedDeptFilter.toUpperCase())).length === 0 ? (
                                                <div style={{ fontSize: '13px', color: t.textMuted }}>No students found for department: {selectedDeptFilter}.</div>
                                            ) : (
                                                students
                                                    .filter(s => selectedDeptFilter === 'ALL' || (s.department || '').toUpperCase().includes(selectedDeptFilter.toUpperCase()))
                                                    .map(s => (
                                                        <label key={s._id} style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '10px', marginBottom: '8px', fontSize: '14px', color: t.text, cursor: 'pointer' }}>
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
                                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:t.text,marginBottom:12}}>③ Configure Questions per Exam</div>
                                <div className="ad-table-wrap">
                                    <table className="ad-table">
                                        <thead><tr><th>Title</th><th>Duration</th><th>Questions</th><th>Students</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {exams.map(ex => (
                                                <tr key={ex._id}>
                                                    <td><strong>{ex.title}</strong></td>
                                                    <td>{ex.duration} min</td>
                                                    <td><span className="ad-badge ad-badge-ok">{ex.questions?.length||0} Qs</span></td>
                                                    <td>{ex.assigned_students?.length||0}</td>
                                                    <td>
                                                        <div className="ad-td-actions">
                                                            <button className="ad-btn ad-btn-secondary ad-btn-sm" onClick={()=>openConfigurator(ex)}>
                                                                 Configure Questions
                                                            </button>
                                                            <button className="ad-btn ad-btn-danger ad-btn-sm" onClick={()=>handleDeleteExam(ex._id)}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {exams.length===0&&<tr><td colSpan={5} style={{textAlign:'center',color:t.textMuted,padding:28}}>No exams yet.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* ══ CODING RESULTS ══ */}
                        {section === 'Coding Results' && (
                            <>
                                <div className="ad-page-title">Coding Results</div>
                                <div className="ad-card" style={{background:t.tabActiveBg,border:`1px solid ${t.accent}33`,marginBottom:24}}>
                                    <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                                        <span style={{fontSize:22}}></span>
                                        <div style={{fontSize:13,color:t.textMuted,lineHeight:1.6}}>
                                            Coding session results are stored in the database and accessible via the sessions API.
                                            Query <strong style={{color:t.text}}>GET /api/coding/sessions</strong> to view all student coding submissions with test case pass rates, telemetry, and code analysis.
                                        </div>
                                    </div>
                                </div>
                                <div className="ad-table-wrap">
                                    <table className="ad-table">
                                        <thead><tr><th>Student</th><th>Problem</th><th>Language</th><th>Status</th><th>Test Cases</th><th>Submitted</th></tr></thead>
                                        <tbody>
                                            <tr><td colSpan={6} style={{textAlign:'center',color:t.textMuted,padding:28}}>Coding results will appear here once students complete the coding assessment.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* ══ MCQ QUESTIONS — grouped by exam ══ */}
                        {section === 'Questions' && (
                            <>
                                <div className="ad-page-title">Question Bank</div>
                                <div className="ad-card" style={{background:t.tabActiveBg,border:`1px solid ${t.accent}33`,marginBottom:24}}>
                                    <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                                        <span style={{fontSize:22}}></span>
                                        <div style={{fontSize:13,color:t.textMuted,lineHeight:1.6}}>
                                            All questions are in the <strong style={{color:t.text}}>global bank</strong>, grouped by exam below.
                                            To add questions to an exam, go to <strong style={{color:t.text}}>Exams → Configure Questions</strong> → upload Excel/CSV → move questions to the <strong style={{color:t.text}}>right column</strong> → Save.
                                        </div>
                                    </div>
                                </div>

                                {questionsByExam.map(({ exam, qs }) => (
                                    <div key={exam._id} className="exam-group">
                                        <div className={`exam-group-header${expandedExam===exam._id?' open':''}`}
                                            onClick={()=>setExpandedExam(expandedExam===exam._id?null:exam._id)}>
                                            <div className="exam-group-title">
                                                <span className={`eg-chevron${expandedExam===exam._id?' open':''}`}>▶</span>
                                                 {exam.title}
                                                <span className="ad-badge ad-badge-ok">{qs.length} Qs</span>
                                            </div>
                                            <div className="exam-group-meta">
                                                <span>{exam.duration} min</span>
                                                <span>{exam.assigned_students?.length||0} students</span>
                                                {qs.length>0&&<>
                                                    <span style={{color:'#059669'}}>Easy:{qs.filter(q=>q.difficulty==='easy').length}</span>
                                                    <span style={{color:'#ca8a04'}}>Med:{qs.filter(q=>q.difficulty==='medium').length}</span>
                                                    <span style={{color:t.errorText}}>Hard:{qs.filter(q=>q.difficulty==='hard').length}</span>
                                                </>}
                                                <button className="ad-btn ad-btn-secondary ad-btn-sm"
                                                    onClick={e=>{e.stopPropagation();openConfigurator(exam);}}>
                                                     Configure
                                                </button>
                                            </div>
                                        </div>
                                        {expandedExam===exam._id && (
                                            <div>
                                                {qs.length===0
                                                    ? <div style={{padding:28,textAlign:'center',color:t.textMuted,fontSize:13}}>No questions configured for this exam yet.</div>
                                                    : <table className="ad-table">
                                                        <thead><tr><th>#</th><th>Question</th><th>Topic</th><th>Difficulty</th><th>Type</th><th>Marks</th></tr></thead>
                                                        <tbody>
                                                            {qs.map((q,i)=>(
                                                                <tr key={q._id}>
                                                                    <td className="ad-cell-muted">{i+1}</td>
                                                                    <td style={{maxWidth:360}}>{q.question_text}</td>
                                                                    <td>{q.topic}</td>
                                                                    <td><span className={`ad-badge ad-badge-${q.difficulty}`}>{q.difficulty}</span></td>
                                                                    <td>{q.structure_type}</td>
                                                                    <td>{q.marks}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                }
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {untaggedQs.length>0 && (
                                    <div className="exam-group">
                                        <div className={`exam-group-header${expandedExam==='__untagged__'?' open':''}`}
                                            onClick={()=>setExpandedExam(expandedExam==='__untagged__'?null:'__untagged__')}>
                                            <div className="exam-group-title">
                                                <span className={`eg-chevron${expandedExam==='__untagged__'?' open':''}`}>▶</span>
                                                 Untagged Questions
                                                <span className="ad-badge ad-badge-medium">{untaggedQs.length}</span>
                                            </div>
                                            <div className="exam-group-meta">Not linked to any exam</div>
                                        </div>
                                        {expandedExam==='__untagged__' && (
                                            <table className="ad-table">
                                                <thead><tr><th>#</th><th>Question</th><th>Topic</th><th>Difficulty</th><th>Marks</th></tr></thead>
                                                <tbody>{untaggedQs.map((q,i)=>(
                                                    <tr key={q._id}>
                                                        <td className="ad-cell-muted">{i+1}</td>
                                                        <td style={{maxWidth:380}}>{q.question_text}</td>
                                                        <td>{q.topic}</td>
                                                        <td><span className={`ad-badge ad-badge-${q.difficulty}`}>{q.difficulty}</span></td>
                                                        <td>{q.marks}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        )}
                                    </div>
                                )}

                                {questions.length===0 && (
                                    <div style={{textAlign:'center',padding:'48px 0',color:t.textMuted,fontSize:14}}>
                                        No questions yet. Go to <strong>Exams → Configure Questions</strong> to upload.
                                    </div>
                                )}
                            </>
                        )}

                        {/* ══ MCQ RESULTS ══ */}
                        {section === 'MCQ Results' && (
                            <>
                                <div className="ad-page-title">Exam Results</div>
                                <div className="ad-table-wrap">
                                    <table className="ad-table">
                                        <thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>Date</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {results.map(r=>(
                                                <tr key={r._id}>
                                                    <td>{r.student_id?.name}</td><td>{r.exam_id?.title}</td>
                                                    <td><strong>{r.score}/{r.total_marks}</strong></td>
                                                    <td className="ad-cell-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                    <td>
                                                        <button className="ad-btn ad-btn-secondary ad-btn-sm" 
                                                            onClick={() => openTimeline(r.student_id?._id, r.exam_id?._id, r.student_id?.name)}>
                                                            Analyze Timeline
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {results.length===0&&<tr><td colSpan={5} style={{textAlign:'center',color:t.textMuted,padding:28}}>No results yet.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* ══ BEHAVIOR ══ */}
                        {section === 'Behavior' && (
                            <>
                                <div className="ad-page-title">Behavior Monitoring</div>
                                <div className="ad-table-wrap">
                                    <table className="ad-table">
                                        <thead><tr><th>Student</th><th>Exam</th><th>Eye</th><th>Head</th><th>Idle</th><th>Resp</th><th>Risk</th><th>Time</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {logs.slice(0,50).map(l=>(
                                                <tr key={l._id}>
                                                    <td>{l.student_id?.name}</td><td>{l.exam_id?.title}</td>
                                                    <td>{l.eyeDeviation}</td><td>{l.headMovement}</td>
                                                    <td>{l.mouseIdleTime}</td><td>{l.responseTime}</td>
                                                    <td><span className={`ad-badge ${l.riskScore>=0.6?'ad-badge-hard':l.riskScore>=0.3?'ad-badge-medium':'ad-badge-easy'}`}>{(l.riskScore*100).toFixed(0)}%</span></td>
                                                    <td className="ad-cell-muted">{new Date(l.timestamp).toLocaleTimeString()}</td>
                                                    <td>
                                                        <button className="ad-btn ad-btn-secondary ad-btn-sm"
                                                            onClick={() => openTimeline(l.student_id?._id, l.exam_id?._id, l.student_id?.name)}>
                                                            Timeline
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {logs.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:t.textMuted,padding:28}}>No logs yet.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TWO-COLUMN DRAG-AND-DROP QUESTION CONFIGURATOR
                Left = Available (global bank, not yet in this exam)
                Right = Selected (will be saved to this exam)
                Upload Excel → questions go to global bank + jump to Selected
            ══════════════════════════════════════════════════════════════ */}
            {configExam && (
                <div className="cfg-overlay" onClick={e=>{if(e.target===e.currentTarget)closeConfigurator();}}>
                    <div className="cfg-panel">

                        {/* Header */}
                        <div className="cfg-header">
                            <div>
                                <div className="cfg-title"> {configExam.title} — Configure Questions</div>
                                <div className="cfg-subtitle">
                                    <strong>Left:</strong> all available questions · <strong>Right:</strong> questions in this exam.<br/>
                                    Drag cards across · click ＋/ · use ▶▶ ◀◀ arrows · or upload a new Excel/CSV to add fresh questions directly to the right column.
                                </div>
                            </div>
                            <div className="cfg-header-btns">
                                <button className="ad-btn ad-btn-secondary ad-btn-sm"
                                    onClick={()=>{setShowUpload(v=>!v);setQPreview([]);if(qUploadRef.current)qUploadRef.current.value='';}}>
                                    {showUpload?' Hide Upload':' Upload Excel/CSV'}
                                </button>
                                <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={downloadQTemplate}>⬇ Template</button>
                                <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={closeConfigurator}></button>
                            </div>
                        </div>

                        {/* Upload strip */}
                        {showUpload && (
                            <>
                                <div className="cfg-upload-strip">
                                    <input type="file" ref={qUploadRef} accept=".xlsx,.xls,.csv"
                                        className="ad-input" onChange={handleQFileChange} />
                                    <span className="cfg-hint">Columns: question_text, options (comma-separated), correct_answer, topic, concept, difficulty, structure_type, marks</span>
                                    {qPreview.length>0 && <>
                                        <span className="cfg-pill">{qPreview.length} rows parsed</span>
                                        <button className="ad-btn ad-btn-primary ad-btn-sm" onClick={handleUploadToExam} disabled={qUploading}>
                                            {qUploading?'Uploading…':` Upload & Add to Selected`}
                                        </button>
                                    </>}
                                </div>
                                {qPreview.length>0 && (
                                    <div className="cfg-preview-wrap">
                                        <table className="ad-table" style={{fontSize:12.5}}>
                                            <thead><tr><th>#</th><th>Question</th><th>Options</th><th>Answer</th><th>Topic</th><th>Difficulty</th><th>Marks</th></tr></thead>
                                            <tbody>
                                                {qPreview.map((q,i)=>(
                                                    <tr key={i}>
                                                        <td className="ad-cell-muted">{i+1}</td>
                                                        <td style={{maxWidth:240}}>{q.question_text}</td>
                                                        <td className="ad-cell-muted">{q.options.join(' / ')}</td>
                                                        <td>{q.correct_answer}</td>
                                                        <td>{q.topic}</td>
                                                        <td><span className={`ad-badge ad-badge-${q.difficulty}`}>{q.difficulty}</span></td>
                                                        <td>{q.marks}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Two-column body */}
                        <div className="cfg-body">

                            {/* LEFT — Available */}
                            <div className="cfg-col">
                                <div className="cfg-col-head">
                                    <span className="cfg-col-label"> Available</span>
                                    <span className="cfg-col-pill cfg-col-pill-blue">{filteredAvailable.length}/{available.length}</span>
                                    <input className="ad-input" placeholder="Search…" value={avSearch} onChange={e=>setAvSearch(e.target.value)} />
                                    <select className="ad-select" value={avFilter} onChange={e=>setAvFilter(e.target.value)}>
                                        <option value="all">All Diff</option>
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                    <select className="ad-select" value={cfgDeptFilter} onChange={e=>setCfgDeptFilter(e.target.value)}>
                                        <option value="ALL">All Depts</option>
                                        <option value="ECE">ECE</option>
                                        <option value="EEE">EEE</option>
                                        <option value="CSE">CSE</option>
                                    </select>
                                </div>
                                <div className="cfg-list"
                                    onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('drag-target');}}
                                    onDragLeave={e=>e.currentTarget.classList.remove('drag-target')}
                                    onDrop={e=>{e.currentTarget.classList.remove('drag-target');handleDropOnAvailable(e);}}>
                                    {filteredAvailable.length===0
                                        ? <div className="cfg-empty"><div className="cfg-empty-icon"></div>No questions here.<br/>All matched questions are in the exam,<br/>or change the filter.</div>
                                        : filteredAvailable.map(q=>(
                                            <div key={q._id}
                                                className={`cfg-q-card${dragItem?.q._id===q._id?' is-dragging':''}`}
                                                draggable onDragStart={()=>handleDragStart(q,'available')} onDragEnd={handleDragEnd}>
                                                <div className="cfg-q-body">
                                                    <div className="cfg-q-text">{q.question_text}</div>
                                                    <div className="cfg-q-meta">
                                                        <span className={`ad-badge ad-badge-${q.difficulty}`}>{q.difficulty}</span>
                                                        <span className="cfg-q-tag">{q.topic}</span>
                                                        <span className="cfg-q-tag">{q.structure_type}</span>
                                                        <span className="cfg-q-tag">{q.marks}m</span>
                                                    </div>
                                                </div>
                                                <button className="cfg-q-btn cfg-q-btn-add" title="Add to exam" onClick={()=>moveToSelected(q)}>＋</button>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            {/* MIDDLE — arrows */}
                            <div className="cfg-mid">
                                <button className="cfg-arrow" title="Move all filtered → Selected" onClick={moveAllToSelected} style={{fontSize:11,letterSpacing:-2}}>▶▶</button>
                                <div className="cfg-arrow-divider" />
                                <button className="cfg-arrow" title="Move all filtered ← Available" onClick={moveAllToAvailable} style={{fontSize:11,letterSpacing:-2}}>◀◀</button>
                            </div>

                            {/* RIGHT — Selected */}
                            <div className="cfg-col">
                                <div className="cfg-col-head">
                                    <span className="cfg-col-label"> In This Exam</span>
                                    <span className="cfg-col-pill cfg-col-pill-green">{selected.length} selected</span>
                                    <input className="ad-input" placeholder="Search…" value={selSearch} onChange={e=>setSelSearch(e.target.value)} />
                                </div>
                                <div className="cfg-list"
                                    onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('drag-target');}}
                                    onDragLeave={e=>e.currentTarget.classList.remove('drag-target')}
                                    onDrop={e=>{e.currentTarget.classList.remove('drag-target');handleDropOnSelected(e);}}>
                                    {filteredSelected.length===0
                                        ? <div className="cfg-empty"><div className="cfg-empty-icon"></div>{selected.length===0?'Drag questions here or click ＋ to add them.':'No questions match the search.'}</div>
                                        : filteredSelected.map(q=>(
                                            <div key={q._id}
                                                className={`cfg-q-card${dragItem?.q._id===q._id?' is-dragging':''}`}
                                                draggable onDragStart={()=>handleDragStart(q,'selected')} onDragEnd={handleDragEnd}>
                                                <div className="cfg-q-body">
                                                    <div className="cfg-q-text">{q.question_text}</div>
                                                    <div className="cfg-q-meta">
                                                        <span className={`ad-badge ad-badge-${q.difficulty}`}>{q.difficulty}</span>
                                                        <span className="cfg-q-tag">{q.topic}</span>
                                                        <span className="cfg-q-tag">{q.structure_type}</span>
                                                        <span className="cfg-q-tag">{q.marks}m</span>
                                                    </div>
                                                </div>
                                                <button className="cfg-q-btn cfg-q-btn-remove" title="Remove from exam" onClick={()=>moveToAvailable(q)}></button>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="cfg-footer">
                            <div className="cfg-footer-stats">
                                <span><strong>{selected.length}</strong> question{selected.length!==1?'s':''} selected{configExam.total_questions?` / target ${configExam.total_questions}`:''}</span>
                                {selected.length>0&&<>
                                    <span className="diff-pill ad-badge-easy">Easy: {selected.filter(q=>q.difficulty==='easy').length}</span>
                                    <span className="diff-pill ad-badge-medium">Med: {selected.filter(q=>q.difficulty==='medium').length}</span>
                                    <span className="diff-pill ad-badge-hard">Hard: {selected.filter(q=>q.difficulty==='hard').length}</span>
                                </>}
                            </div>
                            <button className="ad-btn ad-btn-ghost" onClick={closeConfigurator}>Cancel</button>
                            <button className="ad-btn ad-btn-primary" onClick={handleSaveConfig} disabled={configSaving}>
                                {configSaving?'Saving…':' Save to Exam'}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {showTimeline && (
                <div className="tl-overlay" onClick={e => e.target === e.currentTarget && setShowTimeline(false)}>
                    <div className="tl-modal">
                        <div className="tl-modal-header">
                            <div>
                                <div className="cfg-title"> Behavior Timeline: {timelineStudent}</div>
                                <div className="cfg-subtitle">Chronological evidence analysis of behavior anomalies and metrics.</div>
                            </div>
                            <button className="ad-btn ad-btn-ghost ad-btn-sm" onClick={() => setShowTimeline(false)}></button>
                        </div>
                        <div className="tl-modal-body">
                            {tlLoading ? (
                                <div style={{ textAlign: 'center', padding: 40 }}><p>Fetching evidence logs...</p></div>
                            ) : (
                                <BehaviorTimeline logs={timelineLogs} />
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Progress modal removed - departments feature removed */}

            <style>{`
                .tl-overlay { position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; padding: 20px; }
                .tl-modal { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 24px; width: 100%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.5); }
                .tl-modal-header { padding: 24px 32px; border-bottom: 1px solid ${t.border}; display: flex; align-items: center; justify-content: space-between; background: ${t.surface}; }
                .tl-modal-body { flex: 1; overflow-y: auto; padding: 0 32px 32px; }
            `}</style>
        </>
    );
}
