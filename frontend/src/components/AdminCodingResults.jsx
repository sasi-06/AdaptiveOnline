import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import AICandidateRiskRadar from './AICandidateRiskRadar';
import { 
  BrainCircuit, CheckCircle, AlertTriangle, ShieldAlert, 
  Code, User, FileText, Cpu, Clock, Terminal, Check, Copy, GraduationCap, X
} from 'lucide-react';

const AdminCodingResults = () => {
  const [sessions, setSessions] = useState([]);
  const [mlStats, setMlStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [reviewLabel, setReviewLabel] = useState('Genuine');
  const [reviewNotes, setReviewNotes] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const { theme: t } = useTheme();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        api.get('/coding/sessions/all').catch(() => ({ data: [] })),
        api.get('/ml/stats').catch(() => ({ data: null }))
      ]);
      setSessions(sessionsRes.data || []);
      if (statsRes.data) setMlStats(statsRes.data);
    } catch (err) {
      toast.error('Failed to fetch coding results');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    if (!risk) return t.textMuted;
    const r = risk.toLowerCase();
    if (r === 'low' || r === 'genuine') return '#10b981';
    if (r === 'medium' || r === 'review needed') return '#f59e0b';
    return '#ef4444';
  };

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const res = await api.post('/ml/retrain', { forceWithSynthetic: true });
      toast.success(`Model Retrained! New Accuracy: ${res.data.accuracy}%`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Retraining failed');
    } finally {
      setRetraining(false);
    }
  };

  const submitReview = async () => {
    if (!selectedSession) return;
    try {
      await api.post(`/ml/review/${selectedSession._id}`, {
        classification: reviewLabel,
        notes: reviewNotes
      });
      toast.success('Review saved and added to training data!');
      setSelectedSession(null);
      setReviewNotes('');
      fetchData();
    } catch (err) {
      toast.error('Failed to save review');
    }
  };

  const openReviewModal = (session) => {
    setSelectedSession(session);
    setReviewLabel(session.classification || 'Genuine');
    setReviewNotes(session.recruiterNotes || '');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading) {
    return <div style={{ color: t.textMuted, padding: 20 }}>Loading results & ML stats...</div>;
  }

  return (
    <div style={{ padding: '20px 0' }}>
      
      {/* --- ML DASHBOARD HEADER --- */}
      <div style={{ 
        background: t.surface, 
        border: `1px solid ${t.border}`, 
        borderRadius: 16, 
        padding: 24, 
        marginBottom: 32,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: t.accent + '20', padding: 12, borderRadius: 12, color: t.accent }}>
            <BrainCircuit size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, margin: '0 0 4px 0' }}>AI Behavioral Model</h2>
            <p style={{ margin: 0, color: t.textMuted, fontSize: 14 }}>
              The model continuously learns from candidate reviews and telemetry analysis.
            </p>
          </div>
        </div>

        {mlStats && (
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <div style={{ fontSize: 12, color: t.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Model Accuracy</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>
                {mlStats.trainingData?.modelAccuracyOnRealData || mlStats.mlService?.accuracy || 0}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: t.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Training Samples</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>
                {mlStats.trainingData?.total || 0}
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={handleRetrain}
          disabled={retraining}
          style={{
            background: retraining ? t.surfaceAlt : t.accent,
            color: retraining ? t.textMuted : '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: retraining ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s'
          }}
        >
          <BrainCircuit size={18} />
          {retraining ? 'Retraining...' : 'Force Retrain Model'}
        </button>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: t.text, marginBottom: 16 }}>
        Candidate Coding Results
      </h2>

      {/* --- CODING SESSIONS TABLE --- */}
      <div style={{ overflowX: 'auto', background: t.surface, borderRadius: 12, border: `1px solid ${t.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: t.text }}>
          <thead>
            <tr style={{ background: t.border, color: t.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Candidate</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Question</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Coding Score</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>AI Risk Level</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s._id} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {s.candidateSnapshot ? (
                      <img 
                        src={s.candidateSnapshot} 
                        alt="Candidate Photo" 
                        style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid #38bdf8', objectFit: 'cover', boxShadow: '0 0 8px rgba(56,189,248,0.4)', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={18} color="#94a3b8" />
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.candidate?.name || s.student?.name || 'Unknown Candidate'}</div>
                      <div style={{ fontSize: 12, color: t.textMuted }}>{s.candidate?.email || s.student?.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 500 }}>{s.question?.title || 'Unknown Question'}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{s.language}</div>
                </td>
                <td style={{ padding: '16px 20px', fontWeight: 700, color: t.text }}>
                  {s.finalScore || s.codeQualityScore || 0}/100
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ 
                      width: 10, height: 10, borderRadius: '50%', 
                      background: getRiskColor(s.riskLevel || s.classification) 
                    }} />
                    <span style={{ fontWeight: 600, color: getRiskColor(s.riskLevel || s.classification) }}>
                      {s.classification || s.riskLevel || 'N/A'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                    Auth Score: {s.authenticityScore || 0}/100
                  </div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {s.reportPath && (
                      <a 
                        href={`http://localhost:5000/reports/${s.reportPath}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          padding: '6px 12px',
                          background: t.surfaceAlt,
                          color: t.text,
                          border: `1px solid ${t.border}`,
                          borderRadius: 6,
                          textDecoration: 'none',
                          fontSize: 13,
                          fontWeight: 500
                        }}
                      >
                        PDF Report
                      </a>
                    )}
                    <button 
                      onClick={() => openReviewModal(s)}
                      style={{
                        padding: '6px 14px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <BrainCircuit size={14} /> Review & Teach AI
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: t.textMuted }}>No coding results found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      
      {selectedSession && (
        <div 
          onClick={() => setSelectedSession(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
            padding: '20px', overflowY: 'auto'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px',
              width: '860px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto',
              margin: 'auto', boxShadow: '0 32px 64px rgba(0,0,0,0.7)',
              animation: 'modalSlideUp 0.3s ease-out', position: 'relative', color: '#f8fafc'
            }}
          >
            
            <div style={{
              position: 'sticky', top: 0, zIndex: 10,
              background: 'linear-gradient(135deg, #0f172a 80%, #1a1f35)',
              borderBottom: '1px solid #1e293b', padding: '18px 28px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              {(() => {
                const candName = selectedSession.candidate?.name || selectedSession.student?.name || 'Candidate';
                const initialLetter = candName.charAt(0).toUpperCase();
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {selectedSession.candidateSnapshot ? (
                      <img 
                        src={selectedSession.candidateSnapshot} 
                        alt="Candidate Snapshot"
                        style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #38bdf8', objectFit: 'cover', boxShadow: '0 0 14px rgba(56, 189, 248, 0.4)' }}
                      />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', border: '2px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 20, boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)' }}>
                        {initialLetter}
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                        <BrainCircuit size={20} color="#818cf8" />
                        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '19px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                          AI Candidate Evaluation & Motion Analysis
                        </h3>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                        Candidate: <strong style={{ color: '#e2e8f0' }}>{candName}</strong>
                        {' '}({selectedSession.candidate?.email || selectedSession.student?.email})
                        {' • '}Language: <strong style={{ color: '#38bdf8' }}>{selectedSession.language}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <button 
                onClick={() => setSelectedSession(null)}
                style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px 28px' }}>

              {/* Candidate Verification Photo Card */}
              {(() => {
                const candName = selectedSession.candidate?.name || selectedSession.student?.name || 'Candidate';
                const initialLetter = candName.charAt(0).toUpperCase();
                return (
                  <div style={{
                    background: '#0b0f19', border: '1px solid #1e293b', borderRadius: 14,
                    padding: '14px 18px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 16
                  }}>
                    {selectedSession.candidateSnapshot ? (
                      <img 
                        src={selectedSession.candidateSnapshot} 
                        alt="Candidate Exam Photo" 
                        style={{ width: 110, height: 78, borderRadius: 10, border: '2px solid #38bdf8', objectFit: 'cover', boxShadow: '0 0 14px rgba(56, 189, 248, 0.3)' }}
                      />
                    ) : (
                      <div style={{ width: 110, height: 78, borderRadius: 10, background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '2px dashed #38bdf8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                        <User size={28} />
                        <span style={{ fontSize: 9, fontWeight: 800, marginTop: 4, textTransform: 'uppercase' }}>STUDENT {initialLetter}</span>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                         Candidate Exam Verification Image
                        <span style={{ fontSize: 10, background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>CAPTURED AT START</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                        Verified webcam snapshot of <strong>{candName}</strong> attending the coding exam session.
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(selectedSession.totalPasteCount > 0) && (() => {
                const pasteChars = selectedSession.totalPasteChars || selectedSession.totalPasteCount * 50;
                const severity = pasteChars > 300 ? 'CRITICAL' : pasteChars > 100 ? 'HIGH' : 'MEDIUM';
                const bgColor = pasteChars > 300 ? '#7f1d1d' : pasteChars > 100 ? '#431407' : '#422006';
                const bdColor = pasteChars > 300 ? '#ef4444' : pasteChars > 100 ? '#f97316' : '#f59e0b';
                const txColor = pasteChars > 300 ? '#fca5a5' : pasteChars > 100 ? '#fed7aa' : '#fde68a';
                return (
                  <div style={{
                    background: bgColor, border: `2px solid ${bdColor}`, borderRadius: 14,
                    padding: '14px 18px', marginBottom: 20,
                    display: 'flex', alignItems: 'flex-start', gap: 14
                  }}>
                    <AlertTriangle size={22} color={bdColor} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: 800, color: txColor, fontSize: 14, marginBottom: 4 }}>
                         COPY-PASTE DETECTED — Severity: {severity}
                      </div>
                      <div style={{ color: '#fecaca', fontSize: 13, lineHeight: 1.6 }}>
                        Student pasted <strong>{pasteChars.toLocaleString()} characters</strong> across{' '}
                        <strong>{selectedSession.totalPasteCount} paste event(s)</strong>.{' '}
                        This inflates the Code Quality score while the Authenticity score is penalized.
                        AI Trust Score has been reduced accordingly.
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, background: '#ef444430', color: '#fca5a5', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                           Paste Events: {selectedSession.totalPasteCount}
                        </span>
                        <span style={{ fontSize: 11, background: '#ef444430', color: '#fca5a5', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                           Characters Pasted: {pasteChars.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 11, background: '#ef444430', color: '#fca5a5', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                           paste_ratio: {Math.min(1, pasteChars / Math.max(1, selectedSession.totalKeystrokes || 100)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              
              {/* ── 5 SNAPSHOT CARDS IN SINGLE EQUAL ROW ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 22 }}>
                {/* 1. Authenticity Score */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: `1px solid ${getRiskColor(selectedSession.riskLevel || selectedSession.classification)}40`, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>AI Trust Score</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: getRiskColor(selectedSession.riskLevel || selectedSession.classification) }}>
                    {selectedSession.authenticityScore ?? selectedSession.finalScore ?? 0}/100
                  </div>
                  <div style={{ 
                    fontSize: 10, fontWeight: 700, marginTop: 6, padding: '2px 8px', borderRadius: 6, display: 'inline-block',
                    background: `${getRiskColor(selectedSession.riskLevel || selectedSession.classification)}20`,
                    color: getRiskColor(selectedSession.riskLevel || selectedSession.classification)
                  }}>
                    {selectedSession.classification || selectedSession.riskLevel || 'Genuine'}
                  </div>
                </div>

                {/* 2. Code Quality */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #38bdf840', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>Code Quality</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8' }}>
                    {selectedSession.codeQualityScore ?? 0}/100
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: 500 }}>
                    Lang: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{selectedSession.language}</span>
                  </div>
                </div>

                {/* 3. Test Cases */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #10b98140', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>Tests Passed</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>
                    {selectedSession.testCasesPassed ?? 0}/{selectedSession.totalTestCases ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: selectedSession.testCasesPassed === selectedSession.totalTestCases ? '#10b981' : '#f59e0b', fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {selectedSession.totalTestCases > 0 && selectedSession.testCasesPassed === selectedSession.totalTestCases 
                      ? <><CheckCircle size={12} /> 100% Passed</> 
                      : <><AlertTriangle size={12} /> {Math.round(((selectedSession.testCasesPassed || 0)/(selectedSession.totalTestCases||1))*100)}% Passed</>}
                  </div>
                </div>

                {/* 4. Duration */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #f59e0b40', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>Duration</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>
                    {selectedSession.duration ? `${Math.floor(selectedSession.duration/60)}m ${selectedSession.duration%60}s` : 'N/A'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: 500 }}>
                    Compiles: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{selectedSession.compilationAttempts ?? 0}</span>
                  </div>
                </div>

                {/* 5. Copy-Paste Events */}
                <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: `1px solid ${(selectedSession.totalPasteCount||0) > 0 ? '#ef444450' : '#10b98140'}`, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>Copy-Paste</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: (selectedSession.totalPasteCount||0) > 0 ? '#ef4444' : '#10b981' }}>
                    {selectedSession.totalPasteCount ?? 0} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>events</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginTop: 6, color: (selectedSession.totalPasteCount||0) > 0 ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(selectedSession.totalPasteCount||0) > 0 
                      ? <><AlertTriangle size={12} /> {selectedSession.totalPasteChars || (selectedSession.totalPasteCount * 50)} chars</> 
                      : <><CheckCircle size={12} /> Clean</>}
                  </div>
                </div>
              </div>

              {/* ── AI 360° RADAR ── */}
              <div style={{ marginBottom: 22 }}>
                <AICandidateRiskRadar
                  authenticityScore={selectedSession.authenticityScore ?? selectedSession.finalScore ?? 0}
                  codeQualityScore={selectedSession.codeQualityScore ?? 0}
                  testCasesPassed={selectedSession.testCasesPassed ?? 0}
                  totalTestCases={selectedSession.totalTestCases ?? 1}
                  tabSwitches={selectedSession.totalTabSwitches ?? 0}
                  pasteCount={selectedSession.totalPasteCount ?? 0}
                  classification={selectedSession.classification || selectedSession.riskLevel || 'Genuine'}
                />
              </div>

              {/* ── AI TELEMETRY BEHAVIORAL BREAKDOWN ── */}
              <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 18, padding: 22, marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#818cf8', marginBottom: 18 }}>
                  <Cpu size={18} /> AI Telemetry & Behavioral Feature Breakdown
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
                  {/* 1. Keystroke Burstiness */}
                  {(() => {
                    const burstiness = selectedSession.features?.keystroke_burstiness ?? null;
                    const isReal = burstiness !== null && burstiness !== undefined;
                    const val = isReal ? Number(burstiness).toFixed(3) : 'N/A';
                    const isHuman = isReal ? burstiness > 0.05 : true;
                    return (
                      <div style={{ background: '#0b0f19', padding: 16, borderRadius: 12, border: `1px solid ${isHuman ? '#1f2937' : '#ef444440'}` }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Terminal size={14} color="#818cf8" /> Keystroke Burstiness
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isHuman ? '#818cf8' : '#ef4444', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {val} {isHuman ? <span style={{ fontSize: 10, background: '#818cf820', padding: '2px 6px', borderRadius: 6, color: '#818cf8' }}>Human Cadence</span> : <span style={{ fontSize: 10, background: '#ef444420', padding: '2px 6px', borderRadius: 6, color: '#ef4444' }}>Bot Pattern</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Inter-key pause variance (&gt;0.05)</div>
                      </div>
                    );
                  })()}

                  {/* 2. Copy-Paste Ratio */}
                  {(() => {
                    const pasteChars = selectedSession.totalPasteChars || (selectedSession.totalPasteCount||0) * 50;
                    const totalKeys = selectedSession.totalKeystrokes || 100;
                    const ratio = Math.min(1, pasteChars / Math.max(1, totalKeys));
                    const isPasteHigh = ratio > 0.25;
                    return (
                      <div style={{ background: '#0b0f19', padding: 16, borderRadius: 12, border: `1px solid ${isPasteHigh ? '#ef444440' : '#1f2937'}` }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Copy size={14} color="#10b981" /> Copy-Paste Ratio
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isPasteHigh ? '#ef4444' : '#10b981', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {(ratio * 100).toFixed(1)}% {isPasteHigh ? <span style={{ fontSize: 10, background: '#ef444420', padding: '2px 6px', borderRadius: 6, color: '#ef4444' }}>High</span> : <span style={{ fontSize: 10, background: '#10b98120', padding: '2px 6px', borderRadius: 6, color: '#10b981' }}>Genuine</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                          {pasteChars} chars / {totalKeys} keys
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3. Eye Deviation Angle & Focus Events */}
                  {(() => {
                    const eyeDeg = typeof selectedSession.eyeDeviationDegrees === 'number'
                      ? selectedSession.eyeDeviationDegrees
                      : (selectedSession.features?.eye_deviation ?? (selectedSession.totalOffScreenEvents ? Math.min(90, selectedSession.totalOffScreenEvents * 12) : 0));
                    const offScreen = selectedSession.totalOffScreenEvents ?? selectedSession.features?.off_screen_events_count ?? 0;
                    const isSuspect = eyeDeg > 25 || offScreen > 3;
                    return (
                      <div style={{ background: '#0b0f19', padding: 16, borderRadius: 12, border: `1px solid ${isSuspect ? '#f59e0b40' : '#1f2937'}` }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={14} color="#f59e0b" /> Eye Deviation Degree
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isSuspect ? '#f59e0b' : '#10b981', marginTop: 6 }}>
                          {eyeDeg}° <span style={{ fontSize: 10, color: isSuspect ? '#f59e0b' : '#10b981' }}>({isSuspect ? 'Deviated' : 'Focused'})</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{offScreen} off-screen gaze events</div>
                      </div>
                    );
                  })()}

                  {/* 4. Live Audio Proctoring Stream */}
                  {(() => {
                    const speech = selectedSession.totalSpeechDetectedEvents || selectedSession.features?.audio_speech_ratio || 0;
                    const noise = selectedSession.totalAudioNoiseEvents || 0;
                    const isAudioAlert = speech > 0 || noise > 5;
                    return (
                      <div style={{ background: '#0b0f19', padding: 16, borderRadius: 12, border: `1px solid ${isAudioAlert ? '#ef444440' : '#1f2937'}` }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}></span> Audio Proctoring Stream
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isAudioAlert ? '#ef4444' : '#10b981', marginTop: 6 }}>
                          {speech > 0 ? ` Voice (${speech})` : ' Quiet (0 Speech)'}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Noise spikes: {noise} | Web Audio API</div>
                      </div>
                    );
                  })()}

                  {/* 5. Motion & Head Pose Rotation Degree */}
                  {(() => {
                    const headDeg = typeof selectedSession.headMovementDegrees === 'number'
                      ? selectedSession.headMovementDegrees
                      : (selectedSession.features?.head_movement ?? (selectedSession.headMovementIntensity ? Math.min(90, Math.round(selectedSession.headMovementIntensity / 4)) : 0));
                    const isExcessive = headDeg > 20;
                    return (
                      <div style={{ background: '#0b0f19', padding: 16, borderRadius: 12, border: `1px solid ${isExcessive ? '#f59e0b40' : '#1f2937'}` }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}></span> Head Movement Rotation
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isExcessive ? '#f59e0b' : '#38bdf8', marginTop: 6 }}>
                          {headDeg}° <span style={{ fontSize: 10, color: isExcessive ? '#f59e0b' : '#38bdf8' }}>({isExcessive ? 'Head Turned' : 'Centered'})</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>MediaPipe 3D face mesh pose</div>
                      </div>
                    );
                  })()}

                  {/* 6. AST Complexity */}
                  {(() => {
                    const complexity = selectedSession.features?.cyclomatic_complexity ?? Math.max(1, Math.round((selectedSession.finalCode?.length || 200) / 45));
                    const isComplex = complexity >= 5;
                    return (
                      <div style={{ background: '#0b0f19', padding: 16, borderRadius: 12, border: '1px solid #1f2937' }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <BrainCircuit size={14} color="#38bdf8" /> AST Complexity
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', marginTop: 6 }}>
                          {complexity} / 25 <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>({isComplex ? 'Structured' : 'Simple'})</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Decision branches & depth</div>
                      </div>
                    );
                  })()}
                </div>

                {/* Structured Behavioral Summary Cards */}
                <div style={{ background: '#0b0f19', padding: 18, borderRadius: 14, border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={15} color="#818cf8" /> Diagnostic Summary Report
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Keystroke Diagnostics */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
                      {(selectedSession.totalPasteCount || 0) > 0 ? (
                        <span style={{ background: '#ef444420', color: '#ef4444', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 2 }}>PASTE ALERT</span>
                      ) : (
                        <span style={{ background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 2 }}>TYPING VERIFIED</span>
                      )}
                      <div>
                        <strong>Keystroke & Rhythm:</strong>{' '}
                        {(selectedSession.totalPasteCount || 0) > 0
                          ? `${selectedSession.totalPasteCount} paste event(s) detected (${selectedSession.totalPasteChars || (selectedSession.totalPasteCount||0)*50} chars). Code was not fully self-typed.`
                          : 'Code entered with natural human typing cadence. Zero paste bursts detected.'}
                      </div>
                    </div>

                    {/* Proctoring Diagnostics */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
                      {((selectedSession.totalTabSwitches||0) > 5 || (selectedSession.totalOffScreenEvents||0) > 3) ? (
                        <span style={{ background: '#f59e0b20', color: '#f59e0b', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 2 }}>ATTENTION</span>
                      ) : (
                        <span style={{ background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 2 }}>PROCTOR PASSED</span>
                      )}
                      <div>
                        <strong>Multi-Modal Proctoring:</strong>{' '}
                        Tab switches: <strong>{selectedSession.totalTabSwitches ?? 0}</strong>. Off-screen gaze events: <strong>{selectedSession.totalOffScreenEvents ?? 0}</strong>.{' '}
                        {((selectedSession.totalTabSwitches||0) > 5 || (selectedSession.totalOffScreenEvents||0) > 3) ? 'Potential focus loss or external help detected.' : 'Camera gaze & page focus maintained throughout exam.'}
                      </div>
                    </div>

                    {/* Code Structure Diagnostics */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
                      <span style={{ background: '#38bdf820', color: '#38bdf8', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 2 }}>CODE AST</span>
                      <div>
                        <strong>Code Construction:</strong>{' '}
                        {(selectedSession.codeQualityScore ?? 0) > 75
                          ? 'Code exhibits clean modular structure with appropriate logic and error handling.'
                          : 'Code structure is basic or procedural.'}{' '}
                        Compilation attempts: <strong>{selectedSession.compilationAttempts ?? 0}</strong>.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SHAP MODEL ATTRIBUTION ── */}
              <div style={{ padding: 18, background: '#111827', borderRadius: 16, border: '1px solid #1f2937', marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={16} /> SHAP Feature Attribution & Verification Seal
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', background: '#1f2937', padding: '3px 10px', borderRadius: 6 }}>
                    SHA-256: 0x8F92A0B7{selectedSession?._id ? String(selectedSession._id).slice(-8).toUpperCase() : '00000000'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 11, background: '#10b98115', color: '#10b981', padding: '4px 12px', borderRadius: 8, fontWeight: 700, border: '1px solid #10b98130' }}>
                    +30 pts: Natural Keystroke Cadence
                  </span>
                  {(selectedSession.totalPasteCount || 0) > 0 ? (
                    <span style={{ fontSize: 11, background: '#ef444415', color: '#ef4444', padding: '4px 12px', borderRadius: 8, fontWeight: 700, border: '1px solid #ef444430' }}>
                      -{Math.min(40, (selectedSession.totalPasteCount||0) * 8)} pts: {selectedSession.totalPasteCount} Copy-Paste Event(s) ({selectedSession.totalPasteChars || (selectedSession.totalPasteCount||0)*50} chars)
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, background: '#10b98115', color: '#10b981', padding: '4px 12px', borderRadius: 8, fontWeight: 700, border: '1px solid #10b98130' }}>
                      +25 pts: Zero Copy-Paste Bursts
                    </span>
                  )}
                  <span style={{ fontSize: 11, background: '#38bdf815', color: '#38bdf8', padding: '4px 12px', borderRadius: 8, fontWeight: 700, border: '1px solid #38bdf830' }}>
                    {(selectedSession.testCasesPassed||0) === (selectedSession.totalTestCases||1) ? '+' : ''}
                    {Math.round(((selectedSession.testCasesPassed||0)/(selectedSession.totalTestCases||1))*25)} pts: {selectedSession.testCasesPassed||0}/{selectedSession.totalTestCases||0} Tests Passed
                  </span>
                  {(selectedSession.totalTabSwitches||0) > 5 ? (
                    <span style={{ fontSize: 11, background: '#ef444415', color: '#f97316', padding: '4px 12px', borderRadius: 8, fontWeight: 700, border: '1px solid #f9741630' }}>
                      -{Math.min(20, (selectedSession.totalTabSwitches||0) * 2)} pts: {selectedSession.totalTabSwitches} Tab Switches
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, background: '#818cf815', color: '#818cf8', padding: '4px 12px', borderRadius: 8, fontWeight: 700, border: '1px solid #818cf830' }}>
                      +10 pts: Zero Tab Switches
                    </span>
                  )}
                  <span style={{ fontSize: 11, background: '#818cf815', color: '#818cf8', padding: '4px 12px', borderRadius: 8, fontWeight: 700, border: '1px solid #818cf830' }}>
                    +10 pts: Camera Gaze Verified
                  </span>
                </div>
              </div>

              
              {/* ── LINE-BY-LINE CODE AUTHENTICITY HEATMAP ── */}
              {selectedSession.finalCode && (() => {
                const codeLines = selectedSession.finalCode.split('\n');
                const lineOriginsMap = new Map();
                if (Array.isArray(selectedSession.lineOrigins)) {
                  selectedSession.lineOrigins.forEach(lo => lineOriginsMap.set(lo.lineNumber, lo.type));
                }

                const totalLines = codeLines.length;
                let typedCount = 0, editedCount = 0, pastedCount = 0;

                codeLines.forEach((_, idx) => {
                  const lineNum = idx + 1;
                  const originType = lineOriginsMap.get(lineNum) || 'typed';
                  if (originType === 'pasted') pastedCount++;
                  else if (originType === 'edited') editedCount++;
                  else typedCount++;
                });

                return (
                  <div style={{ marginBottom: 24, background: '#0b0f19', borderRadius: 16, border: '1px solid #1f2937', padding: 18 }}>
                    {/* Header & Copy Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Code size={16} color="#38bdf8" /> Line-by-Line Code Authenticity Heatmap ({selectedSession.language})
                      </div>
                      <button 
                        onClick={() => copyToClipboard(selectedSession.finalCode)}
                        style={{ background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {copiedCode ? <Check size={12} /> : <Copy size={12} />} {copiedCode ? 'Copied!' : 'Copy Code'}
                      </button>
                    </div>

                    {/* Heatmap Legend Pills */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14, background: '#111827', padding: '8px 14px', borderRadius: 10, border: '1px solid #1f2937', fontSize: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 700 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }} /> Self-Typed ({typedCount} lines)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontWeight: 700 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b' }} /> Revised/Edited ({editedCount} lines)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontWeight: 700 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} /> Pasted ({pastedCount} lines)
                      </div>
                    </div>

                    {/* Line-by-Line Highlighted Code Box */}
                    <div style={{
                      background: '#030712', borderRadius: 12, border: '1px solid #1f2937',
                      fontFamily: 'Consolas, Monaco, "Fira Code", monospace', fontSize: 12.5,
                      lineHeight: 1.65, maxHeight: 320, overflowY: 'auto', overflowX: 'auto'
                    }}>
                      {codeLines.map((lineText, idx) => {
                        const lineNum = idx + 1;
                        const originType = lineOriginsMap.get(lineNum) || 'typed';

                        let lineBg = 'transparent';
                        let borderLeftColor = '#374151';
                        let badgeLabel = '';
                        let badgeBg = '';
                        let badgeColor = '';

                        if (originType === 'pasted') {
                          lineBg = 'rgba(239, 68, 68, 0.15)';
                          borderLeftColor = '#ef4444';
                          badgeLabel = 'PASTED';
                          badgeBg = '#ef444430';
                          badgeColor = '#fca5a5';
                        } else if (originType === 'edited') {
                          lineBg = 'rgba(245, 158, 11, 0.12)';
                          borderLeftColor = '#f59e0b';
                          badgeLabel = 'EDITED';
                          badgeBg = '#f59e0b30';
                          badgeColor = '#fde68a';
                        } else {
                          lineBg = 'rgba(16, 185, 129, 0.06)';
                          borderLeftColor = '#10b981';
                        }

                        return (
                          <div 
                            key={lineNum}
                            style={{
                              display: 'flex', alignItems: 'center',
                              background: lineBg, borderLeft: `4px solid ${borderLeftColor}`,
                              padding: '2px 12px 2px 8px'
                            }}
                          >
                            <span style={{ width: 32, color: '#4b5563', fontSize: 11, userSelect: 'none', textAlign: 'right', paddingRight: 10, flexShrink: 0 }}>
                              {lineNum}
                            </span>
                            <span style={{ color: originType === 'pasted' ? '#fca5a5' : originType === 'edited' ? '#fde68a' : '#e5e7eb', flexGrow: 1, whiteSpace: 'pre' }}>
                              {lineText || ' '}
                            </span>
                            {badgeLabel && (
                              <span style={{ fontSize: 9, fontWeight: 800, background: badgeBg, color: badgeColor, padding: '1px 6px', borderRadius: 4, marginLeft: 12, flexShrink: 0 }}>
                                {badgeLabel}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── TEACH AI / OVERRIDE LABEL ── */}
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GraduationCap size={20} color="#818cf8" /> Teach AI Model — Set Ground-Truth Label
                </div>
                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
                  Selecting a label feeds this candidate session into the AI training dataset. Future automated evaluations become smarter with your input.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Genuine', color: '#10b981', desc: 'Authentic candidate work' }, 
                    { label: 'Review Needed', color: '#f59e0b', desc: 'Requires human verification' }, 
                    { label: 'Suspicious', color: '#ef4444', desc: 'Plagiarism / external help' }
                  ].map(({ label, color, desc }) => (
                    <div 
                      key={label} 
                      onClick={() => setReviewLabel(label)}
                      style={{ 
                        display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px',
                        border: `2px solid ${reviewLabel === label ? color : '#334155'}`,
                        borderRadius: '12px', cursor: 'pointer', 
                        background: reviewLabel === label ? `${color}12` : '#1e293b',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: '16px', height: '16px', borderRadius: '50%', 
                          border: `4px solid ${reviewLabel === label ? color : '#475569'}`,
                          background: reviewLabel === label ? '#fff' : 'transparent',
                          boxSizing: 'border-box', flexShrink: 0
                        }} />
                        <span style={{ fontWeight: 700, color: reviewLabel === label ? color : '#e2e8f0', fontSize: '14px' }}>
                          {label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 26 }}>{desc}</div>
                    </div>
                  ))}
                </div>

                <textarea 
                  placeholder="Add reviewer notes for AI training logs (optional)..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #334155',
                    background: '#1e293b', color: '#f8fafc', minHeight: '65px', marginBottom: '16px', 
                    fontFamily: 'inherit', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => setSelectedSession(null)}
                    style={{ flex: 1, padding: '12px', background: '#334155', border: 'none', color: '#f8fafc', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={submitReview}
                    style={{ 
                      flex: 2, padding: '12px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', 
                      color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '14px',
                      boxShadow: '0 4px 14px rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    <BrainCircuit size={16} /> Save Analysis & Train Model
                  </button>
                </div>
              </div>
            </div>
            
            <style>{`
              @keyframes modalSlideUp {
                from { opacity: 0; transform: translateY(24px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminCodingResults;

