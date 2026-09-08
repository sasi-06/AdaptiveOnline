import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { 
  ShieldAlert, AlertTriangle, CheckCircle, Code, 
  FileText, Search, RefreshCw, Layers, ArrowRight, Eye
} from 'lucide-react';

export default function AdminPlagiarismDetector() {
  const { theme: t } = useTheme();
  const [data, setData] = useState({ matrix: [], candidates: [], totalSubmissions: 0, highRiskCount: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'high' | 'medium'
  const [selectedPair, setSelectedPair] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    fetchMatrix();
  }, []);

  const [selectedQuestion, setSelectedQuestion] = useState('all');

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await api.get('/plagiarism/matrix');
      setData(res.data);
    } catch (err) {
      toast.error('Failed to fetch plagiarism matrix data');
    } finally {
      setLoading(false);
    }
  };

  const handleInspectDiff = async (pair) => {
    setSelectedPair(pair);
    setDiffLoading(true);
    try {
      const res = await api.post('/plagiarism/compare', {
        sessionAId: pair.sessionA,
        sessionBId: pair.sessionB
      });
      setDiffData(res.data);
    } catch (err) {
      toast.error('Failed to generate code diff');
    } finally {
      setDiffLoading(false);
    }
  };

  const filteredMatrix = (data.matrix || []).filter(item => {
    if (selectedQuestion !== 'all' && item.questionId !== selectedQuestion) return false;
    if (filter === 'high') return item.similarityScore >= 75;
    if (filter === 'medium') return item.similarityScore >= 40 && item.similarityScore < 75;
    return true;
  });

  const getScoreColor = (score) => {
    if (score >= 75) return '#ef4444'; // Red
    if (score >= 40) return '#f59e0b'; // Yellow
    return '#10b981'; // Green
  };

  if (loading) {
    return <div style={{ padding: 24, color: t.textMuted }}>Analyzing Abstract Syntax Trees (AST) & Code Similarities...</div>;
  }

  return (
    <div style={{ padding: '20px 0', fontFamily: 'Outfit, sans-serif' }}>
      
      {/* ── HEADER BANNER ── */}
      <div style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24, marginBottom: 28,
        display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#ef444420', padding: 12, borderRadius: 12, color: '#ef4444' }}>
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: '0 0 4px 0' }}>
              AI Code Plagiarism & AST Similarity Engine
            </h2>
            <p style={{ margin: 0, color: t.textMuted, fontSize: 14 }}>
              Cross-candidate Abstract Syntax Tree (AST) N-gram token sequence analysis & plagiarism detection.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ background: t.surfaceAlt, padding: '10px 18px', borderRadius: 12, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>Total Submissions</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{data.totalSubmissions || 0}</div>
          </div>
          <div style={{ background: t.surfaceAlt, padding: '10px 18px', borderRadius: 12, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>High Risk Plagiarism Pairs</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{data.highRiskCount || 0}</div>
          </div>
          <button 
            onClick={fetchMatrix}
            style={{
              background: t.accent, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10,
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <RefreshCw size={16} /> Re-analyze Cohort
          </button>
        </div>
      </div>

      {/* ── FILTER TABS & QUESTION SELECTOR ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'all', label: `All Comparisons (${filteredMatrix.length})` },
            { id: 'high', label: `High Similarity ≥75% (${data.highRiskCount || 0})` },
            { id: 'medium', label: 'Medium Similarity 40-74%' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.border}`,
                background: filter === tab.id ? t.accent : t.surface,
                color: filter === tab.id ? '#fff' : t.text, fontWeight: 600, fontSize: 13, cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Question Selector Dropdown */}
        {data.questions && data.questions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: t.textMuted, fontWeight: 700 }}>Filter by Question:</label>
            <select
              value={selectedQuestion}
              onChange={e => setSelectedQuestion(e.target.value)}
              style={{
                padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border}`,
                background: t.surface, color: t.text, fontWeight: 600, fontSize: 13, outline: 'none'
              }}
            >
              <option value="all">All Exam Questions ({data.questions.length})</option>
              {data.questions.map(q => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── SIMILARITY MATRIX TABLE ── */}
      <div style={{ overflowX: 'auto', background: t.surface, borderRadius: 14, border: `1px solid ${t.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: t.text, fontSize: 14 }}>
          <thead>
            <tr style={{ background: t.border, color: t.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              <th style={{ padding: '14px 20px' }}>Candidate A</th>
              <th style={{ padding: '14px 20px' }}>Candidate B</th>
              <th style={{ padding: '14px 20px' }}>Question / Domain</th>
              <th style={{ padding: '14px 20px' }}>AST Similarity %</th>
              <th style={{ padding: '14px 20px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatrix.map((pair, idx) => {
              const scoreColor = getScoreColor(pair.similarityScore);
              return (
                <tr key={idx} style={{ borderTop: `1px solid ${t.border}`, background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700 }}>{pair.candidateA}</div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{pair.emailA}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700 }}>{pair.candidateB}</div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{pair.emailB}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600 }}>{pair.questionTitle}</div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{pair.language}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 8, background: t.border, borderRadius: 99, overflow: 'hidden', maxWidth: 100 }}>
                        <div style={{ width: `${pair.similarityScore}%`, height: '100%', background: scoreColor }} />
                      </div>
                      <span style={{ fontWeight: 800, color: scoreColor, fontSize: 15 }}>
                        {pair.similarityScore}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <button
                      onClick={() => handleInspectDiff(pair)}
                      style={{
                        padding: '6px 14px', background: `${scoreColor}15`, color: scoreColor,
                        border: `1px solid ${scoreColor}40`, borderRadius: 6, fontSize: 13,
                        fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <Eye size={14} /> Inspect Code Diff
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredMatrix.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: 32, textAlign: 'center', color: t.textMuted }}>
                  No candidate submissions matching this plagiarism filter threshold.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── SIDE-BY-SIDE CODE DIFF MODAL ── */}
      {selectedPair && (
        <div 
          onClick={() => setSelectedPair(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 24
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0f172a', border: '1px solid #334155', borderRadius: 24, padding: 28,
              width: '1000px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px rgba(0,0,0,0.7)', color: '#f8fafc'
            }}
          >
            {/* Modal Title Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>
                  Side-by-Side AST Code Comparison & Diff Viewer
                </h3>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  Question: <strong style={{ color: '#e2e8f0' }}>{selectedPair.questionTitle}</strong> ({selectedPair.language})
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  padding: '6px 14px', borderRadius: 99, fontWeight: 800, fontSize: 14,
                  background: `${getScoreColor(selectedPair.similarityScore)}20`,
                  color: getScoreColor(selectedPair.similarityScore),
                  border: `1px solid ${getScoreColor(selectedPair.similarityScore)}40`
                }}>
                  Similarity: {selectedPair.similarityScore}%
                </div>
                <button 
                  onClick={() => setSelectedPair(null)}
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {diffLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Tokenizing AST nodes & generating side-by-side diff...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, overflowY: 'auto', flex: 1 }}>
                {/* Candidate A Code Panel */}
                <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Code size={16} /> Candidate A: {selectedPair.candidateA} ({selectedPair.emailA})
                  </div>
                  <pre style={{
                    color: '#e2e8f0', fontFamily: 'Consolas, Monaco, monospace', fontSize: 13,
                    lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto'
                  }}>
                    {diffData?.sessionA?.code || selectedPair.codeA || '// No code submitted'}
                  </pre>
                </div>

                {/* Candidate B Code Panel */}
                <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ec4899', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Code size={16} /> Candidate B: {selectedPair.candidateB} ({selectedPair.emailB})
                  </div>
                  <pre style={{
                    color: '#e2e8f0', fontFamily: 'Consolas, Monaco, monospace', fontSize: 13,
                    lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto'
                  }}>
                    {diffData?.sessionB?.code || selectedPair.codeB || '// No code submitted'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
