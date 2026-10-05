import React from 'react';

/**
 * ShapBreakdown.jsx
 * Displays local SHAP feature importance breakdown (explainable AI)
 * showing students and instructors exactly why the AI assigned this score.
 */
export default function ShapBreakdown({ shapData, isDark }) {
    if (!shapData || (!shapData.top_positive?.length && !shapData.top_negative?.length)) {
        return null;
    }

    const { top_positive = [], top_negative = [], base_score = 50, engine } = shapData;

    const bgCard = isDark ? '#161b22' : '#ffffff';
    const border = isDark ? '#30363d' : '#e2e8f0';
    const textPrimary = isDark ? '#f0f6fc' : '#1e293b';
    const textSecondary = isDark ? '#8b949e' : '#64748b';

    return (
        <div style={{
            background: bgCard,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.05)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}></span>
                    <div>
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textPrimary }}>
                            AI Decision Explainability (SHAP Breakdown)
                        </h4>
                        <span style={{ fontSize: 11, color: textSecondary }}>
                            Local TreeExplainer · Base Score: {base_score} pts
                        </span>
                    </div>
                </div>
                {engine && (
                    <span style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: isDark ? '#21262d' : '#f1f5f9',
                        color: textSecondary,
                        fontWeight: 600
                    }}>
                        100% Local AI
                    </span>
                )}
            </div>

            {/* Positive contributors */}
            {top_positive.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>▲</span> Score Boosters (Correct Design Choices)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {top_positive.map((item, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.05)',
                                borderLeft: '3px solid #22c55e',
                                padding: '6px 10px',
                                borderRadius: '0 6px 6px 0',
                                fontSize: 12
                            }}>
                                <span style={{ color: textPrimary, fontWeight: 500 }}>{item.label}</span>
                                <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>
                                    +{item.shap_value.toFixed(1)} pts
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Negative contributors */}
            {top_negative.length > 0 && (
                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>▼</span> Score Penalties (Issues & Mistakes)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {top_negative.map((item, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
                                borderLeft: '3px solid #ef4444',
                                padding: '6px 10px',
                                borderRadius: '0 6px 6px 0',
                                fontSize: 12
                            }}>
                                <span style={{ color: textPrimary, fontWeight: 500 }}>{item.label}</span>
                                <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>
                                    {item.shap_value.toFixed(1)} pts
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
