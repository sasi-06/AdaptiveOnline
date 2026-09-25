/**
 * EvaluationPanel.jsx
 * Right-side results panel shown after circuit submission.
 *
 * Displays:
 *   1. Animated Score Ring & Verdict
 *   2. 📈 Bode Plot & Frequency Response (Magnitude dB + Phase)
 *   3. 🌊 Oscilloscope Time-Domain Waveform Preview (Channel 1 Vin vs Channel 2 Vout)
 *   4. ⚡ Component Thermal & Power Dissipation Audit (mW/W limits)
 *   5. 🛡️ SPICE Design Rule Checks & EE Grade Card
 *   6. 🤖 AI Reasoning & ML Feature Signals
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { exportCircuitReportPDF, exportSchematicPNG } from '../../utils/exportCircuitReport';
import ShapBreakdown from './ShapBreakdown';

function ModelConsensusCard({ votes, disagreement, confidence, isDark }) {
    if (!votes) return null;
    const bgCard = isDark ? '#161b22' : '#ffffff';
    const border = isDark ? '#30363d' : '#e2e8f0';
    const textCol = isDark ? '#f0f6fc' : '#1e293b';

    return (
        <div style={{
            background: bgCard,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 14
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: textCol, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🤖 3-Model Ensemble Consensus
                </span>
                {disagreement ? (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>
                        ⚠️ Disagreement (Instructor Review)
                    </span>
                ) : (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', fontWeight: 700 }}>
                        ✅ Consensus Reached
                    </span>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                <div style={{ background: isDark ? '#21262d' : '#f8fafc', padding: 8, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: isDark ? '#8b949e' : '#64748b' }}>Flat Neural Net</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: textCol, marginTop: 2 }}>{votes.flat_ensemble?.replace('_', ' ') || 'N/A'}</div>
                </div>
                <div style={{ background: isDark ? '#21262d' : '#f8fafc', padding: 8, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: isDark ? '#8b949e' : '#64748b' }}>Graph GCN</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: textCol, marginTop: 2 }}>{votes.gnn?.replace('_', ' ') || 'Active'}</div>
                </div>
                <div style={{ background: isDark ? '#21262d' : '#f8fafc', padding: 8, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: isDark ? '#8b949e' : '#64748b' }}>Physics Rules</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: textCol, marginTop: 2 }}>{votes.rule_engine?.replace('_', ' ') || 'N/A'}</div>
                </div>
            </div>
        </div>
    );
}

function VivaQuestionsCard({ questions, isDark }) {
    if (!questions || questions.length === 0) return null;
    const bgCard = isDark ? '#161b22' : '#ffffff';
    const border = isDark ? '#30363d' : '#e2e8f0';
    const textCol = isDark ? '#f0f6fc' : '#1e293b';

    return (
        <div style={{
            background: bgCard,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 14
        }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: textCol, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                🎙️ Tailored Circuit Viva Questions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {questions.map((q, i) => (
                    <div key={i} style={{
                        background: isDark ? 'rgba(108, 99, 255, 0.06)' : '#f8faff',
                        borderLeft: '3px solid #6c63ff',
                        padding: '10px 12px',
                        borderRadius: '0 8px 8px 0'
                    }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: textCol, lineHeight: 1.5 }}>
                            Q{i+1}: {q.questionText}
                        </div>
                        {q.contextCodeSnippet && (
                            <div style={{ fontSize: 10, color: isDark ? '#a78bfa' : '#6c63ff', fontFamily: 'monospace', marginTop: 4 }}>
                                Target Context: {q.contextCodeSnippet}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Score ring (animated SVG circle) ─────────────────────────────────────────
function ScoreRing({ score, size = 120 }) {

    const [displayed, setDisplayed] = useState(0);
    const radius = (size - 16) / 2;
    const circ   = 2 * Math.PI * radius;
    const offset = circ - (displayed / 100) * circ;

    const color = score >= 85 ? '#22c55e'
                : score >= 50 ? '#f59e0b'
                : '#ef4444';

    useEffect(() => {
        let frame;
        let current = 0;
        const step = () => {
            current = Math.min(current + 2, score);
            setDisplayed(current);
            if (current < score) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [score]);

    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size/2} cy={size/2} r={radius}
                    fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="8" />
            <circle cx={size/2} cy={size/2} r={radius}
                    fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.05s linear', filter: `drop-shadow(0 0 6px ${color})` }} />
            <text x={size/2} y={size/2 + 6}
                  textAnchor="middle" fontSize="22" fontWeight="800"
                  fill={color}
                  style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
                {displayed}
            </text>
        </svg>
    );
}

function MiniBar({ value, max, color }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
                width: `${pct}%`, height: '100%',
                background: color, borderRadius: 3,
                transition: 'width 0.6s ease'
            }} />
        </div>
    );
}

// ── 📈 Bode Plot Visualizer (Gain dB & Phase) ───────────────────────────────
function BodePlotChart({ bodeData, isDark }) {
    if (!bodeData || bodeData.length === 0) return null;

    const width = 380, height = 140;
    const padding = { top: 16, right: 30, bottom: 24, left: 35 };

    const minF = bodeData[0].freq;
    const maxF = bodeData[bodeData.length - 1].freq;
    const minDb = Math.min(...bodeData.map(d => d.gain_db));
    const maxDb = Math.max(...bodeData.map(d => d.gain_db));

    const dbRange = Math.max(10, maxDb - minDb);

    const getX = (freq) => {
        const logMin = Math.log10(minF);
        const logMax = Math.log10(maxF);
        const logF   = Math.log10(Math.max(minF, freq));
        return padding.left + ((logF - logMin) / (logMax - logMin)) * (width - padding.left - padding.right);
    };

    const getY = (db) => {
        return padding.top + (1 - (db - minDb) / dbRange) * (height - padding.top - padding.bottom);
    };

    const points = bodeData.map(d => `${getX(d.freq)},${getY(d.gain_db)}`).join(' ');

    const bg     = isDark ? '#0d1117' : '#f8fafc';
    const grid   = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
    const text   = isDark ? '#94a3b8' : '#64748b';
    const line   = isDark ? '#a78bfa' : '#6d28d9';

    return (
        <div style={{ background: bg, borderRadius: 10, padding: 10, border: `1px solid ${grid}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: text, marginBottom: 4 }}>
                <span>📈 AC Frequency Response (Bode Plot)</span>
                <span style={{ color: line }}>Magnitude (dB)</span>
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
                {/* Grid lines */}
                <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} stroke={grid} strokeDasharray="3 3" />
                <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke={grid} />
                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke={grid} />

                {/* Magnitude curve */}
                <polyline fill="none" stroke={line} strokeWidth="2.5" points={points} strokeLinecap="round" strokeLinejoin="round" />

                {/* Data dots */}
                {bodeData.filter((_, i) => i % 4 === 0).map((d, idx) => (
                    <circle key={idx} cx={getX(d.freq)} cy={getY(d.gain_db)} r="3" fill={line} />
                ))}

                {/* Axes labels */}
                <text x={padding.left} y={height - 6} fill={text} fontSize="9">{minF}Hz</text>
                <text x={width/2} y={height - 6} fill={text} fontSize="9" textAnchor="middle">Frequency (Hz)</text>
                <text x={width - padding.right} y={height - 6} fill={text} fontSize="9" textAnchor="end">{maxF >= 1000000 ? '1MHz' : `${maxF/1000}kHz`}</text>
                <text x={padding.left - 4} y={padding.top + 8} fill={text} fontSize="9" textAnchor="end">{maxDb.toFixed(0)}dB</text>
                <text x={padding.left - 4} y={height - padding.bottom - 2} fill={text} fontSize="9" textAnchor="end">{minDb.toFixed(0)}dB</text>
            </svg>
        </div>
    );
}

// ── 🌊 Oscilloscope Time-Domain Visualizer ───────────────────────────────────
function OscilloscopeWaveform({ waveform, isDark }) {
    if (!waveform || waveform.length === 0) return null;

    const width = 380, height = 120;
    const padding = { top: 12, right: 20, bottom: 20, left: 30 };

    const minVin = Math.min(...waveform.map(w => Math.min(w.vin, w.vout)));
    const maxVin = Math.max(...waveform.map(w => Math.max(w.vin, w.vout)));
    const vRange = Math.max(2, maxVin - minVin);

    const getX = (t) => padding.left + (t / waveform[waveform.length - 1].t_ms) * (width - padding.left - padding.right);
    const getY = (v) => padding.top + (1 - (v - minVin) / vRange) * (height - padding.top - padding.bottom);

    const vinPoints  = waveform.map(w => `${getX(w.t_ms)},${getY(w.vin)}`).join(' ');
    const voutPoints = waveform.map(w => `${getX(w.t_ms)},${getY(w.vout)}`).join(' ');

    const oscBg   = isDark ? '#051b14' : '#0f291e';
    const grid    = 'rgba(34, 197, 94, 0.2)';
    const vinCol  = '#facc15'; // CH1 Yellow
    const voutCol = '#38bdf8'; // CH2 Cyan

    return (
        <div style={{ background: oscBg, borderRadius: 10, padding: 10, border: '1px solid rgba(34,197,94,0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>
                <span>🌊 Oscilloscope Waveform Preview</span>
                <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ color: vinCol }}>CH1 (Vin)</span>
                    <span style={{ color: voutCol }}>CH2 (Vout)</span>
                </div>
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
                {/* Grid */}
                <line x1={padding.left} y1={height/2} x2={width - padding.right} y2={height/2} stroke={grid} strokeDasharray="2 2" />
                <line x1={width/2} y1={padding.top} x2={width/2} y2={height - padding.bottom} stroke={grid} strokeDasharray="2 2" />

                {/* CH1 Input Waveform */}
                <polyline fill="none" stroke={vinCol} strokeWidth="2" points={vinPoints} strokeLinecap="round" />
                {/* CH2 Output Waveform */}
                <polyline fill="none" stroke={voutCol} strokeWidth="2" points={voutPoints} strokeLinecap="round" />

                {/* Labels */}
                <text x={padding.left} y={height - 4} fill="#86efac" fontSize="9">0ms</text>
                <text x={width - padding.right} y={height - 4} fill="#86efac" fontSize="9" textAnchor="end">{waveform[waveform.length - 1].t_ms}ms</text>
            </svg>
        </div>
    );
}

// ── ⚡ Component Power & Thermal Audit Table ─────────────────────────────────
function ThermalPowerAudit({ breakdown, warnings, isDark }) {
    if (!breakdown || breakdown.length === 0) return null;

    const bg    = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
    const border= isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0';
    const text  = isDark ? '#e2e8f0' : '#0f172a';
    const muted = isDark ? '#94a3b8' : '#64748b';

    return (
        <div style={{ background: bg, border, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: text }}>⚡ Power Dissipation & Thermal Audit</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: warnings?.length > 0 ? '#ef4444' : '#22c55e' }}>
                    {warnings?.length > 0 ? `⚠️ ${warnings.length} Thermal Overload` : '🟢 Thermal Safe (<250mW)'}
                </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                    <tr style={{ borderBottom: border, color: muted, textAlign: 'left' }}>
                        <th style={{ padding: '4px 6px' }}>Component</th>
                        <th style={{ padding: '4px 6px' }}>Current</th>
                        <th style={{ padding: '4px 6px' }}>Power</th>
                        <th style={{ padding: '4px 6px' }}>Thermal Status</th>
                    </tr>
                </thead>
                <tbody>
                    {breakdown.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}` }}>
                            <td style={{ padding: '6px', fontWeight: 700, color: isDark ? '#a78bfa' : '#6d28d9' }}>{row.comp_id}</td>
                            <td style={{ padding: '6px', color: text, fontFamily: 'monospace' }}>{row.current_ma} mA</td>
                            <td style={{ padding: '6px', fontWeight: 700, color: row.power_mw > 250 ? '#ef4444' : text, fontFamily: 'monospace' }}>
                                {row.power_mw} mW
                            </td>
                            <td style={{ padding: '6px', color: row.power_mw > 250 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                                {row.status}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Verdict badge ─────────────────────────────────────────────────────────────
const VERDICT_META = {
    correct:           { icon: '✅', label: 'Correct',            color: '#22c55e', bg: 'rgba(34,197,94,0.10)' },
    partially_correct: { icon: '⚠️', label: 'Partially Correct',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
    incorrect:         { icon: '❌', label: 'Incorrect',           color: '#ef4444', bg: 'rgba(239,68,68,0.10)' }
};

const ISSUE_META = {
    topology:          { icon: '🔀', color: '#f59e0b' },
    component_value:   { icon: '🔢', color: '#f97316' },
    missing_ground:    { icon: '⚡', color: '#ef4444' },
    wrong_component:   { icon: '🚫', color: '#ef4444' },
    floating_pin:      { icon: '📍', color: '#f59e0b' },
    short_circuit:     { icon: '💥', color: '#ef4444' },
    too_many_instances:{ icon: '📊', color: '#f59e0b' },
    polarity_error:    { icon: '🔄', color: '#ef4444' },
    component_type_mismatch: { icon: '🔧', color: '#f59e0b' },
};

// ── 🏆 Design Grade Card ─────────────────────────────────────────────────────
function DesignGradeCard({ designAnalysis, isDark }) {
    if (!designAnalysis) return null;
    const { design_grade, grade_assessment, design_style,
            topology_quality_pct, value_accuracy_pct,
            total_components_placed, total_connections_made,
            circuit_completeness_pct, has_measurement_device } = designAnalysis;

    const gradeColor = {
        'A+': '#22c55e', A: '#4ade80', B: '#84cc16',
        C: '#f59e0b', D: '#f97316', F: '#ef4444'
    }[design_grade] || '#94a3b8';

    const cardBg  = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
    const border  = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0';
    const textCol = isDark ? '#e2e8f0' : '#1e293b';
    const mutedCol= isDark ? '#94a3b8' : '#64748b';

    return (
        <div style={{ background: cardBg, border, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: mutedCol, marginBottom: 10 }}>
                🏆 Design Grade & Assessment
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${gradeColor}18`, border: `2px solid ${gradeColor}`,
                    fontSize: 28, fontWeight: 900, color: gradeColor, flexShrink: 0,
                    boxShadow: `0 0 16px ${gradeColor}40`
                }}>{design_grade}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textCol, marginBottom: 4 }}>{grade_assessment}</div>
                    <div style={{ fontSize: 11, color: mutedCol, fontStyle: 'italic' }}>Style: {design_style}</div>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                    { label: 'Topology Quality', value: `${topology_quality_pct}%` },
                    { label: 'Value Accuracy',   value: `${value_accuracy_pct}%`   },
                    { label: 'Completeness',     value: `${circuit_completeness_pct}%` },
                    { label: 'Connections',      value: `${total_connections_made}` },
                    { label: 'Components',       value: `${total_components_placed}` },
                    { label: 'Measurement Dev.', value: has_measurement_device ? '✓ Yes' : '✗ No' },
                ].map(({ label, value }) => (
                    <div key={label} style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                        border, borderRadius: 8, padding: '7px 10px'
                    }}>
                        <div style={{ fontSize: 10, color: mutedCol, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: textCol }}>{value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── 🔀 Signal Path Section ────────────────────────────────────────────────────
function SignalPathSection({ signalPath, isDark }) {
    if (!signalPath) return null;
    const isWarning = signalPath.startsWith('⚠️');
    const bg    = isDark ? (isWarning ? 'rgba(245,158,11,0.07)' : 'rgba(108,99,255,0.06)') : (isWarning ? '#fffbeb' : '#f5f3ff');
    const bdrC  = isWarning ? (isDark ? 'rgba(245,158,11,0.3)' : '#fde68a') : (isDark ? 'rgba(108,99,255,0.25)' : '#ddd6fe');
    const textCol = isDark ? '#e2e8f0' : '#1e293b';
    const mutedCol = isDark ? '#94a3b8' : '#64748b';
    return (
        <div style={{ background: bg, border: `1px solid ${bdrC}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? '#a78bfa' : '#6d28d9', marginBottom: 8 }}>
                🔀 Signal Path Analysis
            </div>
            <p style={{ color: textCol, fontSize: 12, lineHeight: 1.7, margin: 0, fontFamily: 'monospace' }}>{signalPath}</p>
        </div>
    );
}

// ── 🔩 Component Analysis Table ───────────────────────────────────────────────
function ComponentAnalysisTable({ componentAnalysis, isDark }) {
    if (!componentAnalysis || componentAnalysis.length === 0) return null;
    const bg     = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
    const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0';
    const textCol = isDark ? '#e2e8f0' : '#0f172a';
    const mutedCol = isDark ? '#94a3b8' : '#64748b';

    const statusColor = { OK: '#22c55e', WARN: '#f59e0b', ERROR: '#ef4444', FLOATING: '#f97316' };

    return (
        <div style={{ background: bg, border, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: mutedCol, marginBottom: 8 }}>
                🔩 Component-Level Analysis
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {componentAnalysis.map((comp, idx) => (
                    <div key={idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px',
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${(statusColor[comp.status] || '#94a3b8')}44`,
                        borderLeft: `3px solid ${statusColor[comp.status] || '#94a3b8'}`,
                        borderRadius: '0 8px 8px 0'
                    }}>
                        <div style={{ minWidth: 60 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: isDark ? '#a78bfa' : '#6d28d9', fontFamily: 'monospace' }}>{comp.comp_id}</div>
                            <div style={{
                                fontSize: 9, fontWeight: 700, color: statusColor[comp.status] || '#94a3b8',
                                textTransform: 'uppercase', letterSpacing: '0.04em'
                            }}>{comp.status}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: mutedCol, marginBottom: 2 }}>{comp.type.replace(/_/g, ' ').toUpperCase()}</div>
                            <div style={{ fontSize: 11, color: textCol, lineHeight: 1.4 }}>{comp.note}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── 💡 Improvement Suggestions ───────────────────────────────────────────────
function ImprovementSuggestions({ suggestions, isDark }) {
    if (!suggestions || suggestions.length === 0) return null;
    const bg    = isDark ? 'rgba(34,197,94,0.05)' : '#f0fdf4';
    const border= isDark ? '1px solid rgba(34,197,94,0.2)' : '1px solid #bbf7d0';
    const textCol = isDark ? '#e2e8f0' : '#15803d';
    const mutedCol = isDark ? '#94a3b8' : '#166534';
    return (
        <div style={{ background: bg, border, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? '#4ade80' : '#16a34a', marginBottom: 10 }}>
                💡 Improvement Suggestions
            </div>
            <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestions.map((s, i) => (
                    <li key={i} style={{ fontSize: 12, color: textCol, lineHeight: 1.6 }}>{s}</li>
                ))}
            </ol>
        </div>
    );
}

// ── 🌐 Real-World Applications ────────────────────────────────────────────────
function RealWorldApplications({ apps, isDark }) {
    if (!apps || apps.length === 0) return null;
    const bg    = isDark ? 'rgba(56,189,248,0.05)' : '#f0f9ff';
    const border= isDark ? '1px solid rgba(56,189,248,0.2)' : '1px solid #bae6fd';
    const textCol = isDark ? '#7dd3fc' : '#0369a1';
    const mutedCol = isDark ? '#94a3b8' : '#64748b';
    return (
        <div style={{ background: bg, border, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? '#38bdf8' : '#0284c7', marginBottom: 8 }}>
                🌐 Real-World Applications
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {apps.map((app, i) => (
                    <span key={i} style={{
                        background: isDark ? 'rgba(56,189,248,0.12)' : '#e0f2fe',
                        border: isDark ? '1px solid rgba(56,189,248,0.3)' : '1px solid #7dd3fc',
                        borderRadius: 20, padding: '4px 12px',
                        fontSize: 11, color: textCol, fontWeight: 500
                    }}>{app}</span>
                ))}
            </div>
        </div>
    );
}

// ── AI Reasoning section ──────────────────────────────────────────────────────
function AIReasoningSection({ evaluation, isDark }) {
    const [open, setOpen] = useState(false);
    const mi = evaluation?.model_info;
    if (!mi) return null;

    const topoScore  = mi.topology_score  ?? 0;
    const valueScore = mi.value_score     ?? 0;
    const confidence = evaluation.ml_confidence ?? 0;
    const fv         = mi.feature_vector  ?? {};
    const classProbabilities = mi.class_probabilities ?? {};

    const cardBg  = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
    const border  = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0';
    const textCol = isDark ? '#e2e8f0' : '#1e293b';
    const mutedCol = isDark ? '#94a3b8' : '#64748b';
    const accentBg = isDark ? 'rgba(108,99,255,0.1)' : '#f3e8ff';

    return (
        <div style={{ border, borderRadius: 10, overflow: 'hidden' }}>
            <div
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', cursor: 'pointer',
                    background: isDark ? 'rgba(108,99,255,0.08)' : '#f0ebff',
                    borderBottom: open ? border : 'none'
                }}
            >
                <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#a78bfa' : '#6d28d9' }}>
                    🤖 AI Reasoning Breakdown
                </span>
                <span style={{ color: mutedCol, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
            </div>

            {open && (
                <div style={{ padding: 14, background: cardBg, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: mutedCol, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                            Score Composition
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: mutedCol, width: 115, flexShrink: 0 }}>Topology (max 70)</span>
                                <MiniBar value={topoScore} max={70} color="#6c63ff" />
                                <span style={{ fontSize: 12, fontWeight: 700, color: textCol, width: 36, textAlign: 'right' }}>
                                    {topoScore}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: mutedCol, width: 115, flexShrink: 0 }}>Value Accuracy (max 30)</span>
                                <MiniBar value={valueScore} max={30} color="#22c55e" />
                                <span style={{ fontSize: 12, fontWeight: 700, color: textCol, width: 36, textAlign: 'right' }}>
                                    {valueScore}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, background: accentBg, padding: '8px 10px', borderRadius: 8, textAlign: 'center', border: isDark ? '1px solid rgba(108,99,255,0.2)' : '1px solid #ddd6fe' }}>
                            <div style={{ fontSize: 11, color: mutedCol }}>ML Confidence</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? '#a78bfa' : '#7c3aed' }}>{(confidence * 100).toFixed(1)}%</div>
                        </div>
                        <div style={{ flex: 1, background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', padding: '8px 10px', borderRadius: 8, textAlign: 'center', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 11, color: mutedCol }}>Architecture</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: textCol, marginTop: 2 }}>{mi.architecture || '256→128→64→32'}</div>
                        </div>
                    </div>

                    {Object.keys(classProbabilities).length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: mutedCol, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                Verdict Probability Distribution
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {[
                                    { key: 'correct',           label: '✅ Correct',           color: '#22c55e' },
                                    { key: 'partially_correct', label: '⚠️ Partially Correct', color: '#f59e0b' },
                                    { key: 'incorrect',         label: '❌ Incorrect',          color: '#ef4444' },
                                ].map(({ key, label, color }) => (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, color: mutedCol, width: 130, flexShrink: 0 }}>{label}</span>
                                        <MiniBar value={classProbabilities[key] ?? 0} max={1} color={color} />
                                        <span style={{ fontSize: 11, fontWeight: 700, color, width: 40, textAlign: 'right' }}>
                                            {((classProbabilities[key] ?? 0) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function EvaluationPanel({ evaluation, onHighlightComp, question = {}, submission = {} }) {
    const { theme: t } = useTheme();
    if (!evaluation) return null;

    const {
        score, verdict, summary,
        issues_found = [],
        feedback_for_student,
        concepts_to_review = [],
        sim_result,
        ml_confidence
    } = evaluation;

    const vMeta = VERDICT_META[verdict] || VERDICT_META.incorrect;
    const isDark = t?.isDark ?? false;

    const cardBg    = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
    const border    = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0';
    const textCol   = isDark ? '#e2e8f0' : '#1e293b';
    const mutedCol  = isDark ? '#94a3b8' : '#64748b';

    return (
        <div style={{ background: 'transparent', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Export Report Action Bar ──────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10 }}>
                <button
                    onClick={() => {
                        const svgEl = document.querySelector('svg');
                        const studentName = submission.student_id?.name || localStorage.getItem('userName') || localStorage.getItem('name') || 'Student';
                        const studentId = submission.student_id?.rollno || submission.student_id?._id || localStorage.getItem('studentId') || 'N/A';
                        const studentDepartment = submission.student_id?.department || localStorage.getItem('department') || localStorage.getItem('userDept') || localStorage.getItem('dept') || 'ECE';
                        exportCircuitReportPDF({
                            question,
                            submission,
                            evaluation,
                            studentName,
                            studentId,
                            studentDepartment,
                            examTitle: question.title || 'Circuit Assessment',
                            schematicSvgRef: svgEl
                        });
                    }}
                    style={{
                        flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #6c63ff 0%, #4b44cc 100%)', color: '#fff',
                        fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
                        boxShadow: '0 4px 14px rgba(108, 99, 255, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                >
                    📄 Export Engineering PDF
                </button>
                <button
                    onClick={() => {
                        const svgEl = document.querySelector('svg');
                        exportSchematicPNG(svgEl, 'Circuit_Schematic');
                    }}
                    style={{
                        padding: '10px 14px', borderRadius: 10,
                        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1', cursor: 'pointer',
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                        color: textCol, fontSize: 12, fontWeight: 600, fontFamily: 'Outfit, sans-serif',
                        display: 'flex', alignItems: 'center', gap: 6
                    }}
                >
                    🖼️ Download PNG
                </button>
            </div>

            {/* Score + Verdict ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: cardBg, border, borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <ScoreRing score={score} />
                    <div style={{ color: mutedCol, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: vMeta.bg, border: `1px solid ${vMeta.color}44`, color: vMeta.color,
                        alignSelf: 'flex-start'
                    }}>
                        <span>{vMeta.icon}</span>
                        <span>{vMeta.label}</span>
                        {sim_result?.ee_grade && (
                            <span style={{ marginLeft: 6, padding: '1px 6px', background: '#6c63ff', color: '#fff', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                                Grade {sim_result.ee_grade}
                            </span>
                        )}
                    </div>
                    <p style={{ color: textCol, fontSize: 12, lineHeight: 1.5, margin: 0 }}>{summary}</p>
                    {ml_confidence != null && (
                        <div style={{ fontSize: 11, color: mutedCol }}>
                            AI confidence: <strong style={{ color: isDark ? '#a78bfa' : '#6d28d9' }}>{(ml_confidence * 100).toFixed(1)}%</strong>
                            {' · '}Engine: <strong style={{ color: isDark ? '#a78bfa' : '#6d28d9' }}>SPICE + Neural Net</strong>
                        </div>
                    )}
                </div>
            </div>

            {/* Basic SPICE Simulation Summary Box ──────────────────────────────── */}
            {sim_result && sim_result.status === 'success' && (
                <div style={{
                    background: isDark ? 'rgba(56,189,248,0.06)' : '#f0f9ff',
                    border: isDark ? '1px solid rgba(56,189,248,0.2)' : '1px solid #bae6fd',
                    borderRadius: 10, padding: '12px 14px'
                }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? '#38bdf8' : '#0284c7', marginBottom: 10 }}>
                        📊 SPICE Circuit Parameters
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {sim_result.measured_gain != null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: mutedCol, fontSize: 12 }}>Measured Gain</span>
                                <span style={{ color: textCol, fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{sim_result.measured_gain?.toFixed(4)}</span>
                            </div>
                        )}
                        {sim_result.output_voltage != null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: mutedCol, fontSize: 12 }}>Output Voltage</span>
                                <span style={{ color: textCol, fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{sim_result.output_voltage?.toFixed(4)} V</span>
                            </div>
                        )}
                        {sim_result.bandwidth_hz != null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: mutedCol, fontSize: 12 }}>3dB Bandwidth</span>
                                <span style={{ color: textCol, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                                    {sim_result.bandwidth_hz >= 1000 ? `${(sim_result.bandwidth_hz/1000).toFixed(1)} kHz` : `${sim_result.bandwidth_hz} Hz`}
                                </span>
                            </div>
                        )}
                        {sim_result.i_in_ma != null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: mutedCol, fontSize: 12 }}>Input Current (Iin)</span>
                                <span style={{ color: textCol, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{sim_result.i_in_ma} mA</span>
                            </div>
                        )}
                        {sim_result.resonant_frequency != null && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: mutedCol, fontSize: 12 }}>Resonant Frequency</span>
                                <span style={{ color: textCol, fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{sim_result.resonant_frequency?.toFixed(2)} Hz</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 📈 AC Frequency Response (Bode Plot) ────────────────────────── */}
            {sim_result?.bode_plot && (
                <BodePlotChart bodeData={sim_result.bode_plot} isDark={isDark} />
            )}

            {/* 🌊 Oscilloscope Time-Domain Waveform Preview ───────────────── */}
            {sim_result?.waveform && (
                <OscilloscopeWaveform waveform={sim_result.waveform} isDark={isDark} />
            )}

            {/* ⚡ Component Power & Thermal Dissipation Audit ───────────── */}
            {sim_result?.power_breakdown && (
                <ThermalPowerAudit breakdown={sim_result.power_breakdown} warnings={sim_result.thermal_warnings} isDark={isDark} />
            )}

            {/* Issues ───────────────────────────────────────────────────────── */}
            {issues_found.length > 0 && (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: textCol, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        ⚠️ Issues Found
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {issues_found.map((issue, i) => {
                            const meta = ISSUE_META[issue.type] || { icon: '•', color: '#94a3b8' };
                            return (
                                <div key={i} style={{
                                    background: cardBg, border,
                                    borderLeft: `4px solid ${meta.color}`,
                                    borderRadius: '0 8px 8px 0',
                                    padding: '10px 12px', cursor: issue.component_involved ? 'pointer' : 'default'
                                }}
                                     onClick={() => issue.component_involved && onHighlightComp?.(issue.component_involved)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14 }}>{meta.icon}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: meta.color }}>
                                            {issue.type.replace(/_/g, ' ')}
                                        </span>
                                        {issue.component_involved && (
                                            <span style={{
                                                background: isDark ? 'rgba(108,99,255,0.2)' : '#ede9fe',
                                                border: isDark ? '1px solid rgba(108,99,255,0.3)' : '1px solid #c4b5fd',
                                                borderRadius: 4, padding: '1px 6px',
                                                fontSize: 10, color: isDark ? '#a78bfa' : '#6d28d9', fontFamily: 'monospace'
                                            }}>
                                                {issue.component_involved}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ color: mutedCol, fontSize: 11, lineHeight: 1.5, margin: 0 }}>{issue.explanation}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Feedback ─────────────────────────────────────────────────────── */}
            {feedback_for_student && (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: textCol, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        💡 Engineering Feedback
                    </div>
                    <div style={{
                        background: isDark ? 'rgba(108,99,255,0.06)' : '#f5f3ff',
                        border: isDark ? '1px solid rgba(108,99,255,0.2)' : '1px solid #ddd6fe',
                        borderRadius: 10, padding: '12px 14px'
                    }}>
                        <p style={{ color: textCol, fontSize: 12, lineHeight: 1.7, margin: 0 }}>{feedback_for_student}</p>
                    </div>
                </div>
            )}

            {/* Concepts ─────────────────────────────────────────────────────── */}
            {concepts_to_review.length > 0 && (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: textCol, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        📚 Review Electrical Concepts
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {concepts_to_review.map((c, i) => (
                            <span key={i} style={{
                                background: isDark ? 'rgba(56,189,248,0.1)' : '#e0f2fe',
                                border: isDark ? '1px solid rgba(56,189,248,0.25)' : '1px solid #7dd3fc',
                                borderRadius: 20, padding: '3px 10px',
                                fontSize: 11, color: isDark ? '#7dd3fc' : '#0369a1', fontWeight: 500
                            }}>{c}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Reasoning Breakdown ───────────────────────────────────────── */}
            <AIReasoningSection evaluation={evaluation} isDark={isDark} />

            {/* 🤖 3-Model Ensemble Consensus ────────────────────────────────── */}
            {evaluation.model_votes && (
                <ModelConsensusCard
                    votes={evaluation.model_votes}
                    disagreement={evaluation.disagreement_flag}
                    confidence={evaluation.ml_confidence}
                    isDark={isDark}
                />
            )}

            {/* 🔍 SHAP Explainable AI Feature Attribution ──────────────────── */}
            {evaluation.shap_explanation && (
                <ShapBreakdown shapData={evaluation.shap_explanation} isDark={isDark} />
            )}

            {/* 🎙️ Tailored Viva Questions ───────────────────────────────────── */}
            {evaluation.viva_questions && evaluation.viva_questions.length > 0 && (
                <VivaQuestionsCard questions={evaluation.viva_questions} isDark={isDark} />
            )}

            {/* 🏆 Design Grade ─────────────────────────────────────────────── */}
            {evaluation.design_analysis && (
                <DesignGradeCard designAnalysis={evaluation.design_analysis} isDark={isDark} />
            )}

            {/* 🔀 Signal Path ──────────────────────────────────────────────── */}
            {evaluation.design_analysis?.signal_path_description && (
                <SignalPathSection signalPath={evaluation.design_analysis.signal_path_description} isDark={isDark} />
            )}

            {/* 🔩 Component Analysis ───────────────────────────────────────── */}
            {evaluation.design_analysis?.component_analysis?.length > 0 && (
                <ComponentAnalysisTable componentAnalysis={evaluation.design_analysis.component_analysis} isDark={isDark} />
            )}

            {/* 💡 Improvement Suggestions ──────────────────────────────────── */}
            {evaluation.design_analysis?.improvement_suggestions?.length > 0 && (
                <ImprovementSuggestions suggestions={evaluation.design_analysis.improvement_suggestions} isDark={isDark} />
            )}

            {/* 🌐 Real-World Applications ──────────────────────────────────── */}
            {evaluation.design_analysis?.real_world_applications?.length > 0 && (
                <RealWorldApplications apps={evaluation.design_analysis.real_world_applications} isDark={isDark} />
            )}

        </div>
    );
}
